# LODHI AI — ANDROID COMPANION DEVICE TEST REPORT
**Task ID:** AND-005  
**Version:** 2.0  
**Target Package:** `com.lodhideveleper.lodhiai` / `com.lodhiai.companion`  
**Date:** October 29, 2026  

---

## 1. Scope & Execution Conditions

This document details the test verification of the Lodhi AI Android Companion app. As mandated by strict audit rules:
- No test outcomes, device interactions, or physical touches are fabricated.
- Where physical mobile hardware is unavailable during headless execution, tests are validated through unit suites, manifest audits, dependency verifications, and CI build outputs.

---

## 2. APK Artifact Analysis

| Metric | Measured Value |
|---|---|
| **Package Name** | `com.lodhideveleper.lodhiai` (CI Companion) / `com.lodhiai.companion` (Legacy) |
| **Debug APK Location** | `E:\LodhiAI\AndroidApp\app\build\outputs\apk\debug\app-debug.apk` |
| **File Size** | 10,165,116 bytes (9.69 MB) |
| **Minimum SDK** | API Level 26 (Android 8.0 Oreo) |
| **Target SDK** | API Level 34 (Android 14) |
| **Architectures** | `arm64-v8a`, `armeabi-v7a`, `x86_64` |
| **Google Services Config** | `android/app/google-services.json` (Project ID: `lodhi-ai-assistant`) |

---

## 3. Screen & Functional Coverage

The Android Companion codebase implements 16 complete screen surfaces:

1. **Screen 1 — Onboarding & Secure Device Pairing:** 6-digit PIN input, validation regex `^\d{6}$`, challenge response to relay.
2. **Screen 2 — Login & Session Management:** Email/password cloud credentials, Firebase Auth token exchange.
3. **Screen 3 — Home Dashboard:** Real-time Windows workstation telemetry (RAM, CPU, active model, latency).
4. **Screen 4 — Real AI Text Chat:** Multi-turn chat with Roman Urdu and English streaming.
5. **Screen 5 — Push-to-Talk Voice Assistant:** Audio recording toggle, STT transcript display, TTS playback.
6. **Screen 6 — Windows Devices:** Multi-workstation management, status indicators, device revocation.
7. **Screen 7 — Projects & Workspaces:** Sandboxed workspace browser, path whitelist inspection.
8. **Screen 8 — Autonomous Coding Agent:** Remote prompt dispatch, task execution status.
9. **Screen 9 — Running Tasks & Approvals:** Sensitive action modal, code diff inspection (`+`/`-`), approve/deny gates.
10. **Screen 10 — Documents & Knowledge Base:** Document catalog, BM25 semantic query interface.
11. **Screen 11 — AI Model Settings:** Switch between local Ollama (`qwen2.5-coder:3b`) and Google Gemini Pro.
12. **Screen 12 — Notifications:** System push notifications, task completion badges, security alerts.
13. **Screen 13 — Usage & Plan Entitlements:** Token usage gauges, device limits, offline grace period counter.
14. **Screen 14 — Security & Privacy:** Biometric prompt toggle, Android Keystore hardware protection status.
15. **Screen 15 — Diagnostics & Troubleshooting:** Relay latency ping, IPC check, cache purge button.
16. **Screen 16 — Application Settings:** Dark mode toggle, Roman Urdu persona toggle, version info.

---

## 4. Test Verification Summary

- **Companion Unit Tests:**
  - `testPinValidationFormat`: **PASSED** (Validates length 6, numeric-only constraint, rejects alpha/short PINs).
  - `testTaskRiskAssessmentInvariant`: **PASSED** (Validates risk level assignment and target file containment).
  - `testUsageQuotaCalculation`: **PASSED** (Validates token consumption percentage calculation).
- **Physical Device Status:** **BLOCKED (Hardware)**  
  *Pending availability of an unlocked physical Android device connected via USB ADB for runtime touch testing and Bluetooth/Wi-Fi direct discovery verification.*
