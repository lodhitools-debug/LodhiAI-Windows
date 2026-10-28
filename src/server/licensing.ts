import crypto from 'crypto';
import { ServerLicenseTicket, SubscriptionTier } from './types';

export const LODHI_OFFICIAL_ISSUER = 'lodhiai.com';
export const DEFAULT_VERIFICATION_KEY = '7f9a1c3e5b7d9f2a4c6e80b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2';

function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Issue an official cryptographically signed Lodhi AI License Token
 * Compatible with the native Windows desktop Ed25519/HMAC-SHA256 verifier.
 */
export function issueLicenseToken(params: {
  subject: string;
  tier: SubscriptionTier;
  durationDays?: number;
  features?: string[];
  deviceId?: string;
  signingKeyHex?: string;
}): { token: string; ticket: ServerLicenseTicket } {
  const signingKey = params.signingKeyHex || process.env.LODHI_LICENSE_SIGNING_KEY || DEFAULT_VERIFICATION_KEY;
  const nowSecs = Math.floor(Date.now() / 1000);
  const durationSecs = (params.durationDays || 365) * 86400;

  const ticket: ServerLicenseTicket = {
    licenseId: `lic_${crypto.randomBytes(8).toString('hex')}`,
    issuer: LODHI_OFFICIAL_ISSUER,
    subject: params.subject,
    tier: params.tier,
    features: params.features || [
      'ai_chat',
      'coding_agent',
      'voice_conversation',
      'rag_knowledge_base',
      'workspace_protection',
    ],
    issuedAt: nowSecs,
    expiresAt: nowSecs + durationSecs,
    deviceId: params.deviceId,
  };

  const header = {
    alg: 'LODHI-SHA256-V1',
    typ: 'LODHI_LIC',
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(ticket));
  const signedContent = `${encodedHeader}.${encodedPayload}`;

  const signatureHex = crypto
    .createHmac('sha256', Buffer.from(signingKey, 'utf-8'))
    .update(Buffer.from(signedContent, 'utf-8'))
    .digest('hex');

  const token = `${signedContent}.${signatureHex}`;

  return { token, ticket };
}

/**
 * Server-side verification of a license token
 */
export function verifyServerLicenseToken(
  token: string,
  verificationKeyHex?: string
): { isValid: boolean; ticket?: ServerLicenseTicket; error?: string } {
  const key = verificationKeyHex || DEFAULT_VERIFICATION_KEY;
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { isValid: false, error: 'Malformed token: expected 3 parts' };
  }

  const [hStr, pStr, sigHex] = parts;

  try {
    const header = JSON.parse(base64urlDecode(hStr));
    if (header.typ !== 'LODHI_LIC' || header.alg !== 'LODHI-SHA256-V1') {
      return { isValid: false, error: `Unsupported header: ${JSON.stringify(header)}` };
    }

    const signedContent = `${hStr}.${pStr}`;
    const expectedSigHex = crypto
      .createHmac('sha256', Buffer.from(key, 'utf-8'))
      .update(Buffer.from(signedContent, 'utf-8'))
      .digest('hex');

    if (sigHex.toLowerCase() !== expectedSigHex.toLowerCase()) {
      return { isValid: false, error: 'Cryptographic signature mismatch' };
    }

    const ticket: ServerLicenseTicket = JSON.parse(base64urlDecode(pStr));
    if (ticket.issuer !== LODHI_OFFICIAL_ISSUER) {
      return { isValid: false, error: 'Untrusted issuer' };
    }

    const nowSecs = Math.floor(Date.now() / 1000);
    if (nowSecs > ticket.expiresAt) {
      return { isValid: false, error: 'License expired', ticket };
    }

    return { isValid: true, ticket };
  } catch (err) {
    return { isValid: false, error: `Parse error: ${String(err)}` };
  }
}
