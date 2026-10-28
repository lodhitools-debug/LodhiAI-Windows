# Lodhi AI — Phase 1: Firebase Architecture Gap Audit & Migration Analysis

**Document Version:** 1.0.0  
**Project:** Lodhi AI Windows Desktop & Android Companion  
**Audit Date:** October 25, 2026  
**Auditor:** Antigravity AI Architecture Team  
**Authorized Project Root:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Executive Summary

This audit establishes the baseline architectural state of Lodhi AI Windows and Android Companion prior to introducing Firebase as the primary cloud backend platform.

Lodhi AI was initially engineered with an offline-first, local-first paradigm:
- **Local AI:** Ollama local model discovery and inference (`qwen2.5-coder:3b`), native SAPI 5.4 text-to-speech, and local BM25 document indexing.
- **Relay & SaaS Backend:** In-memory TypeScript server modules (`src/server/`) providing HMAC-SHA256 JWT auth, PBKDF2 password hashing, rate limiting, and an standalone HTTP/WebSocket relay server (`relayServer.ts`).
- **PostgreSQL Specification:** A multi-tenant schema with Row-Level Security (`src/server/schema.sql`).
- **Zero Existing Firebase Integration:** As verified by codebase grep, neither Firebase SDK nor Firestore configuration currently exists in the repository.

---

## 2. Existing Subsystems: Real Implementations vs. Mocks vs. Specs

| Subsystem | Real Implementation | Simulated / In-Memory Mock | Specification / DDL Only | Deployed Live Service |
| :--- | :---: | :---: | :---: | :---: |
| **Windows Desktop UI** | Yes (10 React screens) | No | No | No (Local Desktop App) |
| **Tauri / Rust Native Core** | Yes (103 Cargo tests pass) | No | No | No (Local PE64 binary) |
| **Local LLM Streaming** | Yes (Ollama IPC streaming) | Fallback sandbox | No | No (Local port 11434) |
| **Cloud Relay Server** | Yes (`relayServer.ts`, HTTP/WS) | No | No | No (Local port 4000) |
| **Android Companion** | Yes (16 Compose screens) | In-memory pairing test | No | No (Pending APK CI build) |
| **Authentication** | Yes (PBKDF2, JWT in `auth.ts`) | In-memory token blacklist | No | No (No live auth server) |
| **PostgreSQL Database** | **No** | Yes (`LocalTenantStore`) | **Yes (`schema.sql`)** | **No (Not deployed)** |
| **Firebase Auth / Firestore** | **No** | **No** | **No** | **No** |

---

## 3. PostgreSQL Schema Dependency & Migration Risk Assessment

### 3.1 Purpose of Existing PostgreSQL Schema (`src/server/schema.sql`)
The PostgreSQL schema was created to define a relational multi-tenant SaaS model for cloud deployment:
1. `tenants`: Multi-tenant organization boundaries.
2. `users`: Credentials, salt, role, and tenant foreign key.
3. `subscriptions`: Billing gateway IDs (Stripe/Lemon Squeezy), status, current period end.
4. `idempotency_keys`: Webhook event deduplication.
5. `licenses`: Cryptographic server-issued licenses for desktop seats.
6. `audit_logs`: Tenant-scoped activity logging.
7. `ROW LEVEL SECURITY (RLS)`: Isolation policies using `SET LOCAL app.current_tenant_id`.

### 3.2 Dependencies in Active Code
- `src/server/index.ts` implements `LocalTenantStore` which mimics the PostgreSQL schema in memory for unit testing (`src/test/CommercialSaaS.test.ts`).
- Neither `pg`, `pg-pool`, `@prisma/client`, nor any PostgreSQL driver is installed in `package.json`.
- The frontend and desktop apps have zero direct PostgreSQL client dependencies.

### 3.3 Migration Risks & Firestore Mapping Strategy
Migrating to a **Firebase-First** architecture offers significant advantages for a mobile companion + desktop workflow:
- **Real-Time Synchronization:** Cloud Firestore provides native real-time listeners (`onSnapshot`) on both Android and Web, eliminating manual WebSocket polling for device status and approvals.
- **Managed Auth:** Firebase Authentication handles password hashing, token rotation, email verification, and session management without maintaining custom auth servers.
- **Security at Document Level:** Firestore Security Rules replace PostgreSQL RLS policies with declarative, fine-grained access rules evaluated directly at Google's edge.
- **Migration Action:** We **retain** `src/server/schema.sql` as a documented historical reference and enterprise self-hosted option, while implementing the Firestore schema and rules as the primary cloud platform.

---

## 4. Test & Verification Baseline

Prior to making any edits, the full test suite was executed:
- **TypeScript Static Verification (`tsc --noEmit`):** 0 errors.
- **Vitest Automated Suites (`npm test -- --run`):** 20 test files, 173 tests passed, 0 failed.
- **Rust Native Tests (`cargo test`):** 103 tests passed, 1 ignored, 0 failed.
- **Android Gradle Wrapper:** `gradle-wrapper.jar` (43,453 bytes, SHA-256: `cb0da6751c2b753a16ac168bb354870ebb1e162e9083f116729cec9c781156b8`) verified.

---

## 5. Architectural Gap Identification

1. **Cloud Project Configuration:** Need `firebase.json`, `firestore.rules`, and `firestore.indexes.json`.
2. **Client Firebase SDK Integration:** Need client configuration modules for Windows (`src/services/firebaseConfig.ts`, `src/services/firebaseAuthService.ts`) and Android (`android/app/build.gradle.kts` dependencies).
3. **Privilege Boundary Enforcement:** Firestore rules must strictly block client writes to subscriptions, tier upgrades, trusted usage counters, and foreign user records.
4. **Relay Token Compatibility:** Relay server must support verifying Firebase ID Tokens alongside standalone server JWTs.
5. **Privacy Guardrails:** Local AI inference must remain offline by default, with opt-in cloud sync for metadata.
