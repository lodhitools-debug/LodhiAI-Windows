import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  verifyFirebaseIdToken,
  verifyFirebaseIdTokenAsync,
  verifyAnyToken,
  verifyAnyTokenAsync,
  setFirebasePublicKeys,
  clearFirebasePublicKeys,
  googleCertStore,
  revokeToken,
  clearRevocationCache,
} from '../server/auth';

function generateRsaKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function mintTestFirebaseToken(params: {
  privateKey: string;
  kid?: string;
  sub?: any;
  aud?: string;
  iss?: string;
  iat?: number;
  exp?: number;
  role?: string;
  plan?: string;
  alg?: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: params.alg || 'RS256',
    typ: 'JWT',
    kid: params.kid || 'test-key-id-1',
  };

  const payload = {
    sub: params.sub !== undefined ? params.sub : 'usr_test_12345',
    aud: params.aud !== undefined ? params.aud : 'lodhiai-cloud',
    iss: params.iss !== undefined ? params.iss : 'https://securetoken.google.com/lodhiai-cloud',
    iat: params.iat !== undefined ? params.iat : now - 60,
    exp: params.exp !== undefined ? params.exp : now + 3600,
    email: 'testuser@lodhiai.internal',
    ...(params.role ? { role: params.role } : {}),
    ...(params.plan ? { plan: params.plan } : {}),
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64url(signer.sign(params.privateKey));

  return `${signingInput}.${signature}`;
}

describe('Firebase ID Token Cryptographic Verification & Security Guardrails Suite', () => {
  let primaryKeypair: { publicKey: string; privateKey: string };
  let secondaryKeypair: { publicKey: string; privateKey: string };
  const originalNodeEnv = process.env.NODE_ENV;
  const originalProjectId = process.env.FIREBASE_PROJECT_ID;

  beforeEach(() => {
    primaryKeypair = generateRsaKeyPair();
    secondaryKeypair = generateRsaKeyPair();
    clearFirebasePublicKeys();
    clearRevocationCache();
    // Default test key in cache
    setFirebasePublicKeys({
      'test-key-id-1': primaryKeypair.publicKey,
    });
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (originalProjectId !== undefined) {
      process.env.FIREBASE_PROJECT_ID = originalProjectId;
    } else {
      delete process.env.FIREBASE_PROJECT_ID;
    }
    clearFirebasePublicKeys();
    clearRevocationCache();
  });

  describe('1. Valid Signed Firebase Token Verification', () => {
    it('successfully verifies a genuine RS256 token matching Google public key', () => {
      const token = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        kid: 'test-key-id-1',
        sub: 'usr_alice_genuine',
      });

      const payload = verifyFirebaseIdToken(token, { expectedProjectId: 'lodhiai-cloud' });
      expect(payload.sub).toBe('usr_alice_genuine');
      expect(payload.tenantId).toBe('usr_alice_genuine');
      expect(payload.plan).toBe('free');
      expect(payload.role).toBe('developer');
    });

    it('successfully verifies asynchronously via verifyFirebaseIdTokenAsync', async () => {
      const token = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        kid: 'test-key-id-1',
        sub: 'usr_bob_async',
      });

      const payload = await verifyFirebaseIdTokenAsync(token, { expectedProjectId: 'lodhiai-cloud' });
      expect(payload.sub).toBe('usr_bob_async');
    });

    it('successfully verifies through universal verifyAnyToken', () => {
      const token = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        kid: 'test-key-id-1',
        sub: 'usr_charlie_universal',
      });

      const payload = verifyAnyToken(token, 'fallback-hmac-secret', { expectedProjectId: 'lodhiai-cloud' });
      expect(payload.sub).toBe('usr_charlie_universal');
    });

    it('successfully verifies through universal verifyAnyTokenAsync', async () => {
      const token = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        kid: 'test-key-id-1',
        sub: 'usr_charlie_async_universal',
      });

      const payload = await verifyAnyTokenAsync(token, 'fallback-hmac-secret', { expectedProjectId: 'lodhiai-cloud' });
      expect(payload.sub).toBe('usr_charlie_async_universal');
    });
  });

  describe('2. Cryptographic Signature Tampering & Forgery Defense', () => {
    it('rejects a token signed with an unauthorized private key (wrong signature)', () => {
      // Signed with secondary key, but verifier only knows primary key for 'test-key-id-1'
      const forgedToken = mintTestFirebaseToken({
        privateKey: secondaryKeypair.privateKey,
        kid: 'test-key-id-1',
        sub: 'usr_attacker',
      });

      expect(() => {
        verifyFirebaseIdToken(forgedToken, { expectedProjectId: 'lodhiai-cloud' });
      }).toThrow('Invalid Firebase ID Token cryptographic signature');
    });

    it('rejects a validly signed token whose payload was modified in transit', () => {
      const genuineToken = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        kid: 'test-key-id-1',
        sub: 'usr_victim',
      });

      const parts = genuineToken.split('.');
      // Tamper with payload (substitute sub with attacker UID)
      const tamperedPayload = JSON.stringify({
        sub: 'usr_attacker_hijack',
        aud: 'lodhiai-cloud',
        iss: 'https://securetoken.google.com/lodhiai-cloud',
        iat: Math.floor(Date.now() / 1000) - 60,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const tamperedToken = `${parts[0]}.${base64url(tamperedPayload)}.${parts[2]}`;

      expect(() => {
        verifyFirebaseIdToken(tamperedToken, { expectedProjectId: 'lodhiai-cloud' });
      }).toThrow('Invalid Firebase ID Token cryptographic signature');
    });
  });

  describe('3. Expiration and Issued-At Time Boundary Controls', () => {
    it('strictly rejects an expired token', () => {
      const expiredToken = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        exp: Math.floor(Date.now() / 1000) - 600, // expired 10 minutes ago
      });

      expect(() => {
        verifyFirebaseIdToken(expiredToken, { expectedProjectId: 'lodhiai-cloud' });
      }).toThrow('Firebase ID Token has expired');
    });

    it('strictly rejects a token issued in the future beyond clock skew allowance', () => {
      const futureToken = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        iat: Math.floor(Date.now() / 1000) + 1200, // 20 minutes in future
      });

      expect(() => {
        verifyFirebaseIdToken(futureToken, { expectedProjectId: 'lodhiai-cloud' });
      }).toThrow('Firebase ID Token issued in the future');
    });
  });

  describe('4. Issuer and Audience Boundary Verification', () => {
    it('strictly rejects a token from an untrusted issuer', () => {
      const evilIssuerToken = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        iss: 'https://attacker-idp.example.com/lodhiai-cloud',
      });

      expect(() => {
        verifyFirebaseIdToken(evilIssuerToken, { expectedProjectId: 'lodhiai-cloud' });
      }).toThrow('Invalid token issuer');
    });

    it('strictly rejects a token minted for a different Firebase project (wrong audience)', () => {
      const wrongAudToken = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        aud: 'other-unrelated-firebase-project',
      });

      expect(() => {
        verifyFirebaseIdToken(wrongAudToken, { expectedProjectId: 'lodhiai-cloud' });
      }).toThrow('Invalid token audience');
    });
  });

  describe('5. Subject / UID Integrity Validation', () => {
    it('strictly rejects a token with an empty subject (UID)', () => {
      const emptySubToken = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        sub: '',
      });

      expect(() => {
        verifyFirebaseIdToken(emptySubToken, { expectedProjectId: 'lodhiai-cloud' });
      }).toThrow('Firebase ID Token missing or invalid subject (UID)');
    });

    it('strictly rejects a token with an oversized subject (>128 chars)', () => {
      const longSubToken = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        sub: 'a'.repeat(150),
      });

      expect(() => {
        verifyFirebaseIdToken(longSubToken, { expectedProjectId: 'lodhiai-cloud' });
      }).toThrow('Firebase ID Token missing or invalid subject (UID)');
    });
  });

  describe('6. Key Rotation & Unknown Key ID Handling', () => {
    it('fails synchronously when a token uses an unknown key ID not in cache', () => {
      const unknownKidToken = mintTestFirebaseToken({
        privateKey: secondaryKeypair.privateKey,
        kid: 'unseen-google-kid-999',
      });

      expect(() => {
        verifyFirebaseIdToken(unknownKidToken, { expectedProjectId: 'lodhiai-cloud' });
      }).toThrow('is not cached');
    });

    it('handles key rotation when new key is dynamically added to public certificate store', async () => {
      const rotatedKeyId = 'google-rotated-kid-2026';
      const rotatedToken = mintTestFirebaseToken({
        privateKey: secondaryKeypair.privateKey,
        kid: rotatedKeyId,
        sub: 'usr_rotated_account',
      });

      // Initially missing in cache
      expect(googleCertStore.getCertificate(rotatedKeyId)).toBeNull();

      // Simulate Google publishing the new key during rotation
      setFirebasePublicKeys({
        [rotatedKeyId]: secondaryKeypair.publicKey,
      });

      const payload = await verifyFirebaseIdTokenAsync(rotatedToken, { expectedProjectId: 'lodhiai-cloud' });
      expect(payload.sub).toBe('usr_rotated_account');
    });
  });

  describe('7. Verification / Network Failure Handling', () => {
    it('fails closed and rejects authentication if public certificates cannot be fetched', async () => {
      // Point store endpoint to an unreachable address to simulate network outage
      googleCertStore.setEndpoint('http://127.0.0.1:59999/unreachable-endpoint');
      clearFirebasePublicKeys();

      const token = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        kid: 'key-during-outage',
      });

      await expect(
        verifyFirebaseIdTokenAsync(token, { expectedProjectId: 'lodhiai-cloud' })
      ).rejects.toThrow('Failed to fetch Google public certificates');
    });
  });

  describe('8. Defense Against Client-Forged Roles and Plans', () => {
    it('sanitizes unauthorized role and plan claims injected into tokens', () => {
      const attackerToken = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        sub: 'usr_sneaky_dev',
        role: 'super_admin_root', // forged invalid role
        plan: 'enterprise_unlimited_free', // forged invalid plan
      });

      const payload = verifyFirebaseIdToken(attackerToken, { expectedProjectId: 'lodhiai-cloud' });
      // Role & plan must safely fall back to authoritative defaults
      expect(payload.role).toBe('developer');
      expect(payload.plan).toBe('free');
    });

    it('authoritative subscription resolver overrides client claims with genuine server entitlements', async () => {
      const clientToken = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        sub: 'usr_paying_customer',
        plan: 'free',
      });

      const verified = await verifyFirebaseIdTokenAsync(clientToken, {
        expectedProjectId: 'lodhiai-cloud',
        authoritativeSubscriptionResolver: async (uid) => {
          // Authoritative DB lookup
          if (uid === 'usr_paying_customer') {
            return { plan: 'pro', role: 'owner' };
          }
          return { plan: 'free', role: 'developer' };
        },
      });

      expect(verified.plan).toBe('pro');
      expect(verified.role).toBe('owner');
    });
  });

  describe('9. Production Mode Safeguards & Rejection of Simulated Tokens', () => {
    it('strictly forbids simulated tokens (fb_id_token_*) when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      process.env.FIREBASE_PROJECT_ID = 'lodhiai-cloud-prod';

      expect(() => {
        verifyFirebaseIdToken('fb_id_token_usr_attacker_1730000000', {
          expectedProjectId: 'lodhiai-cloud-prod',
        });
      }).toThrow('Simulated Firebase tokens are strictly forbidden in production mode');
    });

    it('strictly forbids simulated tokens when allowSimulatedTokens is explicitly false', () => {
      process.env.NODE_ENV = 'development';

      expect(() => {
        verifyFirebaseIdToken('fb_id_token_usr_attacker_1730000000', {
          expectedProjectId: 'lodhiai-cloud',
          allowSimulatedTokens: false,
        });
      }).toThrow('Simulated Firebase tokens are strictly forbidden');
    });

    it('rejects verification in production if FIREBASE_PROJECT_ID is unconfigured', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.FIREBASE_PROJECT_ID;

      const token = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
      });

      expect(() => {
        verifyFirebaseIdToken(token);
      }).toThrow('Production mode requires explicitly configured FIREBASE_PROJECT_ID');
    });
  });

  describe('10. Revocation Blacklist Enforcement', () => {
    it('rejects authenticated token if user UID has been revoked', () => {
      const token = mintTestFirebaseToken({
        privateKey: primaryKeypair.privateKey,
        sub: 'usr_compromised_alice',
      });

      // Verify once before revocation
      expect(verifyFirebaseIdToken(token).sub).toBe('usr_compromised_alice');

      // Revoke user
      revokeToken('usr_compromised_alice');

      // Now must be rejected
      expect(() => {
        verifyFirebaseIdToken(token);
      }).toThrow('Token or user has been revoked');
    });
  });
});
