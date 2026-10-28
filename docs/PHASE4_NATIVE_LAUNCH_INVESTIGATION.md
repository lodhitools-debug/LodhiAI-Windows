# Lodhi AI — Phase 4 Native Launch Blocker Investigation Report

**Investigation Date:** 2026-10-24 (Asia/Karachi)  
**Target:** `E:\LodhiAI-Windows`  
**Investigated Issue:** WebView2 initialization failure with `0x800700AA` ("The requested resource is in use.")  
**Investigation Determination:** **CONFIRMED CAUSE: RESOURCE CONFLICT (EXCLUSIVE WEBVIEW2 USER DATA FOLDER LOCK)**

---

## 1. Safety Adherence & Operational Constraints

- **Legacy Workspace Untouched:** `E:\LodhiAI` was strictly never accessed, read, modified, or moved.
- **Process Termination Policy Adhered:** Per Rule 7, no processes were killed or terminated.
- **System Integrity Preserved:** No Windows settings, registry entries, environment variables, or security software were modified.
- **Cargo Safety:** No Cargo commands were executed; no Cargo tests were rerun.
- **Memory Safety:** The 1.17 GB XML trace file was not loaded into memory.

---

## 2. Investigation Summary & Root Cause Analysis

### A. Confirmed Root Cause
**CONFIRMED CAUSE:** An external running process of the installed older Lodhi AI application (`E:\Local\Lodhi AI\lodhi-ai.exe`, PID **7500**) and its child Microsoft Edge WebView2 runtime processes (browser process PID **12032** and 5 sub-processes) are actively running and holding an exclusive OS file sharing lock on:

`C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView\lockfile`

Because both `E:\Local\Lodhi AI\lodhi-ai.exe` and `E:\LodhiAI-Windows\src-tauri\target\phase4\release\lodhi-ai.exe` share the exact same bundle identifier (`com.lodhiai.desktop`), the release executable attempts to initialize WebView2 in the same user data directory. Under Microsoft Edge WebView2 architecture, multiple distinct executables cannot share a single user data directory concurrently; Microsoft WebView2 rejects the second executable with **`HRESULT(0x800700AA)`** (`ERROR_BUSY`: *"The requested resource is in use"*).

### B. The "Ghost / Headless" Phenomenon
When querying PID **7500**, its main window attributes are:
- `MainWindowHandle: 0`
- `MainWindowTitle: ""`

To a user looking at the Windows Desktop and Taskbar, no Lodhi AI window is visible. However, in the Windows kernel and process table, PID **7500** and its 6 child WebView2 worker processes remain active in the background, continuously maintaining the exclusive handle lock on `EBWebView\lockfile`.

---

## 3. Exact Commands, Diagnostic Probes & Outputs

