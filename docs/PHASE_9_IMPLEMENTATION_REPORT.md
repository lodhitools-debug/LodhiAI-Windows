# Lodhi AI Windows — Phase 9 Implementation Report
## Native Offline Voice Conversation Engine

**Document Version:** 1.0.0  
**Date:** October 25, 2026  
**Auditor / Lead Engineer:** Antigravity AI Engineering Team  
**Project Workspace:** `E:\LodhiAI-Windows` (Strictly verified)  
**Legacy Project Boundary:** `E:\LodhiAI` (OFF-LIMITS · 100% Isolated & Untouched)  
**Host Target Profile:** Windows 10/11 x64, ~8 GB RAM, Local Ollama (`qwen2.5-coder:3b` on `127.0.0.1:11434`), Realtek/High Definition Audio Controller  
**Release Binary:** `E:\LodhiAI-Windows\src-tauri\target\release\lodhi-ai.exe` (5,823,488 bytes · Built Oct 25, 2026, 11:30:27 AM PKT)

---

## 1. Executive Summary & Accomplishments

Phase 9 successfully delivers a **genuine native offline voice conversation engine** for Lodhi AI Windows, breaking free from the brittle, cloud-dependent browser Web Speech API. The implementation provides hands-free speech input, native Windows speech synthesis (TTS), live hardware detection, and a safe 6-state conversation machine.

### Key Milestones Delivered:
1. **Natural Conversation State Machine:**
   - Formalized and implemented explicit states: `IDLE` → `LISTENING` → `TRANSCRIBING` → `THINKING` → `SPEAKING` → `IDLE`.
   - Safe error handling (`ERROR`), instantaneous interruption (`INTERRUPTED`), and cancellation support (`CANCELLED`).
   - Seamless integration with existing AI Chat: prompts can be spoken, reviewed, edited, and dispatched to either local Ollama or Google Gemini without duplicating chat interfaces.
2. **Real Microphone Input & Windows Hardware Probing:**
   - Native Rust commands query Windows PnP audio endpoints and the Windows Privacy Consent Store (`HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone`).
   - Graceful hardware detection: If no microphone is physically plugged into the PC, the system displays an informative notice (*"No active microphone detected. Connect a microphone or headset to use speech input, or continue typing in chat"*) rather than failing or faking recording.
   - Web Audio RMS level meter (0 to 100) displays real-time audio waveforms during push-to-talk.
   - Strict privacy mandate: Zero background listening. Microphones are active only during user-triggered push-to-talk.
3. **Native Offline Text-to-Speech (TTS):**
   - Implemented native Windows SAPI speech synthesis via Rust (`speak_text_native` and `stop_speech_native`).
   - Discovered and verified installed voices: `Microsoft David Desktop` (Male en-US) and `Microsoft Zira Desktop` (Female en-US).
   - Verified live WAV synthesis: generated 119 KB WAV in 1.2s.
   - Added speech controls: voice selector, rate adjustment (0.5x to 2.0x), volume adjustment (0% to 100%), replay, and instant speech interruption.
   - Integrated automatic secret and syntax sanitization: Redacts Gemini API keys (`AIza...`) and code blocks before speaking to avoid reading raw tokens aloud.
4. **Local Speech Recognition (STT) & Model Catalog:**
   - Evaluated Windows built-in `System.Speech.Recognition` (`MS-1033-80-DESK`), Whisper.cpp (`ggml-tiny.bin` 75 MB, `ggml-base.bin` 142 MB), and Piper TTS (`ur_PK-medium` 38 MB).
   - Built a verified model catalog enforcing an 8 GB RAM budget constraint (all models require ≤ 500 MB RAM).
   - Implemented transcript review and editing mode: Users can edit or reject transcripts before submitting to AI.
5. **Zero Cloud Audio Transmission:**
   - Audio is 100% processed locally on the Windows host.
   - If Google Gemini cloud provider is active, an explicit amber banner explains that only the transcribed text prompt is transmitted, never raw voice audio.
6. **Full Suite Test & Production Build:**
   - 120 automated frontend unit/integration tests passed across 17 test files.
   - 101 automated Rust backend unit tests passed.
   - 1 live local Ollama smoke test passed against `qwen2.5-coder:3b` in 43.36s.
   - Windows native release binary compiled and verified launch: Process ID 13040, `Responding: True`.

---

## 2. Source Files Modified & Backups Created

All modified source files were backed up with a timestamp prior to editing:

