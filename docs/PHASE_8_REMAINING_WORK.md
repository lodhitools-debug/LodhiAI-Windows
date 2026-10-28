# Lodhi AI Windows — Phase 8 Remaining Work & Commercial Roadmap

**Document Version:** 1.0.0  
**Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Scope:** `E:\LodhiAI-Windows` (Strict Windows Commercial Desktop Edition)  
**Hardware Target:** Windows 10/11 x64, ~8 GB RAM, Local Ollama (`qwen2.5-coder:3b`) + Gemini Cloud Provider  

---

## 1. Executive Summary & Audit Matrix

This audit evaluates all platform subsystems across Phases 1 through 8, establishing the ground truth of what is **genuinely working**, what is **partially implemented or mocked for desktop evaluation**, and what is **dependent on external SaaS cloud infrastructure**.

### Classification Taxonomy
- **[VERIFIED]**: Fully implemented, tested with automated test suites, and verified in the native release build.
- **[PARTIAL]**: Partially functional in desktop client; client-side mocks or UI components present, but lacks production backend or deep native engine.
- **[ROADMAP]**: Architecture documented and UI drafted, but production implementation deferred to a dedicated phase.
- **[BLOCKED]**: Dependent on external third-party accounts, payment gateways, cloud hosting, or customer credentials.

---

## 2. Feature-by-Feature Commercial Status Audit

| Subsystem / Feature | Current Status | Implementation Depth & Reality | Next Milestone Required |
| :--- | :--- | :--- | :--- |
| **AI Chat & Natural Roman Urdu** | **VERIFIED** | Real-time streaming with Ollama `qwen2.5-coder:3b` & Google Gemini API. Shift+Enter, Stop Generation, copy feedback, proximity auto-scroll, bilingual Roman Urdu/English context conditioning. | Multi-turn branch editing & conversation export to markdown. |
| **Coding Agent & Approval Workflow** | **VERIFIED** | Multi-file diff viewer, transactional atomic writes with automatic recovery backups (`.bak-TIMESTAMP`), approval gates before writing, AST diagnostic checks. | Multi-step autonomous planning with auto-rollback on test failure. |
| **Workspace Security & Isolation** | **VERIFIED** | Path canonicalization, symlink escape prevention, strict traversal protection, sensitive file blocking (`.env`, `.git`, `.ssh`, `.pem`), secret redaction. | Configurable glob exclusions in UI settings. |
| **Model Providers (Local & Cloud)** | **VERIFIED** | Local Ollama auto-discovery & latency benchmarking; Google Gemini with Windows DPAPI encryption, official `systemInstruction`, cloud consent, and live latency diagnostics. | Anthropic Claude & OpenAI provider integration. |
| **Knowledge Base & Document RAG** | **VERIFIED** | PDF stream text extraction, semantic sentence-boundary chunking, deterministic BM25 search ranking, and clickable citation cards. | Dense vector embeddings with local ONNX model (all-MiniLM-L6-v2) for hybrid retrieval. |
| **Diagnostics & Central Logging** | **VERIFIED** | Multi-level diagnostic logger (DEBUG, INFO, WARN, ERROR), memory-bounded buffer (1,000 entries), native log exporter (`lodhi-diagnostic-*.log`), language compiler parsers (`tsc`, `rustc`, `pytest`). | Automated bug bundle crash reporter. |
| **Settings & Edition Switching** | **VERIFIED** | Dynamic switching between Free Community, Pro, and Enterprise editions with feature-toggling and local persistence. | Remote license activation heartbeat check. |
| **Offline License Validation** | **VERIFIED** | Cryptographic Ed25519 digital signature validation with embedded public key, payload tampering rejection, and expiry enforcement. | Online license activation portal & self-service key generator. |
| **Voice Conversation** | **ROADMAP / PROTOTYPE** | Desktop UI includes VoiceInteractionModal and speech parameter controls; browser `webkitSpeechRecognition` & `SpeechSynthesis` are brittle on WebView2. **User cannot currently converse fluently with voice.** | Phase 9: Native neural STT (Sherpa-ONNX / Whisper.cpp) + Piper TTS with Roman Urdu acoustic model. |
| **User Authentication & Accounts** | **PARTIAL** | Local profile state and pairing PIN generation. No remote user login, Cognito/Firebase/Supabase auth, or multi-tenant database. | Phase 10: SaaS authentication backend (OAuth2 / PKCE, Google Sign-In, Supabase). |
| **Usage Limits & Metering** | **PARTIAL** | Local token counting, duration tracking, and rate calculation in memory. No centralized billing quotas or server-side rate limits. | Phase 10: Metering daemon reporting to Stripe Usage Records. |
| **Subscription & Payment Handling** | **BLOCKED** | Documented in `COMMERCIAL_SAAS_ROADMAP.md` and `SAAS_ARCHITECTURE.md`. No live Stripe/LemonSqueezy integration or webhook listener. | Phase 11: Production Stripe checkout, webhooks, and customer billing portal. |
| **Multi-User Data Isolation** | **NOT IMPLEMENTED** | Application is currently single-user desktop software storing data in `%APPDATA%` and `%LOCALAPPDATA%`. No multi-user tenant database. | Cloud SaaS sync engine with tenant-level AES-GCM encryption. |
| **Backend / API Deployment** | **NOT IMPLEMENTED** | Tauri desktop runs entirely locally on Windows. No cloud API server, Kubernetes cluster, or serverless functions deployed. | Phase 12: Cloud microservices deployment (Fly.io / AWS ECS / Cloudflare Workers). |

---

## 3. Prioritized Commercial Roadmap: Follow-Up Phases

