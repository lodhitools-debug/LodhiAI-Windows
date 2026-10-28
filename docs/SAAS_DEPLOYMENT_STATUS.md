# Lodhi AI — Commercial SaaS Cloud Deployment & Payment Status

**Document Version:** 1.0.0  
**Date:** October 25, 2026  
**Infrastructure Engineer:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Ground-Truth Cloud Deployment Status

| Infrastructure Component | Current State | Live Cloud Host | Technical Blockers |
| :--- | :---: | :---: | :--- |
| **Backend API Service (`src/server/`)** | Local Code Complete (17 Tests Pass) | None (Local only) | Cloud compute instance not provisioned. |
| **Multi-Tenant Database (`schema.sql`)** | Schema Ready with RLS Policies | None (Local only) | PostgreSQL cloud database not provisioned. |
| **Token Revocation & Cache Store** | In-Memory Simulation Ready | None (Local only) | Redis cloud cluster not provisioned. |
| **Production Domain & TLS Routing** | Domain Not Configured | None | DNS records and SSL certificates pending. |
| **Stripe Payment Gateway** | Adapter & Webhook Guard Verified | Sandbox Blocked | Requires US/Delaware legal entity (Stripe Atlas). |
| **Lemon Squeezy (MoR)** | Adapter & Webhook Guard Verified | Sandbox Blocked | Requires founder CNIC/Passport verification & W-8BEN. |

> [!IMPORTANT]
> **No live cloud deployment has been executed.**  
> In adherence to strict safety mandates, no paid cloud resources, external databases, DNS modifications, or live webhooks have been created without explicit user authorization and credentials.

---

## 2. Environment Configuration Specifications

The following environment variables are required to deploy the verified `src/server/` backend to staging or production. **No real secrets or private keys are committed to Git.**

```bash
# ==============================================================================
# LODHI AI COMMERCIAL SAAS ENVIRONMENT CONFIGURATION TEMPLATE
# ==============================================================================

# Server Runtime Settings
NODE_ENV=production
PORT=8080
API_BASE_URL=https://api.lodhiai.com
ALLOWED_ORIGINS=tauri://localhost,http://localhost:1420

# Relational Database (PostgreSQL 14+ with Row-Level Security)
# Replace with actual managed connection string (e.g., Supabase / Neon / AWS RDS)
DATABASE_URL=postgres://lodhi_app:<ENCRYPTED_DB_PASSWORD>@db.lodhiai.com:5432/lodhiai_saas?sslmode=require

# High-Performance Revocation Cache (Redis 7+ TLS)
REDIS_URL=rediss://default:<ENCRYPTED_REDIS_PASSWORD>@cache.lodhiai.com:6379

# Cryptographic Token Secrets (Must be 64-character high-entropy hex strings)
JWT_SECRET=<GENERATE_VIA_CRYPTO_RANDOM_BYTES_64>
JWT_REFRESH_SECRET=<GENERATE_VIA_CRYPTO_RANDOM_BYTES_64>

# Ed25519 Digital License Signing Secret Key (SERVER-SIDE PRIVATE KEY ONLY)
# CRITICAL: Keep offline in KMS / Vault. The desktop binary contains only LODHI_PUBLIC_VERIFY_KEY.
LODHI_LICENSE_SIGNING_KEY=<OFFLINE_ED25519_PRIVATE_KEY_HEX>

# Payment Provider Configuration (Lemon Squeezy - Recommended for Pakistan Founders)
LEMON_SQUEEZY_API_KEY=<LIVE_API_KEY_FROM_LEMON_SQUEEZY>
LEMON_SQUEEZY_WEBHOOK_SECRET=<SIGNING_SECRET_CONFIGURED_IN_WEBHOOKS>
LEMON_SQUEEZY_STORE_ID=<STORE_NUMERIC_IDENTIFIER>

# Payment Provider Configuration (Stripe - Requires US/UK Incorporation)
STRIPE_SECRET_KEY=sk_live_<STRIPE_SECRET_KEY>
STRIPE_WEBHOOK_SECRET=whsec_<STRIPE_WEBHOOK_SIGNING_SECRET>
```

