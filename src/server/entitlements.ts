import { SubscriptionTier } from './types';

export interface TierEntitlements {
  tier: SubscriptionTier;
  displayName: string;
  maxDevices: number;
  cloudTokensPerMonth: number;
  allowsBYOKCloud: boolean;
  allowsManagedCloud: boolean;
  allowsVoiceSAPI: boolean;
  allowsTeamPolicies: boolean;
  offlineGraceDays: number;
  features: string[];
}

export const TIER_CONFIG: Record<SubscriptionTier, TierEntitlements> = {
  free: {
    tier: 'free',
    displayName: 'Free Community Edition',
    maxDevices: 1,
    cloudTokensPerMonth: 0,
    allowsBYOKCloud: true, // Users can supply their personal Google Gemini key
    allowsManagedCloud: false,
    allowsVoiceSAPI: true,
    allowsTeamPolicies: false,
    offlineGraceDays: 999999, // Perpetual offline local usage
    features: [
      'local_ollama_chat',
      'coding_agent',
      'workspace_sandboxing',
      'document_rag_local',
      'native_voice_sapi',
      'gemini_byok',
    ],
  },
  pro: {
    tier: 'pro',
    displayName: 'Developer Pro',
    maxDevices: 3,
    cloudTokensPerMonth: 500000,
    allowsBYOKCloud: true,
    allowsManagedCloud: true,
    allowsVoiceSAPI: true,
    allowsTeamPolicies: false,
    offlineGraceDays: 14,
    features: [
      'local_ollama_chat',
      'coding_agent',
      'workspace_sandboxing',
      'document_rag_local',
      'native_voice_sapi',
      'gemini_byok',
      'managed_cloud_inference',
      'multi_device_sync',
      'priority_support',
    ],
  },
  business: {
    tier: 'business',
    displayName: 'Business Enterprise',
    maxDevices: 10,
    cloudTokensPerMonth: 2500000,
    allowsBYOKCloud: true,
    allowsManagedCloud: true,
    allowsVoiceSAPI: true,
    allowsTeamPolicies: true,
    offlineGraceDays: 30,
    features: [
      'local_ollama_chat',
      'coding_agent',
      'workspace_sandboxing',
      'document_rag_local',
      'native_voice_sapi',
      'gemini_byok',
      'managed_cloud_inference',
      'multi_device_sync',
      'priority_support',
      'central_audit_stream',
      'team_workspace_policies',
      'custom_model_routing',
    ],
  },
};

/**
 * Evaluate entitlements for a given subscription tier
 */
export function evaluateEntitlements(tier: SubscriptionTier): TierEntitlements {
  return TIER_CONFIG[tier] || TIER_CONFIG.free;
}

/**
 * Check if a specific feature is permitted under the active tier
 */
export function isFeaturePermitted(tier: SubscriptionTier, featureName: string): boolean {
  const entitlements = evaluateEntitlements(tier);
  return entitlements.features.includes(featureName);
}
