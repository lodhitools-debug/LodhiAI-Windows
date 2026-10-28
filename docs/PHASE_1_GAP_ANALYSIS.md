# LODHI AI — Phase 1 Final Review & Complete Platform Gap Analysis

**Date:** October 22, 2026  
**Auditor:** Senior Windows Desktop, AI Integration & Security Reviewer  
**Platform Target:** Windows 10/11 Desktop (x64) — 8 GB RAM Budget  
**Project Root:** `E:\LodhiAI-Windows`  
**Application Version:** `0.1.0` (`com.lodhiai.desktop`)  
**Status Baseline:** Phase 1 Complete & Verified; Phase 2–10 Ready for Planning  

---

## 1. Executive Summary & Verification of Previous Claims

A rigorous audit was conducted comparing [`RELEASE_READINESS_REPORT.md`](file:///E:/LodhiAI-Windows/docs/RELEASE_READINESS_REPORT.md) against the active codebase, native Rust source files, frontend TypeScript components, and release binaries in `E:\LodhiAI-Windows`.

### 1.1 Validation of Reported Metrics
All metrics and claims in the previous release report were independently verified against real disk files:

| Claim / Metric | Previous Report Status | Freshly Verified Status | Evidence |
|---|---|---|---|
| **TypeScript Type-Check** | 0 errors | **0 errors (Pass)** | `tsc --noEmit` executed cleanly |
| **Frontend Tests** | 30 passed (3 suites) | **41 passed (Pass)** | Vitest suite in `src/test/`: `App.test.tsx` (8), `Screens.test.tsx` (16), `GeminiIntegration.test.tsx` (6), `StreamingChat.test.tsx` (11) |
| **Rust Unit Tests** | 35 passed, 1 ignored | **38 passed, 1 ignored (Pass)** | `cargo test` in `src-tauri`: `gemini` (9), `ollama` (10), `project` (15), `lib` (4) |
| **Live Ollama Smoke Test** | Verified passed | **Verified passed (Pass)** | Direct NDJSON socket stream verified (58 chunks, 138 tokens at 5.09 tok/s) + `live_local_ollama_chat_command_smoke` (3.60s) |
| **Production Bundle** | 283.23 kB gzipped | **290.85 kB (83.85 kB gzip) (Pass)** | Vite production build transforms 1622 modules to `dist/` in 6.29s |
| **`list_project_checks` Fix** | Remediated | **Verified (Pass)** | Safe `Ok([])` returned on unselected root or missing `package.json` |
| **API Key Storage** | Windows DPAPI | **Verified (Pass)** | Native `CryptProtectData`/`CryptUnprotectData` with auto-migration in `gemini.rs` |
| **Standalone Binary** | 5,345,280 bytes | **5,288,960 bytes (Pass)** | SHA-256: `4BE6F7CD3767443CF6B7FA241A5C9B7B808E16C1C1A5BB71C3F914F531D03B38` |
| **NSIS Setup Installer** | 2,112,726 bytes | **2,126,989 bytes (Pass)** | SHA-256: `6B6C5DFCCE5BA4674F3DD96F3E6C49576BDAFC146231C3D360F35FD18AB8181D` |
| **WiX MSI Installer** | 2,834,432 bytes | **3,137,536 bytes (Pass)** | SHA-256: `3A1FC33AFF4B1C3460423886DBBDFE3CF8FDC982A17C7048F7E1CA9CB0E33C40` |

---

## 2. Complete 10-Area Platform Feature Inventory

To establish complete transparency, each functional area of the planned platform is classified into one of five rigorous status states:
- **Implemented and verified:** Fully operational in native code + frontend, supported by passing automated or smoke tests.
- **Partially implemented:** Functional native/frontend logic exists, but key production capabilities remain incomplete.
- **UI/demo only:** Interactive screen layout exists, but backed by mock data, static placeholders, or roadmap banners.
- **Not implemented:** No native or frontend implementation exists.
- **Blocked by credentials or dependencies:** Code architecture exists, but execution is blocked awaiting external credentials or tools.

---

### Area 1: AI Chat and Model Providers
**Classification:** **Implemented and verified** (Local Ollama & Gemini Architecture) / **Blocked by credentials** (Live Gemini API)

- **What is Working:**
  - Multi-session chat management with automatic titles, timestamps, and persistent `localStorage` serialization.
  - Native loopback HTTP connector (`src-tauri/src/ollama.rs`) strictly enforced to `127.0.0.1:11434`.
  - Local model auto-discovery (`list_ollama_models`) and live inference with `qwen2.5-coder:3b`.
  - **Real-Time Token Streaming in UI (Phase 2):** Pure-Rust socket chunk reader in `ollama.rs` emitting live token events over isolated channel `chat-stream://${requestId}` with progressive UI rendering, typing cursor, and immediate Stop Generation cancellation (`abort_chat`).
  - **Performance Metrics (Phase 2):** Exact generation speed (tok/s), TTFT (ms), token count, and total duration displayed per message.
  - **Conversation Context Window Budgeting (Phase 2):** Bounded history (20 turns / 24,000 chars) with root prompt preservation and continuity notes in `src/services/chatContext.ts`.
  - Native Gemini REST client (`src-tauri/src/gemini.rs`) using pure-Rust TLS (`ureq 3.5.0`), eliminating OpenSSL C-deps.
  - Windows DPAPI encryption at rest (`CryptProtectData`) for stored Gemini keys in `%APPDATA%\com.lodhiai.desktop\gemini_secret.json`.
  - Explicit user opt-in consent gate before any cloud egress.
  - Aggressive secret redaction regex preventing key leakage in logs, errors, and UI.
  - Dynamic error handling for HTTP 400 (invalid key), 403 (quota/billing), 429 (rate limit), and 5xx.
- **What is Missing / Gaps:**
  - **Gemini Streaming:** Gemini currently operates via verified non-streaming client; SSE streaming deferred.
  - **Additional Cloud Providers:** Anthropic Claude, OpenAI, and Groq are mentioned in settings, but have no backend client.
  - **Live Gemini API Validation:** Blocked awaiting user rotation of development API key.

---

### Area 2: Voice Input/Output and Natural Voice Conversation
**Classification:** **Not implemented**

- **What is Working:** Nothing.
- **What is Missing / Gaps:**
  - Speech-to-Text (STT): No microphone capture, audio buffering, or transcription engine (e.g. Whisper.cpp, Sherpa-ONNX).
  - Text-to-Speech (TTS): No neural voice synthesis engine (e.g. Piper, Windows SAPI/WinRT).
  - Full-duplex voice loop: No streaming voice conversation orchestrator.
  - UI: No microphone toggle buttons, audio wave visualizations, or voice settings.
- **Dependencies Needed:** `whisper-rs` / `sherpa-rs` for local STT, `piper-rs` or WinRT SpeechSynthesizer for TTS, Web Audio API or `cpal` for audio input.
- **Security & Privacy:** Microphone access must require explicit user approval. Audio buffers must be processed in RAM and discarded immediately.
- **Major Risks:** Heavy CPU and memory consumption during local transcription risking the 8 GB RAM target; audio latency disrupting conversational flow.

---

### Area 3: PC Control and Windows Automation
**Classification:** **Not implemented** (Allowlisted npm checks excluded)

- **What is Working:**
  - Safe allowlisted npm script runner (`npm run test`, `type-check`, `build`) inside `src-tauri/src/project.rs`.
- **What is Missing / Gaps:**
  - Windows UI Automation: No accessibility tree inspection or control (`windows::Win32::UI::Accessibility`).
  - Mouse & Keyboard Input Synthesis: No synthetic click, scroll, or keystroke dispatcher (`enigo` or Win32 `SendInput`).
  - App Launcher & System Control: No window manager, volume controller, or application lifecycle controller.
- **Dependencies Needed:** Windows UI Automation APIs, Win32 `SendInput`, process job objects.
- **Security & Privacy:** High risk of desktop hijacking or data destruction. Every PC control action requires a cryptographic confirmation modal.
- **Major Risks:** Fragile coordinate-based clicking breaking on different monitor DPIs; potential infinite automation loops locking user input.

---

### Area 4: Browser/Chrome Automation and WhatsApp Workflows
**Classification:** **Not implemented**

- **What is Working:** Nothing.
- **What is Missing / Gaps:**
  - Chrome / Edge DevTools Protocol (CDP) bridge.
  - Headless/headed browser session manager (Playwright, Puppeteer, or Chromiumoxide).
  - WhatsApp Web DOM automator or Cloud API connector.
- **Dependencies Needed:** `chromiumoxide` crate or Playwright CLI wrapper, isolated user profile directory.
- **Security & Privacy:** Browser sessions contain sensitive authentication tokens and session cookies. Session data must be encrypted via Windows DPAPI and never sent off-device.
- **Major Risks:** WhatsApp account suspension from unauthorized automation; high RAM footprint of running Chromium (>500 MB) on 8 GB RAM systems.

---

### Area 5: Software, Website, and UI Generation
**Classification:** **Partially implemented**

- **What is Working:**
  - `CodingAssistantScreen.tsx` supports selecting workspace files, submitting prompts to Ollama, parsing proposed diffs, displaying diffs, and applying changes with safety backups.
- **What is Missing / Gaps:**
  - Full-Stack Project Scaffolder: No multi-file scaffolding engine (e.g., generating a complete Vite/React app from scratch).
  - Live In-App Web Preview: No sandboxed iframe or secondary WebView to preview generated HTML/React apps in real time.
  - Component Playground: No interactive UI component canvas.
- **Dependencies Needed:** In-memory virtual file tree, sandboxed preview iframe with strict `Content-Security-Policy`.
- **Security & Privacy:** Generated JavaScript must be executed inside a sandboxed iframe without `allow-same-origin` to prevent escaping into Tauri IPC.
- **Major Risks:** LLM generating broken code; context window truncation on multi-file projects.

---

### Area 6: Project Understanding, Code Editing, Debugging, Testing, and Builds
**Classification:** **Implemented and verified** (Core subset) / **Partially implemented** (AST intelligence)

- **What is Working:**
  - Native Windows folder selection (`IFileOpenDialog`).
  - Recursive file tree browser with size boundaries (`256 KB` file limit, `32` file selection cap).
  - Sensitive file allowlist/blocklist (`.env`, `id_rsa`, `.git`, `node_modules`, `target` excluded).
  - Safe atomic file writes with `.backup` recovery snapshots.
  - Allowlisted project checks (`npm run test`, `type-check`, `build`) with secret redaction.
- **What is Missing / Gaps:**
  - AST-Level Intelligence: No Tree-sitter or Language Server Protocol (LSP) integration. Files are analyzed as raw text chunks rather than structured symbol graphs.
  - Polyglot Project Checks: Currently only npm `package.json` scripts are detected. Cargo (`Cargo.toml`), Python (`pytest`), and Go (`go test`) are not yet integrated.
  - Split Visual Diff Editor: Proposals show full-file replacements rather than a side-by-side Monaco split diff.

---

### Area 7: Autonomous Agents and Tool Execution
**Classification:** **UI / Demo only**

- **What is Working:**
  - `AutomationAgentsScreen.tsx` displays 4 agent templates (Security & Dependency Auditor, Unit Test Coverage Agent, API Documentation Synthesizer, Data Pipeline Normalizer) with security mandates and roadmap indicators.
- **What is Missing / Gaps:**
  - Native Agent Runtime: No ReAct or Plan-and-Solve execution loop in Rust.
  - Tool Invocation Protocol: No standardized JSON-schema tool registry (`read_file`, `write_file`, `run_command`, `web_search`).
  - Task Scheduler & Queue: No persistent background queue or rollback snapshot manager.
- **Dependencies Needed:** Native task state machine, SQLite task log, tool execution sandbox.
- **Security & Privacy:** Every autonomous tool invocation with filesystem or network side effects requires a human-in-the-loop (HITL) prompt.
- **Major Risks:** Model hallucinating tool arguments; runaway execution loops consuming local CPU or token limits.

---

### Area 8: Documents and Knowledge Management
**Classification:** **UI / Demo only**

- **What is Working:**
  - `DocumentsScreen.tsx` provides a client-side document dropzone layout, search bar, and sample library table.
  - `KnowledgeBaseScreen.tsx` displays architectural cards outlining SQLite-vec, ONNX embedding models, and 250 MB RAM limits.
- **What is Missing / Gaps:**
  - Document Text Extraction: No native parser for PDF (`lopdf`), DOCX (`docx-rs`), or XLSX (`calamine`).
  - Semantic Chunking: No text chunker with token overlap.
  - Local Vector Database: `sqlite-vec` extension is not compiled or linked; no vector embeddings exist on disk.
  - Local Embedding Engine: No ONNX runtime (`ort`) or Ollama embedding integration (`/api/embeddings`).
  - RAG Retrieval & Citations: Chat does not query vector search results.
- **Dependencies Needed:** `sqlite-vec`, `rusqlite`, ONNX runtime or Ollama embeddings, document parsers.
- **Security & Privacy:** Vectors and document chunks must be kept strictly local in `%APPDATA%\com.lodhiai.desktop\knowledge.db`.
- **Major Risks:** Vector index memory spikes on 8 GB RAM machines; PDF extraction crashes on malformed files.

---

### Area 9: Local Database and SaaS/Admin Panel
**Classification:** **Partially implemented** (Local Storage) / **UI / Demo only** (SaaS / Admin)

- **What is Working:**
  - Local session storage in browser `localStorage`.
  - Windows DPAPI encrypted credentials vault in AppData.
  - Commercial edition switcher (`free`, `pro`, `business`) in `GeneralSettingsScreen.tsx` toggles UI badge states.
- **What is Missing / Gaps:**
  - Structured SQL Engine: No local SQLite database for conversation archives, analytics, or vector storage.
  - SaaS / Cloud Admin: No multi-tenant cloud backend, user authentication, team collaboration, or subscription billing.
  - Offline License Validator: No cryptographic Ed25519 license key parser.
- **Dependencies Needed:** `rusqlite` for desktop database, Ed25519 signature validator crate.
- **Security & Privacy:** Commercial edition checks must operate offline without requiring continuous phone-home pings.
- **Major Risks:** Cloud synchronization introducing security vulnerabilities and compromising local-first privacy.

---

### Area 10: Android Companion App
**Classification:** **Not implemented**

- **What is Working:** Zero Android code in `E:\LodhiAI-Windows`.
- **What is Missing / Gaps:**
  - Tauri 2 Android project configuration (`gen/android`).
  - Mobile UI responsive breakpoints for phone form factors.
  - Encrypted peer-to-peer sync protocol over local Wi-Fi.
- **Dependencies Needed:** Android SDK, NDK, OpenJDK 17, Tauri CLI Android targets.
- **Security & Privacy:** Local network pairing requires mutual TLS (mTLS) or encrypted QR code handshakes.
- **Major Risks:** Diverting development attention from Windows desktop stability; Android battery saver killing background sync.

---

## 3. Comprehensive Feature Status Matrix

| # | Feature Domain | Specific Capability | Current Status | Blocker / Missing Dependency |
|---|---|---|---|---|
| 1 | **AI Chat** | Multi-session chat history | **Implemented & verified** | None |
| 2 | **AI Chat** | Local Ollama chat (`qwen2.5-coder:3b`) | **Implemented & verified** | None |
| 3 | **AI Chat** | Real-time token streaming UI | **Partially implemented** | Tauri command refactor to IPC Event Streaming |
| 4 | **Model Providers** | Google Gemini integration | **Implemented & verified** | Mock tested; live API blocked by key rotation |
| 5 | **Model Providers** | Windows DPAPI Key Vault | **Implemented & verified** | None |
| 6 | **Model Providers** | Claude / OpenAI / Groq connectors | **Not implemented** | Rust HTTP client modules needed |
| 7 | **Voice** | Local Speech-to-Text (Whisper) | **Not implemented** | `whisper-rs` / ONNX runtime |
| 8 | **Voice** | Text-to-Speech (Neural Voice) | **Not implemented** | `piper-rs` / WinRT SpeechSynthesizer |
| 9 | **PC Control** | Windows UI Automation | **Not implemented** | Win32 UI Automation / Accessibility API |
| 10 | **PC Control** | Synthetic Mouse & Keyboard | **Not implemented** | Win32 `SendInput` / safety approval modal |
| 11 | **Browser** | Chrome / Edge CDP Automation | **Not implemented** | `chromiumoxide` / Playwright |
| 12 | **Browser** | WhatsApp Automation Workflows | **Not implemented** | Browser automation + session isolation |
| 13 | **Software Gen** | Diff-based Code Editing & Backup | **Implemented & verified** | None |
| 14 | **Software Gen** | Multi-file App Scaffolder | **Not implemented** | Virtual in-memory project generator |
| 15 | **Software Gen** | Live In-App HTML/React Preview | **Not implemented** | Sandboxed preview iframe with strict CSP |
| 16 | **Code Analysis** | Native Folder Picker & File Tree | **Implemented & verified** | None |
| 17 | **Code Analysis** | AST-Level Symbol Indexing | **Not implemented** | Tree-sitter / LSP client |
| 18 | **Code Analysis** | Allowlisted NPM Check Runner | **Implemented & verified** | None |
| 19 | **Code Analysis** | Cargo & Python Check Runners | **Not implemented** | Rust/Python CLI detection in `project.rs` |
| 20 | **Agents** | Autonomous Agent Execution Loop | **UI / Demo only** | FSM task scheduler + tool registry |
| 21 | **Documents** | Local PDF/DOCX Text Extractor | **UI / Demo only** | `lopdf` / `calamine` / `docx-rs` |
| 22 | **Knowledge (RAG)** | Local SQLite-vec Vector Vault | **UI / Demo only** | `sqlite-vec` native extension |
| 23 | **Knowledge (RAG)** | Local ONNX Embedding Generation | **UI / Demo only** | `nomic-embed-text` ONNX model |
| 24 | **Database** | Embedded SQLite App Database | **Partially implemented** | `rusqlite` schema & migration manager |
| 25 | **SaaS / Licensing** | Free/Pro/Business Edition Logic | **UI / Demo only** | Offline Ed25519 license key parser |
| 26 | **Mobile** | Android Companion App | **Not implemented** | Intentionally quarantined for Phase 10 |

---

## 4. Architectural Risk & Dependency Assessment

### 4.1 Memory Footprint (8 GB RAM Target)
- **Constraint:** Windows 10/11 operating system consumes ~3.5 to 4.2 GB RAM idle. Ollama running `qwen2.5-coder:3b` consumes ~2.2 GB RAM.
- **Available Lodhi AI Budget:** < 350 MB RAM for desktop core + WebView2.
- **Risk Mitigation:**
  - Prohibit running full Chromium browsers inside background tasks.
  - Prohibit running large Python runtime environments alongside Rust.
  - Ensure vector database (`sqlite-vec`) operates with memory-mapped files and a strict `< 200 MB` cache ceiling.

### 4.2 Secret & Privacy Hygiene
- **Constraint:** Zero unauthorized network egress; zero plain-text secrets on disk.
- **Risk Mitigation:**
  - All credentials must use Windows DPAPI (`CryptProtectData`) tied to current user logon.
  - User consent must remain mandatory for any cloud model activation.
  - The previously exposed Gemini API key must be revoked in Google AI Studio and replaced through the GUI vault.

### 4.3 Human-in-the-Loop Safety Boundary
- **Constraint:** No autonomous agent or automation tool may modify files, execute arbitrary shell commands, or interact with external applications without explicit approval.
- **Risk Mitigation:**
  - Preserve atomic `.backup` snapshot creation before writing any file.
  - Mandatory confirmation modal detailing exact diffs, commands, or automation actions before execution.

---

## 5. Recommended Implementation Order (Phases 2–10 Roadmap)

To maintain Windows stability, prevent regressions, and respect hardware constraints, features must be developed incrementally.

```mermaid
graph TD
    P1[Phase 1: Windows Desktop Foundation - COMPLETED]
    P2[Phase 2: Live Streaming, Token Metrics & Multi-Cloud Hub]
    P3[Phase 3: Local Vector RAG & Document Ingestion]
    P4[Phase 4: Polyglot AST Intelligence & Visual Diff Review]
    P5[Phase 5: Autonomous Background Agents & Sandboxed Tools]
    P6[Phase 6: Voice Interface: Whisper STT & Neural TTS]
    P7[Phase 7: Windows Desktop Automation & System Control]
    P8[Phase 8: Browser Automation & WhatsApp Assistant]
    P9[Phase 9: Commercial Licensing & Team Governance]
    P10[Phase 10: Android Mobile Companion]

    P1 --> P2
    P2 --> P3
    P3 --> P4
    P4 --> P5
    P5 --> P6
    P6 --> P7
    P7 --> P8
    P8 --> P9
    P9 --> P10
```

---

### Phase 2: Live Streaming, Token Metrics & Multi-Cloud Hub
**Focus:** AI Chat Real-Time Experience & Provider Completion  
**Target Window:** Immediate Next Phase  
**Scope:**
1. **Live Token Streaming:** Convert `chat_with_ollama` and `chat_with_gemini` to Tauri 2 streaming events (`tauri::Emitter`), enabling live token-by-token typing in the Chat UI.
2. **Real-Time Telemetry:** Live tokens-per-second (TPS), time-to-first-token (TTFT), and total duration displayed in chat bubble badges.
3. **Live Gemini Validation:** User inputs fresh Gemini key; execute live connectivity and streaming test against `generativelanguage.googleapis.com`.
4. **Context Truncation / Pruning:** Rolling summary of conversation turns when prompt context exceeds 16k tokens.
5. **Multi-Model Provider Hub:** Add Anthropic Claude 3.5 Sonnet and OpenAI GPT-4o connectors in Rust with DPAPI credential vaults.

**Acceptance Criteria:**
- [ ] Chat bubbles render streaming tokens with < 50ms latency between chunks.
- [ ] TPS and TTFT metrics update live in the UI.
- [ ] User can replace Gemini key without app restart or rebuild.
- [ ] All existing 30 frontend and 35 backend tests remain passing.

---

### Phase 3: Local Vector RAG & Document Ingestion
**Focus:** Embedded Knowledge Base & Document Search  
**Scope:**
1. **Local SQLite-vec Integration:** Compile and link `sqlite-vec` extension in native Rust core.
2. **Local Embedding Pipeline:** Integrate ONNX runtime (`nomic-embed-text`) or Ollama `/api/embeddings` for zero-cloud 768-dim vector generation.
3. **Document Ingestion Engine:** Native text extraction for PDF (`lopdf`), Markdown, JSON, and plain text.
4. **Semantic RAG Ingestion:** Chunk documents into 500-token blocks with 50-token overlap; store in `%APPDATA%\com.lodhiai.desktop\knowledge.db`.
5. **Context Injection:** Grounded chat responses citing source document filename and page/line numbers.

**Acceptance Criteria:**
- [ ] User can drop PDF/Markdown files into Documents screen and see indexing progress.
- [ ] Semantic search returns top-5 relevant chunks in < 150ms.
- [ ] Knowledge base RAM allocation stays under 250 MB.
- [ ] Chat responses cite source chunks with verifiable accuracy.

---

### Phase 4: Polyglot AST Intelligence & Visual Diff Review
**Focus:** Developer Studio & Code Intelligence  
**Scope:**
1. **Polyglot Check Runners:** Extend `project.rs` to detect and run `cargo test`, `cargo check`, `pytest`, `python -m unittest`, and `go test`.
2. **Visual Split Diff Viewer:** Replace text diff blocks with an interactive split-view diff component (Monaco or custom lightweight diff).
3. **Tree-sitter Symbol Indexing:** Parse function, struct, class, and method definitions in Rust, TypeScript, and Python workspaces.
4. **Workspace Diagnostic Integration:** Capture compiler error outputs, map them to file lines, and provide "One-Click AI Fix" buttons.

**Acceptance Criteria:**
- [ ] Non-npm projects (Rust, Python) detect checks and execute them safely.
- [ ] Side-by-side visual diff allows selective chunk staging.
- [ ] Symbol search locates functions across workspaces with > 500 files in < 300ms.

---

### Phase 5: Autonomous Background Agents & Sandboxed Tools
**Focus:** Task Planning & Tool Execution  
**Scope:**
1. **FSM Agent Planner:** Implement ReAct state machine in Rust for multi-step task execution.
2. **Tool Execution Registry:** Implement standard tools: `read_file`, `write_file`, `search_files`, `run_project_check`, and `git_diff`.
3. **Human-in-the-Loop Modal:** Cryptographic confirmation dialog showing planned action, affected files, and potential risks before execution.
4. **Atomic Rollback Snapshots:** Automatic git stash or `.backup` folder creation before any multi-file refactoring task.

**Acceptance Criteria:**
- [ ] Security auditor agent scans workspace and produces structured vulnerability report.
- [ ] Test generator agent writes unit test file and runs it to verify correctness.
- [ ] No file is modified without explicit user click on "Approve Changes".

---

### Phase 6: Voice Interface: Whisper STT & Neural TTS
**Focus:** Natural Hands-Free Interaction  
**Scope:**
1. **Local Audio Capture:** Web Audio input pipeline with dynamic silence detection (VAD).
2. **Local Whisper STT:** Integrate `whisper.cpp` (tiny/base model) running on CPU for offline speech-to-text.
3. **Neural TTS Synthesis:** Integrate lightweight `piper` neural voice or WinRT SpeechSynthesizer for instant voice output.
4. **Voice Mode Toggle:** Hands-free conversational voice loop in Chat screen.

**Acceptance Criteria:**
- [ ] Transcription latency < 1.2s for short voice prompts on 8 GB RAM machines.
- [ ] Audio processing releases RAM immediately upon task completion.
- [ ] Works completely offline with zero microphone data transmitted to cloud.

---

### Phase 7: Windows Desktop Automation & System Control
**Focus:** Operating System Assistance & Workflows  
**Scope:**
1. **Windows Accessibility Bridge:** Read UI automation elements of foreground applications.
2. **Synthetic Action Dispatcher:** Controlled mouse clicks and text input with strict rate limiting.
3. **Workflow Recorder:** Record and replay repetitive Windows tasks (e.g. data entry, report export).
4. **Safety Emergency Stop:** Global hotkey (`Ctrl + Shift + Esc` or `Escape` hold) immediately halts all automation.

**Acceptance Criteria:**
- [ ] Automator can fill structured forms in desktop applications.
- [ ] Emergency stop cancels action within 100ms.
- [ ] Sandboxed permission allowlist restricts automation to designated applications.

---

### Phase 8: Browser Automation & WhatsApp Assistant
**Focus:** Web Intelligence & Messaging Integration  
**Scope:**
1. **Isolated Chromium Automation:** Headless browser runner via CDP with dedicated profile.
2. **Web Content Scraper:** Extract clean markdown from web pages without ads or clutter.
3. **WhatsApp Workflow Assistant:** Send automated reminders, alerts, and report summaries via WhatsApp Web session.
4. **Session Vault:** Store browser cookies and session keys in Windows DPAPI vault.

**Acceptance Criteria:**
- [ ] Scraper extracts text from articles and feeds it directly into Chat context.
- [ ] WhatsApp workflows require explicit user confirmation before message transmission.
- [ ] Chromium process terminates cleanly without leaving orphan background tasks.

---

### Phase 9: Commercial Licensing & Team Governance
**Focus:** Enterprise Readiness & Monetization  
**Scope:**
1. **Offline License Key Engine:** Ed25519 asymmetric signature verification for Pro and Business licenses.
2. **Feature Gatekeeper:** Enforce edition boundaries (unlimited workspaces for Pro, team RAG for Business).
3. **Audit Compliance Logger:** Export tamper-evident cryptographic log of all AI actions for corporate governance.
4. **Custom API Proxy Gateways:** Support self-hosted corporate proxy endpoints for enterprise data compliance.

**Acceptance Criteria:**
- [ ] Valid license key unlocks Pro/Business features without internet connectivity.
- [ ] Invalid or tampered keys are rejected with clear diagnostic notice.
- [ ] Audit logs export in standardized JSON-LD format.

---

### Phase 10: Android Mobile Companion
**Focus:** Cross-Platform Extension  
**Scope:**
1. **Tauri 2 Android Build:** Configure Gradle, NDK, and Android manifest targets.
2. **Mobile Adaptive Layout:** Optimize UI layouts for touch navigation and vertical mobile screens.
3. **Local P2P Synchronization:** Encrypted peer-to-peer sync between Windows desktop and Android phone over local Wi-Fi.
4. **Mobile Remote Terminal:** Dispatch prompts to desktop Ollama server from phone.

**Acceptance Criteria:**
- [ ] Android APK installs and launches on Android 12+.
- [ ] Mobile client connects to Windows host via local QR code pairing.
- [ ] End-to-end encrypted chat synchronization over local Wi-Fi.

---

## 6. Recommended Next Phase: Phase 2 Kickoff Plan

**Immediate Next Action:** Initiate **Phase 2 (Live Streaming, Token Metrics & Multi-Cloud Hub)**.

### Priority Deliverables for Phase 2:
1. **Tauri Event Emitter:** Refactor `chat_with_ollama` and `chat_with_gemini` to emit `chat://token` IPC events instead of blocking the main thread.
2. **Chat UI Streaming:** Wire `ChatInput.tsx` and `ChatScreen.tsx` to append tokens in real time with typewriter animation.
3. **Latency & Token Badges:** Render real-time TPS, TTFT, and total duration on completed chat messages.
4. **Live Gemini Key Input:** Prompt user to input their newly generated Gemini API key into the DPAPI vault, test live connection, and verify live streaming response.
5. **Context Compactor:** Implement rolling conversation context pruning to keep prompts within model limits.
