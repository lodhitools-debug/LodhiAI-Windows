# Lodhi AI Windows — Phase 8 Pre-Implementation Audit
**Audit Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Project Root:** `E:\LodhiAI-Windows` (Strictly verified)  
**Legacy Project Boundary:** `E:\LodhiAI` (OFF-LIMITS · 100% Isolated & Untouched)  
**Host Target Profile:** Windows 10/11 x64, ~8 GB RAM, Local Ollama (`qwen2.5-coder:3b` on `127.0.0.1:11434`)  

---

## 1. Environment & Project Boundary Verification

1. **Current Working Directory:**
   - Active workspace: `E:\LodhiAI-Windows`.
   - Legacy directory `E:\LodhiAI` has **never** been opened, inspected, read, edited, built, formatted, or touched.
2. **Git Status & Working Tree:**
   - Working tree is clean and uncommitted user files have been preserved with zero destructive resets.
   - All backups follow the `.bak-<timestamp>` convention outside build outputs.
3. **Hardware & Local Model Characteristics:**
   - Physical PC RAM: ~8 GB.
   - Local model: `qwen2.5-coder:3b` (1.8 GB GGUF, Q4_K_M quantization).
   - Observed generation speed: ~5.8 to 6.1 tokens/sec on CPU/shared RAM.
   - First token latency (warm TTFT): ~1.79s; cold disk load: ~45s.
   - Design imperative: Keep the application lightweight, avoid concurrent heavy builds, stream responses to minimize perceived latency, avoid UI thread blockage, and never hallucinate capabilities.

---

## 2. Review of Prior Phase Reports & Baseline Tests

The following reports were inspected:
- `docs/MASTER_DEVELOPMENT_REPORT.md` (Native launch, WebView2 lockfile fix, 12-step agent workflow verification)
- `docs/COMMERCIAL_SAAS_ROADMAP.md` (Phased commercial release plan)
- `docs/SAAS_ARCHITECTURE.md` (Local vs Cloud separation, cryptographic licensing, SaaS API boundary)
- `docs/PHASE_3_AI_CODING_AGENT_REPORT.md` (Approval gates, transactional backups, sandboxed tools)
- `docs/PHASE_4_RELEASE_READINESS_REPORT.md` (Release executable verification, real-world QA)
- `docs/CODING_AGENT_WORKFLOW_VERIFICATION.md` (End-to-end file propose/reject/apply tests)
- `docs/COMBINED_PHASE_5_7_FINAL_REPORT.md` (Ed25519 offline licensing, RAG BM25, Android companion cockpit)

### Baseline Verification Commands Status:
- `npm run type-check`: **PASS (exit code 0)**
- `npm test`: **PASS (exit code 0, 102/102 tests passed across 15 test suites)**
- `npm run build`: **PASS (exit code 0, Vite production bundle generated)**
- `cargo test --manifest-path src-tauri\Cargo.toml`: **PASS (exit code 0, 97/97 tests passed)**
- `cargo test --manifest-path src-tauri\Cargo.toml live_local_ollama_chat_command_smoke -- --ignored`: **PASS (exit code 0, 1/1 passed against live `qwen2.5-coder:3b`)**

---

## 3. Inspection of Existing AI Chat, Gemini & Settings

### A. AI Chat Screen & Components
- **`src/screens/ChatScreen.tsx`:**
  - Manages session history, active conversation, message submission, loading states, and error alerts.
  - Auto-scroll currently triggers on every message array change, which can forcibly jump users away from reading older messages when new tokens arrive. Needs smart proximity detection (`isNearBottom`).
  - Chat header clearly distinguishes between `Google Gemini (Cloud)` with `Cloud Egress` badge and `Local Ollama` with `No cloud provider` badge.
  - Banner explains prompt transmission destination clearly.
- **`src/components/chat/ChatMessage.tsx`:**
  - Separates User, Assistant, and System messages cleanly.
  - Displays performance metrics: TTFT (ms), Tokens/sec, Token count, Duration (s).
  - Copy button already present for messages.
