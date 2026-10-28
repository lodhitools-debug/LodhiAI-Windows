# Lodhi AI — Phase 15 Android Companion App Roadmap

**Document Version:** 1.0.0  
**Phase:** Phase 15 — Mobile Engineering Roadmap & Milestones  
**Project:** Lodhi AI Desktop for Windows  
**Audit Completion Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Technical Stack Selection & Prerequisites

- **Language & UI:** Kotlin 2.0+ with Jetpack Compose & Material 3 design system.
- **Networking:** Ktor HTTP Client / Retrofit 2 with OkHttp 4 (TLS 1.3, Certificate Pinning).
- **Local Persistence:** Room Database with SQLCipher encryption, EncryptedSharedPreferences.
- **Biometrics:** `androidx.biometric:biometric:1.2.0-alpha05`.
- **Background Sync:** Android Jetpack WorkManager with periodic network-constrained constraints.
- **Min SDK:** Android 8.0 (API Level 26); **Target SDK:** Android 14+ (API Level 34+).

---

## 2. Phased Implementation Roadmap

```
Phase 15.1: Repository Setup & Skeleton
  ├── Initialize Android Gradle project in separate repository (e.g. `LodhiAI-Android`)
  ├── Setup Material 3 Theme matching Lodhi AI desktop dark glassmorphism
  └── Configure Android KeyStore crypto helper module

Phase 15.2: Pairing & Network Transport
  ├── Implement QR code scanner & 6-digit PIN input screen
  ├── Implement TLS 1.3 handshake with desktop companion server (Port 8443)
  └── Implement device registration and token storage in EncryptedSharedPreferences

Phase 15.3: Core Companion UI Screens
  ├── Dashboard Screen: Desktop connection status, RAM/GPU stats, active model
  ├── Agent Task Cockpit: Step-by-step progress, duration timer, error logs
  └── Approval Modal: Diff viewer with BiometricPrompt authorization button

Phase 15.4: Push Notifications & Cloud Relay
  ├── Integrate Firebase Cloud Messaging (FCM) for remote alerts
  ├── Implement End-to-End Encrypted sync relay for remote monitoring
  └── Add background sync via WorkManager

Phase 15.5: Security Hardening & APK Packaging
  ├── Enable ProGuard / R8 code shrinking and symbol obfuscation
  ├── Implement SafetyNet / Play Integrity device attestation
  ├── Sign release APK / AAB using production Google Play upload keystore
  └── Release Candidate v0.1.0 on Google Play Closed Beta
```

---

## 3. Milestone Schedule & Estimated Resource Allocation

| Milestone | Deliverables | Estimated Duration | Target State |
| :--- | :--- | :---: | :---: |
| **M1: Pairing & Core UI** | PIN pairing, LAN discovery, Dashboard screen | 2 weeks | Internal Alpha (Local LAN) |
| **M2: Approvals & Tasks** | Biometric approval gate, Agent diff inspector | 2 weeks | Internal Beta |
| **M3: Cloud Relay & FCM** | Push notifications, cellular remote monitoring | 3 weeks | Closed Beta (Play Console) |
| **M4: Production Hardening** | Security audits, Play Store submission | 1 week | General Availability (GA) |
| **Total Estimated Effort:** | **8 Weeks (1 Mobile Engineer + 1 Desktop QA)** | — | **Public Release** |
