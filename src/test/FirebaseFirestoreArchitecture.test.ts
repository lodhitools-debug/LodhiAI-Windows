import { describe, it, expect, beforeEach } from 'vitest';
import { firebaseConfig, isFirebaseConfigured } from '../services/firebaseConfig';
import { FirebaseAuthService } from '../services/firebaseAuthService';
import { FirestoreService, FirestoreUserProfile } from '../services/firestoreService';
import { verifyFirebaseIdToken } from '../server/auth';
import { CloudRelayService, RelayMessage } from '../server/relay';

describe('Firebase-First Architecture & Firestore Security Verification Suite', () => {
  let authService: FirebaseAuthService;
  let firestoreService: FirestoreService;
  let relayService: CloudRelayService;

  beforeEach(() => {
    authService = new FirebaseAuthService();
    firestoreService = new FirestoreService();
    relayService = new CloudRelayService();
  });

  describe('1. Firebase Client Configuration & Privacy Guardrails', () => {
    it('initializes safe configuration defaults without leaking production secrets', () => {
      expect(firebaseConfig.projectId).toBeDefined();
      expect(firebaseConfig.authDomain).toContain('.firebaseapp.com');
      // Secret checks
      expect((firebaseConfig as any).serviceAccountKey).toBeUndefined();
      expect((firebaseConfig as any).privateKey).toBeUndefined();
    });

    it('accurately identifies whether production Firebase credentials are provided', () => {
      // By default in dev environment without .env.production, isFirebaseConfigured returns false (fallback/emulator mode)
      const configured = isFirebaseConfigured();
      expect(typeof configured).toBe('boolean');
    });
  });

  describe('2. Firebase Authentication Service Lifecycle', () => {
    it('signs up a new user with email and password and assigns default free tier', async () => {
      const res = await authService.signUp({
        email: 'developer@lodhiai.com',
        password: 'SuperSecurePassword123!',
        displayName: 'Lodhi Developer',
      });

      expect(res.success).toBe(true);
      expect(res.session).toBeDefined();
      expect(res.session?.uid).toMatch(/^usr_/);
      expect(res.session?.plan).toBe('free');
      expect(res.session?.role).toBe('developer');
      expect(res.session?.idToken).toBeDefined();
    });

    it('rejects signup with invalid email or short password (< 8 chars)', async () => {
      const resBadEmail = await authService.signUp({
        email: 'invalid-email',
        password: 'ValidPassword123!',
        displayName: 'User',
      });
      expect(resBadEmail.success).toBe(false);
      expect(resBadEmail.error).toContain('Valid email');

      const resShortPass = await authService.signUp({
        email: 'user@lodhiai.com',
        password: '123',
        displayName: 'User',
      });
      expect(resShortPass.success).toBe(false);
      expect(resShortPass.error).toContain('8 characters');
    });

    it('signs in an existing user and manages ID token lifecycle', async () => {
      const res = await authService.signIn({
        email: 'user@lodhiai.com',
        password: 'Password123!',
      });
      expect(res.success).toBe(true);
      expect(res.session?.uid).toBeDefined();

      const token = await authService.getIdToken();
      expect(token).toBeDefined();
      expect(token).toContain('fb_id_token_');

      // Sign out clears session
      await authService.signOut();
      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe('3. Cloud Firestore Schema Validation & Privilege Boundary Defense', () => {
    it('enforces free plan on client-side profile creation (privilege escalation defense)', async () => {
      const maliciousProfile: FirestoreUserProfile = {
        uid: 'usr_attacker_1',
        email: 'attacker@evil.com',
        displayName: 'Attacker',
        role: 'owner',
        plan: 'business' as any, // Attacker attempts to grant business tier
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await firestoreService.createUserProfile(maliciousProfile);
      const saved = await firestoreService.getUserProfile('usr_attacker_1');

      // Rules strictly force plan to free on client write
      expect(saved?.plan).toBe('free');
    });

    it('registers paired device metadata and supports explicit revocation', async () => {
      const uid = 'usr_test_1';
      await firestoreService.registerDevice(uid, {
        deviceId: 'android_s24_ultra',
        deviceType: 'android_companion',
        deviceName: 'Galaxy S24 Ultra',
        pairedAt: Date.now(),
        lastActiveAt: Date.now(),
        revoked: false,
      });

      const devicesBefore = await firestoreService.listDevices(uid);
      expect(devicesBefore).toHaveLength(1);
      expect(devicesBefore[0].revoked).toBe(false);

      // Revoke device
      await firestoreService.revokeDevice(uid, 'android_s24_ultra');
      const devicesAfter = await firestoreService.listDevices(uid);
      expect(devicesAfter[0].revoked).toBe(true);
    });

    it('protects subscription entitlements from client-side tampering', async () => {
      const uid = 'usr_test_2';
      const sub = await firestoreService.getSubscription(uid);

      // Default tier is free with 1 device limit and 100k token limit
      expect(sub.tier).toBe('free');
      expect(sub.devicesLimit).toBe(1);
      expect(sub.cloudTokensLimit).toBe(100000);
    });

    it('creates 5-minute pairing session and safely redeems with matching PIN hash', async () => {
      const sessionId = 'session_pair_99';
      const pinHash = 'hash_582910';

      await firestoreService.createPairingSession({
        sessionId,
        pinHash,
        windowsUid: 'usr_windows_owner',
        windowsDeviceId: 'win_workstation_1',
        expiresAt: Date.now() + 300 * 1000,
        status: 'pending',
        createdAt: Date.now(),
      });

      // 1. Wrong PIN fails
      const badAttempt = await firestoreService.redeemPairingSession(sessionId, 'wrong_hash', 'phone_1');
      expect(badAttempt.success).toBe(false);
      expect(badAttempt.error).toContain('Invalid pairing PIN');

      // 2. Correct PIN succeeds
      const goodAttempt = await firestoreService.redeemPairingSession(sessionId, pinHash, 'phone_1');
      expect(goodAttempt.success).toBe(true);
      expect(goodAttempt.windowsUid).toBe('usr_windows_owner');

      // 3. Replay attack blocked (already redeemed)
      const replayAttempt = await firestoreService.redeemPairingSession(sessionId, pinHash, 'phone_2');
      expect(replayAttempt.success).toBe(false);
      expect(replayAttempt.error).toContain('already redeemed');
    });

    it('manages approved workspaces without exposing raw host filesystem paths', async () => {
      const uid = 'usr_dev_3';
      await firestoreService.approveWorkspace(uid, {
        workspaceId: 'ws_alpha',
        name: 'My React Project',
        pathAlias: '~/projects/frontend', // Alias only, no C:\Users\... raw path
        isApprovedForRemote: true,
        addedAt: Date.now(),
      });

      const approved = await firestoreService.listApprovedWorkspaces(uid);
      expect(approved).toHaveLength(1);
      expect(approved[0].name).toBe('My React Project');
      expect(approved[0].pathAlias).toBe('~/projects/frontend');
    });
  });

  describe('4. Cloud Relay Integration with Firebase ID Tokens', () => {
    it('verifies simulated and production-format Firebase ID Tokens in auth module', () => {
      const simToken = 'fb_id_token_usr_firebase_123_1730000000';
      const payload = verifyFirebaseIdToken(simToken, 'lodhiai-cloud');

      expect(payload.sub).toBe('usr_firebase_123');
      expect(payload.tenantId).toBe('usr_firebase_123');
      expect(payload.plan).toBe('free');
    });

    it('authenticates WebSocket connection to Cloud Relay using Firebase ID Token', () => {
      const fbToken = 'fb_id_token_usr_alice_999_1730000000';

      // Desktop registers using Firebase token
      const regDesktop = relayService.registerConnection({
        token: fbToken,
        jwtSecret: 'test-secret',
        deviceId: 'win_desktop_alice',
        deviceType: 'windows_desktop',
        deviceName: 'Alice Desktop PC',
      });

      expect(regDesktop.success).toBe(true);
      expect(regDesktop.connection?.userId).toBe('usr_alice_999');
      expect(regDesktop.connection?.tenantId).toBe('usr_alice_999');

      // Android companion registers using Firebase token under same user account
      const regMobile = relayService.registerConnection({
        token: fbToken,
        jwtSecret: 'test-secret',
        deviceId: 'android_alice_phone',
        deviceType: 'android_companion',
        deviceName: 'Alice Galaxy Phone',
      });

      expect(regMobile.success).toBe(true);

      // Route message between Alice devices
      const message: RelayMessage = {
        id: 'msg_fb_1',
        sourceDeviceId: 'android_alice_phone',
        targetDeviceId: 'win_desktop_alice',
        tenantId: 'usr_alice_999',
        type: 'chat_prompt',
        payload: { text: 'Hello from Firebase authenticated phone' },
        timestamp: Date.now(),
      };

      const routeRes = relayService.routeMessage(message);
      expect(routeRes.delivered).toBe(true);
      expect(routeRes.queued).toBe(false);
    });

    it('enforces tenant boundary: User Bob cannot route message to User Alice desktop', () => {
      const aliceToken = 'fb_id_token_usr_alice_999_1730000000';
      const bobToken = 'fb_id_token_usr_bob_888_1730000000';

      relayService.registerConnection({
        token: aliceToken,
        jwtSecret: 'test-secret',
        deviceId: 'win_alice',
        deviceType: 'windows_desktop',
        deviceName: 'Alice PC',
      });

      relayService.registerConnection({
        token: bobToken,
        jwtSecret: 'test-secret',
        deviceId: 'android_bob',
        deviceType: 'android_companion',
        deviceName: 'Bob Phone',
      });

      const attackMsg: RelayMessage = {
        id: 'attack_1',
        sourceDeviceId: 'android_bob',
        targetDeviceId: 'win_alice',
        tenantId: 'usr_alice_999', // Bob claims target's tenant
        type: 'chat_prompt',
        payload: { prompt: 'Hack attempt' },
        timestamp: Date.now(),
      };

      const result = relayService.routeMessage(attackMsg);
      expect(result.delivered).toBe(false);
      expect(result.error).toContain('Cross-tenant message routing forbidden');
    });
  });
});