- **`src/components/chat/ChatInput.tsx`:**
  - Handles `Enter` to send and `Shift+Enter` for newline.
  - Stop Generation button appears during active generation.
  - Input and Send buttons disabled when generating or empty.
- **`src/services/chatContext.ts`:**
  - Implements `prepareConversationContext` with sliding window (budgeting tokens/chars while preserving root prompt).
  - **Gap:** Currently lacks a configurable System Prompt for natural conversational Roman Urdu / English personality, respectful tone, technical coding accuracy, uncertainty acknowledgment, and strict privacy guardrails against prompt/secret leakage.

### B. Gemini Provider Integration (`src-tauri/src/gemini.rs` & `ModelSettingsScreen.tsx`)
- **Key Storage:** Uses Windows DPAPI (`CryptProtectData` / `CryptUnprotectData`) to encrypt keys at rest in `%APPDATA%\com.lodhiai.desktop\gemini_secret.json`. Supports `GEMINI_API_KEY` / `GOOGLE_API_KEY` environment variables.
- **Redaction:** `mask_key` formats as `AIza****1234`. `redact_key` strips keys from error messages and logs.
- **Models:** Defaults to `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`. Dynamically queries available models via `list_gemini_models`.
- **Egress Guard:** Frontend enforces `settings.geminiConsentGiven` before transmitting prompts to `https://generativelanguage.googleapis.com`.
- **Error Handling:** Formats HTTP 400 (bad request/invalid key), HTTP 401/403 (unauthorized/quota exhausted), HTTP 429 (rate limits).
- **Gaps:** Non-streaming is currently used for Gemini; connection test latency is not explicitly surfaced in milliseconds in diagnostics; need configurable language settings in AppSettings and Settings screens.

---

## 4. Honest Audit of Voice Capabilities

### Can the user currently speak to Lodhi AI and hear Lodhi AI speaking back?
**Honest Answer:** **NO.**  
While foundational building blocks exist, **a natural, bi-directional spoken voice conversation in Roman Urdu is NOT functioning end-to-end today.**

### Detailed Voice Code Inspection:
1. **`src-tauri/src/voice.rs`:**
   - Implements `VoiceCapabilities` and `VoiceConfig` data structures.
   - Strictly enforces local isolation and prohibits background listening (`background_listening_allowed: false`).
   - Does **not** contain a native neural STT (speech-to-text) or neural TTS (text-to-speech) engine. It merely returns metadata.
2. **`src/services/voice.ts`:**
   - Wraps browser `window.webkitSpeechRecognition` / `window.SpeechRecognition` and `window.speechSynthesis`.
   - In desktop Tauri/WebView2 on Windows:
     - The Web Speech API `SpeechRecognition` is frequently unsupported or requires online Google/Microsoft cloud recognition endpoints.
     - Roman Urdu (`ur-PK` written in Latin script) is not recognized by standard English or Urdu acoustic models; it produces garbled or empty transcripts.
     - Windows desktop SAPI TTS voices (e.g., "Microsoft David", "Microsoft Zira") speak with English phonology and pronounce Roman Urdu words in an unintelligible, heavily accented English manner.
3. **`src/components/voice/VoiceInteractionModal.tsx`:**
   - A prototype modal UI that captures microphone activity and attempts Web Speech synthesis.
   - Because Web Speech API recognition fails or produces English phonetic misinterpretations for Roman Urdu, the user cannot have a reliable conversation.

### Realistic Voice Roadmap:
- In Phase 8, we will **NOT** create decorative or fake mic/audio buttons that pretend to work.
- We will document a dedicated, realistic Voice Architecture in `docs/PHASE_8_IMPLEMENTATION_REPORT.md` and `docs/PHASE_8_REMAINING_WORK.md` utilizing lightweight offline embedded models (e.g. Sherpa-ONNX / Whisper-base for STT and Piper / Edge-TTS for Urdu/English phonemes) optimized for 8 GB RAM PCs.

---

## 5. Audit of All Features from Phases 1–7

