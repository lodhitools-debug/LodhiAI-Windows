# Lodhi AI — Google Gemini Provider Integration Guide

## Overview

Lodhi AI incorporates Google Gemini as an optional, high-performance cloud AI provider alongside the default on-device **Ollama** engine (`qwen2.5-coder:3b`).

This integration strictly follows Lodhi AI's least-privilege security model:
1. **Zero Silent Cloud Egress:** All project workspaces, source trees, and local checks remain 100% on-device. Prompts are dispatched to Google Gemini only when Gemini is explicitly chosen as the active provider and user consent is granted.
2. **Zero Key Exposure:** API keys never touch browser `localStorage`, frontend JavaScript bundles, window globals, diagnostic logs, or error dialogs. Network requests originate solely within the native Rust backend.
3. **Local Ollama Fallback:** Ollama remains fully operational on `http://127.0.0.1:11434` as the private, offline fallback provider.

---

## 1. Secure Setup Instructions

Lodhi AI provides two secure methods to supply your Google Gemini API key:

### Method A: Environment Variable (Recommended for Developers)

Set the `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) environment variable in your Windows environment before launching Lodhi AI:

#### In Windows PowerShell:
```powershell
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'your-actual-api-key', 'User')
```

#### In Windows Command Prompt:
```cmd
setx GEMINI_API_KEY "your-actual-api-key"
```

Lodhi AI's native Rust backend automatically detects this environment variable at startup. No files are written to disk, and the key status will display as `Configured (environment variable)` with masked preview (e.g. `AIza****cdef`).

### Method B: Native Windows DPAPI Secret Vault (GUI)

If you prefer configuring through the desktop interface:
1. Open Lodhi AI.
2. Navigate to **Model Providers** in the left sidebar.
3. Select **Google Gemini** as your Active AI Provider.
4. Switch to the **Google Gemini Cloud Settings** tab.
5. In the **Gemini API Key Vault** card, enter your key into the masked password field and click **Save to Vault**.
6. The key is encrypted at rest using **Windows Data Protection API (DPAPI)** via native `CryptProtectData`. The encrypted payload is tied specifically to the current Windows user account security identifier (SID).
7. The ciphertext is saved to:
   `%APPDATA%\com.lodhiai.desktop\gemini_secret.json`
8. The input field is immediately cleared from React state memory, and the status updates to `Configured (Windows DPAPI Encrypted Vault)` with masked display (e.g. `AIza****cdef`).

#### Automatic Migration of Legacy Plaintext Secrets
If an earlier unencrypted key was stored in `%APPDATA%\com.lodhiai.desktop\gemini_secret.json`, Lodhi AI automatically detects it on startup, encrypts it using DPAPI `CryptProtectData`, re-writes the file with ciphertext, and deletes the plaintext entry.

#### Key Replacement & Revocation Notice
> [!IMPORTANT]
> If an API key was previously exposed or pasted into chat or test conversations, it **MUST be revoked immediately** in the [Google AI Studio Console](https://aistudio.google.com/app/apikey).
> 
> To replace a key in Lodhi AI:
> 1. In **Model Providers > Google Gemini Cloud Settings**, click **Clear Key from Vault**.
> 2. Paste your new API key and click **Save to Vault**.
> 3. Alternatively, update the `GEMINI_API_KEY` environment variable.
> 4. **No application rebuild or restart is required.** Key replacement takes effect immediately.

---

## 2. Architecture & Security Isolation

```
+----------------------------------------------------------------+
|                        Lodhi AI Desktop                        |
|                                                                |
|  +----------------------------------------------------------+  |
|  |                     WebView Frontend                     |  |
|  |  CSP: default-src 'self'; connect-src 'self'             |  |
|  |  * NO network requests to googleapis.com allowed         |  |
|  |  * NO API keys stored in localStorage or window state    |  |
|  |  * Displays only masked key (AIza****cdef)               |  |
|  +----------------------------------------------------------+  |
|                             |                                  |
|                  Tauri IPC (Binary Bridge)                     |
|                             v                                  |
|  +----------------------------------------------------------+  |
|  |                    Native Rust Core                      |  |
|  |  Key Resolution:                                         |  |
|  |    1. In-Memory Runtime Override                         |  |
|  |    2. GEMINI_API_KEY / GOOGLE_API_KEY Env Var            |  |
|  |    3. %APPDATA%\com.lodhiai.desktop\gemini_secret.json   |  |
|  |                                                          |  |
|  |  Security Filters:                                       |  |
|  |    * Aggressive key redaction regex                      |  |
|  |    * Header injection: x-goog-api-key                    |  |
|  |    * ureq pure-Rust TLS (Zero C-OpenSSL dependency)      |  |
|  +----------------------------------------------------------+  |
|               |                               |                |
|      Loopback HTTP                   Native HTTPS (Egress)     |
|               v                               v                |
|       Local Ollama Daemon             Google Gemini API        |
|    http://127.0.0.1:11434       generativelanguage.googleapis.com
+----------------------------------------------------------------+
```

---

## 3. Verified Model Catalog

Lodhi AI only targets verified, official Gemini model IDs as defined in Google AI Studio documentation:

| Model ID | Best For | Context Window | Default Status |
| :--- | :--- | :--- | :--- |
| **`gemini-2.0-flash`** | Next-generation speed, general coding & multimodal tasks | 1,000,000 tokens | **Recommended** |
| **`gemini-1.5-flash`** | High frequency, cost-effective reasoning, low latency | 1,000,000 tokens | Verified Alternative |
| **`gemini-1.5-pro`** | Highly complex multi-file reasoning & deep architectural analysis | 2,000,000 tokens | Verified Alternative |

Users can also click **Query API Models** in Model Providers to query Google's `/v1beta/models` endpoint for the latest available models on their account.

---

## 4. Usage Limits & Rate-Limit Handling

Google Gemini free-tier and pay-as-you-go tiers enforce standard rate limits:

| Tier | Requests Per Minute (RPM) | Requests Per Day (RPD) | Tokens Per Minute (TPM) |
| :--- | :--- | :--- | :--- |
| **Gemini 2.0 Flash (Free Tier)** | 15 RPM | 1,500 RPD | 1,000,000 TPM |
| **Gemini 1.5 Flash (Free Tier)** | 15 RPM | 1,500 RPD | 1,000,000 TPM |
| **Gemini 1.5 Pro (Free Tier)** | 2 RPM | 50 RPD | 32,000 TPM |

### Rate Limit (HTTP 429) & Error Handling:
When rate limits or quota caps are encountered:
1. Google returns HTTP 429 with `RESOURCE_EXHAUSTED`.
2. Lodhi AI's native core captures the error, aggressively strips any sensitive query parameters or key strings, and presents a clear, actionable banner:
   `Gemini rate limit exceeded (429): Resource has been exhausted (check quota). Please wait a moment before trying again or switch to Local Ollama.`
3. The conversation history is preserved in local session state so no user input is lost.

---

## 5. Billing Considerations

- **Ollama (`qwen2.5-coder:3b`):** 100% Free, zero tokens billed, unlimited local executions.
- **Google AI Studio Free Tier:** Available at no charge for testing and personal development (subject to rate limits and data sharing terms outlined in Google AI Studio agreements).
- **Pay-as-you-go Billing:** If you link a Google Cloud Billing account, charges accrue per token evaluated and generated. Using `gemini-2.0-flash` or `gemini-1.5-flash` offers substantially lower token costs compared to `gemini-1.5-pro`.

---

## 6. Privacy & External Egress Consent

Lodhi AI enforces an explicit user opt-in before sending prompts externally:
- In **Model Providers**, users must check:
  `I explicitly consent to transmitting prompt text to Google Gemini cloud servers when Gemini is selected.`
- If this consent is absent, the application halts prompt dispatch and presents an alert directing the user to grant consent.
- Project files, git history, and filesystem hierarchies are **NEVER** automatically attached or transmitted to Google Gemini.
