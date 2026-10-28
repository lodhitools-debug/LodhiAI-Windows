import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  hashPassword,
  verifyPassword,
  signJWT,
  verifyJWT,
  revokeToken,
  clearRevocationCache,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
  authorizeRequest,
} from '../server/auth';
import {
  issueLicenseToken,
  verifyServerLicenseToken,
  LODHI_OFFICIAL_ISSUER,
} from '../server/licensing';
import {
  verifyStripeSignature,
  verifyLemonSqueezySignature,
  processWebhookEvent,
  clearIdempotencyCache,
} from '../server/webhooks';
import {
  evaluateEntitlements,
  isFeaturePermitted,
} from '../server/entitlements';
import { SlidingWindowRateLimiter } from '../server/rateLimiter';
import { UsageMeter } from '../server/usageMetering';
import { LocalTenantStore } from '../server/index';

describe('Phase 11 — Commercial SaaS Foundation Suite', () => {
  const TEST_JWT_SECRET = 'super-secret-jwt-signing-key-for-tests-only-32bytes!';
  const TEST_WEBHOOK_SECRET = 'whsec_test_secret_1234567890abcdef';

  beforeEach(() => {
    clearRevocationCache();
    clearIdempotencyCache();
  });

  describe('1. Server-Side Authentication & Password Security', () => {
    it('hashes passwords with unique random salt using PBKDF2/SHA-512', () => {
      const pass = 'CorrectHorseBatteryStaple123!';
      const res1 = hashPassword(pass);
      const res2 = hashPassword(pass);

      expect(res1.salt).not.toBe(res2.salt);
      expect(res1.hash).not.toBe(res2.hash);
      expect(res1.hash.length).toBe(128); // 64 bytes = 128 hex chars
    });

    it('successfully verifies correct password and rejects wrong password', () => {
      const pass = 'SafeP@ssword2026';
      const { hash, salt } = hashPassword(pass);

      expect(verifyPassword(pass, hash, salt)).toBe(true);
      expect(verifyPassword('WrongPassword!', hash, salt)).toBe(false);
      expect(verifyPassword('', hash, salt)).toBe(false);
    });

    it('mints signed JWT with short expiration and verifies claims', () => {
      const payload = {
        sub: 'user_123',
        tenantId: 'tenant_abc',
        email: 'developer@lodhiai.com',
        role: 'developer',
        plan: 'pro' as const,
      };

      const token = signJWT(payload, TEST_JWT_SECRET, 900);
      expect(token.split('.').length).toBe(3);

      const verified = verifyJWT(token, TEST_JWT_SECRET);
      expect(verified.sub).toBe('user_123');
      expect(verified.tenantId).toBe('tenant_abc');
      expect(verified.role).toBe('developer');
      expect(verified.plan).toBe('pro');
      expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects tampered JWT signature or altered payload', () => {
      const payload = {
        sub: 'user_123',
        tenantId: 'tenant_abc',
        email: 'user@lodhiai.com',
        role: 'developer',
        plan: 'free' as const,
      };

      const token = signJWT(payload, TEST_JWT_SECRET, 900);
      const parts = token.split('.');

      // Tamper signature
      const tamperedSigToken = `${parts[0]}.${parts[1]}.tampered_signature_hex`;
      expect(() => verifyJWT(tamperedSigToken, TEST_JWT_SECRET)).toThrow(/Invalid JWT cryptographic signature/i);

      // Verify with wrong secret
      expect(() => verifyJWT(token, 'wrong-secret-key')).toThrow(/Invalid JWT cryptographic signature/i);
    });

    it('rejects expired JWT tokens', () => {
      const payload = {
        sub: 'user_123',
        tenantId: 'tenant_abc',
        email: 'user@lodhiai.com',
        role: 'developer',
        plan: 'free' as const,
      };

      // Expired 10 seconds ago
      const token = signJWT(payload, TEST_JWT_SECRET, -10);
      expect(() => verifyJWT(token, TEST_JWT_SECRET)).toThrow(/JWT token has expired/i);
    });

    it('rejects revoked tokens via JTI blacklist', () => {
      const jti = 'revoked-session-token-999';
      const payload = {
        sub: 'user_123',
        tenantId: 'tenant_abc',
        email: 'user@lodhiai.com',
        role: 'developer',
        plan: 'pro' as const,
        jti,
      };

      const token = signJWT(payload, TEST_JWT_SECRET, 900);
      expect(verifyJWT(token, TEST_JWT_SECRET).jti).toBe(jti);

      // Revoke token
      revokeToken(jti);
      expect(() => verifyJWT(token, TEST_JWT_SECRET)).toThrow(/Token has been revoked/i);
    });
  });

  describe('2. Multi-Tenant Isolation & Store Queries', () => {
    it('isolates audit logs strictly by tenant ID (Row-Level Security)', () => {
      const store = new LocalTenantStore();
      const tenantA = store.createTenant('Tenant Alpha', 'free');
      const tenantB = store.createTenant('Tenant Beta', 'pro');

      store.logAction(tenantA.id, 'User Alpha created chat session');
      store.logAction(tenantA.id, 'User Alpha indexed README.md');
      store.logAction(tenantB.id, 'User Beta upgraded to Pro tier');

      // Query logs with Tenant A context
      const logsA = store.getTenantAuditLogs(tenantA.id);
      expect(logsA.length).toBe(2);
      expect(logsA.every(l => l.tenantId === tenantA.id)).toBe(true);
      expect(logsA.some(l => l.action.includes('User Beta'))).toBe(false);

      // Query logs with Tenant B context
      const logsB = store.getTenantAuditLogs(tenantB.id);
      expect(logsB.length).toBe(1);
      expect(logsB[0].action).toContain('User Beta upgraded');
    });

    it('authenticates user and returns session bound to tenant plan', () => {
      const store = new LocalTenantStore();
      const tenant = store.createTenant('Lodhi Dev Corp', 'pro');
      store.registerUser({
        email: 'umar@lodhicorp.com',
        password: 'Password123!',
        tenantId: tenant.id,
        role: 'admin',
      });

      const session = store.authenticateUser({
        email: 'umar@lodhicorp.com',
        password: 'Password123!',
        jwtSecret: TEST_JWT_SECRET,
      });

      expect(session.user.email).toBe('umar@lodhicorp.com');
      expect(session.user.role).toBe('admin');
      expect(session.user.plan).toBe('pro');
      expect(session.accessToken).toBeDefined();

      const decoded = verifyJWT(session.accessToken, TEST_JWT_SECRET);
      expect(decoded.tenantId).toBe(tenant.id);
      expect(decoded.plan).toBe('pro');
    });
  });

  describe('3. Cryptographic Offline License Token Minting & Verification', () => {
    it('mints valid signed license token compatible with native Rust verifier', () => {
      const { token, ticket } = issueLicenseToken({
        subject: 'client@lodhiai.com',
        tier: 'pro',
        durationDays: 30,
        deviceId: 'hardware_composite_hash_pc1',
      });

      expect(ticket.tier).toBe('pro');
      expect(token).toBeDefined();
      const parts = token.split('.');
      expect(parts.length).toBe(3);

      const verification = verifyServerLicenseToken(token);
      expect(verification.isValid).toBe(true);
      expect(verification.ticket?.subject).toBe('client@lodhiai.com');
      expect(verification.ticket?.tier).toBe('pro');
      expect(verification.ticket?.issuer).toBe(LODHI_OFFICIAL_ISSUER);
      expect(verification.ticket?.deviceId).toBe('hardware_composite_hash_pc1');
    });

    it('rejects forged license signatures and altered tier claims', () => {
      const { token } = issueLicenseToken({
        subject: 'client@lodhiai.com',
        tier: 'free',
      });

      const parts = token.split('.');
      // Tamper signature
      const tampered = `${parts[0]}.${parts[1]}.0000000000000000000000000000000000000000000000000000000000000000`;
      const res = verifyServerLicenseToken(tampered);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Cryptographic signature mismatch');
    });
  });

  describe('4. Payment Webhook Verification & Idempotency', () => {
    it('verifies genuine Stripe webhook signature with timestamp tolerance', () => {
      const rawBody = JSON.stringify({
        id: 'evt_stripe_test_1',
        type: 'checkout.session.completed',
        data: { object: { customer: 'cus_123', client_reference_id: 'user_abc' } },
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const signedPayload = `${timestamp}.${rawBody}`;
      const v1Signature = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');

      const signatureHeader = `t=${timestamp},v1=${v1Signature}`;

      const res = verifyStripeSignature(rawBody, signatureHeader, TEST_WEBHOOK_SECRET);
      expect(res.isValid).toBe(true);
      expect(res.timestamp).toBe(timestamp);
    });

    it('rejects Stripe webhook replay attack outside 300-second tolerance window', () => {
      const rawBody = JSON.stringify({ id: 'evt_old_1', type: 'checkout.session.completed' });
      // Old timestamp from 10 minutes ago (600s)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const signedPayload = `${oldTimestamp}.${rawBody}`;
      const v1Signature = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');

      const signatureHeader = `t=${oldTimestamp},v1=${v1Signature}`;

      const res = verifyStripeSignature(rawBody, signatureHeader, TEST_WEBHOOK_SECRET);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('replay attack detected');
    });

    it('verifies Lemon Squeezy webhook signature', () => {
      const rawBody = JSON.stringify({
        meta: { event_name: 'subscription_created' },
        data: { id: 'sub_ls_123' },
      });

      const signatureHex = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      const res = verifyLemonSqueezySignature(rawBody, signatureHex, TEST_WEBHOOK_SECRET);
      expect(res.isValid).toBe(true);

      const invalidRes = verifyLemonSqueezySignature(rawBody, 'bad_signature_hex', TEST_WEBHOOK_SECRET);
      expect(invalidRes.isValid).toBe(false);
    });

    it('enforces idempotency: ignores duplicate webhook deliveries without duplicate mutations', () => {
      const eventId = 'evt_unique_txn_9999';

      const firstPass = processWebhookEvent({
        eventId,
        eventType: 'checkout.session.completed',
        gateway: 'stripe',
        payload: { customer: 'cus_123' },
      });

      expect(firstPass.success).toBe(true);
      expect(firstPass.isDuplicate).toBe(false);
      expect(firstPass.actionTaken).toContain('Provisioned subscription tier upgrade');

      // Duplicate delivery
      const secondPass = processWebhookEvent({
        eventId,
        eventType: 'checkout.session.completed',
        gateway: 'stripe',
        payload: { customer: 'cus_123' },
      });

      expect(secondPass.success).toBe(true);
      expect(secondPass.isDuplicate).toBe(true);
      expect(secondPass.actionTaken).toContain('Ignored duplicate webhook event');
    });
  });

  describe('5. Entitlement Rules & Feature Permitted Evaluation', () => {
    it('verifies Free Community Edition has perpetual offline operation and allows BYOK Gemini', () => {
      const free = evaluateEntitlements('free');
      expect(free.offlineGraceDays).toBeGreaterThan(100000);
      expect(free.allowsBYOKCloud).toBe(true);
      expect(free.allowsManagedCloud).toBe(false);
      expect(isFeaturePermitted('free', 'local_ollama_chat')).toBe(true);
      expect(isFeaturePermitted('free', 'managed_cloud_inference')).toBe(false);
    });

    it('verifies Pro Tier unlocks 500k cloud tokens and 3 device activations', () => {
      const pro = evaluateEntitlements('pro');
      expect(pro.maxDevices).toBe(3);
      expect(pro.cloudTokensPerMonth).toBe(500000);
      expect(pro.allowsManagedCloud).toBe(true);
      expect(isFeaturePermitted('pro', 'managed_cloud_inference')).toBe(true);
      expect(isFeaturePermitted('pro', 'team_workspace_policies')).toBe(false);
    });

    it('verifies Business Enterprise unlocks team workspace policies and pooled tokens', () => {
      const biz = evaluateEntitlements('business');
      expect(biz.maxDevices).toBe(10);
      expect(biz.cloudTokensPerMonth).toBe(2500000);
      expect(biz.allowsTeamPolicies).toBe(true);
      expect(isFeaturePermitted('business', 'team_workspace_policies')).toBe(true);
    });
  });

  describe('6. Password Reset & Email Verification Token Lifecycle', () => {
    it('mints and verifies a valid password reset token', () => {
      const email = 'developer@lodhiai.com';
      const token = generatePasswordResetToken(email, TEST_JWT_SECRET, 3600);
      expect(token).toBeDefined();

      const verification = verifyPasswordResetToken(token, TEST_JWT_SECRET);
      expect(verification.valid).toBe(true);
      expect(verification.email).toBe(email);
    });

    it('rejects tampered or forged password reset tokens', () => {
      const token = generatePasswordResetToken('user@lodhiai.com', TEST_JWT_SECRET, 3600);
      const parts = token.split('.');
      const tampered = `${parts[0]}.forged_signature_hex`;

      const verification = verifyPasswordResetToken(tampered, TEST_JWT_SECRET);
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('signature');
    });

    it('rejects expired password reset tokens', () => {
      // Expired 10 seconds ago
      const token = generatePasswordResetToken('user@lodhiai.com', TEST_JWT_SECRET, -10);
      const verification = verifyPasswordResetToken(token, TEST_JWT_SECRET);
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('expired');
    });

    it('mints and verifies email verification token', () => {
      const email = 'newuser@lodhiai.com';
      const token = generateEmailVerificationToken(email, TEST_JWT_SECRET, 86400);
      const res = verifyEmailVerificationToken(token, TEST_JWT_SECRET);
      expect(res.valid).toBe(true);
      expect(res.email).toBe(email);
    });

    it('rejects email verification token with incorrect secret', () => {
      const token = generateEmailVerificationToken('test@lodhiai.com', TEST_JWT_SECRET);
      const res = verifyEmailVerificationToken(token, 'wrong-secret');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('signature');
    });
  });

  describe('7. Server-Side Request Authorization & Cross-Tenant Boundary Rejection', () => {
    it('authorizes requests with valid token and matching tenant and role', () => {
      const token = signJWT(
        {
          sub: 'user_1',
          tenantId: 'tenant_alpha',
          email: 'admin@alpha.com',
          role: 'admin',
          plan: 'pro',
        },
        TEST_JWT_SECRET,
        900
      );

      const auth = authorizeRequest({
        token,
        jwtSecret: TEST_JWT_SECRET,
        requiredRoles: ['admin', 'owner'],
        requiredTenantId: 'tenant_alpha',
      });

      expect(auth.authorized).toBe(true);
      expect(auth.payload?.tenantId).toBe('tenant_alpha');
    });

    it('STRICTLY DENIES cross-tenant resource access (Tenant B accessing Tenant A)', () => {
      const token = signJWT(
        {
          sub: 'user_attacker',
          tenantId: 'tenant_beta',
          email: 'attacker@beta.com',
          role: 'admin',
          plan: 'pro',
        },
        TEST_JWT_SECRET,
        900
      );

      // Attempting to access Tenant Alpha's resources
      const auth = authorizeRequest({
        token,
        jwtSecret: TEST_JWT_SECRET,
        requiredTenantId: 'tenant_alpha',
      });

      expect(auth.authorized).toBe(false);
      expect(auth.error).toContain('Cross-tenant access forbidden');
    });

    it('STRICTLY DENIES access when user role is insufficient (viewer attempting admin action)', () => {
      const token = signJWT(
        {
          sub: 'user_viewer',
          tenantId: 'tenant_alpha',
          email: 'viewer@alpha.com',
          role: 'viewer',
          plan: 'pro',
        },
        TEST_JWT_SECRET,
        900
      );

      const auth = authorizeRequest({
        token,
        jwtSecret: TEST_JWT_SECRET,
        requiredRoles: ['admin', 'owner'],
        requiredTenantId: 'tenant_alpha',
      });

      expect(auth.authorized).toBe(false);
      expect(auth.error).toContain('Insufficient permissions');
    });
  });

  describe('8. Sliding Window Rate Limiting & Abuse Protection', () => {
    it('permits requests within quota and blocks requests exceeding limit', () => {
      const limiter = new SlidingWindowRateLimiter();
      const ip = '192.168.1.100';
      const limit = 3;
      const windowSecs = 10;

      // 3 allowed hits
      const hit1 = limiter.consume(ip, limit, windowSecs);
      expect(hit1.allowed).toBe(true);
      expect(hit1.remaining).toBe(2);

      const hit2 = limiter.consume(ip, limit, windowSecs);
      expect(hit2.allowed).toBe(true);
      expect(hit2.remaining).toBe(1);

      const hit3 = limiter.consume(ip, limit, windowSecs);
      expect(hit3.allowed).toBe(true);
      expect(hit3.remaining).toBe(0);

      // 4th hit: blocked
      const hit4 = limiter.consume(ip, limit, windowSecs);
      expect(hit4.allowed).toBe(false);
      expect(hit4.remaining).toBe(0);
      expect(hit4.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('isolates rate limits by distinct keys (IPs / Tenants)', () => {
      const limiter = new SlidingWindowRateLimiter();
      const ipA = '10.0.0.1';
      const ipB = '10.0.0.2';

      // Exhaust ipA
      limiter.consume(ipA, 1, 10);
      const blockedA = limiter.consume(ipA, 1, 10);
      expect(blockedA.allowed).toBe(false);

      // ipB should still be permitted
      const allowedB = limiter.consume(ipB, 1, 10);
      expect(allowedB.allowed).toBe(true);
    });
  });

  describe('9. AI Usage Metering & Quota Enforcement', () => {
    it('tracks token consumption and reports usage summary', () => {
      const meter = new UsageMeter();
      const tenantId = 'tenant_meter_1';

      meter.recordUsage(tenantId, 150000);
      meter.recordUsage(tenantId, 50000);

      const summary = meter.getUsageSummary(tenantId, 'pro');
      expect(summary.tokensConsumed).toBe(200000);
      expect(summary.tokensLimit).toBe(500000);
      expect(summary.percentUsed).toBe(40);
      expect(summary.isExhausted).toBe(false);
    });

    it('rejects managed cloud quota checks for Free Community tier (requires BYOK or upgrade)', () => {
      const meter = new UsageMeter();
      const quota = meter.checkQuota('tenant_free_1', 'free', 1000);
      expect(quota.allowed).toBe(false);
      expect(quota.reason).toContain('Managed cloud inference requires Pro or Business subscription');
    });

    it('enforces quota exhaustion when usage reaches plan limit', () => {
      const meter = new UsageMeter();
      const tenantId = 'tenant_pro_1';

      // Record 499,000 tokens (limit is 500k)
      meter.recordUsage(tenantId, 499000);

      // 500 tokens should be allowed
      const checkSmall = meter.checkQuota(tenantId, 'pro', 500);
      expect(checkSmall.allowed).toBe(true);

      // 2,000 tokens exceeds 500k limit -> rejected
      const checkLarge = meter.checkQuota(tenantId, 'pro', 2000);
      expect(checkLarge.allowed).toBe(false);
      expect(checkLarge.reason).toContain('Monthly token quota exhausted');
    });

    it('resets usage cycle upon subscription renewal', () => {
      const meter = new UsageMeter();
      const tenantId = 'tenant_pro_renew';

      meter.recordUsage(tenantId, 480000);
      expect(meter.getUsageSummary(tenantId, 'pro').tokensConsumed).toBe(480000);

      // Reset cycle
      meter.resetCycle(tenantId);
      const after = meter.getUsageSummary(tenantId, 'pro');
      expect(after.tokensConsumed).toBe(0);
      expect(after.percentUsed).toBe(0);
      expect(after.isExhausted).toBe(false);
    });
  });
});
