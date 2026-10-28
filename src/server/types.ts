export type SubscriptionTier = 'free' | 'pro' | 'business';

export interface Tenant {
  id: string;
  name: string;
  plan: SubscriptionTier;
  status: 'active' | 'past_due' | 'cancelled';
  createdAt: number;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  createdAt: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
    plan: SubscriptionTier;
  };
}

export interface JWTPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  plan: SubscriptionTier;
  iat: number;
  exp: number;
  jti?: string;
  auth_time?: number;
  firebase?: Record<string, any>;
}

export interface ServerLicenseTicket {
  licenseId: string;
  issuer: string;
  subject: string;
  tier: SubscriptionTier;
  features: string[];
  issuedAt: number;
  expiresAt: number;
  deviceId?: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  isDuplicate: boolean;
  eventId: string;
  actionTaken: string;
  error?: string;
}
