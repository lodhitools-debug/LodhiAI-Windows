import crypto from 'crypto';
import { JWTPayload } from './types';

// In-memory token revocation blacklist (in production, stored in Redis)
const revokedTokens = new Set<string>();

/**
 * Secure password hashing using PBKDF2 with SHA-512 and unique 16-byte salt
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const iterations = 100000;
  const keylen = 64;
  const digest = 'sha512';
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Verify a plaintext password against a stored hash using timing-safe equality
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Helper to base64url encode buffers or strings
 */
function base64urlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Helper to base64url decode strings to Buffer
 */
function base64urlDecode(input: string): Buffer {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Mint a cryptographically signed JSON Web Token (JWT)
 */
export function signJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds = 900 // 15 minutes default
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    jti: payload.jti || crypto.randomBytes(16).toString('hex'),
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const encodedSignature = base64urlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

/**
 * Verify a JWT and validate signature and expiry
 */
export function verifyJWT(token: string, secret: string): JWTPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token: expected 3 parts');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const providedSig = base64urlDecode(encodedSignature);

  if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
    throw new Error('Invalid JWT cryptographic signature');
  }

  const payload: JWTPayload = JSON.parse(base64urlDecode(encodedPayload).toString('utf-8'));

  if (payload.jti && revokedTokens.has(payload.jti)) {
    throw new Error('Token has been revoked');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('JWT token has expired');
  }

  return payload;
}

/**
 * Revoke a token by its unique JTI identifier
 */
export function revokeToken(jti: string): void {
  revokedTokens.add(jti);
}

/**
 * Check if a token has been revoked
 */
export function isTokenRevoked(jti: string): boolean {
  return revokedTokens.has(jti);
}

/**
 * Clear revocation cache (for testing)
 */
export function clearRevocationCache(): void {
  revokedTokens.clear();
}

export interface FirebaseVerificationOptions {
  expectedProjectId?: string;
  publicKey?: string;
  allowSimulatedTokens?: boolean;
  clockToleranceSeconds?: number;
  authoritativeSubscriptionResolver?: (uid: string) =>
    | { plan: 'free' | 'pro' | 'business'; role: 'owner' | 'developer' | 'viewer' }
    | Promise<{ plan: 'free' | 'pro' | 'business'; role: 'owner' | 'developer' | 'viewer' }>;
}

export interface CachedCertificate {
  pem: string;
  expiresAt: number;
}

/**
 * Google Public Certificate Store
 * Manages certificate caching, fetching from Google's official endpoint, and key rotation.
 */
export class GoogleCertificateStore {
  private cache = new Map<string, CachedCertificate>();
  private fetchPromise: Promise<Record<string, string>> | null = null;
  private certEndpoint = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

  setEndpoint(url: string): void {
    this.certEndpoint = url;
  }

  setCertificates(certs: Record<string, string>, ttlSeconds: number = 21600): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    for (const [kid, pem] of Object.entries(certs)) {
      this.cache.set(kid, { pem, expiresAt });
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.fetchPromise = null;
  }

  getCertificate(kid: string): string | null {
    const entry = this.cache.get(kid);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(kid);
      return null;
    }
    return entry.pem;
  }

  async getCertificateAsync(kid: string): Promise<string> {
    const cached = this.getCertificate(kid);
    if (cached) return cached;

    // Key rotation: kid not found in cache, fetch fresh certificates from Google
    await this.fetchCertificates();

    const afterFetch = this.getCertificate(kid);
    if (!afterFetch) {
      throw new Error(`Key ID (kid) "${kid}" not found in Google public certificates (key rotation check failed)`);
    }
    return afterFetch;
  }

  async fetchCertificates(): Promise<Record<string, string>> {
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        const res = await fetch(this.certEndpoint, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          throw new Error(`Google certificate endpoint returned HTTP ${res.status}: ${res.statusText}`);
        }

        const certs = (await res.json()) as Record<string, string>;
        const cacheControl = res.headers.get('cache-control') || '';
        const match = cacheControl.match(/max-age=(\d+)/i);
        const ttlSeconds = match ? parseInt(match[1], 10) : 21600;
        this.setCertificates(certs, ttlSeconds);
        return certs;
      } catch (err) {
        throw new Error(`Failed to fetch Google public certificates: ${(err as Error).message}`);
      } finally {
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }
}

export const googleCertStore = new GoogleCertificateStore();

export function setFirebasePublicKeys(keys: Record<string, string>, ttlSeconds?: number): void {
  googleCertStore.setCertificates(keys, ttlSeconds);
}

export function clearFirebasePublicKeys(): void {
  googleCertStore.clearCache();
}

export async function fetchGooglePublicKeys(): Promise<Record<string, string>> {
  return googleCertStore.fetchCertificates();
}

