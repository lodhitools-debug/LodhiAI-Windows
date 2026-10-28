# Lodhi AI — Phase 15 Android Companion Security Plan

**Document Version:** 1.0.0  
**Phase:** Phase 15 — Mobile Security Architecture  
**Project:** Lodhi AI Desktop for Windows  
**Audit Completion Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Core Security Principles

1. **Defense-in-Depth:** A PIN alone is strictly temporary (5 minutes); it is never treated as a permanent authentication credential.
2. **Hardware-Backed Cryptography:** Companion session tokens and private keys are generated and protected within the Android Hardware Keystore (TEE / StrongBox).
3. **Zero Arbitrary Remote Execution:** The companion app cannot execute arbitrary terminal commands, download unapproved binaries, or modify files outside the desktop agent's strictly constrained workspace sandbox.
4. **Biometric Gate:** Sensitive mobile approvals (e.g. approving file writes) require local biometric verification (Fingerprint / Face Unlock via Android `BiometricPrompt`).

---

## 2. Threat Analysis & Defensive Countermeasures

| Threat Vector | Risk Level | Defensive Countermeasure |
| :--- | :---: | :--- |
| **PIN Brute-Forcing** | High | Desktop rate limits pairing to **max 3 consecutive failures**, followed by a mandatory 5-minute lockout and session termination. |
| **Man-in-the-Middle on LAN** | High | TLS 1.3 encryption with certificate pinning. Android app pins the desktop's self-signed TLS certificate fingerprint exchanged during initial pairing. |
| **Stolen Phone / Lost Device** | Critical | 1-Click revocation from the desktop immediately blacklists the device ID. On next network contact, desktop commands phone to wipe local state. |
| **Malicious Push Injection** | Medium | Push notifications from Cloud Relay contain encrypted pointers only; actual task details and approval diffs are fetched directly from desktop or end-to-end encrypted relay. |
| **Credential Extraction from APK** | High | ProGuard / R8 code obfuscation, root detection (SafetyNet / Play Integrity API), and zero embedded API keys. |

---

## 3. Key Storage & Secret Management on Android

- **Private Keys:** Stored in `AndroidKeyStore` with `KeyProperties.PURPOSE_SIGN`. Keys are non-exportable and require user biometric authorization per approval signature.
- **Tokens & Preferences:** Stored using `EncryptedSharedPreferences` backed by a MasterKey in Android KeyStore.
- **RAM Protection:** Sensitive in-memory byte arrays (tokens, PINs) are explicitly overwritten with zeroes after cryptographic operations.
