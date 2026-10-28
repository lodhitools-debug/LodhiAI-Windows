# Lodhi AI — Release Blocker Resolution & Verification

**Captured:** 2026-10-23 (Asia/Karachi)  
**Project:** `E:\LodhiAI-Windows`  
**Final status: BLOCKED**

## Decision

The current release artifacts are intact against the supplied hashes, and the frontend checks plus Rust compilation pass. The full local verification gate did not pass: `cargo fmt --check` reports formatting differences throughout existing Rust modules, and Rust tests repeatedly failed while writing Cargo metadata files (`os error 32`, file in use), so no fresh Rust test result is available. MSVC Build Tools are not discoverable, so no fresh Tauri Windows package build was run. No installer was executed, and no disposable-VM evidence was available. Do not mark production-ready.

No in-scope functional source/configuration defect was verified, so no source fix was made. Broad formatting changes would touch existing uncommitted source across modules and are not justified as a release-blocker fix without the user choosing that cleanup. Current installers can be staged in a disposable VM, but this report does not certify them as ready for distribution.

## Baseline and repository state

Baseline captured before checks in [RELEASE_BLOCKER_BASELINE-20261023-231522.md](RELEASE_BLOCKER_BASELINE-20261023-231522.md).

- Root was verified as `E:\LodhiAI-Windows`; branch `master`; Git reports **No commits yet**. The project files (including source, reports, and build outputs) were already untracked. No existing backups matching `*backup*`, `*.bak`, `*.old`, `*~`, or `*.orig` were found outside build output.
- Git required a per-command `-c safe.directory=E:/LodhiAI-Windows` override due sandbox/checkout ownership mismatch. No Git configuration was changed.
- No existing source/config/doc file was edited. Existing `dist/` and all three release artifacts retained their original timestamps and hashes.
- New outputs created by this run: this report; `docs/RELEASE_BLOCKER_BASELINE-20261023-231522.md`; frontend build under `dist-release-verification-20261023/` (7 files: `index.html`, `logo.svg`, and 5 assets); and Cargo scratch outputs under `src-tauri/target/release-blocker-verification-20261023/` and `src-tauri/target/release-blocker-tests-20261023/`. These are untracked, preserved outputs. Git final status remains an unborn `master` with the baseline untracked project tree plus these additions; there are no tracked modifications.

## Verified blockers and fixes

### Verified findings

1. `cargo fmt --check` fails: 157 rustfmt diff sections are reported across existing Rust sources. This is a formatting gate failure; it does not by itself establish a runtime defect. Files were not mass-formatted.
2. Rust test builds fail before tests execute with `The process cannot access the file because it is being used by another process. (os error 32)` while writing `.rmeta` output. It happened in both isolated target directories and in a `--jobs 1` retry. The failing crate/path changed (`ureq` in the first target, `windows-sys` in the second), consistent with an environment/file-lock issue rather than a test assertion. No successful fresh Rust test run is claimed.
3. MSVC `cl.exe`/`link.exe` and a Visual Studio installation with the required C++ workload were not discoverable. This prevents a fresh Windows Tauri build from being verified here.
4. No installer staging runbook exists in current `docs/`; the available Phase 4.5 report is a failed desktop-launch verification, not an install/uninstall runbook.
5. No 7-Zip CLI/archive extractor was found. The EXE inside the NSIS installer was not extracted or byte-compared to the standalone EXE.

### Confirmed configuration and data handling