/**
 * Cryptographically verify RS256 signature using RSA-SHA256
 */
export function verifyRS256Signature(
  signingInput: string,
  signatureBase64Url: string,
  publicKeyOrCert: string
): boolean {
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signingInput);
    verifier.end();
    const signature = base64urlDecode(signatureBase64Url);
    return verifier.verify(publicKeyOrCert, signature);
  } catch {
    return false;
  }
}

/**
 * Synchronously verify a Firebase ID Token cryptographic signature, issuer, audience, and expiration.
 * Public key must be pre-cached or supplied via options.
 */
export function verifyFirebaseIdToken(
  token: string,
  options?: string | FirebaseVerificationOptions
): JWTPayload {
  const opts: FirebaseVerificationOptions = typeof options === 'string'
    ? { expectedProjectId: options }
    : (options || {});

  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test' || process.env.LODHI_ALLOW_SIMULATED_TOKENS === 'true';
  const allowSimulated = !isProduction && (opts.allowSimulatedTokens ?? isTest);

  // Check if simulated token in offline/emulator mode: fb_id_token_<uid>_<timestamp>
  if (token.startsWith('fb_id_token_')) {
    if (isProduction || !allowSimulated) {
      throw new Error('Simulated Firebase tokens are strictly forbidden in production mode or when allowSimulatedTokens is disabled');
    }
    const withoutPrefix = token.slice('fb_id_token_'.length);
    const lastUnderscore = withoutPrefix.lastIndexOf('_');
    const uid = lastUnderscore !== -1 ? withoutPrefix.substring(0, lastUnderscore) : withoutPrefix;
    const now = Math.floor(Date.now() / 1000);
    return {
      sub: uid,
      tenantId: uid,
      email: `${uid}@lodhiai.internal`,
      role: 'developer',
      plan: 'free',
      iat: now,
      exp: now + 3600,
    };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase ID Token: expected 3 parts');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header: any;
  try {
    header = JSON.parse(base64urlDecode(encodedHeader).toString('utf-8'));
  } catch {
    throw new Error('Malformed Firebase ID Token header: invalid JSON');
  }

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported JWT algorithm: expected RS256, received ${header.alg}`);
  }

  if (!header.kid || typeof header.kid !== 'string' || header.kid.trim() === '') {
    throw new Error('Firebase ID Token missing or invalid key ID (kid) in header');
  }

  const envProjectId = (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== 'undefined')
    ? process.env.FIREBASE_PROJECT_ID
    : undefined;
  const expectedProjectId = opts.expectedProjectId || envProjectId || 'lodhiai-cloud';
  if (isProduction && (!envProjectId || envProjectId === 'lodhiai-cloud')) {
    throw new Error('Production mode requires explicitly configured FIREBASE_PROJECT_ID');
  }

  // Resolve public key from options or cache
  const publicKey = opts.publicKey || googleCertStore.getCertificate(header.kid);
  if (!publicKey) {
    throw new Error(`Firebase public key for kid "${header.kid}" is not cached. Call verifyFirebaseIdTokenAsync or prime the certificate cache first.`);
  }

  // 1. Verify RS256 Cryptographic Signature
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  if (!verifyRS256Signature(signingInput, encodedSignature, publicKey)) {
    throw new Error('Invalid Firebase ID Token cryptographic signature');
  }

  // 2. Decode and validate claims
  let payloadJson: any;
  try {
    payloadJson = JSON.parse(base64urlDecode(encodedPayload).toString('utf-8'));
  } catch {
    throw new Error('Malformed Firebase ID Token payload: invalid JSON');
  }

  const now = Math.floor(Date.now() / 1000);
  const clockTolerance = opts.clockToleranceSeconds ?? 300;

  if (!payloadJson.exp || typeof payloadJson.exp !== 'number' || payloadJson.exp < (now - clockTolerance)) {
    throw new Error('Firebase ID Token has expired');
  }

  if (payloadJson.iat && typeof payloadJson.iat === 'number' && payloadJson.iat > (now + clockTolerance)) {
    throw new Error('Firebase ID Token issued in the future');
  }

  if (!payloadJson.aud || payloadJson.aud !== expectedProjectId) {
    throw new Error(`Invalid token audience: expected "${expectedProjectId}", received "${payloadJson.aud}"`);
  }

  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (!payloadJson.iss || payloadJson.iss !== expectedIssuer) {
    throw new Error(`Invalid token issuer: expected "${expectedIssuer}", received "${payloadJson.iss}"`);
  }

  if (!payloadJson.sub || typeof payloadJson.sub !== 'string' || payloadJson.sub.trim() === '' || payloadJson.sub.length > 128) {
    throw new Error('Firebase ID Token missing or invalid subject (UID)');
  }

  if (revokedTokens.has(payloadJson.sub) || (payloadJson.jti && revokedTokens.has(payloadJson.jti))) {
    throw new Error('Token or user has been revoked');
  }

  // Authoritative Role & Plan resolution: Never trust client parameters; sanitize enums
  const allowedRoles: Array<'owner' | 'developer' | 'viewer'> = ['owner', 'developer', 'viewer'];
  const allowedPlans: Array<'free' | 'pro' | 'business'> = ['free', 'pro', 'business'];

  let role: 'owner' | 'developer' | 'viewer' = allowedRoles.includes(payloadJson.role) ? payloadJson.role : 'developer';
  let plan: 'free' | 'pro' | 'business' = allowedPlans.includes(payloadJson.plan) ? payloadJson.plan : 'free';

  if (opts.authoritativeSubscriptionResolver) {
    const authoritative = opts.authoritativeSubscriptionResolver(payloadJson.sub);
    if (authoritative && typeof (authoritative as any).then !== 'function') {
      const syncAuth = authoritative as { plan: 'free' | 'pro' | 'business'; role: 'owner' | 'developer' | 'viewer' };
      if (allowedPlans.includes(syncAuth.plan)) plan = syncAuth.plan;
      if (allowedRoles.includes(syncAuth.role)) role = syncAuth.role;
    }
  }

  return {
    sub: payloadJson.sub,
    tenantId: payloadJson.tenantId || payloadJson.sub,
    email: payloadJson.email || `${payloadJson.sub}@firebase.internal`,
    role,
    plan,
    iat: payloadJson.iat || now,
    exp: payloadJson.exp,
    auth_time: payloadJson.auth_time,
    firebase: payloadJson.firebase,
  };
}

/**
 * Asynchronously verify a Firebase ID Token with automatic on-demand certificate fetching and key rotation.
 */
export async function verifyFirebaseIdTokenAsync(
  token: string,
  options?: string | FirebaseVerificationOptions
): Promise<JWTPayload> {
  const opts: FirebaseVerificationOptions = typeof options === 'string'
    ? { expectedProjectId: options }
    : (options || {});

  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test' || process.env.LODHI_ALLOW_SIMULATED_TOKENS === 'true';
  const allowSimulated = !isProduction && (opts.allowSimulatedTokens ?? isTest);

  if (token.startsWith('fb_id_token_')) {
    if (isProduction || !allowSimulated) {
      throw new Error('Simulated Firebase tokens are strictly forbidden in production mode or when allowSimulatedTokens is disabled');
    }
    return verifyFirebaseIdToken(token, opts);
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase ID Token: expected 3 parts');
  }

  const [encodedHeader] = parts;
  let header: any;
  try {
    header = JSON.parse(base64urlDecode(encodedHeader).toString('utf-8'));
  } catch {
    throw new Error('Malformed Firebase ID Token header: invalid JSON');
  }

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported JWT algorithm: expected RS256, received ${header.alg}`);
  }

  if (!header.kid || typeof header.kid !== 'string' || header.kid.trim() === '') {
    throw new Error('Firebase ID Token missing or invalid key ID (kid) in header');
  }

  // Asynchronously resolve certificate (fetches from Google if kid not cached, handling key rotation)
  const publicKey = opts.publicKey || (await googleCertStore.getCertificateAsync(header.kid));

  // Run verification with the resolved key
  const verified = verifyFirebaseIdToken(token, { ...opts, publicKey });

  // Handle async authoritativeSubscriptionResolver if provided
  if (opts.authoritativeSubscriptionResolver) {
    const authResult = opts.authoritativeSubscriptionResolver(verified.sub);
    if (authResult && typeof (authResult as any).then === 'function') {
      const resolved = await authResult;
      const allowedRoles: Array<'owner' | 'developer' | 'viewer'> = ['owner', 'developer', 'viewer'];
      const allowedPlans: Array<'free' | 'pro' | 'business'> = ['free', 'pro', 'business'];
      if (allowedPlans.includes(resolved.plan)) verified.plan = resolved.plan;
      if (allowedRoles.includes(resolved.role)) verified.role = resolved.role;
    }
  }

  return verified;
}

