/**
 * Lodhi AI — Production Cloud Relay & WebSocket Server
 * Enables end-to-end authenticated communication between Android Companion
 * and Windows Desktop AI instances across arbitrary internet connections (NAT/firewall traversal).
 */

import http from 'http';
import { URL } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { globalCloudRelay, RelayMessage, RelayDeviceType } from './relay';
import { verifyAnyToken } from './auth';
import { JWTPayload } from './types';

export interface RelayServerOptions {
  port?: number;
  jwtSecret?: string;
  host?: string;
}

export interface RelayServerInstance {
  server: http.Server;
  wss: WebSocketServer;
  port: number;
  close: () => Promise<void>;
}

export class ProductionRelayServer {
  private server: http.Server;
  private wss: WebSocketServer;
  private jwtSecret: string;
  private deviceSockets = new Map<string, WebSocket>();
  private messageDeduplication = new Set<string>();
  private deviceMessageTimestamps = new Map<string, number[]>();
  private totalMessagesRouted = 0;

  constructor(options: RelayServerOptions = {}) {
    this.jwtSecret = options.jwtSecret || process.env.LODHI_JWT_SECRET || 'lodhi-ai-secure-cloud-jwt-secret-key-32bytes';

    this.server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocketServer({ server: this.server });
    this.setupWebSocketServer();
  }

