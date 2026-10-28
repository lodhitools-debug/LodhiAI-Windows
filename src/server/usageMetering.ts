import { SubscriptionTier } from './types';
import { TIER_CONFIG } from './entitlements';

/**
 * Lodhi AI — Server-Side AI Usage Metering & Quota Enforcement
 * Enforces strict server-side consumption tracking so clients cannot self-grant tokens
 * or manipulate quota boundaries.
 */

export interface TenantUsageSummary {
  tenantId: string;
  tier: SubscriptionTier;
  tokensConsumed: number;
  tokensLimit: number;
  percentUsed: number;
  isExhausted: boolean;
  cycleStartMs: number;
  cycleEndMs: number;
}

export class UsageMeter {
  // In production, backed by PostgreSQL `tenant_usage` table with row-level security
  private usage = new Map<string, { tokens: number; cycleStartMs: number }>();

  /**
   * Record token consumption for a tenant (called strictly server-side upon model response)
   */
  recordUsage(tenantId: string, tokens: number): number {
    if (tokens < 0) {
      throw new Error('Invalid negative token usage');
    }

    const current = this.getOrInit(tenantId);
    current.tokens += tokens;
    this.usage.set(tenantId, current);
    return current.tokens;
  }

  /**
   * Check if a requested inference batch is permitted under the tenant's tier quota
   */
  checkQuota(
    tenantId: string,
    tier: SubscriptionTier,
    estimatedTokens = 1000
  ): { allowed: boolean; remaining: number; reason?: string } {
    const config = TIER_CONFIG[tier] || TIER_CONFIG.free;

    // Free community tier has 0 managed cloud tokens (BYOK Gemini is client-billed)
    if (tier === 'free') {
      return {
        allowed: false,
        remaining: 0,
        reason: 'Managed cloud inference requires Pro or Business subscription. Free Community uses local Ollama or BYOK Gemini.',
      };
    }

    const current = this.getOrInit(tenantId);
    const limit = config.cloudTokensPerMonth;
    const remaining = Math.max(0, limit - current.tokens);

    if (current.tokens + estimatedTokens > limit) {
      return {
        allowed: false,
        remaining,
        reason: `Monthly token quota exhausted (${current.tokens}/${limit} tokens used). Upgrade to Business or wait for next billing cycle.`,
      };
    }

    return {
      allowed: true,
      remaining,
    };
  }

  /**
   * Get usage summary for reporting and dashboard display
   */
  getUsageSummary(tenantId: string, tier: SubscriptionTier): TenantUsageSummary {
    const config = TIER_CONFIG[tier] || TIER_CONFIG.free;
    const current = this.getOrInit(tenantId);
    const limit = config.cloudTokensPerMonth;
    const percentUsed = limit > 0 ? Math.min(100, Math.round((current.tokens / limit) * 100)) : 100;
    const isExhausted = limit > 0 ? current.tokens >= limit : true;

    // 30-day billing cycle estimate
    const cycleEndMs = current.cycleStartMs + 30 * 24 * 60 * 60 * 1000;

    return {
      tenantId,
      tier,
      tokensConsumed: current.tokens,
      tokensLimit: limit,
      percentUsed,
      isExhausted,
      cycleStartMs: current.cycleStartMs,
      cycleEndMs,
    };
  }

  /**
   * Reset usage for a tenant upon subscription renewal or start of new billing month
   */
  resetCycle(tenantId: string): void {
    this.usage.set(tenantId, {
      tokens: 0,
      cycleStartMs: Date.now(),
    });
  }

  /**
   * Clear usage store (for tests)
   */
  clear(): void {
    this.usage.clear();
  }

  private getOrInit(tenantId: string): { tokens: number; cycleStartMs: number } {
    let entry = this.usage.get(tenantId);
    if (!entry) {
      entry = { tokens: 0, cycleStartMs: Date.now() };
      this.usage.set(tenantId, entry);
    }
    return entry;
  }
}

export const globalUsageMeter = new UsageMeter();