- Application versions agree at `0.1.0` in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`; Tauri identifier is `com.lodhiai.desktop`.
- Rust storage resolves to `%APPDATA%\com.lodhiai.desktop` when `APPDATA` is available (and falls back to `%TEMP%\com.lodhiai.desktop` if it is absent). Gemini’s vault uses `%APPDATA%\com.lodhiai.desktop\gemini_secret.json`.
- Generated NSIS source specifies `INSTALLMODE "currentUser"` and has a custom “delete app data” choice. Its recursive removal of `%APPDATA%\com.lodhiai.desktop` and `%LOCALAPPDATA%\com.lodhiai.desktop` occurs only when that choice is selected and the uninstall is not an update. Therefore NSIS can remove data by explicit user selection; default preservation still needs VM confirmation.
- Generated WiX source specifies `InstallScope="perMachine"`; actual MSI metadata also has `ALLUSERS=1`. The MSI removes its install folder/shortcuts and contains no app-data removal action. Runtime preservation was not tested.
- Read-only Windows Installer COM database query returned ProductCode `{F89FC162-EB9F-4425-9003-5475971994BE}`, UpgradeCode `{6C50665C-80A7-59D7-B94A-A213A1B394A5}`, ProductVersion `0.1.0`, ProductName `Lodhi AI`, and `ALLUSERS=1`. These are from the current MSI, not an older hardcoded package code. No installed-state or registry discovery claim is made.
- A secret-pattern scan of project text/config sources and fixtures emitted no matches for common Google API, OpenAI-style, GitHub, or AWS key shapes. This is not a general secret scanner; no values were printed.
- Staging runbook review items (unsafe extraction cleanup, command-line parsing, residual checks, post-uninstall verification, COM/registry runtime discovery) are **NOT REVIEWABLE** because the runbook is absent. No replacement runbook was created.

## Commands and results

| Command | Exit | Result |
|---|---:|---|
| `git -c safe.directory=E:/LodhiAI-Windows status --short --branch` | 0 | Baseline and final status read; unborn `master`, untracked project tree. |
| `npm run type-check` | 0 | `tsc --noEmit` passed. |
| `npm test` | 0 | 12 files passed, **75 tests passed**. Vitest emitted existing React `act(...)` warnings and diagnostic test logs. |
| `npm run build -- --outDir dist-release-verification-20261023` | 0 | Production build passed; 1,629 modules transformed; built to a new directory, preserving existing `dist/`. |
| `cargo fmt --manifest-path src-tauri\Cargo.toml -- --check` | 1 | 157 rustfmt diff sections; no formatting edits made. |
| `cargo check --manifest-path src-tauri\Cargo.toml --locked --offline --target-dir src-tauri\target\release-blocker-verification-20261023` | 0 | Finished `dev` profile successfully. |
| `cargo test --manifest-path src-tauri\Cargo.toml --locked --offline --target-dir src-tauri\target\release-blocker-verification-20261023` | 1 | Failed writing `libureq-7400680e8f4550e2.rmeta` due OS error 32. No tests ran. |
| `cargo test --manifest-path src-tauri\Cargo.toml --locked --offline --jobs 1 --target-dir src-tauri\target\release-blocker-verification-20261023` | 1 | Same `.rmeta` file-in-use failure. |
| `cargo test --manifest-path src-tauri\Cargo.toml --locked --offline --jobs 1 --target-dir src-tauri\target\release-blocker-tests-20261023` | 1 | Fresh-target retry failed writing `libwindows_sys-5b8d1abb8fb27a38.rmeta`, OS error 32. No tests ran. |
| Windows Installer COM: open current MSI database read-only, query `Property` table | 0 | Current ProductCode/UpgradeCode/version/scope captured above. No install action. |
| Secret-pattern scan (PowerShell, project files excluding dependency/build trees) | 0 | No matches for the listed common key shapes. |
| `npm run tauri -- build ...` | NOT RUN | Existing release artifacts were preserved; a new package build is not verifiable without discoverable MSVC Build Tools. |
| NSIS/MSI execution, install/uninstall, GUI smoke, VM test | NOT RUN | Prohibited on development host; no disposable VM evidence provided. |

Frontend test result: **PASS**. Frontend type-check: **PASS**. Production frontend build: **PASS**. Rust compiler check: **PASS**. Rust format check: **FAIL**. Rust tests: **BLOCKED by OS file locking**. Tauri release build: **NOT RUN**.

## Release artifact inventory

The supplied expected hashes match the exact current files. A repeated final hash check after all local commands remained identical. These are existing artifacts, not regenerated files:

| Artifact | Exact path | Bytes | Last write (Asia/Karachi) | SHA-256 | Match supplied baseline |
|---|---|---:|---|---|---|
| Standalone EXE | `E:\LodhiAI-Windows\src-tauri\target\release\lodhi-ai.exe` | 5,727,744 | 2026-10-23 22:24:49.1947520 +05:00 | `47BDBD3DEA2BA1C9E9B1D37B921B09D4BD4AB89B887BA03FD775A0B1BE2824ED` | Yes |
| WiX MSI | `E:\LodhiAI-Windows\src-tauri\target\release\bundle\msi\Lodhi AI_0.1.0_x64_en-US.msi` | 3,305,472 | 2026-10-23 22:24:35.4100000 +05:00 | `B27BE92B33428DD9A77631C3CB692B3B93C1E732B5E44775A25C2073AEEAD2D3` | Yes |
| NSIS setup | `E:\LodhiAI-Windows\src-tauri\target\release\bundle\nsis\Lodhi AI_0.1.0_x64-setup.exe` | 2,251,052 | 2026-10-23 22:24:49.1634989 +05:00 | `F690CCE61AF28107E0F14BAFE598FEF364EE19E399DE47E85C2853D1C41DA1AC` | Yes |

The older `src-tauri/target/phase4/release` EXE and NSIS installer have different hashes and sizes and are dated 2026-10-22; they are separate older artifacts, not evidence of corruption. No phase4 MSI exists at its expected path. The standalone EXE was not compared with the NSIS-embedded EXE.

## Missing dependencies and vendor instructions

- **Present:** Node/npm; Rust/Cargo/rustfmt (Rust 1.99.1, Cargo 1.99.1); cached Tauri NSIS and WiX packager binaries. `makensis.exe`, WiX `candle.exe` and `light.exe` exist under `%LOCALAPPDATA%\tauri` even though they are not on `PATH`.
- **Missing/not discoverable:** MSVC C/C++ x64/x86 tools (`cl.exe`, `link.exe`) and a Visual Studio Build Tools installation containing them. Windows SDK presence was not established.
- Official Build Tools page: [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/). Select **Desktop development with C++** workload (`Microsoft.VisualStudio.Workload.VCTools`), **MSVC v143 x64/x86 build tools** (`Microsoft.VisualStudio.Component.VC.Tools.x86.x64`), and a **Windows 10/11 SDK** (Windows 11 SDK component `Microsoft.VisualStudio.Component.Windows11SDK.26100` is listed by Microsoft as a recommended option). Confirm current component names in [Microsoft’s workload/component list](https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools). Tauri’s Windows prerequisite page is [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/).
- Rust is already installed; no Rust install is needed for this verification. No tools were installed, downloaded, or added to PATH.

## Remaining VM checks and release blockers

- Use separate clean disposable Windows VM snapshots for MSI and NSIS. Exercise install, first launch, upgrade/uninstall as applicable, and residual-file/registry checks. Do not run either installer on this development workstation.
- Confirm default NSIS user scope/path and app-data checkbox behavior; verify `%APPDATA%\com.lodhiai.desktop` canary preservation under default uninstall and document the limitation that one canary proves only its own survival.
- Capture MSI runtime installed state separately from static MSI metadata. Validate ProductCode discovery from the installed VM’s Windows Installer state and registry inventory using a corrected staging procedure.
- Investigate the pre-existing Phase 4.5 WebView2 launch error (`0x800700AA`) under the disposable VM. The current launch report records it as previously reproducible on the development workstation; it is not retested here.
- Compare the executable extracted from NSIS with the standalone EXE after obtaining an already-approved/available extraction utility, or leave that comparison explicitly blocked.
- Reconcile broad Rust formatting debt and obtain a successful fresh Rust test run after the OS file-lock condition is resolved. Rebuild Tauri packages only after the supported native toolchain is available, preserving the current artifacts.

**Final classification: BLOCKED.** The supplied artifact hashes are verified and the frontend plus Rust compilation checks pass, but Rust formatting and fresh Rust tests remain unresolved; no VM testing evidence exists. No successful installation, uninstallation, or production-readiness claim is made.
