import { describe, it, expect, beforeEach } from 'vitest';
import { CloudRelayService, RelayMessage } from '../server/relay';
import { signJWT } from '../server/auth';

describe('Phase 15 — Cloud Relay & Remote Access Test Suite', () => {
  const TEST_JWT_SECRET = 'super-secret-jwt-signing-key-for-tests-only-32bytes!';
  let relay: CloudRelayService;

  beforeEach(() => {
    relay = new CloudRelayService();
  });

  describe('1. Secure Pairing Challenge Lifecycle', () => {
    it('creates a 6-digit pairing challenge with 5-minute expiry', () => {
      const challenge = relay.createPairingChallenge({
        tenantId: 'tenant_alpha',
        userId: 'user_1',
        expiresInSeconds: 300,
      });

      expect(challenge.challengeId).toBeDefined();
      expect(challenge.pin.length).toBe(6);
      expect(challenge.expiresAt).toBeGreaterThan(Date.now());
      expect(challenge.redeemed).toBe(false);

      const parsedQR = JSON.parse(challenge.qrPayload);
      expect(parsedQR.pin).toBe(challenge.pin);
      expect(parsedQR.tenantId).toBe('tenant_alpha');
    });

    it('successfully redeems pairing challenge with matching PIN', () => {
      const challenge = relay.createPairingChallenge({
        tenantId: 'tenant_alpha',
        userId: 'user_1',
      });

      const res = relay.redeemPairingChallenge({
        challengeId: challenge.challengeId,
        submittedPin: challenge.pin,
        androidDeviceId: 'android_pixel_8',
        androidDeviceName: 'Pixel 8 Pro',
      });

      expect(res.success).toBe(true);
      expect(res.tenantId).toBe('tenant_alpha');
    });

    it('rejects pairing challenge with incorrect PIN', () => {
      const challenge = relay.createPairingChallenge({
        tenantId: 'tenant_alpha',
        userId: 'user_1',
      });

      const res = relay.redeemPairingChallenge({
        challengeId: challenge.challengeId,
        submittedPin: '000000',
        androidDeviceId: 'android_pixel_8',
        androidDeviceName: 'Pixel 8 Pro',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid pairing PIN');
    });

    it('rejects replay attack: cannot redeem challenge twice', () => {
      const challenge = relay.createPairingChallenge({
        tenantId: 'tenant_alpha',
        userId: 'user_1',
      });

      const res1 = relay.redeemPairingChallenge({
        challengeId: challenge.challengeId,
        submittedPin: challenge.pin,
        androidDeviceId: 'android_pixel_8',
        androidDeviceName: 'Pixel 8 Pro',
      });
      expect(res1.success).toBe(true);

      const res2 = relay.redeemPairingChallenge({
        challengeId: challenge.challengeId,
        submittedPin: challenge.pin,
        androidDeviceId: 'android_pixel_8_attacker',
        androidDeviceName: 'Attacker Phone',
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('not found or expired');
    });

    it('rejects expired pairing challenge', () => {
      // Expired 10 seconds ago
      const challenge = relay.createPairingChallenge({
        tenantId: 'tenant_alpha',
        userId: 'user_1',
        expiresInSeconds: -10,
      });

      const res = relay.redeemPairingChallenge({
        challengeId: challenge.challengeId,
        submittedPin: challenge.pin,
        androidDeviceId: 'android_phone',
        androidDeviceName: 'Phone',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('expired');
    });
  });

  describe('2. Device Connection & Status Registry', () => {
    it('registers authenticated Windows Desktop outbound connection', () => {
      const token = signJWT(
        { sub: 'user_1', tenantId: 'tenant_alpha', email: 'user@alpha.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );

      const reg = relay.registerConnection({
        token,
        jwtSecret: TEST_JWT_SECRET,
        deviceId: 'win_desktop_1',
        deviceType: 'windows_desktop',
        deviceName: 'Lodhi Workstation Win11',
      });

      expect(reg.success).toBe(true);
      expect(reg.connection?.deviceId).toBe('win_desktop_1');

      const status = relay.getDeviceStatus('win_desktop_1');
      expect(status.online).toBe(true);
      expect(status.connection?.deviceName).toBe('Lodhi Workstation Win11');
    });

    it('rejects connection registration with invalid JWT token', () => {
      const reg = relay.registerConnection({
        token: 'invalid.tampered.token',
        jwtSecret: TEST_JWT_SECRET,
        deviceId: 'win_desktop_2',
        deviceType: 'windows_desktop',
        deviceName: 'Hacked Win',
      });

      expect(reg.success).toBe(false);
      expect(reg.error).toBeDefined();
    });

    it('reports offline status for disconnected device', () => {
      const status = relay.getDeviceStatus('non_existent_device');
      expect(status.online).toBe(false);
    });
  });

  describe('3. Cross-Network Message Routing & Tenant Isolation', () => {
    it('routes message between paired devices in the same tenant', () => {
      const token = signJWT(
        { sub: 'user_1', tenantId: 'tenant_alpha', email: 'user@alpha.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );

      // Register Windows Desktop
      relay.registerConnection({
        token,
        jwtSecret: TEST_JWT_SECRET,
        deviceId: 'win_desktop_1',
        deviceType: 'windows_desktop',
        deviceName: 'Desktop Win11',
      });

      // Register Android Companion
      relay.registerConnection({
        token,
        jwtSecret: TEST_JWT_SECRET,
        deviceId: 'android_1',
        deviceType: 'android_companion',
        deviceName: 'Galaxy S24',
      });

      const message: RelayMessage = {
        id: 'msg_1',
        sourceDeviceId: 'android_1',
        targetDeviceId: 'win_desktop_1',
        tenantId: 'tenant_alpha',
        type: 'chat_prompt',
        payload: { prompt: 'Analyze workspace performance' },
        timestamp: Date.now(),
      };

      const result = relay.routeMessage(message);
      expect(result.delivered).toBe(true);
      expect(result.queued).toBe(false);
    });

    it('STRICTLY BLOCKS cross-tenant message routing (Tenant Beta targeting Tenant Alpha desktop)', () => {
      const tokenA = signJWT(
        { sub: 'user_a', tenantId: 'tenant_alpha', email: 'a@alpha.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );
      const tokenB = signJWT(
        { sub: 'user_b', tenantId: 'tenant_beta', email: 'b@beta.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );

      relay.registerConnection({
        token: tokenA,
        jwtSecret: TEST_JWT_SECRET,
        deviceId: 'win_desktop_alpha',
        deviceType: 'windows_desktop',
        deviceName: 'Alpha PC',
      });

      relay.registerConnection({
        token: tokenB,
        jwtSecret: TEST_JWT_SECRET,
        deviceId: 'android_beta',
        deviceType: 'android_companion',
        deviceName: 'Beta Phone',
      });

      const attackMessage: RelayMessage = {
        id: 'msg_hack_1',
        sourceDeviceId: 'android_beta',
        targetDeviceId: 'win_desktop_alpha',
        tenantId: 'tenant_alpha', // Attacker claims target tenant
        type: 'chat_prompt',
        payload: { prompt: 'Exfiltrate files' },
        timestamp: Date.now(),
      };

      const result = relay.routeMessage(attackMessage);
      expect(result.delivered).toBe(false);
      expect(result.error).toContain('Cross-tenant message routing forbidden');
    });

    it('refuses to queue dangerous tasks when target desktop is offline', () => {
      const token = signJWT(
        { sub: 'user_1', tenantId: 'tenant_alpha', email: 'user@alpha.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );

      relay.registerConnection({
        token,
        jwtSecret: TEST_JWT_SECRET,
        deviceId: 'android_1',
        deviceType: 'android_companion',
        deviceName: 'Galaxy S24',
      });

      // Target desktop is offline
      const sensitiveTaskMessage: RelayMessage = {
        id: 'task_msg_1',
        sourceDeviceId: 'android_1',
        targetDeviceId: 'offline_desktop',
        tenantId: 'tenant_alpha',
        type: 'task_submit',
        payload: { action: 'write_file', target: 'index.ts' },
        timestamp: Date.now(),
      };

      const result = relay.routeMessage(sensitiveTaskMessage);
      expect(result.delivered).toBe(false);
      expect(result.queued).toBe(false);
      expect(result.error).toContain('Target Windows desktop is offline');
    });
  });

  describe('4. Device Revocation Security', () => {
    it('revokes device authorization and disconnects active session immediately', () => {
      const token = signJWT(
        { sub: 'user_1', tenantId: 'tenant_alpha', email: 'user@alpha.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );

      relay.registerConnection({
        token,
        jwtSecret: TEST_JWT_SECRET,
        deviceId: 'stolen_phone',
        deviceType: 'android_companion',
        deviceName: 'Stolen Pixel',
      });

      expect(relay.getDeviceStatus('stolen_phone').online).toBe(true);

      // Desktop user revokes stolen phone
      relay.revokeDevice('stolen_phone');

      expect(relay.getDeviceStatus('stolen_phone').online).toBe(false);

      // Subsequent registration attempt fails
      const reattempt = relay.registerConnection({
        token,
        jwtSecret: TEST_JWT_SECRET,
        deviceId: 'stolen_phone',
        deviceType: 'android_companion',
        deviceName: 'Stolen Pixel',
      });

      expect(reattempt.success).toBe(false);
      expect(reattempt.error).toContain('explicitly revoked');
    });
  });
});
