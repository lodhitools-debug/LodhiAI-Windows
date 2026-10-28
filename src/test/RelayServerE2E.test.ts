import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { startRelayServer, RelayServerInstance } from '../server/relayServer';
import { signJWT } from '../server/auth';
import { RelayMessage } from '../server/relay';

describe('Phase 15 — Live Production Relay Server & WebSocket E2E Test Suite', () => {
  const TEST_JWT_SECRET = 'super-secret-e2e-relay-jwt-key-32bytes!';
  let serverInstance: RelayServerInstance;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    // Start on ephemeral OS port
    serverInstance = await startRelayServer({
      port: 0,
      host: '127.0.0.1',
      jwtSecret: TEST_JWT_SECRET,
    });
    baseUrl = `http://127.0.0.1:${serverInstance.port}`;
    wsUrl = `ws://127.0.0.1:${serverInstance.port}`;
  });

  afterAll(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
  });

  describe('1. HTTP Endpoints: Health, Readiness & Metrics', () => {
    it('GET /health returns 200 with service status and zero leaked credentials', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('lodhi-cloud-relay');
      expect(data.version).toBe('1.0.0');
      expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);
      // Ensure no secrets leaked
      expect(data.jwtSecret).toBeUndefined();
      expect(data.token).toBeUndefined();
    });

    it('GET /ready returns 200 and reports active socket count', async () => {
      const res = await fetch(`${baseUrl}/ready`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ready');
      expect(data.activeSockets).toBeGreaterThanOrEqual(0);
    });

    it('GET /metrics returns aggregated traffic statistics', async () => {
      const res = await fetch(`${baseUrl}/metrics`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totalMessagesRouted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. Pairing Challenge & Redemption Flow', () => {
    let challengeId: string;
    let pin: string;

    it('POST /api/v1/relay/pairing/challenge issues a 6-digit challenge to authenticated user', async () => {
      const token = signJWT(
        { sub: 'user_e2e_1', tenantId: 'tenant_e2e_alpha', email: 'owner@alpha.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );

      const res = await fetch(`${baseUrl}/api/v1/relay/pairing/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ expiresInSeconds: 300 }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.pin).toHaveLength(6);
      expect(data.challengeId).toBeDefined();

      challengeId = data.challengeId;
      pin = data.pin;
    });

    it('POST /api/v1/relay/pairing/redeem rejects incorrect PIN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/relay/pairing/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          submittedPin: '999999',
          androidDeviceId: 'android_test_1',
          androidDeviceName: 'Pixel 8',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid pairing PIN');
    });

    it('POST /api/v1/relay/pairing/redeem successfully registers phone with correct PIN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/relay/pairing/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          submittedPin: pin,
          androidDeviceId: 'android_test_1',
          androidDeviceName: 'Pixel 8',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.tenantId).toBe('tenant_e2e_alpha');
    });
  });

  describe('3. WebSocket Authentication & Replay Protection', () => {
    it('rejects WebSocket connection with unauthenticated/tampered token', async () => {
      const ws = new WebSocket(
        `${wsUrl}?token=tampered.token.here&deviceId=fake_dev&deviceType=windows_desktop&deviceName=Hacker`
      );

      const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
        ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      });

      expect(closeEvent.code).toBe(1008); // Policy Violation
    });

    it('authenticates and establishes real-time bi-directional sockets for Desktop and Mobile', async () => {
      const token = signJWT(
        { sub: 'user_e2e_1', tenantId: 'tenant_e2e_alpha', email: 'owner@alpha.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );

      // 1. Connect Windows Desktop
      const desktopWs = new WebSocket(
        `${wsUrl}?token=${token}&deviceId=win_workstation&deviceType=windows_desktop&deviceName=Lodhi-Desktop-11`
      );

      const desktopAck = await new Promise<any>((resolve) => {
        desktopWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'connection_ack') resolve(msg);
        });
      });

      expect(desktopAck.type).toBe('connection_ack');
      expect(desktopAck.deviceId).toBe('win_workstation');
      expect(desktopAck.tenantId).toBe('tenant_e2e_alpha');

      // 2. Connect Android Companion
      const androidWs = new WebSocket(
        `${wsUrl}?token=${token}&deviceId=android_phone_1&deviceType=android_companion&deviceName=Samsung-S24`
      );

      const androidAck = await new Promise<any>((resolve) => {
        androidWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'connection_ack') resolve(msg);
        });
      });

      expect(androidAck.type).toBe('connection_ack');
      expect(androidAck.deviceId).toBe('android_phone_1');

      // 3. Android sends chat_prompt to Windows desktop
      const chatPrompt: RelayMessage = {
        id: `msg_prompt_${Date.now()}`,
        sourceDeviceId: 'android_phone_1',
        targetDeviceId: 'win_workstation',
        tenantId: 'tenant_e2e_alpha',
        type: 'chat_prompt',
        payload: { prompt: 'How does memory safety work in Rust?' },
        timestamp: Date.now(),
      };

      const desktopReceivedPromise = new Promise<RelayMessage>((resolve) => {
        desktopWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'chat_prompt') resolve(msg);
        });
      });

      androidWs.send(JSON.stringify(chatPrompt));
      const receivedOnDesktop = await desktopReceivedPromise;

      expect(receivedOnDesktop.id).toBe(chatPrompt.id);
      expect((receivedOnDesktop.payload as any).prompt).toBe('How does memory safety work in Rust?');

      // 4. Desktop replies with chat_chunk
      const replyChunk: RelayMessage = {
        id: `msg_chunk_${Date.now()}`,
        sourceDeviceId: 'win_workstation',
        targetDeviceId: 'android_phone_1',
        tenantId: 'tenant_e2e_alpha',
        type: 'chat_chunk',
        payload: { chunk: 'Rust ensures memory safety via ownership.' },
        timestamp: Date.now(),
      };

      const androidReceivedPromise = new Promise<RelayMessage>((resolve) => {
        androidWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'chat_chunk') resolve(msg);
        });
      });

      desktopWs.send(JSON.stringify(replyChunk));
      const receivedOnMobile = await androidReceivedPromise;

      expect((receivedOnMobile.payload as any).chunk).toBe('Rust ensures memory safety via ownership.');

      // 5. Cleanup sockets
      desktopWs.close();
      androidWs.close();
    });

    it('rejects malformed JSON and enforces replay attack protection', async () => {
      const token = signJWT(
        { sub: 'user_e2e_1', tenantId: 'tenant_e2e_alpha', email: 'owner@alpha.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );

      const clientWs = new WebSocket(
        `${wsUrl}?token=${token}&deviceId=client_replay_test&deviceType=android_companion&deviceName=Phone`
      );

      await new Promise<void>((resolve) => {
        clientWs.on('open', () => resolve());
      });

      // 1. Send malformed non-JSON string
      const malformedErrorPromise = new Promise<any>((resolve) => {
        clientWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'error' && msg.error.includes('Malformed JSON')) resolve(msg);
        });
      });
      clientWs.send('THIS IS NOT JSON!');
      const malformedRes = await malformedErrorPromise;
      expect(malformedRes.error).toBe('Malformed JSON payload');

      // 2. Send message with duplicate ID (replay attack)
      const testMsgId = 'unique_replay_id_123';
      const validMsg: RelayMessage = {
        id: testMsgId,
        sourceDeviceId: 'client_replay_test',
        targetDeviceId: 'target_dev',
        tenantId: 'tenant_e2e_alpha',
        type: 'heartbeat',
        payload: {},
        timestamp: Date.now(),
      };

      // First send -> handled
      clientWs.send(JSON.stringify(validMsg));

      // Second send with same ID -> replay error
      const replayErrorPromise = new Promise<any>((resolve) => {
        clientWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'error' && msg.error.includes('Replay detected')) resolve(msg);
        });
      });

      clientWs.send(JSON.stringify(validMsg));
      const replayRes = await replayErrorPromise;
      expect(replayRes.error).toContain('Replay detected');

      clientWs.close();
    });
  });

  describe('4. Device Revocation Immediate Socket Termination', () => {
    it('terminates active WebSocket immediately upon device revocation API call', async () => {
      const token = signJWT(
        { sub: 'user_e2e_1', tenantId: 'tenant_e2e_alpha', email: 'owner@alpha.com', role: 'admin', plan: 'pro' },
        TEST_JWT_SECRET,
        900
      );

      const targetDeviceId = 'compromised_android_device';
      const ws = new WebSocket(
        `${wsUrl}?token=${token}&deviceId=${targetDeviceId}&deviceType=android_companion&deviceName=LostPhone`
      );

      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve());
      });

      // Confirm device is online
      const statusRes = await fetch(`${baseUrl}/api/v1/relay/devices/${targetDeviceId}/status`);
      const statusData = await statusRes.json();
      expect(statusData.online).toBe(true);

      // Desktop user revokes the device via REST API
      const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
        ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      });

      const revokeRes = await fetch(`${baseUrl}/api/v1/relay/devices/${targetDeviceId}/revoke`, {
        method: 'POST',
      });
      expect(revokeRes.status).toBe(200);

      // Verify WebSocket was severed with policy violation code
      const closeEvent = await closePromise;
      expect(closeEvent.code).toBe(1008);
      expect(closeEvent.reason).toContain('revoked');

      // Verify device status is now offline
      const statusAfter = await fetch(`${baseUrl}/api/v1/relay/devices/${targetDeviceId}/status`);
      const statusAfterData = await statusAfter.json();
      expect(statusAfterData.online).toBe(false);
    });
  });
});
