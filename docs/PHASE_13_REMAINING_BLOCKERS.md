# Lodhi AI Windows — Phase 13 Remaining Blockers & Release Roadmap

**Document Version:** 1.0.0  
**Audit Completion Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Directory:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Release Gate Decision: HOLD

The release gate for Lodhi AI Desktop for Windows v0.1.0 is currently on **HOLD**.

While all local source code, security boundaries, UI components, Rust native commands, and commercial backend foundations are fully written and verified by 100% automated test suites (137 Vitest + 103 Cargo tests), the application cannot be given an unconditional production sign-off until the external and environmental prerequisites outlined below are addressed.

---

## 2. Granular Blocker Registry

### Blocker 1: Clean-VM Staging Execution (Environment Blocked)
- **Impact:** High (Installer Safety Assurance)
- **Details:** The production installers (`Lodhi AI_0.1.0_x64-setup.exe` and `Lodhi AI_0.1.0_x64_en-US.msi`) must be installed, launched, and uninstalled in a completely clean, isolated environment to ensure:
  - Shortcuts (Desktop & Start Menu) point to the correct discovered binary path.
  - Registry uninstaller keys are registered properly.
  - Uninstallation cleanly removes application binaries without touching user data in `%APPDATA%\com.lodhiai.desktop`.
- **Reason Not Executed Locally:** `WindowsSandbox.exe` is not enabled on the development PC, and strict project safety rules forbid running installers or modifying registry entries on the host machine.
- **Required Action:** Run the safe staging runbook (`docs/PHASE_12_RELEASE_REPORT.md`) on an isolated disposable VM.

---

### Blocker 2: Physical Microphone Real Dictation (Hardware Blocked)
- **Impact:** Medium (Voice Input Verification)
- **Details:** Windows Plug and Play hardware enumeration (`Get-PnpDevice -Class AudioEndpoint`) confirms 0 physical audio capture devices are connected to the motherboard jacks. While software pipelines, audio meter animations, simulated transcripts, and privacy permission handling are 100% verified, real acoustic sound capture cannot be verified until physical hardware is connected.
- **Speech Engine Reality:** Windows SAPI 5.4 zero-install speech recognizer (`MS-1033-80-DESK`) supports English dictation only. Offline multilingual speech recognition (Urdu/Roman Urdu) requires optional Whisper.cpp models (e.g. `ggml-tiny.bin`, 75 MB), cataloged in `VoiceModelSpec` as optional on-demand downloads.
- **Required Action:** Connect a 3.5mm or USB microphone/headset and perform a manual dictation smoke test in Voice Mode.

---

### Blocker 3: Live Cloud Infrastructure Provisioning (Account Blocked)
- **Impact:** Medium (Commercial SaaS Cloud Services)
- **Details:** The commercial backend services in `src/server/` (authentication, JWT, licensing, database migrations, rate limiting) are fully implemented and verified via automated test fixtures. However, zero live cloud resources exist:
  - No managed PostgreSQL database (Supabase / Neon / AWS RDS).
  - No production compute container (Railway / Fly.io / AWS ECS).
  - No Redis instance for distributed token blacklisting.
- **Required Action:** The user/organization must create cloud accounts, provision database instances, and configure production environment variables.

---

### Blocker 4: Production Payment Merchant Activation (Credentials Blocked)
- **Impact:** Medium (Pro/Business Subscriptions)
- **Details:** Stripe and Lemon Squeezy webhook signature verification (HMAC-SHA256), timestamp replay tolerance (300 seconds), and plan provisioning are tested with automated cryptographic vectors. Live transactions cannot be processed without live merchant API keys and webhook signing secrets.
- **Recommended Merchant for Pakistan Founders:** Lemon Squeezy is recommended over Stripe for founders based in Pakistan, as it acts as a Merchant of Record (MoR) and accepts Pakistani CNIC/Passport with local bank account payouts via Wise/Payoneer.
- **Required Action:** Register and activate a Lemon Squeezy merchant account and input `LEMON_SQUEEZY_API_KEY` and `LEMON_SQUEEZY_WEBHOOK_SECRET`.

---

### Blocker 5: Windows Code Signing Certificate (Commercial Trust Blocked)
- **Impact:** Low to Medium (User Experience on Public Download)
- **Details:** The current release installers are built without an EV (Extended Validation) code signing certificate. When users download the EXE/MSI from the web, Windows SmartScreen will display an "Unknown Publisher" warning prompt until cryptographic reputation is established.
- **Required Action:** Purchase a Sectigo or DigiCert EV Code Signing Certificate before general public web distribution.

---

## 3. Road to GA (General Availability) Matrix

| Milestone | Target | Pre-conditions | Estimated Effort |
| :--- | :---: | :--- | :---: |
| **Stage 1: VM Staging Pass** | Candidate Alpha | Disposable Windows VM snapshot | 30 minutes |
| **Stage 2: Voice Dictation Pass** | Candidate Beta | Physical microphone plugged in | 10 minutes |
| **Stage 3: Cloud SaaS Go-Live** | Commercial Preview | Supabase + Railway provisioned | 2 hours |
| **Stage 4: Payment Go-Live** | Commercial Release | Lemon Squeezy approved | 1–3 business days |
| **Stage 5: SmartScreen Sign-Off** | Public GA | EV Certificate applied to CI/CD | 3–5 business days |
