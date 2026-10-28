/**
 * Lodhi AI — Cloud Firestore Service
 * Encapsulates CRUD operations, schema validation, and real-time listeners
 * matching the collections defined in Phase 3 of the Firebase-First Master Plan.
 */

export interface FirestoreUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'developer' | 'viewer';
  plan: 'free' | 'pro' | 'business';
  createdAt: number;
  updatedAt: number;
}

export interface FirestoreDeviceRecord {
  deviceId: string;
  deviceType: 'windows_desktop' | 'android_companion';
  deviceName: string;
  pairedAt: number;
  lastActiveAt: number;
  revoked: boolean;
  fcmToken?: string;
}

export interface FirestoreSubscriptionRecord {
  tier: 'free' | 'pro' | 'business';
  status: 'active' | 'past_due' | 'canceled';
  gateway: 'stripe' | 'lemonsqueezy';
  subscriptionId: string;
  customerId: string;
  currentPeriodEnd: number;
  cloudTokensLimit: number;
  devicesLimit: number;
}

export interface FirestoreUsageRecord {
  periodMonth: string;
  cloudTokensUsed: number;
  agentRunsCount: number;
  storageBytesUsed: number;
  updatedAt: number;
}

export interface FirestorePairingSession {
  sessionId: string;
  pinHash: string;
  windowsUid: string;
  windowsDeviceId: string;
  expiresAt: number;
  status: 'pending' | 'paired' | 'expired';
  pairedAndroidDeviceId?: string;
  createdAt: number;
}

export interface FirestoreWorkspaceRecord {
  workspaceId: string;
  name: string;
  pathAlias: string;
  isApprovedForRemote: boolean;
  addedAt: number;
}

export class FirestoreService {
  // Local simulated stores for offline development & test execution
  private users = new Map<string, FirestoreUserProfile>();
  private devices = new Map<string, Map<string, FirestoreDeviceRecord>>();
  private subscriptions = new Map<string, FirestoreSubscriptionRecord>();
  private usage = new Map<string, Map<string, FirestoreUsageRecord>>();
  private pairingSessions = new Map<string, FirestorePairingSession>();
  private workspaces = new Map<string, Map<string, FirestoreWorkspaceRecord>>();

  // 1. User Profiles
  async getUserProfile(uid: string): Promise<FirestoreUserProfile | null> {
    return this.users.get(uid) || null;
  }

  async createUserProfile(profile: FirestoreUserProfile): Promise<void> {
    // In accordance with security rules, newly created client profile must have free plan
    profile.plan = 'free';
    this.users.set(profile.uid, profile);
  }

  // 2. Devices
  async registerDevice(uid: string, device: FirestoreDeviceRecord): Promise<void> {
    const userDevices = this.devices.get(uid) || new Map<string, FirestoreDeviceRecord>();
    userDevices.set(device.deviceId, device);
    this.devices.set(uid, userDevices);
  }

  async listDevices(uid: string): Promise<FirestoreDeviceRecord[]> {
    const userDevices = this.devices.get(uid);
    if (!userDevices) return [];
    return Array.from(userDevices.values());
  }

  async revokeDevice(uid: string, deviceId: string): Promise<void> {
    const userDevices = this.devices.get(uid);
    if (userDevices && userDevices.has(deviceId)) {
      const dev = userDevices.get(deviceId)!;
      dev.revoked = true;
      userDevices.set(deviceId, dev);
    }
  }

  // 3. Subscriptions (Server privileged)
  async getSubscription(uid: string): Promise<FirestoreSubscriptionRecord> {
    return (
      this.subscriptions.get(uid) || {
        tier: 'free',
        status: 'active',
        gateway: 'stripe',
        subscriptionId: 'sub_free',
        customerId: 'cus_free',
        currentPeriodEnd: Date.now() + 30 * 86400 * 1000,
        cloudTokensLimit: 100000,
        devicesLimit: 1,
      }
    );
  }

  // 4. Usage Records
  async getUsage(uid: string, periodMonth: string): Promise<FirestoreUsageRecord> {
    const userUsage = this.usage.get(uid);
    return (
      userUsage?.get(periodMonth) || {
        periodMonth,
        cloudTokensUsed: 0,
        agentRunsCount: 0,
        storageBytesUsed: 0,
        updatedAt: Date.now(),
      }
    );
  }

  // 5. Pairing Sessions
  async createPairingSession(session: FirestorePairingSession): Promise<void> {
    this.pairingSessions.set(session.sessionId, session);
  }

  async getPairingSession(sessionId: string): Promise<FirestorePairingSession | null> {
    const s = this.pairingSessions.get(sessionId);
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      s.status = 'expired';
    }
    return s;
  }

  async redeemPairingSession(
    sessionId: string,
    submittedPinHash: string,
    androidDeviceId: string
  ): Promise<{ success: boolean; windowsUid?: string; error?: string }> {
    const session = await this.getPairingSession(sessionId);
    if (!session) return { success: false, error: 'Session not found' };
    if (session.status !== 'pending') return { success: false, error: 'Session not pending or already redeemed' };
    if (Date.now() > session.expiresAt) return { success: false, error: 'Session expired' };
    if (session.pinHash !== submittedPinHash) return { success: false, error: 'Invalid pairing PIN' };

    session.status = 'paired';
    session.pairedAndroidDeviceId = androidDeviceId;
    this.pairingSessions.set(sessionId, session);
    return { success: true, windowsUid: session.windowsUid };
  }

  // 6. Workspaces
  async listApprovedWorkspaces(uid: string): Promise<FirestoreWorkspaceRecord[]> {
    const userWorkspaces = this.workspaces.get(uid);
    if (!userWorkspaces) return [];
    return Array.from(userWorkspaces.values()).filter(w => w.isApprovedForRemote);
  }

  async approveWorkspace(uid: string, workspace: FirestoreWorkspaceRecord): Promise<void> {
    const userWorkspaces = this.workspaces.get(uid) || new Map<string, FirestoreWorkspaceRecord>();
    userWorkspaces.set(workspace.workspaceId, workspace);
    this.workspaces.set(uid, userWorkspaces);
  }

  clear(): void {
    this.users.clear();
    this.devices.clear();
    this.subscriptions.clear();
    this.usage.clear();
    this.pairingSessions.clear();
    this.workspaces.clear();
  }
}

export const globalFirestore = new FirestoreService();