---

## 3. Database Migration, Backup & Rollback Runbook

### 3.1 Initial Migration Execution
To initialize the multi-tenant database schema with Row-Level Security:
```bash
# Execute schema migration on the managed PostgreSQL database
psql "$DATABASE_URL" -f "src/server/schema.sql"
```

### 3.2 Schema Invariant Verification
Verify that Row-Level Security is enforced across all tables:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('users', 'subscriptions', 'devices', 'audit_logs');
```
*Expected Result:* `rowsecurity = true` for all tenant tables.

### 3.3 Database Backup Procedure
Schedule daily automated backups with Point-In-Time Recovery (PITR):
```bash
# Logical dump for disaster recovery and offsite archiving
pg_dump -Fc --no-acl --no-owner "$DATABASE_URL" -f "lodhiai_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### 3.4 Emergency Rollback Procedure
If a database migration fails:
```bash
# Restore from previous verified dump snapshot
pg_restore --clean --if-exists --no-acl --no-owner -d "$DATABASE_URL" "lodhiai_backup_PRE_MIGRATION.dump"
```

---

## 4. Payment Gateway Evaluation & Pakistan Merchant Strategy

### 4.1 Lemon Squeezy (Merchant of Record — Primary Recommended Strategy)
- **Eligibility:** Available to founders located in Pakistan.
- **Tax & Compliance:** Acts as Merchant of Record; handles global VAT, GST, and sales tax compliance across 135+ countries.
- **Payout:** Payouts routed to Wise Business (USD) or Payoneer (USD), which transfer directly to Pakistani commercial bank accounts (HBL, Meezan, Bank Alfalah) at official interbank rates.
- **Required Founder Actions:**
  1. Register account at [lemonsqueezy.com](https://www.lemonsqueezy.com).
  2. Complete identity verification (Government-issued CNIC or Passport).
  3. Submit IRS Form W-8BEN electronically to eliminate 30% US withholding tax under the Pakistan-US Double Tax Treaty.
  4. Create products (`Lodhi AI Pro Monthly`, `Lodhi AI Pro Annual`, `Lodhi AI Business`).
  5. Configure webhook URL pointing to `https://api.lodhiai.com/webhooks/lemonsqueezy`.

### 4.2 Stripe Atlas (US LLC — Alternative Corporate Strategy)
- **Eligibility:** Available globally by establishing a Delaware or Wyoming LLC.
- **Cost:** ~$500 incorporation fee + $25/month registered agent + annual state franchise tax.
- **Banking:** Mercury Bank or Brex US business account.
- **Required Founder Actions:**
  1. Form US entity through Stripe Atlas.
  2. Obtain IRS EIN (Employer Identification Number).
  3. Open US business bank account.
  4. Activate live Stripe account and configure webhook secret.

---

## 5. Security & Operational Requirements

1. **Zero Cardholder Data Storage:** Credit card and debit card details are never transmitted through or stored in Lodhi AI servers. All billing transactions occur on hosted checkout pages with PCI-DSS Level 1 compliance.
2. **Server-Side Entitlement Enactment:** Subscriptions and license tokens are strictly minted server-side upon cryptographic signature verification of webhook events. The frontend client cannot grant itself Pro or Business status.
3. **Webhook Replay Prevention:** All incoming webhook payloads are validated against a 300-second timestamp tolerance window. Processed event IDs are recorded in the deduplication cache, preventing re-execution of duplicate requests.
4. **Token Blacklisting & Revocation:** When a user logs out, rotates passwords, or revokes a companion device, the JWT `jti` claim is instantly added to the Redis revocation blacklist.
5. **TLS & Edge Protection:** Production API endpoints must sit behind Cloudflare with HSTS (HTTP Strict Transport Security), TLS 1.3 only, and automated DDoS rate-limiting rules.
