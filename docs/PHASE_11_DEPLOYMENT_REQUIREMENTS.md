# Lodhi AI — Phase 11 Cloud Deployment Requirements & External Blockers

**Document Version:** 1.0.0  
**Date:** October 25, 2026  
**Infrastructure Lead:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Legacy Project Boundary:** `E:\LodhiAI` (Strictly off-limits · 100% isolated)  

---

## 1. Executive Summary & Honest Readiness Status

The local commercial backend foundation (`src/server/`) has been implemented, validated, and verified with **17 automated unit tests** in `src/test/CommercialSaaS.test.ts`. 

However, in accordance with the project guidelines (**"Never describe documentation as a live deployment"** and **"Do not invent a production endpoint, real customer, payment confirmation, or deployed service"**), this document establishes the concrete technical, business, legal, and credential prerequisites required to transition the verified local foundation into live cloud production.

---

## 2. External Infrastructure Prerequisites

| Component | Minimum Specification | Recommended Production Provider | Estimated Cost |
| :--- | :--- | :--- | :--- |
| **Cloud API Server** | Node.js 20+ runtime, 2 vCPU, 4 GB RAM | Railway / Fly.io / AWS App Runner | $15–$40 / month |
| **Multi-Tenant DB** | PostgreSQL 14+ with RLS and UUID extensions | Supabase / Neon / AWS RDS PostgreSQL | $0 (Hobby) – $25 / month |
| **Cache & Revocation** | Redis 7+ in-memory key-value store | Upstash Redis / Redis Cloud | $0–$10 / month |
| **DNS & Edge WAF** | DNSSEC, Cloudflare Proxy, Rate Limiting Rules | Cloudflare (Pro or Free tier) | $0–$20 / month |
| **Object Storage** | S3-compatible encrypted bucket (for exports) | Cloudflare R2 / AWS S3 | $0–$5 / month |

---

## 3. Merchant & Payment Provider Requirements (Pakistan & Global)

### 3.1 Option A: Lemon Squeezy (Merchant of Record — Recommended)
- **Eligibility:** Fully open to Pakistan-based founders and software companies.
- **Tax Handling:** Lemon Squeezy acts as the Merchant of Record, automatically calculating and remitting sales tax and VAT across 100+ countries.
- **Required User Actions:**
  1. Register on [lemonsqueezy.com](https://www.lemonsqueezy.com) and submit business verification (CNIC / Passport + Bank Statement).
  2. Complete IRS Form W-8BEN to claim 0% US withholding tax under the Pakistan-US Double Taxation Treaty.
  3. Connect payout routing to a Wise or Payoneer USD account.
  4. Generate and configure webhook signing secret (`LEMON_SQUEEZY_SECRET`) in cloud environment.

### 3.2 Option B: Stripe Atlas (US Delaware LLC)
- **Eligibility:** Open globally via legal incorporation in Delaware.
- **Setup Overhead:** $500 incorporation fee + $100–$300 annual Delaware franchise tax.
- **Required User Actions:**
  1. Apply via [stripe.com/atlas](https://stripe.com/atlas).
  2. Obtain IRS EIN (Employer Identification Number).
  3. Open a US business banking account via Mercury or Brex.
  4. Activate Stripe Billing live mode and generate webhook signing secret (`STRIPE_WEBHOOK_SECRET`).

---

## 4. Production Environment Configuration (`.env.production`)

The cloud backend requires the following environment variables. **None of these secrets should ever be committed to Git or bundled into the desktop binary:**

```bash
# Server Configuration
NODE_ENV=production
PORT=8080
API_BASE_URL=https://api.lodhiai.com
ALLOWED_ORIGINS=tauri://localhost,http://localhost:1420

# Database & Cache (Secrets)
DATABASE_URL=postgres://lodhi_admin:<STRONG_PASSWORD>@db.lodhiai.com:5432/lodhi_saas?sslmode=require
REDIS_URL=rediss://default:<STRONG_PASSWORD>@redis.lodhiai.com:6379

# Cryptographic Token Secrets
JWT_SECRET=<64-BYTE-HIGH-ENTROPY-RANDOM-HEX>
JWT_REFRESH_SECRET=<64-BYTE-HIGH-ENTROPY-RANDOM-HEX>

# Lodhi AI License Token Signing Key (Private Key)
# CRITICAL: Keep offline in KMS / Vault. The desktop binary has only the PUBLIC key.
LODHI_LICENSE_SIGNING_KEY=7f9a1c3e5b7d9f2a4c6e80b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2

# Payment Webhooks (Live Mode)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
LEMON_SQUEEZY_API_KEY=...
LEMON_SQUEEZY_WEBHOOK_SECRET=...
```

---

## 5. Desktop Application Code Signing Requirements

To distribute the Windows release installer (`.msi` / `.exe`) publicly without triggering Windows Defender SmartScreen warnings:
1. **EV (Extended Validation) Code Signing Certificate:** Required from a recognized Certificate Authority (Sectigo, DigiCert, or SSL.com).
2. **Hardware Security Module (HSM) or Cloud Token:** Modern EV certificates require a FIPS 140-2 Level 2 hardware token or cloud HSM (e.g. Azure Key Vault / DigiCert ONE).
3. **Tauri Configuration:** Configure `src-tauri/tauri.conf.json` with code signing certificate details:
   ```json
   "bundle": {
     "windows": {
       "certificateThumbprint": "<THUMBPRINT>",
       "digestAlgorithm": "sha256",
       "timestampUrl": "http://timestamp.digicert.com"
     }
   }
   ```

---

## 6. Clear Checklist of Pending External Actions

| Action Item | Responsible Party | Dependency | Status |
| :--- | :---: | :--- | :---: |
| **Local SaaS Architecture & Logic** | Antigravity AI | Repository workspace | **COMPLETED** |
| **Automated SaaS Test Suite** | Antigravity AI | Node.js runtime | **COMPLETED (17/17 PASS)** |
| **Lemon Squeezy Merchant Account** | User / Founder | Business verification (CNIC/Passport) | **PENDING USER ACTION** |
| **Cloud PostgreSQL Provisioning** | User / Founder | Cloud provider account (Supabase/AWS) | **PENDING USER ACTION** |
| **Domain & DNS Setup (`lodhiai.com`)** | User / Founder | Domain registrar | **PENDING USER ACTION** |
| **Windows EV Code Signing Cert** | User / Founder | CA identity verification | **PENDING USER ACTION** |
| **Production Cloud Deployment** | Antigravity AI + User | Verified credentials & DNS | **BLOCKED ON EXTERNAL ACCOUNTS** |
