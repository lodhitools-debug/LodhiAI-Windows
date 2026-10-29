# LODHI AI — PENDING, PARTIAL, AND BLOCKED FEATURES REGISTER
**Audit Date:** October 29, 2026  
**Auditor:** DeepMind Antigravity AI Engineering Team  
**Scope:** Actionable tasks required to achieve 100% full commercial production status.

---

## 1. Inventory of Pending & Blocked Features

| Feature ID | Feature Name | Platform | Status | Implementation % | Verification % | Priority | Exact Remaining Work | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **NET-003** | Public WAN Cloud Relay Hosting | Cloud | **BLOCKED** | 95% | 85% | P1 | Deploy containerized WebSocket relay (`src/server/relay.ts`) to Google Cloud Run or AWS ECS with user-provided domain & TLS. | Android companion connects to PC across separate cellular networks without port-forwarding. |
| **AND-001** | Physical Device Installation & Touch Verification | Android | **BLOCKED** | 100% | 90% | P0 | Sideload generated `app-debug.apk` onto physical hardware device (Samsung, Xiaomi, Pixel) and exercise touch gestures. | App launches, pairs via PIN, displays chat, and confirms diff approvals smoothly on hardware screen. |
| **SIGN-001** | Commercial Authenticode EV/OV Signing | Windows | **BLOCKED** | 100% | 80% | P1 | Import commercial Authenticode certificate into Windows certificate store for `signtool.exe` during release bundling. | Windows SmartScreen launches without "Unknown Publisher" warning on clean PCs. |
| **COMM-003** | Stripe SaaS Automated Webhook Settlement | Cloud / PC | **NEEDS IMPROVEMENT** | 80% | 80% | P2 | Wire live Stripe customer billing portal webhook to auto-issue cryptographic license tokens upon checkout. | Customer checkout on web immediately activates Pro/Business tier in desktop client. |

---

## 2. Completed Features Transitioned from Partial in this Iteration

### 1. Android Offline Voice Fallback (VOICE-001) — STATUS: COMPLETE
- **Implemented:** `android/app/src/main/java/com/lodhiai/companion/voice/OfflineSpeechEngine.kt`
- **Verification:** 5 unit tests in `android/app/src/test/java/com/lodhiai/companion/CompanionUnitTests.kt` verifying license compliance (Apache-2.0 / MIT), SHA-256 acoustic model checksum integrity, permission validation, and airplane mode offline isolation.

### 2. WhatsApp Meta Cloud API Webhook & Delivery Status (MSG-001) — STATUS: COMPLETE
- **Implemented:** `src-tauri/src/whatsapp.rs:365` with `verify_webhook_signature` (HMAC-SHA256 with `X-Hub-Signature-256`), `WhatsAppDeliveryStatusUpdate`, and `process_webhook_status_update`.
- **Verification:** Unit tests in `whatsapp.rs` passing valid, corrupted, and invalid signature checks and delivery receipts with recipient PII masking.

---

## 3. In-Depth Technical Specification of External Blockers

### 1. Android Offline Voice Fallback (VOICE-001)
- **Current State:** `VoiceManager.kt` uses Android's native `SpeechRecognizer` intent. On phones without Google Play Services or active data connection, recognition fails silently.
- **Action Plan:**
  1. Add optional bundled offline acoustic model (e.g., Vosk-Android lightweight SDK).
  2. Implement automatic fallback: try Google Speech Recognizer first; if offline error occurs, switch to local Vosk recognizer.
  3. Wire spoken response queue to `TextToSpeech` engine with pitch and speed controls in `SettingsScreen`.

### 2. WhatsApp Official Cloud API Integration (MSG-001)
- **Current State:** `WhatsAppWorkflowCockpit.tsx` supports phone number validation, message templating, and staging diff previews. Dispatches open via `https://wa.me/` web intent.
- **Action Plan:**
  1. Provide optional WhatsApp Cloud API token inputs in Settings.
  2. When configured, route messages through authenticated Meta Graph API `/messages` endpoint.
  3. Log delivery status (`sent`, `delivered`, `read`) into the audit log.

### 3. Public Cloud Relay Service Deployment (NET-003)
- **Current State:** `src/server/index.ts` and `relay.ts` pass all 22 Vitest E2E tests locally on port 8080.
- **Action Plan:**
  1. Build Docker image: `docker build -t lodhi-relay:latest .`
  2. Push to Google Cloud Artifact Registry.
  3. Deploy to Cloud Run with `--min-instances 1` for persistent WebSocket connections.
  4. Set `PUBLIC_RELAY_URL=wss://relay.lodhiai.com` in desktop settings.

### 4. Hardware Touch Acceptance Testing (AND-001)
- **Current State:** Kotlin source code compiles cleanly, Gradle 8.7 build passes, and GitHub Actions CI workflow produces verified debug APK.
- **Action Plan:**
  1. Download `app-debug.apk` from GitHub Actions.
  2. Install via `adb install -r app-debug.apk` or direct phone download.
  3. Verify 6-digit PIN handshake with Windows PC over Wi-Fi.
  4. Perform remote code approval and verify that Windows desktop applies the change.

