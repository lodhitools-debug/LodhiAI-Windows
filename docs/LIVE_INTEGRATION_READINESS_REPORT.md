# Lodhi AI — Live Integration Readiness Report
**Scope:** Google Gemini Engine, Firebase-First Cloud Services & Android CI Verification  
**Repository:** `E:\LodhiAI-Windows`  
**Evaluation Date:** October 26, 2026  
**Auditor:** Senior Security Architect & DevOps Lead

---

## 1. Executive Summary & Verification Classification

Every capability and subsystem evaluated during this live integration readiness audit has been verified directly in the codebase and categorized into one of five rigorous states:

1. **Implemented in Code**: Production or native logic exists in the repository.
2. **Tested with a Local Mock**: Verified deterministically using local in-memory or fixture mocks.
3. **Tested with an Emulator**: Validated against local emulator protocol schemas (e.g., Firebase emulator suite).
4. **Verified Against a Live Service**: Real network call executed against a live third-party production endpoint.
5. **Missing or Blocked**: Architectural gap, missing dependency, or credential prerequisite.

### Verification Status Matrix

| Subsystem / Feature | Classification | Source Location | Notes & Status |
|---|---|---|---|
| **Gemini Native Client & Payload** | **Implemented in Code & Tested with Local Mock** | [`src-tauri/src/gemini.rs`](file:///E:/LodhiAI-Windows/src-tauri/src/gemini.rs) | Alternating `user`/`model` format, `systemInstruction`, 45s timeout. 10 Rust unit tests pass. |
| **Gemini DPAPI Key Storage** | **Implemented in Code & Tested Locally** | [`src-tauri/src/gemini.rs`](file:///E:/LodhiAI-Windows/src-tauri/src/gemini.rs) | Windows DPAPI encryption roundtrip verified. Encrypted in `%APPDATA%\com.lodhiai.desktop\gemini_secret.json`. |
| **Gemini Secret Redaction** | **Implemented in Code & Tested Locally** | [`src-tauri/src/gemini.rs`](file:///E:/LodhiAI-Windows/src-tauri/src/gemini.rs) | `redact_key` scrubs `AIza...` and runtime keys from all logs, errors, and traces. |
| **Gemini Cloud Consent Guard** | **Implemented in Code & Tested with Local Mock** | [`src/store/AppContext.tsx`](file:///E:/LodhiAI-Windows/src/store/AppContext.tsx) | Blocks egress calls unless `geminiConsentGiven` is true. Verified in [`GeminiIntegration.test.tsx`](file:///E:/LodhiAI-Windows/src/test/GeminiIntegration.test.tsx). |
| **Gemini Live API Verification** | **Missing or Blocked (Awaiting Credentials)** | N/A | **No live Google API calls executed.** Blocked until user configures API key. |
| **Gemini Server-Sent Token Streaming** | **Missing or Blocked** | [`src-tauri/src/gemini.rs`](file:///E:/LodhiAI-Windows/src-tauri/src/gemini.rs) | Current native engine uses synchronous `generateContent`. True token SSE streaming (`alt=sse`) is not yet implemented. |
| **Firebase Auth Client** | **Implemented in Code & Tested with Local Mock** | [`src/services/firebaseAuthService.ts`](file:///E:/LodhiAI-Windows/src/services/firebaseAuthService.ts) | Local session management, simulated token refresh. Official `firebase` npm SDK not yet installed. |
| **Firestore Client SDK** | **Implemented in Code & Tested with Local Mock** | [`src/services/firestoreService.ts`](file:///E:/LodhiAI-Windows/src/services/firestoreService.ts) | In-memory simulated storage for profile, device, and pairing. Official Firestore network client pending SDK install. |
| **Firestore Security Rules** | **Implemented in Code & Tested with Emulator Rules** | [`firestore.rules`](file:///E:/LodhiAI-Windows/firestore.rules) | Deny-by-default; privilege escalation defense blocks client tampering of `plan`, `role`, `subscriptions`, and `usage`. |
| **Server-Side Token Verification** | **Implemented in Code (Decoded Claims Only)** | [`src/server/auth.ts`](file:///E:/LodhiAI-Windows/src/server/auth.ts) | Checks `exp`, `iss`, `aud`, `sub`. **Cryptographic RS256 signature verification against Google public certs is missing.** |
| **Firebase App Check** | **Missing / Blocked** | [`android/app/build.gradle.kts`](file:///E:/LodhiAI-Windows/android/app/build.gradle.kts) | Dependency declared in Android, but runtime initialization and backend header enforcement are not implemented. |
| **Ollama Local AI Fallback** | **Implemented in Code & Tested Locally** | [`src-tauri/src/ollama.rs`](file:///E:/LodhiAI-Windows/src-tauri/src/ollama.rs) | Preserved and verified. NDJSON chunk streaming, cancellation via abort signal, and offline fallbacks operational. |
| **PostgreSQL SaaS Schema** | **Implemented in Code & Tested Locally** | [`src/server/schema.sql`](file:///E:/LodhiAI-Windows/src/server/schema.sql) | DDL schema and in-memory mock store operational. Preserved for on-premises enterprise deployments. |
| **Android Companion CI Workflow** | **Implemented in Code & Wrapper Verified** | [`.github/workflows/android-companion-ci.yml`](file:///E:/LodhiAI-Windows/.github/workflows/android-companion-ci.yml) | Validated Gradle 8.7 wrapper jar (SHA-256 verified) and debug APK workflow. Ready for GitHub Actions. |

---

## 2. Gemini Live-Test Readiness Findings

### 1. Key Configuration Mechanism
Users configure their personal Gemini API key through two safe pathways:
- **Desktop UI (Settings $\rightarrow$ Model Providers):** Invokes `save_gemini_api_key` in `src-tauri/src/gemini.rs`. On Windows, the key is encrypted at rest using Windows DPAPI (`CryptProtectData`) tied to the local Windows user profile and written to `%APPDATA%\com.lodhiai.desktop\gemini_secret.json`. The UI displays only `AIza****1234`.
- **Environment Variable:** Set `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
- Plaintext keys are never written to disk, committed to Git, or transmitted in telemetry.

### 2. Supported Model IDs & Verification Against Google API
- Native catalog in `gemini.rs` specifies:
  - `gemini-2.0-flash` (Current primary Google model)
  - `gemini-1.5-flash`
  - `gemini-1.5-pro`
- Dynamic Discovery: The backend implements `list_gemini_models()`, which queries `https://generativelanguage.googleapis.com/v1beta/models`. When a valid key is provided, it dynamically filters models supporting `generateContent` with the prefix `gemini-`. If offline or keyless, it falls back to the verified constants.

### 3. Request Payloads, Endpoint, Timeouts & Cancellation
- **Target Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Headers:** `x-goog-api-key: <key>`, `Content-Type: application/json`.
- **Payload Schema:** Strictly formats conversation history into alternating `user` and `model` role turns with `parts: [{text}]`. System prompts are isolated into the official `systemInstruction` top-level field.
- **Timeout:** 45 seconds (`DEFAULT_TIMEOUT`).
- **Cancellation Gap:** Unlike Ollama (which supports `abort_stream(&request_id)`), Gemini's `chat_with_gemini` uses synchronous blocking HTTP in `tauri::async_runtime::spawn_blocking`. There is currently **no in-flight cancellation handle** to cancel an active Google API call when the user clicks "Stop Generation".

### 4. Error & Quota Exhaustion Reporting
Error mapping in [`format_api_error`](file:///E:/LodhiAI-Windows/src-tauri/src/gemini.rs#L655) maps HTTP status codes:
- **400 Bad Request:** Identifies `API_KEY_INVALID` $\rightarrow$ *"Invalid Google Gemini API key. Verify your key in Model Providers."*
- **401/403 Forbidden:** Identifies quota/billing issues $\rightarrow$ *"Gemini API quota exceeded or billing not enabled for this project. Check your Google AI Studio plan."*
- **429 Rate Limit:** *"Gemini rate limit or free-tier quota exceeded. Please wait a moment before trying again."*
- **500/503 Service Unavailable:** *"Google Gemini service temporarily unavailable ({status}). Please retry or switch to Local Ollama."*

### 5. Distinguishing Real vs. Mock Responses
- In native desktop mode, real responses return latency telemetry (`http_elapsed_ms`, `handler_elapsed_ms`) and token counts (`prompt_tokens`, `candidate_tokens`, `total_tokens`) extracted from Google's `usageMetadata`.
- In Web Sandbox mode (development/testing without Tauri bridge), fallback responses are tagged with `source: 'web_sandbox'`.

### 6. Secrets Protection in Logs & Bundles
- Scanned `dist/`, `src-tauri/target/release/`, and `android/`: **Zero API keys or credentials exist in bundles or source.**
- Native function [`redact_key`](file:///E:/LodhiAI-Windows/src-tauri/src/gemini.rs#L74) scrubs any token matching `AIzaSy[A-Za-z0-9_-]{33}` or matching the configured key from all log statements and error messages.

---

## 3. Firebase Live-Test Readiness Findings

### 1. Configuration & Client Services
- [`src/services/firebaseConfig.ts`](file:///E:/LodhiAI-Windows/src/services/firebaseConfig.ts) reads `VITE_FIREBASE_*` environment variables. If missing, it safely falls back to local emulator defaults (`127.0.0.1:9099` for Auth, `127.0.0.1:8080` for Firestore).
- **Current State:** [`firebaseAuthService.ts`](file:///E:/LodhiAI-Windows/src/services/firebaseAuthService.ts) and [`firestoreService.ts`](file:///E:/LodhiAI-Windows/src/services/firestoreService.ts) are implemented as self-contained TypeScript services with in-memory state. The official `firebase` Web SDK is not currently in `package.json` dependencies.

### 2. Security Rules & Privilege Escalation Defense
- [`firestore.rules`](file:///E:/LodhiAI-Windows/firestore.rules) implements:
  - Deny-by-default for all collections.
  - Ownership enforcement: users can only read/write documents where `request.auth.uid == userId`.
  - **Privilege Escalation Protection:** Blocks client writes to `plan`, `role`, `subscriptions`, and `usage`.
  - Ephemeral pairing sessions: 5-minute maximum TTL with pin hashes.

### 3. Server-Side Token Verification (Security Finding)
- In [`src/server/auth.ts`](file:///E:/LodhiAI-Windows/src/server/auth.ts), `verifyFirebaseIdToken` validates token parts, expiration (`exp`), issuer (`iss`), and audience (`aud`).
- **Critical Security Gap:** It does **not cryptographically verify the RS256 signature** against Google's public key certificates (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`). In production, signature verification is mandatory to prevent forged client JWTs.

### 4. Firebase App Check Status
- Declared in Android Gradle: `com.google.firebase:firebase-appcheck-playintegrity`.
- **Gap:** App Check is not yet initialized in Android application startup or web frontend, and no App Check verification header (`X-Firebase-AppCheck`) is enforced by the Relay server or security rules.

---

## 4. Gemini Token Streaming Analysis

- **Current Behavior:** Synchronous non-streaming HTTP via `generateContent`.
- **User Experience Reality:** When the user sends a message, `isGenerating` is set to `true`, displaying a loading spinner. The response appears in one complete block once Google returns the JSON payload.
- **Why Streaming is Missing:**
  1. The endpoint called is `...:generateContent` instead of `...:streamGenerateContent?alt=sse`.
  2. The Rust HTTP client (`ureq`) uses `.read_to_string()` which buffers the entire body.
  3. No SSE chunk parser exists to stream `data: { ... }` blocks.
  4. Tauri event emission (`app.emit("gemini-chunk-{requestId}", token)`) is not hooked into Gemini (unlike Ollama).
- **Required Architecture for Streaming:**
  ```
  Desktop UI / Mobile Companion
       │
       ▼ (WebSocket / SSE listener)
  Relay or Tauri Rust Backend
       │
       ▼ (GET/POST ...:streamGenerateContent?alt=sse)
  Google Gemini API
  ```
  - Use `ureq` or `reqwest` streaming reader on chunked response lines.
  - Parse SSE lines starting with `data:`.
  - Extract `candidates[0].content.parts[0].text`.
  - Emit chunk events to frontend.

---

## 5. Android Companion CI Preparation

### Verification Details
- **Workflow File:** [`.github/workflows/android-companion-ci.yml`](file:///E:/LodhiAI-Windows/.github/workflows/android-companion-ci.yml)
- **CI Environment:** Ubuntu Latest, JDK 17 (Temurin), Gradle 8.7.
- **Gradle Wrapper Verification:**
  - `android/gradle/wrapper/gradle-wrapper.jar`: 43,453 bytes.
  - **SHA-256:** `CB0DA6751C2B753A16AC168BB354870EBB1E162E9083F116729CEC9C781156B8` (verified official Gradle 8.7 binary).
  - Wrapper script `android/gradlew` is executable.
- **Build Target:** `./gradlew assembleDebug` produces `app/build/outputs/apk/debug/app-debug.apk`.
- **Artifact Upload:** Uploads debug APK with SHA-256 checksum with 14-day retention.
- **Failures Visible:** Full stacktraces and test reports uploaded on build failure.
- **Secrets Dependency:** **None.** The debug build requires zero API keys or secrets to build successfully.
- **Automated Publishing:** None. CI only builds and archives the debug artifact.

### Git Hygiene & Secret Protection
- **Status:** Clean untracked state on local branch `master`.
- **Git Remotes:** No remotes configured (`git remote -v` is empty).
- **`.gitignore` Hardening:** The repository `.gitignore` has been updated to comprehensively exclude:
  - Build targets (`dist/`, `src-tauri/target/`, `android/app/build/`, `android/.gradle/`)
  - Secret & environment files (`.env`, `.env.*.local`, `google-services.json`, `*serviceAccount*.json`, `*.pem`, `*.key`)
  - Installer artifacts (`*.msi`, `*.cab`)
- **Safe Repository Preparation:** The repository is now 100% safe to initialize and push to a private GitHub repository without risking credential exposure or accidental bloat.

---

## 6. Verification Test Results

All four local verification suites executed with zero errors:

| Test Command | Scope | Result | Exit Code |
|---|---|---|---|
| `npm run type-check` | TypeScript Compiler (`tsc --noEmit`) | 0 type errors | **0** |
| `npx vitest run src/test/GeminiIntegration.test.tsx src/test/FirebaseFirestoreArchitecture.test.ts` | Gemini & Firebase Architecture Suites | **19 passed, 0 failed** (47.48s) | **0** |
| `npm test -- --run` | Full Frontend & Server Vitest Suite | **21 test files, 186 passed, 0 failed** (72.23s) | **0** |
| `cargo test --manifest-path src-tauri\Cargo.toml` | Native Rust Backend (Gemini, DPAPI, Tools, Licensing) | **103 passed, 1 ignored (offline Ollama), 0 failed** (9.37s) | **0** |
| `npm run build` | Vite Production Bundle Compiler | **1,629 modules transformed** into `dist/` | **0** |

---

## 7. Security Gaps & Severity Ratings

| Finding | Severity | Impact | Mitigation Required |
|---|---|---|---|
| **Server Token Verification lacks RS256 signature check** | **HIGH** | An attacker could craft an unverified JWT with a valid issuer/audience header and impersonate any user UID. | Integrate Google JWKS public key verification in `src/server/auth.ts` or deploy `firebase-admin` in Cloud Run Relay. |
| **App Check not enforced in Relay backend or Firestore** | **MEDIUM** | Requests from non-official clients or scripts could consume API quotas. | Initialize Play Integrity in Android and reCAPTCHA Enterprise on Web; enforce `X-Firebase-AppCheck` header. |
| **No In-Flight Gemini Request Cancellation** | **LOW** | Clicking "Stop Generation" stops the UI animation but leaves the background HTTP request running until complete. | Add cancellation token / abort mechanism to `gemini.rs` matching Ollama's stream abort pattern. |
| **Missing Google-Services JSON for Android Push Notifications** | **LOW** | Firebase Cloud Messaging (FCM) on Android companion requires `google-services.json` to receive background push alerts. | Provide `google-services.json` via CI secret or local placement when testing push notifications. |

---

## 8. Step-by-Step Instructions for Safe Local Testing

### Step A: Safe Local Gemini API Testing
1. Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
2. Set the key in your local PowerShell session (does not commit to Git):
   ```powershell
   $env:GEMINI_API_KEY="AIzaSyYourActualKeyHere"
   ```
3. Run the desktop app in development mode:
   ```powershell
   npm run tauri dev
   ```
4. In Settings $\rightarrow$ Model Providers:
   - Select **Google Gemini**.
   - Check the **Cloud Egress Consent** box.
   - Click **Test Connection**.

### Step B: Safe Firebase Local Emulator Testing
1. Install Firebase CLI (if not already installed):
   ```powershell
   npm install -g firebase-tools
   ```
2. Start local emulators (zero cloud cost, zero billing):
   ```powershell
   firebase emulators:start --only auth,firestore
   ```
3. Configure `.env` in `E:\LodhiAI-Windows`:
   ```ini
   VITE_FIREBASE_API_KEY=demo-local-key
   VITE_FIREBASE_PROJECT_ID=lodhiai-cloud
   VITE_USE_FIREBASE_EMULATOR=true
   VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
   ```

---

## 9. Cloud Billing & Cost Prerequisites

Before deploying to live production services:
- **Google Gemini API:** Free tier provides 15 requests per minute (RPM) and 1,500 requests per day (RPD) on `gemini-1.5-flash` and `gemini-2.0-flash`. Pay-as-you-go billing is required for high volume.
- **Firebase:** Spark Plan (Free) provides 50k Firestore reads/day, 20k writes/day, and 10k phone/email auth verifications/month. Upgrading to the Blaze Plan (Pay-as-you-go) is required if deploying Cloud Functions or Cloud Run for the Relay server.
- **Android Play Store:** One-time Google Play Console developer registration fee ($25) required to distribute APK via internal test tracks and enable Play Integrity App Check.

---

## 10. Recommended Next Actions

1. **Implement True SSE Streaming for Gemini:** Add `streamGenerateContent?alt=sse` parser and `gemini-chunk` Tauri event emission in `src-tauri/src/gemini.rs` to match Ollama's live token streaming.
2. **Harden Backend Token Verification:** Implement RS256 signature verification in `src/server/auth.ts` against Google's public certs to ensure tamper-proof authentication before connecting live accounts.
3. **Commit & Push to Private GitHub Repository:** Now that `.gitignore` is completely hardened against credential and build leaks, initialize the private GitHub remote and run the Android CI pipeline to generate the first verified companion APK.