/**
 * Universal token verifier supporting both Firebase ID Tokens and standalone HMAC JWTs
 */
export function verifyAnyToken(
  token: string,
  secret: string,
  options?: string | FirebaseVerificationOptions
): JWTPayload {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test' || process.env.LODHI_ALLOW_SIMULATED_TOKENS === 'true';
  const opts = typeof options === 'string' ? { expectedProjectId: options } : (options || {});
  const allowSimulated = !isProduction && (opts.allowSimulatedTokens ?? isTest);

  if (token.startsWith('fb_id_token_')) {
    if (isProduction || !allowSimulated) {
      throw new Error('Simulated Firebase tokens are strictly forbidden in production mode or when allowSimulatedTokens is disabled');
    }
    return verifyFirebaseIdToken(token, opts);
  }

  try {
    return verifyJWT(token, secret);
  } catch (jwtErr) {
    try {
      return verifyFirebaseIdToken(token, opts);
    } catch {
      throw jwtErr;
    }
  }
}

/**
 * Asynchronous universal token verifier supporting both Firebase ID Tokens and standalone HMAC JWTs
 */
export async function verifyAnyTokenAsync(
  token: string,
  secret: string,
  options?: string | FirebaseVerificationOptions
): Promise<JWTPayload> {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test' || process.env.LODHI_ALLOW_SIMULATED_TOKENS === 'true';
  const opts = typeof options === 'string' ? { expectedProjectId: options } : (options || {});
  const allowSimulated = !isProduction && (opts.allowSimulatedTokens ?? isTest);

  if (token.startsWith('fb_id_token_')) {
    if (isProduction || !allowSimulated) {
      throw new Error('Simulated Firebase tokens are strictly forbidden in production mode or when allowSimulatedTokens is disabled');
    }
    return verifyFirebaseIdToken(token, opts);
  }

  try {
    return verifyJWT(token, secret);
  } catch (jwtErr) {
    try {
      return await verifyFirebaseIdTokenAsync(token, opts);
    } catch {
      throw jwtErr;
    }
  }
}

