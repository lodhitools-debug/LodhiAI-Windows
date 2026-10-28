# Lodhi AI — Phase 14 Cloud Deployment & Operations Runbook

**Document Version:** 1.0.0  
**Phase:** Phase 14 — Cloud Deployment Architecture  
**Project:** Lodhi AI Desktop for Windows  
**Audit Completion Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Cloud Architecture Overview

The recommended production deployment topology separates client desktop traffic, API computation, state storage, and payment webhooks:

```
[ Lodhi AI Windows Desktop ]
          │
          ▼ HTTPS / TLS 1.3
[ Cloudflare Edge WAF & CDN ] (DDoS Protection, SSL Termination, DNS)
          │
          ▼ Reverse Proxy
[ Containerized API Service ] (Railway / Fly.io / AWS App Runner)
   ├── Node.js / Express API Runtime (src/server/)
   ├── Sliding Window Rate Limiter & Token Meter
   └── Webhook Verification Endpoints (/api/webhooks/stripe, /api/webhooks/lemonsqueezy)
          │
    ┌─────┴─────────────────────────┐
    ▼                               ▼
[ Managed PostgreSQL 14+ ]     [ Managed Redis 7+ ]
(Supabase / Neon / AWS RDS)    (Upstash / AWS ElastiCache)
- Row-Level Security (RLS)     - Short-lived Token Blacklist
- ACID Transactions            - Distributed Sliding Window
- Automated Daily Backups      - Idempotency State Cache
```

---

## 2. Environment Variables Specification

Create `.env.production` on the production server (never commit secrets to version control):

```bash
# Server Port & Environment
PORT=8080
NODE_ENV=production
APP_BASE_URL=https://api.lodhiai.com

# PostgreSQL Connection Pool (SSL Required)
DATABASE_URL=postgresql://lodhi_app:<SECURE_DB_PASSWORD>@<DB_HOST>:5432/lodhi_saas?sslmode=require
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis Cache (Distributed Rate Limiting & Revocation)
REDIS_URL=rediss://default:<SECURE_REDIS_PASSWORD>@<REDIS_HOST>:6379

# Cryptographic JWT Signing Secret (Minimum 64 characters random)
JWT_SIGNING_SECRET=<RANDOM_64_CHAR_HEX_SECRET>
JWT_EXPIRATION_SECONDS=900

# Stripe Payment Gateway Credentials (Sandbox / Live)
STRIPE_SECRET_KEY=sk_test_placeholder_for_production
STRIPE_WEBHOOK_SECRET=whsec_placeholder_for_production

# Lemon Squeezy Merchant of Record Credentials
LEMON_SQUEEZY_API_KEY=ls_placeholder_api_key
LEMON_SQUEEZY_STORE_ID=placeholder_store_id
LEMON_SQUEEZY_WEBHOOK_SECRET=placeholder_webhook_secret

# CORS & Security
ALLOWED_ORIGINS=tauri://localhost,http://localhost:1420,https://app.lodhiai.com
RATE_LIMIT_AUTH_PER_MINUTE=5
RATE_LIMIT_API_PER_MINUTE=60
```

---

## 3. Database Migration, Backup & Rollback Runbook

### 3.1 Initial Migration
1. Connect via `psql` using administrative credentials:
   ```bash
   psql "$DATABASE_URL" -f src/server/schema.sql
   ```
2. Verify table creation and RLS activation:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
   -- Ensure users, subscriptions, licenses, and audit_logs show rowsecurity = true
   ```

### 3.2 Automated Daily Backups
Configure managed automated point-in-time recovery (PITR) in Supabase or Neon (retaining 7 days minimum).
Manual on-demand snapshot:
```bash
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > "lodhi_saas_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### 3.3 Rollback Procedure
If a migration or bad deployment occurs:
1. Place container in maintenance mode (return 503 on health check).
2. Restore database state from pre-deployment snapshot:
   ```bash
   pg_restore --clean --if-exists -d "$DATABASE_URL" "lodhi_saas_backup_<PRE_DEPLOY_TIMESTAMP>.dump"
   ```
3. Roll back application container image on Railway/Fly.io to the previous release tag.
4. Verify `/api/health` status returns `HTTP 200 OK`.

---

## 4. Operational Health Checks & Logging Standards

- **Endpoint:** `GET /api/health`
  - Responds with `HTTP 200 OK` when DB connection pool is active.
  - Returns `{"status":"ok","version":"0.1.0","timestamp":1792945000}`.
- **Structured Redacted Logging:**
  - Standard JSON output: `{"timestamp":"...","level":"INFO","tenantId":"...","action":"..."}`.
  - Telemetry and error handlers must continuously pipe strings through `sanitizeLogText()` in `logger.ts` to ensure no `AIza*`, `sk_*`, or authorization headers enter CloudWatch/Datadog.

---

## 5. Free-Tier Cloud Limits vs Estimated Production Costs

| Component | Free Tier Capacity | Estimated Future Cost at Scale |
| :--- | :--- | :--- |
| **Compute (Railway / Fly.io)** | Free hobby credits (500 hrs/mo) | $5 - $20 / month for dedicated 2GB RAM container |
| **PostgreSQL (Supabase / Neon)** | 500 MB storage, 2 active projects free | $25 / month (Supabase Pro) for 8GB DB & daily PITR |
| **Redis (Upstash)** | 10,000 commands / day free | $0.20 per 100k requests |
| **Edge / CDN (Cloudflare)** | Free unlimited bandwidth & SSL | Free tier sufficient for initial launch |
| **Total Cloud Infra Cost:** | **$0 / month (Initial Developer Phase)** | **~$30 - $50 / month at 500-1,000 active users** |
