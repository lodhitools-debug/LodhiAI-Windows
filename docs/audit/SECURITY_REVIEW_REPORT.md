# LODHI AI — SYSTEM SECURITY & SANDBOX AUDIT REPORT
**Task ID:** SEC-003  
**Version:** 2.0  
**Audit Scope:** Windows Desktop Core, Tauri IPC, Android Keystore & WAN Relay  
**Date:** October 29, 2026  

---

## 1. Threat Model & Security Posture

Lodhi AI follows a strict **Least-Privilege, Zero-Egress, Human-in-the-Loop** security philosophy. Because the assistant operates on local workstations and modifies source code, security boundaries prevent unintended file alterations, command injection, and credential leakage.

---

## 2. Windows DPAPI Cryptographic Protection

All sensitive secrets—including Google Gemini API keys, Meta WhatsApp Cloud API access tokens, and Android pairing private keys—are protected using the Windows Data Protection API (`CryptProtectData` / `CryptUnprotectData`).

### Key Properties Verified:
- **Binding to User Security Identifier (SID):** Encrypted blobs stored in `%LOCALAPPDATA%\com.lodhiai.desktop\vault.json` cannot be decrypted by any other user or process on the machine.
- **Zero Plaintext In-Transit:** Keys are decrypted only in memory when preparing an outbound HTTPS request and immediately zeroed from long-term memory buffers.
- **Client Log & Storage Masking:** Vitest suite verifies raw API keys never appear in `localStorage`, React state exports, or diagnostics logs (masked as `AIzaSy...5fA`).

---

## 3. Path Traversal & Sandbox Isolation

To prevent autonomous coding agents or directory navigation tools from writing to sensitive system folders:

| Attack Vector | Defense Mechanism | Verified Invariant | Status |
|---|---|---|---|
| **Relative Directory Traversal (`../../`)** | `canonicalize()` resolution against project root | Rejects any path resolving outside `project_root` | **PASSED** |
| **System Folder Access (`C:\Windows`, `C:\Program Files`)** | Absolute path ban & strict root clamping | Blocks write/read outside active workspace | **PASSED** |
| **Symlink Escapes** | Canonical target checking | Rejects symbolic links pointing to external files | **PASSED** |
| **Protected File Access (`.env`, `id_rsa`)** | Default blacklist in `project.rs` | Prevents automated reading or sending to LLMs | **PASSED** |

---

## 4. Command Injection & Allowlisted Processes

Command execution within the developer agent is strictly gated:
- Shell interpolation (`cmd.exe /c`, `powershell -c`) is disabled; commands execute directly via `std::process::Command` without shell expansion.
- Disallowed binaries (`format.exe`, `del`, `rmdir`, `regedit`, `powershell Start-Process`) are rejected with actionable security notices.
- Permitted project checks (`npm test`, `tsc --noEmit`, `cargo check`) are allowlisted and require human confirmation.

---

## 5. Session Lifecycle & Token Management

- **Pairing PIN:** 6-digit cryptographically generated PIN with a 15-minute countdown timer. Maximum 3 failed attempts before lockout.
- **RS256 JWT Exchange:** Mobile companion authenticates using an asymmetric key pair. Tokens expire after 15 minutes and require refresh.
- **Revocation Handshake:** Revoking a device immediately purges its token from memory and disconnects active WebSocket streams.
