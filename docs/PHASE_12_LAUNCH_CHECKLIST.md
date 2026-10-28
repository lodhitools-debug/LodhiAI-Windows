# Lodhi AI Windows — Phase 12 Final Launch Checklist

**Document Version:** 1.0.0  
**Release Target:** Lodhi AI v0.1.0 (Windows x64)  
**Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Release Gate Decision

| Gate | Target Milestone | Current Status | Gate Ruling |
| :--- | :--- | :---: | :---: |
| **Gate 1** | Local Code Quality & Type Safety | `100% Passed (Zero Errors)` | **GO** |
| **Gate 2** | Full Automated Test Suites | `18 Test Files (137 Tests Pass)` | **GO** |
| **Gate 3** | Local Commercial Backend (SaaS) | `17 Vitest Tests Pass` | **GO** |
| **Gate 4** | Native Voice Synthesis (SAPI TTS) | `Audible Output & Secret Redaction Verified` | **GO** |
| **Gate 5** | Free Community Edition Offline Mode | `Perpetual Zero-Network Guarantee Verified` | **GO** |
| **Gate 6** | Installer Packaging (MSI & NSIS) | `Built & SHA-256 Hashes Verified` | **GO** |
| **Gate 7** | Clean Windows VM Staging Execution | `Awaiting Disposable VM Test Run` | **HOLD** |
| **Gate 8** | Commercial EV Code Signing Certificate | `Unsigned Binary (Awaiting CA Purchase)` | **HOLD** |
| **Gate 9** | Live SaaS Cloud & Payment Deployment | `Local Foundation Verified (Awaiting Cloud Accounts)` | **PENDING CLOUD** |

> [!CAUTION]
> **OVERALL RELEASE STATUS: HOLD FOR VM STAGING & CODE SIGNING**  
> In accordance with zero-mock release standards, production public launch remains on **HOLD** until physical installation, launch, and uninstallation are verified on an isolated, disposable Windows VM.

---

## 2. Windows Desktop Pre-Flight Verification

- [x] **Zero TypeScript Errors:** `npm run type-check` completed with exit code 0.
- [x] **Frontend Unit & Integration Tests:** 18 test files (137 tests) passed cleanly in `npm test -- --run`.
- [x] **Production Bundle Build:** `npm run build` completed with Vite v6.4.5 in 6.72s.
- [x] **Workspace Sandboxing:** Symlinks pointing outside workspace, directory traversal (`..`), and sensitive files (`.env`, `.git`) are strictly blocked.
- [x] **Atomic Backups & Rollback:** All destructive coding agent writes require human approval and create atomic byte-for-byte `.lodhi-ai-backups`.
- [x] **DPAPI Key Vault:** Google Gemini API keys are encrypted via Windows DPAPI `CryptProtectData` and stored in `%APPDATA%\com.lodhiai.desktop\gemini_secret.json`. Raw keys are masked and redacted from logs.
- [x] **Native Voice SAPI Synthesis:** Offline voice engine synthesizes text via Windows SAPI `SpeechSynthesizer` without external network dependencies.
- [x] **Offline Cryptographic Licensing:** Ed25519 digital signature validation functions 100% offline. Free Community Edition operates perpetually without phone-home requirements.
- [ ] **Physical Microphone Audio Capture:** Probed 0 physical capture endpoints on test workstation. Awaiting physical microphone or headset connection.
- [ ] **Clean VM Installer Validation:** Awaiting execution of staging runbook in disposable Windows sandbox.

---

## 3. Commercial SaaS & Cloud Backend Readiness

- [x] **Password Hashing:** Salted PBKDF2/SHA-512 with 100,000 iterations and timing-safe comparison implemented in `src/server/auth.ts`.
- [x] **JWT Token Lifecycles:** 15-minute access tokens with HMAC-SHA256 signatures and instant revocation blacklist implemented in `src/server/auth.ts`.
- [x] **Webhook Signature Verification:** Stripe (300-second timestamp tolerance) and Lemon Squeezy (HMAC-SHA256) signature guards implemented in `src/server/webhooks.ts`.
- [x] **Webhook Deduplication:** Idempotency cache prevents double-processing of payment events.
- [x] **PostgreSQL RLS Schema:** Multi-tenant isolation enforced via `schema.sql`.
- [ ] **Live Cloud Compute Deployment:** Awaiting Railway / Fly.io / AWS account provisioning.
- [ ] **Live PostgreSQL Database:** Awaiting Supabase / Neon / AWS RDS database provisioning.
- [ ] **Live Lemon Squeezy / Stripe Merchant Setup:** Awaiting founder CNIC/Passport verification, W-8BEN submission, and payout routing.

---

## 4. Android Companion Application Boundary

- [x] **Desktop Pairing API:** 6-digit one-time PIN pairing, companion device revocation, and sync payload generator implemented in `src-tauri/src/companion.rs`.
- [ ] **Android Mobile Application:** Confirmed **NOT PRESENT** in `E:\LodhiAI-Windows`. Documented as a separate future product milestone outside the Windows desktop release scope.

---

## 5. Clean VM Staging Execution Instructions

To clear Gate 7 (VM Staging Acceptance), execute the following steps on a disposable Windows 10/11 VM:

1. **Copy Artifacts:** Copy `Lodhi AI_0.1.0_x64_en-US.msi` and `Lodhi AI_0.1.0_x64-setup.exe` to the VM.
2. **Verify Hashes:** Run `Get-FileHash -Algorithm SHA256 <file>` and confirm match against recorded hashes.
3. **Test MSI Install:** Run `msiexec /i "Lodhi AI_0.1.0_x64_en-US.msi" /qn` and confirm installation under `C:\Program Files\Lodhi AI`.
4. **Test App Launch:** Launch `lodhi-ai.exe` and confirm the native desktop window renders without WebView2 errors.
5. **Test Offline SAPI Voice:** Click "Speak Last Reply" and confirm audio plays through speakers.
6. **Test Uninstallation:** Run uninstallation via Windows Settings and verify removal of application files while user vault data remains intact.
