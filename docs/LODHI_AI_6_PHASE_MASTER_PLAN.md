# LODHI AI — SIX-PHASE COMPLETION MASTER PLAN
**Project Root:** `E:\LodhiAI-Windows`  
**Product:** Lodhi AI — Commercial Windows AI Developer Platform with Android Companion  
**Architecture:** Windows Native Desktop (Tauri 2 / Rust + React 18 / Vite) + Android Companion (Kotlin / Jetpack Compose) + Firebase Cloud Backend (Auth, Firestore, Rules) + Secure Relay (TypeScript / WebSocket)  

---

## 1. Executive Summary & Master Governance

This document establishes the roadmap, technical specifications, dependency graphs, risk analysis, and acceptance criteria for all 36 feature deliverables (6 Phases × 6 Features).

### Non-Negotiable Operational Boundaries
1. **Isolated Workspace:** All work takes place strictly inside `E:\LodhiAI-Windows`. `E:\LodhiAI` is strictly forbidden.
2. **Secrets Protection:** No API keys, Firebase service account keys, DPAPI master keys, JWT signing keys, or credentials may ever be committed to Git or embedded in client binaries.
3. **No Fake Responses in Production:** Mocks are strictly isolated to development/test configurations (`NODE_ENV !== 'production'`).
4. **Preserve Legacy Assets:** Existing PostgreSQL schemas (`src/server/schema.sql`), licensing verification (`src/server/licensing.ts`), and local Ollama integrations are preserved.
5. **Hardware Target:** Optimized for 8 GB RAM developer PCs (Ollama optional, Google Gemini as premier cloud AI).

---

## 2. Master Phase Matrix (36 Features)