/**
 * Generate a cryptographically signed password reset token valid for 1 hour
 */
export function generatePasswordResetToken(email: string, secret: string, expiresInSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    purpose: 'password_reset',
    email: email.toLowerCase(),
    iat: now,
    exp: now + expiresInSeconds,
  };
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  return `${encodedPayload}.${base64urlEncode(signature)}`;
}

/**
 * Verify a password reset token
 */
export function verifyPasswordResetToken(
  token: string,
  secret: string
): { valid: boolean; email?: string; error?: string } {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed reset token' };
  }
  const [encodedPayload, encodedSig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  const providedSig = base64urlDecode(encodedSig);

  if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
    return { valid: false, error: 'Invalid reset token cryptographic signature' };
  }

  const payload = JSON.parse(base64urlDecode(encodedPayload).toString('utf-8'));
  if (payload.purpose !== 'password_reset') {
    return { valid: false, error: 'Invalid token purpose' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return { valid: false, error: 'Password reset token has expired' };
  }

  return { valid: true, email: payload.email };
}

/**
 * Generate an email verification token valid for 24 hours
 */
export function generateEmailVerificationToken(email: string, secret: string, expiresInSeconds = 86400): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    purpose: 'email_verification',
    email: email.toLowerCase(),
    iat: now,
    exp: now + expiresInSeconds,
  };
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  return `${encodedPayload}.${base64urlEncode(signature)}`;
}

/**
 * Verify an email verification token
 */
export function verifyEmailVerificationToken(
  token: string,
  secret: string
): { valid: boolean; email?: string; error?: string } {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed verification token' };
  }
  const [encodedPayload, encodedSig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  const providedSig = base64urlDecode(encodedSig);

  if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
    return { valid: false, error: 'Invalid verification token signature' };
  }

  const payload = JSON.parse(base64urlDecode(encodedPayload).toString('utf-8'));
  if (payload.purpose !== 'email_verification') {
    return { valid: false, error: 'Invalid token purpose' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return { valid: false, error: 'Verification token has expired' };
  }

  return { valid: true, email: payload.email };
}

/**
 * Server-side authorization guard for protected API endpoints
 */
export function authorizeRequest(params: {
  token: string;
  jwtSecret: string;
  requiredRoles?: string[];
  requiredTenantId?: string;
}): { authorized: boolean; payload?: JWTPayload; error?: string } {
  try {
    const payload = verifyJWT(params.token, params.jwtSecret);

    // Cross-tenant boundary check
    if (params.requiredTenantId && payload.tenantId !== params.requiredTenantId) {
      return {
        authorized: false,
        error: `Cross-tenant access forbidden: token tenant ${payload.tenantId} does not match resource tenant ${params.requiredTenantId}`,
      };
    }

    // Role-based access control (RBAC) check
    if (params.requiredRoles && params.requiredRoles.length > 0) {
      if (!params.requiredRoles.includes(payload.role)) {
        return {
          authorized: false,
          error: `Insufficient permissions: role ${payload.role} not in allowed roles [${params.requiredRoles.join(', ')}]`,
        };
      }
    }

    return { authorized: true, payload };
  } catch (err) {
    return { authorized: false, error: (err as Error).message };
  }
}

