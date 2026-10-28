# Lodhi AI — Phase 15 Android Companion Build Blockers

**Document Version:** 1.0.0  
**Phase:** Phase 15 — Mobile Companion Build Environment Audit  
**Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows\android`  

---

## 1. Verified Blockers Baseline

| Blocker ID | Domain | Root Cause Description | Impact | Severity | Resolution Path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BLK-ANDR-01** | Host Tooling | **Java JDK 17 is missing on Windows PC.** `java` / `javac` is not installed or available on host system PATH. `C:\Program Files\Java` is absent. | Local `./gradlew assembleDebug` cannot run on host machine. | HIGH | Option A (Cloud CI via GitHub Actions) OR Option B (Local JDK install with user permission). |
| **BLK-ANDR-02** | Host Tooling | **Android SDK platform tools are missing on host PC.** `ANDROID_HOME` / `ANDROID_SDK_ROOT` is undefined. Build tools API 34 are absent. | Local Android packaging tools (`aapt2`, `d8`, `zipalign`) are absent. | HIGH | Handled automatically in Ubuntu CI runner; requires Android Studio/SDK if local build is desired. |
| **BLK-ANDR-03** | Cloud CI Execution | **No GitHub Remote Origin is configured on repository.** `git remote -v` is empty. Branch `master` has not been pushed to GitHub. | `.github/workflows/android-build.yml` cannot trigger until commits are pushed to a remote repository. | MEDIUM | User configures remote origin (`git remote add origin <url>`) and authorizes push. |
| **BLK-ANDR-04** | Physical Testing | **No Physical Android Device or Android Emulator connected via ADB.** | Physical verification of push-to-talk microphone, hardware Keystore attestation, and BiometricPrompt must occur on physical hardware. | MEDIUM | Sideload debug APK to physical phone via USB/download link once CI compiles. |

---

## 2. Actionable Resolution Paths

### Option A: Cloud CI Build (Recommended — No Local Software Installation)
Per Non-Negotiable Rule #10 ("Do not install software on my primary Windows machine without checking first"), this option builds the APK without modifying your host Windows PC:

1. Create a private repository on GitHub (e.g. `https://github.com/YourUsername/lodhi-ai-desktop`).
2. Run in terminal:
   ```powershell
   git remote add origin https://github.com/YourUsername/lodhi-ai-desktop.git
   git add .
   git commit -m "feat: complete Phase 15 native Android companion and cloud relay"
   git push -u origin master
   ```
3. GitHub Actions will automatically launch the `Lodhi AI — Android Companion Build & CI` workflow.
4. When finished (~3-4 minutes), download the compiled `app-debug.apk` directly from the GitHub Actions Artifacts tab.

### Option B: Local Toolchain Installation on Windows PC
If you prefer to compile locally on your Windows development workstation:

1. Install Java JDK 17:
   ```powershell
   winget install Microsoft.OpenJDK.17
   ```
2. Install Android Command Line Tools:
   ```powershell
   winget install Google.AndroidStudio
   # OR download commandlinetools-win from developer.android.com
   ```
3. Set Environment Variables:
   ```powershell
   [System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Microsoft\jdk-17.0.x-hotspot', 'User')
   [System.Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
   ```
4. Run Gradle local build:
   ```powershell
   cd E:\LodhiAI-Windows\android
   .\gradlew.bat assembleDebug
   ```
