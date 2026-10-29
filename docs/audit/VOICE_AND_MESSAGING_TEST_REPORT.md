# LODHI AI — VOICE & MESSAGING SUBSYSTEM TEST REPORT
**Task IDs:** VOICE-002, VOICE-003, MSG-002  
**Version:** 2.0  
**Date:** October 29, 2026  

---

## 1. Windows Native SAPI Speech Engine Verification

The Windows desktop client utilizes native Win32 SAPI (Speech API) through `src-tauri/src/voice.rs` for local offline text-to-speech with zero cloud egress.

### Test Matrix & Verification Evidence:
| Test Target | Component / Method | Observed Result | Verdict |
|---|---|---|---|
| **Voice Device Discovery** | `list_audio_input_devices` | Enumerates Windows core audio endpoints | **PASSED** |
| **Model Catalog Invariants** | `test_available_models_catalog_invariants` | Returns validated local & cloud voice options | **PASSED** |
| **Rate Boundary Enforcements** | `test_configure_voice_validates_rate_boundaries` | Clamps speech rate between -10 and +10 | **PASSED** |
| **Volume Boundary Enforcements** | `test_configure_voice_validates_volume_boundaries` | Clamps volume between 0 and 100% | **PASSED** |
| **Speech Text Sanitization** | `test_sanitize_text_redacts_gemini_api_key` | Strips API keys (`AIza...`) before speaking | **PASSED** |
| **Markdown Code Strip** | `test_sanitize_text_strips_code_blocks` | Omits raw code blocks (` ```...``` `) from audio | **PASSED** |
| **Audio Input Transcription** | `test_transcribe_audio_native_accepts_direct_prompt` | Validates WAV audio buffer parsing | **PASSED** |

---

## 2. Android Speech Subsystem: Google Speech vs Vosk

The Android companion architecture supports dual speech-to-text modes:

1. **Google SpeechRecognizer API (Online / Hybrid):**
   - Built into Google Play Services on Android.
   - Low latency, high accuracy for bilingual English and Roman Urdu prompts.
   - Requires `android.permission.RECORD_AUDIO`.

2. **Vosk Offline Engine (Local On-Device Roadmap):**
   - Fallback offline speech recognition engine using pre-packaged acoustic models.
   - Targets 80 MB lightweight multilingual model for offline industrial or low-connectivity use.

---

## 3. WhatsApp Messaging Automation & Meta Cloud API

Automated messaging workflows are governed by `src-tauri/src/whatsapp.rs` and `src/components/automation/WhatsAppWorkflowCockpit.tsx`:

### Security & Invariant Rules:
- **E.164 Strict Format:** Enforces `^\+[1-9]\d{1,14}$` phone number validation.
- **Human-in-the-Loop Confirmation:** An automated WhatsApp message cannot be dispatched without explicit affirmative modal consent.
- **Test Mode Simulation:** Test mode simulates dispatch and logs payload structure without making external network calls.
- **Credential Storage:** Meta Cloud API Permanent Access Token is stored using Windows DPAPI encryption in `%LOCALAPPDATA%\com.lodhiai.desktop\vault.json`.

### Test Suite Evidence:
- `test_phone_number_validation_and_masking`: **PASSED** (Validates numbers, masks middle digits).
- `test_unauthorized_dispatch_is_blocked`: **PASSED** (Blocks dispatch if user cancels modal).
- `test_test_mode_dispatch_simulates_without_network_call`: **PASSED** (Simulates delivery successfully).
- `src/test/WhatsAppWorkflow.test.tsx`: **4 / 4 Tests Passing**.

