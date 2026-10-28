/**
 * Lodhi AI — Cloud Relay & Remote Access Engine
 * Facilitates secure, authenticated communication between Android Companion devices
 * and Windows Desktop AI instances over the public internet without port forwarding.
 */

import crypto from 'crypto';
import { verifyAnyToken } from './auth';
import { JWTPayload } from './types';

export type RelayDeviceType = 'windows_desktop' | 'android_companion';

export interface RelayConnection {
  connectionId: string;
  deviceId: string;
  deviceType: RelayDeviceType;
  tenantId: string;
  userId: string;
  deviceName: string;
  connectedAt: number;
  lastPingAt: number;
  isAlive: boolean;
}

export type RelayMessageType =
  | 'heartbeat'
  | 'chat_prompt'
  | 'chat_chunk'
  | 'chat_complete'
  | 'task_submit'
  | 'task_progress'
  | 'approval_request'
  | 'approval_decision'
  | 'voice_transcript'
  | 'system_diagnostics_req'
  | 'system_diagnostics_res'
  | 'device_revoked'
  | 'error';

export interface RelayMessage<T = unknown> {
  id: string;
  correlationId?: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  tenantId: string;
  type: RelayMessageType;
  payload: T;
  timestamp: number;
  signature?: string;
}

export interface PairingChallenge {
  challengeId: string;
  tenantId: string;
  userId: string;
  pin: string;
  qrPayload: string;
  expiresAt: number;
  redeemed: boolean;
}

export class CloudRelayService {
  // Active connections indexed by deviceId
  private connections = new Map<string, RelayConnection>();
  // Active pairing challenges indexed by challengeId
  private challenges = new Map<string, PairingChallenge>();
  // Message message queues for offline delivery (safe read-only events only)
  private offlineQueues = new Map<string, RelayMessage[]>();
  // Device authorization blacklist
  private revokedDevices = new Set<string>();

  /**
   * Register an outbound connection from Windows desktop or Android companion
   */
  registerConnection(params: {
    token: string;
    jwtSecret: string;
    deviceId: string;
    deviceType: RelayDeviceType;
    deviceName: string;
  }): { success: boolean; connection?: RelayConnection; error?: string } {
    try {
      if (this.revokedDevices.has(params.deviceId)) {
        return { success: false, error: 'Device has been explicitly revoked' };
      }

      const payload: JWTPayload = verifyAnyToken(params.token, params.jwtSecret);
      const connectionId = `conn_${crypto.randomBytes(8).toString('hex')}`;

      const conn: RelayConnection = {
        connectionId,
        deviceId: params.deviceId,
        deviceType: params.deviceType,
        tenantId: payload.tenantId,
        userId: payload.sub,
        deviceName: params.deviceName,
        connectedAt: Date.now(),
        lastPingAt: Date.now(),
        isAlive: true,
      };

      this.connections.set(params.deviceId, conn);
      return { success: true, connection: conn };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Disconnect a device session
   */
  disconnectDevice(deviceId: string): void {
    this.connections.delete(deviceId);
  }

  /**
   * Check connection status of a paired Windows Desktop
   */
  getDeviceStatus(deviceId: string): { online: boolean; connection?: RelayConnection } {
    const conn = this.connections.get(deviceId);
    if (!conn) {
      return { online: false };
    }

    // Consider dead if no ping within 45 seconds
    const isAlive = Date.now() - conn.lastPingAt < 45000;
    return { online: isAlive, connection: conn };
  }

  /**
   * Route an encrypted message from mobile to desktop or vice versa
   */
  routeMessage(message: RelayMessage): {
    delivered: boolean;
    queued: boolean;
    error?: string;
  } {
    // 1. Verify source device is not revoked
    if (this.revokedDevices.has(message.sourceDeviceId)) {
      return { delivered: false, queued: false, error: 'Source device authorization is revoked' };
    }

    // 2. Tenant isolation check: source and target must belong to same tenant
    const sourceConn = this.connections.get(message.sourceDeviceId);
    if (sourceConn && sourceConn.tenantId !== message.tenantId) {
      return { delivered: false, queued: false, error: 'Cross-tenant message routing forbidden' };
    }

    // 3. Check target availability
    const targetConn = this.connections.get(message.targetDeviceId);
    if (targetConn && targetConn.isAlive) {
      if (targetConn.tenantId !== message.tenantId) {
        return { delivered: false, queued: false, error: 'Target device tenant mismatch' };
      }

      // In production, emitted via WebSocket connection
      return { delivered: true, queued: false };
    }

    // 4. Target is offline: Queue ONLY safe read-only/informational messages.
    // Dangerous actions (file writes, bash commands) are NEVER queued without live approval.
    const safeToQueue = ['heartbeat', 'device_revoked', 'chat_complete'].includes(message.type);
    if (safeToQueue) {
      const q = this.offlineQueues.get(message.targetDeviceId) || [];
      q.push(message);
      this.offlineQueues.set(message.targetDeviceId, q);
      return { delivered: false, queued: true };
    }

    return {
      delivered: false,
      queued: false,
      error: 'Target Windows desktop is offline. Sensitive actions cannot be queued.',
    };
  }

  /**
   * Generate a secure short-lived pairing challenge (5 minutes)
   */
  createPairingChallenge(params: {
    tenantId: string;
    userId: string;
    expiresInSeconds?: number;
  }): PairingChallenge {
    const challengeId = `pair_${crypto.randomBytes(8).toString('hex')}`;
    const pin = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiresAt = Date.now() + (params.expiresInSeconds || 300) * 1000;

    const qrPayload = JSON.stringify({
      challengeId,
      pin,
      tenantId: params.tenantId,
      relayUrl: 'https://api.lodhiai.com/relay',
      expiresAt,
    });

    const challenge: PairingChallenge = {
      challengeId,
      tenantId: params.tenantId,
      userId: params.userId,
      pin,
      qrPayload,
      expiresAt,
      redeemed: false,
    };

    this.challenges.set(challengeId, challenge);
    return challenge;
  }

  /**
   * Redeem a pairing challenge from Android companion
   */
  redeemPairingChallenge(params: {
    challengeId: string;
    submittedPin: string;
    androidDeviceId: string;
    androidDeviceName: string;
  }): { success: boolean; tenantId?: string; error?: string } {
    const challenge = this.challenges.get(params.challengeId);
    if (!challenge) {
      return { success: false, error: 'Pairing challenge not found or expired' };
    }

    if (challenge.redeemed) {
      return { success: false, error: 'Pairing challenge has already been redeemed' };
    }

    if (Date.now() > challenge.expiresAt) {
      this.challenges.delete(params.challengeId);
      return { success: false, error: 'Pairing challenge expired (5-minute limit)' };
    }

    if (challenge.pin !== params.submittedPin.trim()) {
      return { success: false, error: 'Invalid pairing PIN' };
    }

    // Mark redeemed
    challenge.redeemed = true;
    this.challenges.delete(params.challengeId);

    return { success: true, tenantId: challenge.tenantId };
  }

  /**
   * Explicitly revoke a companion device
   */
  revokeDevice(deviceId: string): void {
    this.revokedDevices.add(deviceId);
    this.connections.delete(deviceId);
    this.offlineQueues.delete(deviceId);
  }

  /**
   * Clear all relay state (for tests)
   */
  clear(): void {
    this.connections.clear();
    this.challenges.clear();
    this.offlineQueues.clear();
    this.revokedDevices.clear();
  }
}

export const globalCloudRelay = new CloudRelayService();
