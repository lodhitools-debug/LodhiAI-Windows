# Lodhi AI Windows — Phase 9 Pre-Implementation Voice Audit

**Audit Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Project Workspace:** `E:\LodhiAI-Windows` (Strictly verified)  
**Legacy Project Boundary:** `E:\LodhiAI` (OFF-LIMITS · 100% Isolated & Untouched)  
**Host Target Profile:** Windows 10/11 x64, ~8 GB RAM, Local Ollama (`qwen2.5-coder:3b` on `127.0.0.1:11434`), High Definition Audio Controller  

---

## 1. Project Safety & Git Status Verification

1. **Active Working Directory:** `E:\LodhiAI-Windows` confirmed via shell inspection.
2. **Legacy Quarantine Invariant:** The legacy project `E:\LodhiAI` has NOT been accessed, read, modified, or migrated.
3. **Working Tree State:** All user changes from Phase 8 are preserved intact. All tests from Phase 8 pass with exit code 0.
4. **Hardware Environment:**
   - Host OS: Windows 10/11 Pro x64.
   - Physical Memory: ~8 GB RAM.
   - Audio Controller: High Definition Audio Device (Realtek / Microsoft HDAudio driver).
   - Audio Output: `Speakers (2- High Definition Audio Device)` (Status: `OK`, Active).
   - Audio Input (Microphone): Currently no physical 3.5mm or USB microphone endpoint plugged in (`Get-PnpDevice -Class AudioEndpoint` reports 0 active capture endpoints).
   - Windows Microphone Consent: `HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone` is set to `"Allow"`.

---

## 2. Review of Prior Phase Deliverables & Architecture

- **`docs/PHASE_8_AUDIT.md` & `docs/PHASE_8_IMPLEMENTATION_REPORT.md`:**
  - AI Chat upgraded with `Shift+Enter`, `Enter`, `Stop Generation`, copy feedback, proximity auto-scroll (`isNearBottom`), and provider badges.
  - Google Gemini integrated with Windows DPAPI encryption (`%APPDATA%\com.lodhiai.desktop\gemini_secret.json`) and official `systemInstruction` formatting.
  - Roman Urdu personality conditioned in `src/services/chatContext.ts` with 8 GB RAM performance awareness.
  - Production executable: `src-tauri\target\release\lodhi-ai.exe` (5,799,424 bytes).
- **`docs/PHASE_8_REMAINING_WORK.md`:**
  - Classified Voice Conversation as a critical missing native capability: The browser Web Speech API (`webkitSpeechRecognition` / `speechSynthesis`) inside WebView2 is brittle, lacks Roman Urdu phonetics, and fails silently in headless or unprivileged environments.
  - Recommended Phase 9: Native Offline Voice Conversation Engine with native Windows audio capture/synthesis, state machine, and Whisper/Piper evaluation.

---

## 3. Inspection of Existing Audio & Voice Code

### Rust Backend (`src-tauri/src/voice.rs` & `src-tauri/src/lib.rs`):
- `voice.rs` contains minimal placeholder structs: `VoiceCapabilities` and `VoiceConfig`.
- IPC commands registered in `lib.rs`: `get_voice_capabilities`, `configure_voice`, `get_current_voice_config`.
- Current limitation: `get_voice_capabilities` statically returned `microphone_available: true` and generic strings without querying actual Windows hardware, devices, or speech APIs.
- No native audio capture, WAV generation, or speech synthesis commands were implemented.

### Frontend (`src/services/voice.ts` & `src/components/voice/VoiceInteractionModal.tsx`):
- `voice.ts`: Uses `window.speechSynthesis` and `(window as any).webkitSpeechRecognition`.
- In Windows WebView2 desktop runtime, `webkitSpeechRecognition` fails because Google's proprietary cloud speech endpoint is inaccessible from native desktop webviews.
- `VoiceInteractionModal.tsx`: A modal dialog with basic push-to-talk buttons, but disconnected from real native speech engines.

---

## 4. Evaluation of Speech Engines (STT & TTS) for Windows 8 GB RAM

### A. Speech-to-Text (STT) Engines