| Source File | Timestamped Backup File | Rationale & Changes Made |
| :--- | :--- | :--- |
| `src-tauri/src/voice.rs` | `src-tauri/src/voice.rs.bak-20261025-1100` | Implemented native device probing, Windows registry consent checking, SAPI synthesis (`speak_text_native`), interruption (`stop_speech_native`), STT transcription (`transcribe_audio_native`), model catalog, sensitive token sanitization, and 7 automated unit tests. |
| `src-tauri/src/lib.rs` | `src-tauri/src/lib.rs.bak-20261025-1102` | Registered 5 new Tauri IPC commands: `speak_text_native`, `stop_speech_native`, `transcribe_audio_native`, `list_audio_input_devices`, `get_voice_models`. |
| `src/types/index.ts` | `src/types/index.ts.bak-20261025-1113` | Added `AudioInputDevice`, `InstalledVoice`, `VoiceModelSpec`, `TranscriptionResult`, `SpeechSynthesisResult`, and updated `VoiceCapabilities` / `VoiceConfig`. |
| `src/services/tauri.ts` | `src/services/tauri.ts.bak-20261025-1113` | Exported native bridge wrappers with robust fallback defaults for `speakTextNative`, `stopSpeechNative`, `transcribeAudioNative`, `listAudioInputDevices`, `getVoiceModels`. |
| `src/services/voice.ts` | `src/services/voice.ts.bak-20261025-1114` | Refactored service into a full 6-state conversation machine (`IDLE`, `LISTENING`, `TRANSCRIBING`, `THINKING`, `SPEAKING`, `ERROR`). Added hardware probing, native SAPI invocation, live audio metering, and safe fallback. |
| `src/components/voice/VoiceInteractionModal.tsx` | `src/components/voice/VoiceInteractionModal.tsx.bak-20261025-1115` | Upgraded modal with state machine pill, audio activity visualizer, microphone hardware badges, transcript editing textarea, model selector, TTS replay, and cloud egress warning. |
| `src/components/chat/ChatInput.tsx` | `src/components/chat/ChatInput.tsx.bak-20261025-1116` | Forwarded `activeProviderName` and `isCloudProvider` to `VoiceInteractionModal` for cloud egress transparency. |
| `src/screens/GeneralSettingsScreen.tsx` | `src/screens/GeneralSettingsScreen.tsx.bak-20261025-1117` | Added dedicated **Native Voice Conversation Engine** configuration card with STT model selection, TTS voice selector, sliders, transcript review checkbox, and live "Test Speech" action. |
| `src/test/NativeVoiceEngine.test.tsx` | *(New Test Suite)* | Added 9 automated tests covering state machine transitions, cancellation, missing microphone handling, permission denial, transcript editing, cloud notice, privacy banner, and native bridge invocations. |

---

## 3. Natural Conversation State Machine

```
              ┌────────────────────────────────────────────────────────┐
              │                         IDLE                           │
              │         (Push-to-Talk or Click Mic to Start)           │
              └───────┬────────────────────────────────────────▲───────┘
                      │                                        │
           User clicks/holds Mic                      Interruption / End of Speech
                      │                                        │
                      ▼                                        │
              ┌───────────────┐                        ┌───────┴───────┐
              │   LISTENING   ├─────── Cancel ────────>│   SPEAKING    │
              │  (Audio Meter)│                        │ (Native SAPI) │
              └───────┬───────┘                        └───────▲───────┘
                      │                                        │
                 Speech ends                           AI Response Generated
                      │                                        │
                      ▼                                        │
              ┌───────────────┐                        ┌───────┴───────┐
              │ TRANSCRIBING  │                        │   THINKING    │
              │ (Review/Edit) ├────── Send Prompt ────>│(Ollama/Gemini)│
              └───────────────┘                        └───────────────┘
```

---

## 4. Speech Engine & Model Catalog Specifications (8 GB RAM Budget)

| Engine / Model | Download Size | RAM Required | License | Status | Language Capabilities & Roman Urdu Reality |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Windows SAPI Built-in (STT & TTS)** | **0 MB** | **< 30 MB** | Microsoft Windows System License | **Built-in (Zero Install)** | English acoustic models (`David`, `Zira`, `MS-1033-80-DESK`). Extremely fast (< 1s). Roman Urdu is pronounced phonetically using English phoneme rules. |
| **Whisper.cpp Tiny (Multilingual)** | **75 MB** | **~350 MB** | MIT License (OpenAI / Gerganov) | **Available for Download** | High-speed multilingual recognition. Natively transcribes Urdu and English. Ideal for mixed technical developer vocabulary on 8 GB RAM. |
| **Whisper.cpp Base (Balanced)** | **142 MB** | **~500 MB** | MIT License (OpenAI / Gerganov) | **Available for Download** | Higher accuracy recognition for complex code terms, function names, and multi-lingual conversations. |
| **Piper TTS Urdu (`ur_PK-medium`)** | **38 MB** | **~150 MB** | MIT License (Rhasspy Piper) | **Available for Download** | Neural text-to-speech voice trained specifically on native Pakistani Urdu phonology. |

---

## 5. Verification Commands & Actual Exit Codes

All verification commands were executed and passed cleanly:

| Stage | Command Executed | Exit Code | Verified Output |
| :--- | :--- | :---: | :--- |
| **TypeScript Type Check** | `npm run type-check` | **0** | Clean pass (`tsc --noEmit`), 0 errors. |
| **Frontend Unit & Integration** | `npm test -- --run` | **0** | **120 passed / 120 tests** across all 17 test suites (including new `NativeVoiceEngine.test.tsx`). |
| **Native Rust Test Suite** | `cargo test --manifest-path src-tauri\Cargo.toml` | **0** | **101 passed / 101 tests** (voice capabilities, rate/volume boundaries, sanitization, DPAPI, licensing, agent). |
| **Live Local Model Smoke Test** | `cargo test ... live_local_ollama_chat_command_smoke -- --ignored` | **0** | **1 passed / 1 test** in 43.36s against live local `qwen2.5-coder:3b` on `127.0.0.1:11434`. |
| **Vite Production Bundle** | `npm run build` | **0** | Built production bundle in `dist/` (466 kB JS, 6.2 kB CSS). |
| **Windows Native Release Build** | `cargo build --release --manifest-path src-tauri\Cargo.toml` | **0** | Production binary `lodhi-ai.exe` compiled in 4m 08s. |
| **Release Executable Launch Test** | `Start-Process ... lodhi-ai.exe` | **0** | Process ID 13040, `Responding: True`, `HasExited: False`. |

---

## 6. Release Executable Artifact

- **Binary Path:** `E:\LodhiAI-Windows\src-tauri\target\release\lodhi-ai.exe`
- **File Size:** `5,823,488 bytes` (~5.55 MB)
- **Compilation Timestamp:** October 25, 2026, 11:30:27 AM PKT
- **Profile:** Release (`opt-level = "z"`, LTO enabled, symbol stripping, `custom-protocol = ["tauri/custom-protocol"]`)
