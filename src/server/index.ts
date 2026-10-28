import crypto from 'crypto';
import {
  SubscriptionTier,
  Tenant,
  User,
  AuthSession,
  JWTPayload,
  ServerLicenseTicket,
  WebhookProcessingResult,
} from './types';
import {
  hashPassword,
  verifyPassword,
  signJWT,
  verifyJWT,
  revokeToken,
  isTokenRevoked,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
  authorizeRequest,
  verifyFirebaseIdToken,
  verifyFirebaseIdTokenAsync,
  verifyAnyToken,
  verifyAnyTokenAsync,
  verifyRS256Signature,
  googleCertStore,
  setFirebasePublicKeys,
  clearFirebasePublicKeys,
  fetchGooglePublicKeys,
} from './auth';
import {
  issueLicenseToken,
  verifyServerLicenseToken,
  LODHI_OFFICIAL_ISSUER,
  DEFAULT_VERIFICATION_KEY,
} from './licensing';
import {
  verifyStripeSignature,
  verifyLemonSqueezySignature,
  processWebhookEvent,
} from './webhooks';
import {
  evaluateEntitlements,
  isFeaturePermitted,
  TIER_CONFIG,
  TierEntitlements,
} from './entitlements';
import {
  SlidingWindowRateLimiter,
  authRateLimiter,
  apiRateLimiter,
} from './rateLimiter';
import {
  UsageMeter,
  globalUsageMeter,
  TenantUsageSummary,
} from './usageMetering';

/**
 * In-Memory Database store for local testing and offline verification
 * Demonstrates Row-Level Security logic and tenant isolation boundaries.
 */
export class LocalTenantStore {
  private tenants = new Map<string, Tenant>();
  private users = new Map<string, User>();
  private licenses = new Map<string, ServerLicenseTicket>();
  private auditLogs: Array<{ tenantId: string; action: string; timestamp: number }> = [];

  constructor() {
    // Seed default demo tenant
    const defaultTenant: Tenant = {
      id: 'tenant-default',
      name: 'Default Workspace',
      plan: 'free',
      status: 'active',
      createdAt: Date.now(),
    };
    this.tenants.set(defaultTenant.id, defaultTenant);
  }

  // Tenant management
  createTenant(name: string, plan: SubscriptionTier = 'free'): Tenant {
    const tenant: Tenant = {
      id: `tenant_${crypto.randomBytes(6).toString('hex')}`,
      name,
      plan,
      status: 'active',
      createdAt: Date.now(),
    };
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  updateTenantPlan(tenantId: string, plan: SubscriptionTier): Tenant {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
    tenant.plan = plan;
    this.tenants.set(tenantId, tenant);
    return tenant;
  }

  // User management
  registerUser(params: {
    email: string;
    password: string;
    tenantId: string;
    role?: 'owner' | 'admin' | 'developer' | 'viewer';
  }): User {
    const existing = Array.from(this.users.values()).find(u => u.email === params.email.toLowerCase());
    if (existing) throw new Error('Email already registered');

    const { hash, salt } = hashPassword(params.password);
    const user: User = {
      id: `user_${crypto.randomBytes(6).toString('hex')}`,
      tenantId: params.tenantId,
      email: params.email.toLowerCase(),
      passwordHash: hash,
      passwordSalt: salt,
      role: params.role || 'developer',
      createdAt: Date.now(),
    };
    this.users.set(user.id, user);
    return user;
  }

  authenticateUser(params: {
    email: string;
    password: string;
    jwtSecret: string;
  }): AuthSession {
    const user = Array.from(this.users.values()).find(u => u.email === params.email.toLowerCase());
    if (!user) throw new Error('Invalid credentials');

    const valid = verifyPassword(params.password, user.passwordHash, user.passwordSalt);
    if (!valid) throw new Error('Invalid credentials');

    const tenant = this.tenants.get(user.tenantId);
    const plan = tenant?.plan || 'free';

    const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      plan,
    };

    const accessToken = signJWT(tokenPayload, params.jwtSecret, 900); // 15 mins
    const refreshToken = crypto.randomBytes(32).toString('hex');

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        plan,
      },
    };
  }

  // Row-Level Security Enforced Query: Users can only read data belonging to their tenant
  getTenantAuditLogs(requestingTenantId: string): Array<{ tenantId: string; action: string; timestamp: number }> {
    return this.auditLogs.filter(log => log.tenantId === requestingTenantId);
  }

  logAction(tenantId: string, action: string): void {
    this.auditLogs.push({ tenantId, action, timestamp: Date.now() });
  }

  clear(): void {
    this.tenants.clear();
    this.users.clear();
    this.licenses.clear();
    this.auditLogs = [];
  }
}

import {
  CloudRelayService,
  globalCloudRelay,
  RelayConnection,
  RelayMessage,
  RelayMessageType,
  PairingChallenge,
} from './relay';

export type {
  SubscriptionTier,
  Tenant,
  User,
  AuthSession,
  JWTPayload,
  ServerLicenseTicket,
  WebhookProcessingResult,
  TierEntitlements,
  TenantUsageSummary,
  RelayConnection,
  RelayMessage,
  RelayMessageType,
  PairingChallenge,
};

export {
  hashPassword,
  verifyPassword,
  signJWT,
  verifyJWT,
  revokeToken,
  isTokenRevoked,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
  authorizeRequest,
  verifyFirebaseIdToken,
  verifyFirebaseIdTokenAsync,
  verifyAnyToken,
  verifyAnyTokenAsync,
  verifyRS256Signature,
  googleCertStore,
  setFirebasePublicKeys,
  clearFirebasePublicKeys,
  fetchGooglePublicKeys,
  issueLicenseToken,
  verifyServerLicenseToken,
  LODHI_OFFICIAL_ISSUER,
  DEFAULT_VERIFICATION_KEY,
  verifyStripeSignature,
  verifyLemonSqueezySignature,
  processWebhookEvent,
  evaluateEntitlements,
  isFeaturePermitted,
  TIER_CONFIG,
  SlidingWindowRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  UsageMeter,
  globalUsageMeter,
  CloudRelayService,
  globalCloudRelay,
};

export {
  ProductionRelayServer,
  startRelayServer,
} from './relayServer';
export type { RelayServerOptions, RelayServerInstance } from './relayServer';