### Phase 9: Native Offline Voice Conversation Engine (Roman Urdu & English)
- **Objective:** Enable a real, fluent, hands-free conversational voice experience directly on Windows without paid cloud subscriptions.
- **Priority:** HIGH (Requested core feature)
- **Estimated Complexity:** HIGH (3 to 4 engineering days)
- **Dependencies:** Windows audio subsystem, Sherpa-ONNX / Whisper.cpp (quantized Q4/Q5 for ~8 GB RAM), Piper TTS (lightweight neural speech synthesis).
- **Architecture:**
  1. **Microphone Capture:** Native Windows WASAPI input via `cpal` in Rust.
  2. **Voice Activity Detection (VAD):** Silero VAD to detect user speech start and stop without button presses.
  3. **Speech-to-Text (STT):** Local Sherpa-ONNX running Whisper-tiny or Roman Urdu acoustic model (~75 MB RAM footprint).
  4. **Natural Chat Conditioning:** Pipe transcribed text directly to existing `chatContext.ts` Roman Urdu pipeline.
  5. **Text-to-Speech (TTS):** Native Piper neural synthesizer generating smooth WAV audio streamed back to speaker.
  6. **Interruption Handling:** Stop audio playback immediately when user begins speaking.
- **Verification Criteria:**
  - User speaks *"Salam, Lodhi AI kya haal hai"* into microphone.
  - Native engine transcribes speech with >90% accuracy in <600ms.
  - Lodhi AI synthesizes a spoken audio response in Roman Urdu and plays it through the speakers without freezing the UI.

---

### Phase 10: SaaS Authentication & Cloud Account Infrastructure
- **Objective:** Connect the Windows desktop application to a commercial cloud user identity provider.
- **Priority:** MEDIUM
- **Estimated Complexity:** MEDIUM (2 to 3 engineering days)
- **Dependencies:** Supabase Auth or Clerk/Auth0; domain name (`lodhiai.com`); HTTPS callback listener in Tauri (`lodhiai://auth/callback`).
- **Architecture:**
  1. Tauri deep linking for OAuth2 PKCE callback.
  2. Secure token storage via Windows DPAPI vault.
  3. User session persistence with automatic token refresh.
  4. Cloud profile sync (user preferences, custom prompts).
- **Verification Criteria:**
  - User clicks "Sign in with Google" or "Sign in with Email".
  - System browser handles OAuth consent and redirects to desktop app.
  - User profile and entitlement tier are resolved securely.

---

### Phase 11: Commercial Payment Processing & Metered Billing
- **Objective:** Enable in-app upgrades from Free Community to Pro and Enterprise tiers via automated billing.
- **Priority:** MEDIUM-HIGH
- **Estimated Complexity:** MEDIUM-HIGH (3 engineering days)
- **Dependencies:** Stripe account (or LemonSqueezy for merchant-of-record global tax compliance), webhook endpoint.
- **Architecture:**
  1. Stripe Checkout session generation via lightweight backend edge function.
  2. Webhook handler verifying Stripe cryptographic signatures.
  3. Automated Ed25519 license token generation upon payment confirmation.
  4. Instant desktop license activation via deep link or token paste.
- **Verification Criteria:**
  - Test purchase of Pro monthly subscription issues a valid cryptographically signed Ed25519 license key.
  - Key activates in desktop app offline and unlocks Pro model settings.

---

### Phase 12: Hybrid Local-Cloud Vector RAG Sync
- **Objective:** Expand the existing BM25 document library into dense semantic search across entire codebase repositories and cloud document collections.
- **Priority:** LOW-MEDIUM
- **Estimated Complexity:** HIGH (3 to 4 engineering days)
- **Dependencies:** FastEmbed / ONNX Runtime Rust bindings (`all-MiniLM-L6-v2` or `bge-small-en-v1.5`), SQLite `sqlite-vec` or local vector store.
- **Architecture:**
  1. Embedded vector database running inside Tauri (`sqlite-vec` in `%APPDATA%`).
  2. Local embedding generation in background threads without saturating CPU.
  3. Hybrid reciprocal rank fusion (RRF) combining BM25 keyword matching + dense vector similarity.
- **Verification Criteria:**
  - 100-page technical PDF or 500-file project workspace queried semantically.
  - Top 3 relevant snippets retrieved in <120ms with token-budgeted citations.

---

## 4. Hardware Optimization Guidelines for 8 GB RAM Systems

1. **Sequential Tool & Build Execution:** Never execute `cargo build` and large Vitest runs concurrently. Keep CPU utilization below 85% to maintain Windows responsiveness.
2. **Context Window Capping:** Default Ollama context window to 2,048 tokens (`num_ctx: 2048`) for `qwen2.5-coder:3b` to prevent out-of-memory allocations.
3. **Model Keep-Alive Management:** Keep Ollama models loaded for 5 minutes (`keep_alive: "5m"`), releasing memory back to Windows when idle.
4. **WebView2 Memory Trim:** Throttle DOM elements in long chat sessions by virtualizing or batching conversation turns beyond 50 messages.

---

## 5. Security Mandate & Policy Commitments

- **Zero Secret Exposure:** API keys (Gemini, Stripe, etc.) are encrypted via Windows DPAPI and NEVER sent to JavaScript or logged.
- **Human-in-the-Loop Safeguards:** File modifications, diagnostic script executions, and cloud transmissions require explicit user consent.
- **Workspace Boundary Invariant:** Absolute traversal blocking ensures no file outside the user-selected folder is read or modified.
- **Legacy Code Quarantine:** The legacy project `E:\LodhiAI` remains permanently untouched.
