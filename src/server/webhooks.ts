import crypto from 'crypto';
import { WebhookProcessingResult } from './types';

// In-memory idempotency cache (in production, backed by PostgreSQL idempotency_keys table)
const processedEventIds = new Set<string>();

/**
 * Verify a Stripe webhook signature using HMAC-SHA256 with timestamp tolerance
 * Replay protection window: 300 seconds (5 minutes)
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): { isValid: boolean; timestamp?: number; error?: string } {
  if (!signatureHeader) {
    return { isValid: false, error: 'Missing Stripe-Signature header' };
  }

  // Parse header: t=1612345678,v1=5257a869e7eeeefe259435028b674201e5ac0f84...
  const items = signatureHeader.split(',');
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const item of items) {
    const [k, v] = item.split('=');
    if (k === 't') {
      timestamp = parseInt(v, 10);
    } else if (k === 'v1') {
      signatures.push(v);
    }
  }

  if (!timestamp || isNaN(timestamp) || signatures.length === 0) {
    return { isValid: false, error: 'Malformed Stripe-Signature header' };
  }

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return { isValid: false, error: 'Webhook timestamp outside tolerance window (replay attack detected)' };
  }

  // Compute expected HMAC
  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  // Timing safe equality
  let matched = false;
  const expectedBuf = Buffer.from(expectedSignature, 'hex');

  for (const sig of signatures) {
    try {
      const sigBuf = Buffer.from(sig, 'hex');
      if (expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf)) {
        matched = true;
        break;
      }
    } catch {
      // ignore invalid hex
    }
  }

  if (!matched) {
    return { isValid: false, error: 'Invalid Stripe signature' };
  }

  return { isValid: true, timestamp };
}

/**
 * Verify Lemon Squeezy webhook signature (HMAC-SHA256 of raw body)
 */
export function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHex: string,
  secret: string
): { isValid: boolean; error?: string } {
  if (!signatureHex) {
    return { isValid: false, error: 'Missing X-Signature header' };
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const providedBuf = Buffer.from(signatureHex, 'hex');

  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return { isValid: false, error: 'Invalid Lemon Squeezy signature' };
  }

  return { isValid: true };
}

/**
 * Process a verified webhook event idempotently
 */
export function processWebhookEvent(params: {
  eventId: string;
  eventType: string;
  gateway: 'stripe' | 'lemonsqueezy';
  payload: any;
}): WebhookProcessingResult {
  const { eventId, eventType, gateway } = params;

  if (processedEventIds.has(eventId)) {
    return {
      success: true,
      isDuplicate: true,
      eventId,
      actionTaken: 'Ignored duplicate webhook event (already processed)',
    };
  }

  // Process subscription lifecycle events
  let actionTaken = 'No action required for this event type';

  if (eventType === 'checkout.session.completed' || eventType === 'subscription_created') {
    actionTaken = `Provisioned subscription tier upgrade for customer via ${gateway}`;
  } else if (eventType === 'customer.subscription.updated' || eventType === 'subscription_updated') {
    actionTaken = `Updated active subscription period and limits via ${gateway}`;
  } else if (eventType === 'customer.subscription.deleted' || eventType === 'subscription_cancelled') {
    actionTaken = `Downgraded customer to Free Community Edition via ${gateway}`;
  }

  // Commit idempotency key
  processedEventIds.add(eventId);

  return {
    success: true,
    isDuplicate: false,
    eventId,
    actionTaken,
  };
}

/**
 * Clear idempotency cache (for testing)
 */
export function clearIdempotencyCache(): void {
  processedEventIds.clear();
}
