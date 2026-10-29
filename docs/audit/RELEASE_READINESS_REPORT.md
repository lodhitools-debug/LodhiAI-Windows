# LODHI AI — RELEASE READINESS & DEPLOYMENT REPORT
**Version:** 2.0  
**Project:** Lodhi AI Commercial Native Desktop & Android Ecosystem  
**Repository:** `lodhitools-debug/LodhiAI-Windows`  
**Date:** October 29, 2026  

---

## 1. Executive Qualification Verdict

- **Overall Release Qualification:** **QUALIFIED FOR PRODUCTION CANDIDATE (RC-1)**
- **Automated Test Score:** 366 / 366 Tests Passing across Vitest, Cargo, and Node suites (100% Pass Rate).
- **Core Security Audit:** 0 Critical / 0 High Vulnerabilities detected in local sandbox boundaries.
- **Packaging Integrity:** Clean standalone binary and dual Windows installer packages compiled with release profiles.

---

## 2. Release Artifact Inventory & Checksums

All binaries have been built using standard release optimizations on Windows x86_64:

| Binary / Installer | Path | Size | SHA-256 Checksum | Status |
|---|---|---|---|---|
| **Standalone Native Executable** | `src-tauri/target/release/lodhi-ai.exe` | 5,831,680 bytes (5.83 MB) | `A8F47213DF80B41ADDDFB0BCDBAF76FEB29C59D3B838C7049B9D093DC60B928F` | **Verified Fresh** |
| **NSIS Universal Installer** | `src-tauri/target/release/bundle/nsis/Lodhi AI_0.1.0_x64-setup.exe` | 2,295,252 bytes (2.29 MB) | `E3AEE2C0EBA7D80541202F5EF97796C64EFDE091D7060AD409A5F982BAB80388` | **Verified Fresh** |
| **WiX Enterprise MSI Installer** | `src-tauri/target/release/bundle/msi/Lodhi AI_0.1.0_x64_en-US.msi` | 3,362,816 bytes (3.36 MB) | `FCA57E65BD2382B1F7E35F1DBD976DC3C41A279B99DB12BE046B5DA8E4BD7470` | **Verified Fresh** |
| **Frontend Production Bundle** | `dist/assets/index-gODh_Iez.js` | 472,349 bytes (472 kB) | `FC76654FFB4BEC77310569404E3416134B6945A63FCEDEAD146636B2E5697C49` | **Verified Fresh** |
| **Android Companion Debug APK** | `E:\LodhiAI\AndroidApp\app\build\outputs\apk\debug\app-debug.apk` | 9,699,833 bytes (9.69 MB) | `FB8C8142E15503AEE52B7A65C6C24C3A390BA51436443856EBC847B301C55EBD` | **Verified Fresh** |

---

## 3. Production Release Qualification Matrix

| Assessment Area | Requirement | Status | Evidence / Notes |
|---|---|---|---|
| **Local Offline Execution** | Must operate without cloud dependencies | **PASSED** | Local Ollama, SQLite-vec, and native DPAPI vault fully functional offline. |
| **Memory Constraint** | Must stay within 8 GB PC RAM budget | **PASSED** | Core runtime consumes ~65 MB; background agent overhead < 150 MB. |
| **Human-in-the-Loop Guard** | Dangerous tools require explicit human consent | **PASSED** | Code writes, system commands, and WhatsApp messages require affirmative modal review. |
| **Code Signing & SmartScreen** | Executable signed with Authenticode EV Certificate | **BLOCKED (External)** | Requires commercial EV certificate and hardware security token; self-signed for internal CI. |
| **Cloud WAN Relay Deployment** | Publicly accessible WebSocket relay container | **BLOCKED (External)** | `relay.ts` container ready; requires live Cloud Run / AWS ECS provisioning and custom domain. |
| **Physical Android Testing** | Physical handset interaction & touch validation | **BLOCKED (Hardware)** | Unit tests passing, layout verified in Compose previews; physical phone touch pending. |

---

## 4. PIN Pairing vs JWT Token Lifetime Reconciliation

| Token / Mechanism | Lifetime | Scope | Enforcement |
|---|---|---|---|
| **Desktop One-Time Pairing PIN** | **300 seconds (5 minutes)** | Ephemeral challenge for Android device pairing | Stored in `COMPANION_STATE.active_pairing`, cleared upon pairing or timeout |
| **Companion Session Bearer JWT** | **900 seconds (15 minutes)** | Authenticated REST & WebSocket relay calls | Signed via asymmetric RS256 token exchange |
| **Legacy Access PIN** | Persistent (12 chars) | Legacy Node backend `:3210` session authorization | Rate-limited lockout after 5 consecutive failures for 10 minutes |

---

## 5. Deployment Instructions

### Installing on Windows 10 / 11 Workstations:
1. Double-click `Lodhi AI_0.1.0_x64-setup.exe`.
2. Follow on-screen prompts; setup installs to `%LOCALAPPDATA%\Programs\Lodhi AI`.
3. Launch Lodhi AI from Start Menu or desktop shortcut.

### Sideloading Android Companion via USB ADB:
```powershell
# Verify connected USB device
adb devices

# Install APK onto device
adb install -r "E:\LodhiAI\AndroidApp\app\build\outputs\apk\debug\app-debug.apk"

# Launch Android companion application
adb shell am start -n com.lodhideveleper.lodhiai/com.lodhiai.companion.MainActivity
```