| Engine | License | Download Size | RAM Footprint | Windows Offline Support | Language & Roman Urdu Realities | Selection Recommendation |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Windows System Speech (`System.Speech.Recognition`)** | Built into Windows OS (Proprietary / Free) | **0 MB** (Already installed on OS) | **< 30 MB** | **100% Offline Native** | **Verified MS-1033-80-DESK (en-US)** installed on this machine. Verified live: transcribes WAV in < 1s, but maps Urdu phonetically into English words ("Lodhi AI" -> "La Vi boys"). | **Default Zero-Install Fallback** for instant English recognition without downloads. |
| **Whisper.cpp (`ggml-tiny.bin` / `ggml-base.bin`)** | MIT License (OpenAI / Georgi Gerganov) | **75 MB** (tiny) / **142 MB** (base) | **~350 MB** (tiny) / **~500 MB** (base) | **100% Offline Native CPU** (AVX2) | High-accuracy multilingual support including Urdu (`ur`). Roman Urdu can be transcribed phonetically or mapped from Urdu script. Fits comfortably within 8 GB RAM. | **Recommended High-Accuracy Model** for multilingual / Urdu developer workflows. |
| **Sherpa-ONNX (Zipformer)** | Apache 2.0 | **120 MB - 300 MB** | **~450 MB** | 100% Offline (ONNX Runtime) | Good streaming latency, but requires precompiled ONNX Runtime DLLs for MSVC and multi-file models. | Secondary alternative; higher setup complexity. |

### B. Text-to-Speech (TTS) Engines

| Engine | License | Download Size | RAM Footprint | Windows Offline Support | Language & Voice Reality | Selection Recommendation |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Windows SAPI Desktop Synthesizer (`System.Speech.Synthesis`)** | Built into Windows OS (Free) | **0 MB** (Installed) | **< 20 MB** | **100% Offline Native** | **Verified on this PC:** `Microsoft David Desktop` (Male en-US) and `Microsoft Zira Desktop` (Female en-US). Tested live: generates 119 KB WAV in 1.2s. Pronounces English and technical terms clearly. Roman Urdu words are read phonetically with English accent. | **Default Zero-Install TTS Engine.** Extremely lightweight, zero RAM waste. |
| **Piper TTS** | MIT License (Rhasspy) | **30 MB - 60 MB** per voice | **~150 MB** | 100% Offline Native | Neural ONNX voice models with natural inflection. Urdu voice (`ur_PK-medium`) available. | **Recommended Neural Upgrade Voice** when user downloads voice pack. |
| **Windows Media OneCore Synthesizer** | Windows OS Component | **0 MB** | **< 25 MB** | 100% Offline Native | Natural OneCore voices (`DavidM`, `MarkM`, `ZiraM`). High-quality offline synthesis. | Supported out-of-the-box on Windows 10/11. |

---

## 5. Architectural Blueprint for Phase 9 Implementation

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Lodhi AI Voice Cockpit                          │
│  State Machine: IDLE ──> LISTENING ──> TRANSCRIBING ──> THINKING ──>   │
│                 SPEAKING ──> IDLE (Safe Error / Interruption Gates)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               ┌────────────────────┴───────────────────┐
               ▼                                        ▼
   ┌───────────────────────┐                ┌───────────────────────┐
   │ Real Microphone Input │                │ Native Spoken Output  │
   │ - PnP Device Probe    │                │ - Windows SAPI Voice  │
   │ - Windows Privacy Chk │                │ - Rate/Volume Control │
   │ - Web Audio RMS Meter │                │ - Instant Interrupt   │
   │ - Graceful Disconnect │                │ - Audio WAV synthesis │
   └───────────┬───────────┘                └───────────▲───────────┘
               │                                        │
               ▼                                        │
   ┌───────────────────────┐                            │
   │  Speech-to-Text STT   │                            │
   │ - Zero-Install Native │                            │
   │ - Whisper Model Spec  │                            │
   │ - Transcript Edit Gate│                            │
   └───────────┬───────────┘                            │
               │                                        │
               ▼                                        │
┌───────────────────────────────────────────────────────┴────────────────┐
│               Existing Chat Engine & Coding Agent Core                │
│  - Local Ollama (qwen2.5-coder:3b) / Cloud Gemini (with egress notice)│
│  - Roman Urdu Prompt Conditioning with 8 GB RAM Context Awareness     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Pre-Implementation Safety Gates & Invariants

1. **Hardware Integrity:** If no microphone is physically connected, the system MUST display an informative status: *"No active microphone detected. Connect a microphone or headset, or type your message."* The app must NOT crash, pretend audio is recording, or show dummy audio waveforms.
2. **Push-to-Talk Safety:** Audio capture only occurs while the user explicitly holds or triggers Push-to-Talk. Zero background eavesdropping.
3. **Cloud Privacy:** Audio is never transmitted to Google Gemini or any remote server. Only transcribed text is sent, and only if Gemini is explicitly chosen as the active provider with cloud egress consent.
4. **Memory Constraint (8 GB RAM):** No multi-gigabyte models loaded concurrently. Lazy initialization with immediate resource cleanup on completion.