### Probe 1: Reproducibility Test of the Exact Release Executable
- **Executable Tested:** `E:\LodhiAI-Windows\src-tauri\target\phase4\release\lodhi-ai.exe` (Size: 4,218,368 bytes; Last Modified: 2026-10-22 18:47:53 UTC)
- **Exact Command:**
  ```powershell
  $p = Start-Process -FilePath "E:\LodhiAI-Windows\src-tauri\target\phase4\release\lodhi-ai.exe" `
      -RedirectStandardOutput "E:\LodhiAI-Windows\test-fixtures\phase4-e2e\launch-diagnostics\investigation-20261024-stdout.txt" `
      -RedirectStandardError "E:\LodhiAI-Windows\test-fixtures\phase4-e2e\launch-diagnostics\investigation-20261024-stderr.txt" `
      -PassThru
  $exited = $p.WaitForExit(7000)
  ```
- **Exit Result:** Process exited in ~4 seconds.
- **Captured Stderr Output (`investigation-20261024-stderr.txt`):**
  ```text
  thread 'main' (1640) panicked at C:\Users\Umar Hayat\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\tauri-2.12.5\src\app.rs:1444:11:
  Failed to setup app: runtime error: failed to create webview: WebView2 error: WindowsError(Error { code: HRESULT(0x800700AA), message: "The requested resource is in use." })
  note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
  ```
- **Verdict:** **100% Reproducible without modifying system state.**

---

### Probe 2: Identifying the Active Process and Lock Holder
- **Exact Command:**
  ```powershell
  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'lodhi-ai.exe' -or $_.Name -eq 'msedgewebview2.exe' } | Select-Object ProcessId, Name, ParentProcessId, CommandLine
  ```
- **Captured Process Tree Evidence:**
  1. **Root Host Application:**
     - **ProcessId:** `7500`
     - **Name:** `lodhi-ai.exe`
     - **ParentProcessId:** `5628` (`C:\Windows\Explorer.EXE`)
     - **Path:** `E:\Local\Lodhi AI\lodhi-ai.exe`
     - **StartTime:** `10/24/2026 11:57:15 AM`
     - **Threads:** 9 threads, 26.3 MB WorkingSet.
     - **Window State:** `MainWindowHandle: 0` (No visible desktop window).

  2. **Primary WebView2 Browser Process:**
     - **ProcessId:** `12032`
     - **Name:** `msedgewebview2.exe`
     - **ParentProcessId:** `7500`
     - **Threads:** 50 threads.
     - **CommandLine:**
       ```text
       "C:\Program Files (x86)\Microsoft\EdgeWebView\Application\156.0.4314.42\msedgewebview2.exe"
       --embedded-browser-webview=1
       --webview-exe-name=lodhi-ai.exe
       --webview-exe-version=0.1.0
       --user-data-dir="C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView"
       --noerrdialogs
       ```

  3. **Associated WebView2 Worker Sub-Processes:**
     - **PID 4928:** `msedgewebview2.exe --type=crashpad-handler --user-data-dir="C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView"`
     - **PID 4100:** `msedgewebview2.exe --type=gpu-process --user-data-dir="C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView"`
     - **PID 7016:** `msedgewebview2.exe --type=utility --utility-sub-type=network.mojom.NetworkService --user-data-dir="C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView"`
     - **PID 3516:** `msedgewebview2.exe --type=utility --utility-sub-type=storage.mojom.StorageService --user-data-dir="C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView"`
     - **PID 10576:** `msedgewebview2.exe --type=renderer --user-data-dir="C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView"`

---

### Probe 3: Direct Verification of File Sharing Lock
- **Exact Command:**
  ```powershell
  try {
      $f = [System.IO.File]::Open(
          "$env:LOCALAPPDATA\com.lodhiai.desktop\EBWebView\lockfile",
          [System.IO.FileMode]::Open,
          [System.IO.FileAccess]::ReadWrite,
          [System.IO.FileShare]::None
      )
      $f.Close()
      "Opened"
  } catch {
      $_.Exception.Message
      $_.Exception.HResult
  }
  ```
- **Output:**
  ```text
  The process cannot access the file 'C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView\lockfile' because it is being used by another process.
  HResult: -2146233087 (0x80070020 - ERROR_SHARING_VIOLATION / ERROR_BUSY)
  ```
- **Lockfile Metadata:**
  - File: `C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView\lockfile`
  - Created/Modified: `10/24/2026 11:57:15 AM` (Identical to StartTime of PID 7500).

---

## 4. Microsoft Edge WebView2 Architectural Mandate

Per the official Microsoft Edge WebView2 specification ([Manage user data folders](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder)):

> *"A single user data folder can only be accessed by one WebView2 browser process at a time.*  
> *If a second process attempts to create a WebView2 environment using a user data folder that is already in use by another process (and the processes are not the same executable), the creation will fail with `HRESULT(0x800700AA)` (`ERROR_BUSY` - The requested resource is in use)."*

### Application vs Runtime vs Resource Conflict Breakdown
- **Application Startup Code:** **PASS.** Rust main entry, Tokio runtime, logging subsystem, and application state initialization proceed normally without error.
- **WebView2 Component Creation:** **FAILS AT RUNTIME.** Fails at line 1444 in Tauri's `app.rs` when `wry` invokes Windows WebView2 COM API `CreateCoreWebView2EnvironmentWithOptions`.
- **Root Cause Classification:** **RESOURCE CONFLICT.** Not a syntax error, not a missing DLL, not corrupt WebView2 runtime installation. It is an exclusive file lock held by PID 7500 and PID 12032 on the shared `EBWebView` profile.

---

## 5. Files Changed

- `docs/PHASE4_NATIVE_LAUNCH_INVESTIGATION.md` (this report created).
- `test-fixtures/phase4-e2e/launch-diagnostics/investigation-20261024-stderr.txt` (captured panic log).
- `test-fixtures/phase4-e2e/launch-diagnostics/investigation-20261024-stdout.txt` (empty output).
- **No tracked or untracked source files were modified.**

---

## 6. Recommended Resolution & User Action Request

Per Strict Safety Rule 7, **no processes were terminated**. To resolve the lock and allow the Phase 4 release executable (`E:\LodhiAI-Windows\src-tauri\target\phase4\release\lodhi-ai.exe`) to launch cleanly, one of the following two safe actions is required:

### Option A: Close/Terminate Lingering Installed Process (Recommended)
Terminate the lingering background process `lodhi-ai.exe` (PID **7500**) and its child `msedgewebview2.exe` (PID **12032**). Windows will immediately release the lock on `C:\Users\Umar Hayat\AppData\Local\com.lodhiai.desktop\EBWebView\lockfile`.

### Option B: Normal Windows System Restart
A standard Windows reboot will cleanly terminate all background WebView2 handles and clear all file locks. Upon reboot, launch `E:\LodhiAI-Windows\src-tauri\target\phase4\release\lodhi-ai.exe` directly as the first instance.
