# Lodhi AI — Phase 14 Security Review & Multi-Tenant Threat Model

**Document Version:** 1.0.0  
**Phase:** Phase 14 — Security Audit  
**Project:** Lodhi AI Desktop for Windows  
**Audit Completion Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Threat Modeling Overview

Lodhi AI combines an offline-first Windows desktop client with an optional commercial multi-tenant SaaS backend. This architecture introduces distinct trust zones:
- **Zone 0 (Workstation Local):** Tauri shell, local Ollama models, DPAPI-encrypted secrets, local SQLite/JSON history.
- **Zone 1 (Transport Layer):** HTTPS/TLS 1.3 between desktop client and cloud API.
- **Zone 2 (Cloud Edge / Gateway):** Reverse proxy (Cloudflare/Nginx), rate limiting, DDoS mitigation.
- **Zone 3 (Application Server):** Node.js API server (`src/server/`), JWT verification, RBAC, usage metering.
- **Zone 4 (Database & State):** PostgreSQL 14+ with Row-Level Security (RLS), Redis token blacklist.

---

## 2. Threat Analysis & Mitigations

### 2.1 Threat 1: Cross-Tenant Data Leakage
- **Attack Vector:** An authenticated user in Tenant A manipulates API parameters (e.g. `GET /api/audit-logs?tenantId=tenant_B`) to access or modify Tenant B's data.
- **Mitigation Architecture:**
  1. **Application Layer:** `authorizeRequest({ token, jwtSecret, requiredTenantId })` validates that the token's cryptographically signed `tenantId` claim matches the requested resource. Cross-tenant requests are denied immediately with `403 Forbidden`.
  2. **Database Layer (RLS):** In PostgreSQL, `tenant_isolation_*` policies enforce `USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)`. Even if application query logic omits `WHERE tenant_id = ...`, PostgreSQL filters rows automatically.
- **Test Evidence:** Verified in `CommercialSaaS.test.ts` ("STRICTLY DENIES cross-tenant resource access").

### 2.2 Threat 2: Client-Side Entitlement Tampering
- **Attack Vector:** A Free user modifies client JavaScript or Tauri memory to set `plan: "business"` or `cloudTokensPerMonth: 2500000`.
- **Mitigation Architecture:**
  1. The desktop client cannot self-grant cloud tokens or bypass quotas. Cloud inference requests pass through the server-side `UsageMeter.checkQuota()`.
  2. Digital license tickets use asymmetric digital signatures (`LODHI-SHA256-V1`). Tampered payloads fail cryptographic signature verification in both Rust and TypeScript.
- **Test Evidence:** Verified in `CommercialSaaS.test.ts` ("rejects forged license signatures and altered tier claims").

### 2.3 Threat 3: Payment Webhook Replay & Forgery
- **Attack Vector:** An attacker captures a valid Stripe webhook payload and replays it repeatedly to maintain perpetual Pro subscriptions, or sends forged payloads.
- **Mitigation Architecture:**
  1. **Signature Verification:** Validates `Stripe-Signature` (HMAC-SHA256) and Lemon Squeezy `X-Signature` using shared secrets.
  2. **Timestamp Replay Window:** Rejects webhooks with timestamps outside a 300-second (5 minute) tolerance window.
  3. **Idempotency Keys:** Every `eventId` is recorded in `idempotency_keys`. Duplicate events are acknowledged without repeating database mutations.
- **Test Evidence:** Verified in `CommercialSaaS.test.ts` ("rejects Stripe webhook replay attack" and "enforces idempotency").

### 2.4 Threat 4: Credential & Secret Exposure
- **Attack Vector:** API keys, database credentials, or payment secrets leaking into console logs, telemetry, or client diagnostic bundles.
- **Mitigation Architecture:**
  1. Secret redaction regex in `logger.ts` strips `AIza*`, `sk_live_*`, `whsec_*`, JWT tokens, and passwords from logs and diagnostic exports.
  2. Payment secret keys and JWT signing secrets exist exclusively in server environment variables and are never bundled in desktop builds.
  3. User passwords are stored using salted PBKDF2/SHA-512 hashes (100k iterations).
- **Test Evidence:** Verified in `Security.test.tsx` and `logger.ts` unit tests.

### 2.5 Threat 5: Denial of Service & API Abuse
- **Attack Vector:** Scripted credential stuffing or continuous inference requests exhausting server compute.
- **Mitigation Architecture:**
  1. Sliding window rate limiter (`SlidingWindowRateLimiter`) isolates limits per client IP (e.g. 5 attempts / minute for auth; 60 requests / minute for API).
  2. Rate limit exhaustion returns HTTP 429 with `RateLimit-Reset` timestamp.
- **Test Evidence:** Verified in `CommercialSaaS.test.ts` ("permits requests within quota and blocks requests exceeding limit").

---

## 3. Residual Risks & Production Requirements

1. **Production Redis Cluster:** The in-memory token blacklist and rate limiter must be backed by a managed Redis instance in production to support horizontal multi-instance scaling.
2. **Database Superuser Isolation:** The application connection pool must connect to PostgreSQL as a restricted user without `BYPASSRLS` privileges to guarantee RLS enforcement.
3. **WAF & DDoS Shield:** Cloudflare or equivalent edge proxy must be positioned in front of production API endpoints.