| Phase | Feature ID | Feature Name | Primary Component | Delivery Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | 1.1 | Real Firebase ID-Token Verification | `src/server/auth.ts` | **Complete (Verified)** |
| | 1.2 | Trusted Authorization & Role Enforcement | `src/server/auth.ts` | **Complete (Verified)** |
| | 1.3 | Secure Relay Authentication | `src/server/relay.ts` | **Complete (Verified)** |
| | 1.4 | Device & Session Security | `src/server/pairing.ts`, `src-tauri` | **Complete (Verified)** |
| | 1.5 | Rate Limiting & Abuse Protection | `src/server/rateLimiter.ts` | **Complete (Verified)** |
| | 1.6 | Security Regression Suite | `src/test/FirebaseAuthCryptographicSecurity.test.ts` | **Complete (Verified)** |
| **Phase 2** | 2.1 | Secure API Key Configuration (DPAPI Vault) | `src-tauri/src/gemini.rs` | **Complete (Verified)** |
| | 2.2 | Live Gemini Chat | `src-tauri/src/gemini.rs`, `src/services/tauri.ts` | **In Progress (Bridging)** |
| | 2.3 | Real Coding Assistance | `src/screens/CodingAssistantScreen.tsx`, `gemini.rs` | **In Progress (Bridging)** |
| | 2.4 | Model Discovery & Selection | `gemini.rs`, `src/screens/ModelSettingsScreen.tsx` | **In Progress (Bridging)** |
| | 2.5 | True Token Streaming & Cancellation | `gemini.rs`, `src/services/streamingChat.ts` | **In Progress (Bridging)** |
| | 2.6 | Errors, Consent, & Cloud Egress Controls | `src/components/CloudEgressConsentModal.tsx` | **Complete (Verified)** |
| **Phase 3** | 3.1 | Firebase Project Configuration | `.env`, `.firebaserc`, `firebaseConfig.ts` | **Complete (Verified)** |
| | 3.2 | Real Firebase Authentication | `src/services/firebaseAuth.ts` | **In Progress** |
| | 3.3 | Real Firestore Data Management | `src/services/firestoreService.ts` | **Complete (Verified)** |
| | 3.4 | Firestore Rules & Composite Indexes | `firestore.rules`, `firestore.indexes.json` | **Complete (Deployed Live)** |
| | 3.5 | App Check & Backend Attestation | `src/services/appCheck.ts`, `auth.ts` | **In Progress** |
| | 3.6 | Trusted Cloud Usage & Device Registry | `src/server/usage.ts`, `firestoreService.ts` | **Complete (Verified)** |
| **Phase 4** | 4.1 | Reproducible Android Build | `android/build.gradle.kts`, `app/build.gradle.kts` | **Complete (Verified)** |
| | 4.2 | Automated APK CI Workflow | `.github/workflows/android-companion-ci.yml` | **Complete (Verified)** |
| | 4.3 | Installation & Startup Resilience | `android/app/src/main/AndroidManifest.xml` | **In Progress (CI Ready)** |
| | 4.4 | Android Real Auth & Gemini Bridge | `android/.../ui/chat/ChatViewModel.kt` | **In Progress** |
| | 4.5 | Device Pairing & PIN Challenge | `android/.../data/pairing/PairingRepository.kt` | **Complete (Verified)** |
| | 4.6 | Android Reliability & Diagnostics | `android/.../util/Logger.kt` | **In Progress** |
| **Phase 5** | 5.1 | Deployable Relay Service & Health Checks | `src/server/index.ts`, `src/server/relay.ts` | **Complete (Verified)** |
| | 5.2 | Authenticated WebSocket Connection | `src/server/relay.ts` | **Complete (Verified)** |
| | 5.3 | Pairing & Device Lifecycle Management | `src/server/pairing.ts`, `companion.rs` | **Complete (Verified)** |
| | 5.4 | Windows Desktop Agent Outbound Connector | `src/services/desktopAgent.ts` | **In Progress** |
| | 5.5 | Authorized Remote Command Execution | `src/server/commands.ts` | **Complete (Verified)** |
| | 5.6 | Real Cross-Network Acceptance Testing | Remote Relay E2E | **Blocked (Hosting Required)** |
| **Phase 6** | 6.1 | Free, Pro, and Business Entitlement Matrix | `src/server/entitlements.ts` | **Complete (Verified)** |
| | 6.2 | Usage & Quota Concurrency Accounting | `src/server/usage.ts` | **Complete (Verified)** |
| | 6.3 | Subscription & Payment Webhook Validation | `src/server/licensing.ts`, `billing.ts` | **Complete (Verified)** |
| | 6.4 | Privacy, GDPR & Account Lifecycle | `src/screens/GeneralSettingsScreen.tsx` | **Complete (Verified)** |
| | 6.5 | Windows Installer (.wxs / MSI) | `Lodhi AI_0.1.0_x64_en-US.wxs` | **Complete (Verified)** |
| | 6.6 | Final Release Qualification & Gatekeeper | Full Automated Test Suites | **In Progress** |

---

## 3. Phase Gate Criteria

1. **Gate 1 (Security):** RS256 token verification passes all 20 adversarial tests. All JWT claims verified against Google cert keys. Passed.
2. **Gate 2 (Gemini AI Engine):** DPAPI key storage active, live endpoints accessible, model catalog selectable, streaming/cancellation operational, and consent enforced.
3. **Gate 3 (Firebase Cloud):** Firestore rules and indexes deployed to production `lodhi-ai-assistant`. Real auth workflows operational without mock fallbacks in production.
4. **Gate 4 (Android Companion):** APK build reproducible via Gradle/CI with SHA-256 verification. Android companion matches `com.lodhideveleper.lodhiai`.
5. **Gate 5 (Secure Remote Control):** Relay accepts verified WebSocket connections, enforces strict command allowlists, and isolates tenants.
6. **Gate 6 (Commercial Release):** Full regression test suite (TypeScript, Vitest, Rust `cargo test`) passing with 0 failures, WiX installer valid, and commercial licensing verified.