  /**
   * Handle standard HTTP REST & Healthcheck Requests
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method?.toUpperCase();

    // CORS Headers for secure web & mobile clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-device-id, x-device-type, x-device-name');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Healthcheck endpoint (no secrets disclosed)
    if (method === 'GET' && pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'lodhi-cloud-relay',
        version: '1.0.0',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: Date.now(),
      }));
      return;
    }

    // Readiness endpoint
    if (method === 'GET' && pathname === '/ready') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ready',
        activeSockets: this.deviceSockets.size,
        timestamp: Date.now(),
      }));
      return;
    }

    // Service metrics (anonymized aggregates)
    if (method === 'GET' && pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeConnections: this.deviceSockets.size,
        totalMessagesRouted: this.totalMessagesRouted,
        timestamp: Date.now(),
      }));
      return;
    }

    // REST: Generate Pairing Challenge (called by authenticated Windows Desktop)
    if (method === 'POST' && pathname === '/api/v1/relay/pairing/challenge') {
      this.readJsonBody(req, (err, body) => {
        if (err || !body) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON request body' }));
          return;
        }

        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (body.token as string);
        if (!token) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing authentication token' }));
          return;
        }

        try {
          const payload: JWTPayload = verifyAnyToken(token, this.jwtSecret);
          const challenge = globalCloudRelay.createPairingChallenge({
            tenantId: payload.tenantId,
            userId: payload.sub,
            expiresInSeconds: body.expiresInSeconds || 300,
          });

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            challengeId: challenge.challengeId,
            pin: challenge.pin,
            qrPayload: challenge.qrPayload,
            expiresAt: challenge.expiresAt,
          }));
        } catch (authErr) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: (authErr as Error).message }));
        }
      });
      return;
    }

    // REST: Redeem Pairing Challenge (called by Android Companion)
    if (method === 'POST' && pathname === '/api/v1/relay/pairing/redeem') {
      this.readJsonBody(req, (err, body) => {
        if (err || !body || !body.challengeId || !body.submittedPin) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing challengeId or submittedPin' }));
          return;
        }

        const result = globalCloudRelay.redeemPairingChallenge({
          challengeId: body.challengeId,
          submittedPin: body.submittedPin,
          androidDeviceId: body.androidDeviceId || 'android_unknown',
          androidDeviceName: body.androidDeviceName || 'Android Companion',
        });

        if (result.success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, tenantId: result.tenantId }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: result.error }));
        }
      });
      return;
    }

    // REST: Device Status
    const statusMatch = pathname.match(/^\/api\/v1\/relay\/devices\/([^/]+)\/status$/);
    if (method === 'GET' && statusMatch) {
      const deviceId = statusMatch[1];
      const status = globalCloudRelay.getDeviceStatus(deviceId);
      const isSocketActive = this.deviceSockets.has(deviceId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        deviceId,
        online: status.online && isSocketActive,
        connection: status.connection,
      }));
      return;
    }

    // REST: Device Revocation
    const revokeMatch = pathname.match(/^\/api\/v1\/relay\/devices\/([^/]+)\/revoke$/);
    if (method === 'POST' && revokeMatch) {
      const deviceId = revokeMatch[1];
      globalCloudRelay.revokeDevice(deviceId);

      // Force terminate active WebSocket connection immediately
      const socket = this.deviceSockets.get(deviceId);
      if (socket) {
        socket.close(1008, 'Device revoked by user action');
        this.deviceSockets.delete(deviceId);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Device ${deviceId} revoked` }));
      return;
    }

    // 404 Not Found default
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }

  /**
   * Configure WebSocket Server with Authentication, Replay Defense, Rate Limits & Routing
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      
      // Extract credentials from query parameters or HTTP headers
      const token = parsedUrl.searchParams.get('token') || 
        (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
      const deviceId = parsedUrl.searchParams.get('deviceId') || (req.headers['x-device-id'] as string);
      const deviceType = (parsedUrl.searchParams.get('deviceType') || req.headers['x-device-type']) as RelayDeviceType;
      const deviceName = parsedUrl.searchParams.get('deviceName') || (req.headers['x-device-name'] as string) || 'Lodhi Device';

      if (!token || !deviceId || !deviceType) {
        ws.send(JSON.stringify({ type: 'error', error: 'Authentication failed: missing token, deviceId, or deviceType' }));
        ws.close(1008, 'Authentication credentials required');
        return;
      }

      // Verify JWT and register connection in globalCloudRelay
      const reg = globalCloudRelay.registerConnection({
        token,
        jwtSecret: this.jwtSecret,
        deviceId,
        deviceType,
        deviceName,
      });

      if (!reg.success || !reg.connection) {
        ws.send(JSON.stringify({ type: 'error', error: reg.error || 'Connection rejected' }));
        ws.close(1008, reg.error || 'Connection rejected');
        return;
      }

      const tenantId = reg.connection.tenantId;
      this.deviceSockets.set(deviceId, ws);

      // Acknowledge connection
      ws.send(JSON.stringify({
        type: 'connection_ack',
        deviceId,
        tenantId,
        connectedAt: Date.now(),
      }));

      // Incoming message handling
      ws.on('message', (raw: any) => {
        this.handleIncomingSocketMessage(ws, deviceId, tenantId, raw);
      });

      ws.on('close', () => {
        this.deviceSockets.delete(deviceId);
        globalCloudRelay.disconnectDevice(deviceId);
      });

      ws.on('error', () => {
        this.deviceSockets.delete(deviceId);
        globalCloudRelay.disconnectDevice(deviceId);
      });
    });
  }

  /**
   * Process and route WebSocket messages with security defenses
   */
  private handleIncomingSocketMessage(
    ws: WebSocket,
    sourceDeviceId: string,
    sourceTenantId: string,
    rawMessage: any
  ): void {
    let message: RelayMessage;
    try {
      const text = rawMessage.toString();
      message = JSON.parse(text);
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'Malformed JSON payload' }));
      return;
    }

    // 1. Schema Validation
    if (!message.id || !message.type || !message.targetDeviceId || !message.timestamp) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid message schema: missing required fields' }));
      return;
    }

    // 2. Replay Protection: Check message freshness and deduplication
    const now = Date.now();
    const timeDelta = Math.abs(now - message.timestamp);
    if (timeDelta > 300000) { // 5 minutes tolerance
      ws.send(JSON.stringify({ type: 'error', error: 'Message rejected: timestamp skew exceeds 5 minutes' }));
      return;
    }

    if (this.messageDeduplication.has(message.id)) {
      ws.send(JSON.stringify({ type: 'error', error: `Replay detected: duplicate messageId ${message.id}` }));
      return;
    }
    this.messageDeduplication.add(message.id);
    if (this.messageDeduplication.size > 10000) {
      // Periodic pruning of old deduplication IDs
      const iterator = this.messageDeduplication.values();
      for (let i = 0; i < 2000; i++) {
        const item = iterator.next();
        if (item.done) break;
        this.messageDeduplication.delete(item.value);
      }
    }

    // 3. Sliding Window Rate Limiting (60 messages per minute per device)
    const timestamps = this.deviceMessageTimestamps.get(sourceDeviceId) || [];
    const oneMinuteAgo = now - 60000;
    const recent = timestamps.filter(t => t > oneMinuteAgo);
    if (recent.length >= 60) {
      ws.send(JSON.stringify({ type: 'error', error: 'Rate limit exceeded: maximum 60 messages/minute' }));
      return;
    }
    recent.push(now);
    this.deviceMessageTimestamps.set(sourceDeviceId, recent);

    // 4. Force authentic tenantId and sourceDeviceId from authenticated session
    message.sourceDeviceId = sourceDeviceId;
    message.tenantId = sourceTenantId;

    // Handle heartbeats
    if (message.type === 'heartbeat') {
      ws.send(JSON.stringify({ type: 'heartbeat_ack', timestamp: Date.now() }));
      return;
    }

    // 5. Route through CloudRelayService
    const routingResult = globalCloudRelay.routeMessage(message);

    if (routingResult.delivered) {
      const targetSocket = this.deviceSockets.get(message.targetDeviceId);
      if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
        targetSocket.send(JSON.stringify(message));
        this.totalMessagesRouted++;
        ws.send(JSON.stringify({ type: 'delivery_ack', messageId: message.id, delivered: true }));
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          messageId: message.id,
          error: 'Target device socket dropped unexpectedly',
        }));
      }
    } else if (routingResult.queued) {
      ws.send(JSON.stringify({ type: 'delivery_ack', messageId: message.id, delivered: false, queued: true }));
    } else {
      ws.send(JSON.stringify({
        type: 'error',
        messageId: message.id,
        error: routingResult.error || 'Message routing failed',
      }));
    }
  }

  private readJsonBody(req: http.IncomingMessage, callback: (err: Error | null, body: any) => void): void {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1048576) { // 1MB payload limit
        req.destroy();
        callback(new Error('Payload too large'), null);
      }
    });
    req.on('end', () => {
      if (!data) {
        callback(null, {});
        return;
      }
      try {
        const parsed = JSON.parse(data);
        callback(null, parsed);
      } catch (err) {
        callback(err as Error, null);
      }
    });
  }

  /**
   * Start listening on port
   */
  public async listen(port: number = 0, host: string = '127.0.0.1'): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, host, () => {
        const address = this.server.address();
        if (address && typeof address === 'object') {
          resolve(address.port);
        } else {
          resolve(port);
        }
      });
      this.server.on('error', reject);
    });
  }

  /**
   * Graceful shutdown of HTTP & WebSocket Server
   */
  public async close(): Promise<void> {
    return new Promise((resolve) => {
      for (const socket of this.deviceSockets.values()) {
        try {
          socket.close(1000, 'Server shutdown');
        } catch {}
      }
      this.deviceSockets.clear();

      this.wss.close(() => {
        this.server.close(() => {
          resolve();
        });
      });
    });
  }
}

/**
 * Convenience helper to start a relay server instance
 */
export async function startRelayServer(options: RelayServerOptions = {}): Promise<RelayServerInstance> {
  const server = new ProductionRelayServer(options);
  const port = await server.listen(options.port || 0, options.host || '127.0.0.1');
  return {
    server: (server as any).server,
    wss: (server as any).wss,
    port,
    close: () => server.close(),
  };
}
