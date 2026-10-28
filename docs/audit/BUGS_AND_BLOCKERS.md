# LODHI AI — DEFECTS, BUGS & BLOCKERS AUDIT REGISTER
**Audit Date:** October 29, 2026  
**Auditor:** DeepMind Antigravity AI Engineering Team  
**Standard:** Rigorous reproducible evidence tracking without speculation.

---

## 1. Summary Defect Register

| Defect ID | Severity | Description | Module / Component | Probable Cause | Status | Resolution / Fix |
| :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| **BLK-001** | High | Automated subagent virtual desktop buffer cannot project onto monitor `WinSta0\Default` | Windows Runner Environment | Windows Session 0 / Virtual Desktop Isolation (`exebox-...`) | **WORKAROUND CONFIRMED** | Launch standalone executable or dev server directly in user's physical interactive session. |
| **BLK-002** | High | Local Host PC lacks JDK 17 / `java` command on system PATH | Local Windows Host | JDK 17 not installed in system PATH on host PC | **RESOLVED VIA CI** | Automated GitHub Actions CI workflow compiles APK on Ubuntu runner with Temurin JDK 17. |
| **BLK-003** | Medium | Cross-network remote connection requires public server | Remote Relay Server | WebSockets require public IP/domain to connect across disparate Wi-Fi/LTE | **ARCHITECTED** | Relay is containerized with Dockerfile and health endpoints, ready for Google Cloud Run. |
| **DEF-001** | Low | Small 3B models (`qwen2.5-coder:3b`) occasionally mix English grammar in Roman Urdu prompts | Local AI Adapter | 3-Billion parameter language model capacity limits | **RESOLVED** | Added system prompt directives (`WindowsApp/backend/ai-adapter.js`) and integrated Gemini 3.8 Flash online. |
| **DEF-002** | Low | WebView2 lock contention (`0x800700AA`) occurred when orphaned background processes held lockfile | Tauri Desktop Shell | Previous ungraceful termination of background `lodhi-ai.exe` or `cargo.exe` | **RESOLVED** | Explicit `"label": "main"` and `"visible": true` added to `tauri.conf.json`; clean shutdown verified. |
| **DEF-003** | Low | GitHub file size threshold exceeded if performance traces or heap dumps staged | Git Repository | 1.25 GB ETL XML and 827 MB `.hprof` heap dumps produced during profiling | **RESOLVED** | Removed transient dump files and added `*.hprof`, `*.etl`, and `PHASE3_CARGO_FILEIO_TRACE*` to `.gitignore`. |

---

## 2. In-Depth Technical Diagnostics of Critical Items

### BLK-001: Physical Monitor Presentation Boundary
- **Technical Mechanism:** When automated AI subagents execute Windows commands in sandbox mode, Windows allocates a virtual desktop object (e.g. `exebox-BRCX6XO6FYXTZMHCELUFO3RQUO`). The Windows kernel graphics driver only maps the user's physical monitor output to the interactive station `WinSta0\Default`.
- **Impact:** Automated runners can verify window handle allocation (Win32 HWND `132058`), process responsiveness, and custom protocol page loads, but cannot capture visual screenshots from the physical monitor without running in the user's interactive session.
- **Verification:** `lodhi-ai.exe` launches instantly with full window rendering when executed in user's PowerShell.

### BLK-002: Local Host Machine Java Availability
- **Technical Mechanism:** Running `./gradlew assembleDebug` or `gradle testDebugUnitTest` on Windows requires a local Java Development Kit (JDK 17) configured in `JAVA_HOME`.
- **System Audit:**
  - `java -version` returned: `The term 'java' is not recognized as the name of a cmdlet`.
  - In accordance with Section 10 of project safety instructions ("Do not install software on my primary Windows machine without checking first"), no unapproved software or SDK was installed on the user's host PC.
- **Remediation:** Cloud-native compilation was implemented via `.github/workflows/android-companion-ci.yml`. The Ubuntu-based cloud runner automatically provisions Eclipse Temurin JDK 17 and Gradle 8.7 to produce clean, reproducible APK artifacts.

### DEF-002: WebView2 Startup Lock Contention Fix
- **Symptom:** Application launch exited prematurely with error `HRESULT 0x800700AA` (`ERROR_BUSY`).
- **Diagnosis:** An earlier development process held an exclusive write lock on `%LOCALAPPDATA%\com.lodhiai.desktop\EBWebView\lockfile`. Furthermore, `src-tauri/tauri.conf.json` had omitted the explicit `"label": "main"` tag referenced by `src-tauri/capabilities/default.json`.
- **Resolution Applied:**
  1. Terminated orphaned background processes.
  2. Verified port 1420 is free and lockfile is deleted.
  3. Added explicit `"label": "main"` and `"visible": true` to `windows[0]` in `tauri.conf.json`.
  4. Tested standalone release executable; allocated valid Win32 HWND `MainWindowHandle: 132058`.

