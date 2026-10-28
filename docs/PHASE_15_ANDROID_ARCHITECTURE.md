# Lodhi AI — Phase 15 Android Companion App Architecture

**Document Version:** 1.0.0  
**Phase:** Phase 15 — Mobile Companion System Design  
**Project:** Lodhi AI Desktop for Windows  
**Audit Completion Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Reality Declaration: Repository Status

> [!IMPORTANT]
> **No Android application, Gradle project, Flutter codebase, or `.apk` binary currently exists in `E:\LodhiAI-Windows`.**
> The current codebase contains desktop-side foundations only:
> 1. `src-tauri/src/companion.rs` (PIN generation, device registry, and revocation in native Rust).
> 2. `src/components/companion/AndroidCompanionCockpit.tsx` (Desktop UI pairing dashboard).
> Phase 15 establishes the production-grade architectural specification, API contract, security boundaries, and milestone roadmap for building the Android client without destabilizing the Windows release.

---

## 2. Core System Architecture

The Android companion application is designed as a **read-heavy monitoring, notification, and task-approval interface**, intentionally avoiding unrestricted remote desktop control or automated coding execution.

```
┌─────────────────────────────────┐
│     Android Companion Client    │
│  - Kotlin / Jetpack Compose     │
│  - Android Keystore (mTLS)      │
│  - EncryptedSharedPreferences   │
│  - WorkManager Sync Engine      │
└───────────────┬─────────────────┘
                │
    ┌───────────┴────────────────────────┐
    │ Mode A: Local Network (LAN)        │ Mode B: Cloud Relay (Remote)
    ▼ TLS 1.3 / mTLS (Port 8443)         ▼ HTTPS / WSS
┌───────────────────────────────┐  ┌───────────────────────────────┐
│  Lodhi AI Windows Desktop     │  │  Lodhi AI Cloud API Gateway   │
│  - Tauri Companion HTTP Server│  │  - Push Notifications (FCM)   │
│  - PIN Pairing Engine         │  │  - Encrypted Sync Relay       │
│  - Human Approval Gate Bridge │  │  - Token Revocation Registry  │
└───────────────────────────────┘  └───────────────────────────────┘
```

---

## 3. Supported Mobile Use Cases

### 3.1 Secure Device Pairing
- User clicks "Generate Pairing PIN" on Lodhi AI Windows desktop.
- Desktop displays a 6-digit PIN with a 5-minute animated countdown.
- User enters the PIN in the Android app (or scans an optional QR code encoding LAN IP and PIN).
- Android client submits its device model, hardware fingerprint, and generates an Ed25519 public key.
- Desktop registers the device and returns a scoped session certificate.

### 3.2 Live Task & Build Monitoring
- View status of autonomous coding agent tasks running on the desktop (e.g. "Phase 3 test suite running").
- Real-time progress percentage, step logs, and duration timers.

### 3.3 Remote Human-in-the-Loop Approval Gate
- When the desktop AI agent reaches a sensitive action (e.g. applying a multi-file diff or submitting an automated form), a notification is dispatched to Android.
- Mobile displays the proposed diff summary.
- User can tap **"Approve Changes"** or **"Deny & Roll Back"**.
- Action is transmitted back to desktop via authenticated cryptographic signature.

### 3.4 Explicit Device Revocation
- Desktop user can revoke any paired phone with 1 click in `AndroidCompanionCockpit.tsx`.
- Revocation immediately invalidates the device's authorization token on desktop and cloud.

---

## 4. Strict Non-Goals & Safety Prohibitions

To protect user workstations, the Android companion app **WILL NOT**:
1. ❌ Expose an interactive remote terminal or arbitrary command shell (`cmd.exe` / `powershell.exe`).
2. ❌ Permit arbitrary remote file deletion outside the desktop agent's workspace boundary.
3. ❌ Allow unattended background execution without desktop user presence.
4. ❌ Transmit unencrypted API keys or model weights over cellular networks.