| Feature Area | Current Implementation Status | Verification Evidence |
| :--- | :--- | :--- |
| **AI Chat (Local Ollama)** | **Implemented & Verified** | Streaming chat, TTFT metrics, sliding context window, live smoke test passed. |
| **Google Gemini Provider** | **Implemented & Verified (BYOK)** | DPAPI encrypted vault, key masking, redaction, consent gate, mock unit tests passing. |
| **AI Coding Agent** | **Implemented & Verified** | 12-step filesystem workflow, staged proposals, diff preview, user approval gate, transactional byte backups. |
| **Workspace Isolation & Backups**| **Implemented & Verified** | Path traversal check, `.env` file protection, `.lodhi-ai-backups` timestamped recovery. |
| **Documents & Knowledge Base (RAG)**| **Implemented & Verified** | Real FS ingestion, PDF/MD/TXT extraction, BM25 indexing, citation retrieval; fake mock files removed. |
| **Diagnostics & Intelligence** | **Implemented & Verified** | Real project scanning, compiler error parsers (`tsc`, `rustc`, `pytest`), local diagnostic log export. |
| **Settings & Edition Switching** | **Implemented & Verified** | Free, Pro, Business UI preview toggles; local vault persistence. |
| **Offline Cryptographic Licensing** | **Implemented & Verified** | Ed25519 / SHA256 verifiable offline license tokens, instant verification, zero remote check required. |
| **Voice Conversation** | **Partially Implemented (Prototype)** | Web Speech API wrapper exists; lacks native Roman Urdu STT/TTS; needs dedicated future phase. |
| **Android Companion Cockpit** | **Partially Implemented (UI & Pairing)**| 6-digit one-time PIN generator, pairing session store, token generation; network socket sync is Phase 9. |
| **Sandboxed Browser Automation** | **Partially Implemented (Local Headless)**| Read-only HTML extraction, navigation history, human approval gate; advanced workflows scheduled for Phase 10. |
| **WhatsApp Workflow Integration** | **Partially Implemented (Template & Test)**| Phone validation, template drafting, confirmation modal, simulated test mode dispatch; live Cloud API requires credentials. |
| **User Authentication / Accounts**| **Documented Only (Local Profile Active)**| Currently uses local desktop profile. Cloud multi-user auth belongs to SaaS gateway. |
| **Usage Metering & Rate Limiting**| **Partially Implemented (Desktop Metrics)**| TTFT and token counters active in desktop UI; server-side API billing belongs to SaaS gateway. |
| **Subscription & Payment Backend**| **Documented Only (SaaS Gateway Architecture)**| Intentionally kept out of desktop binary; desktop verifies signed license tokens offline. |
| **Cloud Multi-User Data Isolation**| **Documented Only** | Desktop is strictly single-user on local machine; cloud isolation is part of SaaS server. |

---

## 6. Phase 8 Implementation Objectives & Plan

1. **AI Chat Experience Upgrade:**
   - Add personality prompt system in `src/services/chatContext.ts` with natural Roman Urdu, respectful conversational tone, coding precision, and privacy protection.
   - Update `AppSettings` in `src/types/index.ts` and `src/store/AppContext.tsx` with `chatLanguage` ('auto' | 'roman-urdu' | 'english') and `chatStyle` ('natural-companion' | 'concise-developer').
   - Improve `ChatScreen.tsx`: Smart auto-scroll that respects user scroll position (no snap-back while reading earlier turns), copy button feedback, and clear offline/provider disconnect recovery.
2. **Gemini Integration Hardening:**
   - Verify request formatting, latency reporting, error translation, and key redaction.
   - Add Chat Personality & Language preferences to Settings screen.
3. **Automated Testing:**
   - Create test suite `src/test/RomanUrduChat.test.tsx` testing Roman Urdu prompt formatting, language preferences, provider selection, and error resilience.
4. **Comprehensive Documentation:**
   - Create `docs/PHASE_8_IMPLEMENTATION_REPORT.md` and `docs/PHASE_8_REMAINING_WORK.md`.
5. **Full Release Build Verification:**
   - Run `npm run type-check`, `npm test`, `npm run build`, `cargo test`, and `cargo build --release`.
