# Lodhi AI — Phase 15 Android Companion Remaining Blockers

**Document Version:** 1.0.0  
**Phase:** Phase 15 — Blockers & Prerequisites  
**Project:** Lodhi AI Desktop for Windows  
**Audit Completion Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Readiness Verdict: ARCHITECTURE & RELAY VERIFIED (APK BUILD & LIVE RELAY BLOCKED)

The complete native Android companion architecture, 16 Jetpack Compose screens, Material 3 theme, navigation host, Retrofit definitions, data models, and the Cloud Relay backend engine are fully authored and verified via automated test suites.

However, physical APK binary creation and true cross-network validation are blocked by the environmental factors below.

---

## 2. Granular Blocker Registry

| Blocker ID | Domain | Severity | Blocker Description | Required Owner Action |
| :--- | :--- | :---: | :--- | :--- |
| **BLK-15-1** | **Android SDK Tooling** | **HIGH** | Host development machine does not have Java JDK (17+) or Android SDK (API 34) installed. `gradlew assembleDebug` cannot run locally. | Install Android Studio / JDK 17 on workstation or set up a GitHub Actions CI workflow to build the APK. |
| **BLK-15-2** | **Cloud Relay Deployment** | **HIGH** | `src/server/relay.ts` runs locally in development. It is not deployed to a live internet host with public HTTPS/WSS (e.g. `https://api.lodhiai.com/relay`). | Deploy backend to Railway / Fly.io / AWS and configure SSL. |
| **BLK-15-3** | **Push Notifications (FCM)** | **MEDIUM** | Firebase Cloud Messaging `google-services.json` credentials are not provisioned in the repository. In-app refresh/polling is active. | Create Firebase project for `com.lodhiai.companion` and add `google-services.json`. |
| **BLK-15-4** | **Cross-Network Device Acceptance** | **MEDIUM** | Live end-to-end testing between a physical Android phone on 4G and Windows PC requires BLK-15-1 (APK built) and BLK-15-2 (Cloud relay deployed). | Execute cross-network smoke test after APK installation. |

---

## 3. Path to Unblocking and Generating APK

1. **Option A (Local Workstation):**
   - User grants permission to install OpenJDK 17 and Android Command-line Tools (`sdkmanager "platforms;android-34" "build-tools;34.0.0"`).
   - Run `./gradlew assembleDebug` in `android/`.
2. **Option B (GitHub Actions CI/CD):**
   - Push repository to GitHub.
   - Use standard `actions/setup-java@v4` with `actions/upload-artifact@v4` to compile the debug APK in the cloud and download `app-debug.apk`.
