# Lodhi AI Windows Installer Staging Runbook — HOLD

**Purpose:** Instructions for validating the current Lodhi AI Windows MSI and NSIS installers in disposable Windows VMs.  
**Status: HOLD — no installation or uninstallation is authorized by this document.**  
**Project artifacts:** `E:\LodhiAI-Windows\src-tauri\target\release\bundle\`  
**Baseline evidence:** `docs/RELEASE_BLOCKER_BASELINE-20261023-231522.md` and `docs/RELEASE_BLOCKER_RESOLUTION-20261023.md`.

This document contains instructions only. Neither installer has been executed as part of its preparation. Do not run an installer on the development workstation. Do not use a VM containing personal, production, or irreplaceable data.

## 1. Evidence folder and roles

Before testing, create an evidence folder on a tester-controlled location and assign a run ID. Record tester, date/time with timezone, VM name/ID, Windows edition/build, architecture, VM snapshot ID, and the run ID in a plain-text run log. Keep screenshots and logs in that run folder. Redact usernames or other personal information in screenshots where practical; do not record API credentials.

Keep two separate clean VM snapshots:

- `NSIS-clean`: a fresh Windows snapshot dedicated to the NSIS EXE setup.
- `MSI-clean`: a separate fresh Windows snapshot dedicated to the WiX MSI.

Do not test MSI after NSIS in the same snapshot, or NSIS after MSI in the same snapshot. Revert the relevant VM to its named clean snapshot before each installer method. Record each snapshot ID and verify the prior application/install state is absent before beginning.

## 2. Artifact preflight

Use the exact files below from the verified project release directory. Before copying, capture each source file's full path, byte size, timestamp, and SHA-256. Compare against the stored baseline and stop on any mismatch; do not replace, rebuild, or overwrite an artifact as part of staging.

| Package | Exact source file | Expected bytes | Expected SHA-256 |
|---|---|---:|---|
| NSIS | `src-tauri\target\release\bundle\nsis\Lodhi AI_0.1.0_x64-setup.exe` | 2,251,052 | `F690CCE61AF28107E0F14BAFE598FEF364EE19E399DE47E85C2853D1C41DA1AC` |
| MSI | `src-tauri\target\release\bundle\msi\Lodhi AI_0.1.0_x64_en-US.msi` | 3,305,472 | `B27BE92B33428DD9A77631C3CB692B3B93C1E732B5E44775A25C2073AEEAD2D3` |
| Standalone EXE reference | `src-tauri\target\release\lodhi-ai.exe` | 5,727,744 | `47BDBD3DEA2BA1C9E9B1D37B921B09D4BD4AB89B887BA03FD775A0B1BE2824ED` |

Example preflight in PowerShell (run from the project root):

```powershell
$paths = @(
  'src-tauri\target\release\bundle\nsis\Lodhi AI_0.1.0_x64-setup.exe',
  'src-tauri\target\release\bundle\msi\Lodhi AI_0.1.0_x64_en-US.msi',
  'src-tauri\target\release\lodhi-ai.exe'
)
foreach ($path in $paths) {
  $item = Get-Item -LiteralPath $path
  $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
  [pscustomobject]@{ Path = (Resolve-Path $path).Path; Bytes = $item.Length; LastWriteTime = $item.LastWriteTime.ToString('o'); SHA256 = $hash }
}
```

Copy only the package under test to its VM using the approved transfer method. Recalculate SHA-256 on the VM copy and compare with the table before opening it. Record the actual copied path, hash, timestamp, and transfer method. A mismatch means **STOP / HOLD**.

For MSI, record ProductCode and UpgradeCode from the current package's metadata as static package facts. The baseline MSI reported ProductCode `{F89FC162-EB9F-4425-9003-5475971994BE}` and UpgradeCode `{6C50665C-80A7-59D7-B94A-A213A1B394A5}`; verify these against the staged package rather than assuming the values remain current. Do not treat static metadata as evidence that a product is installed.

## 3. Per-package installation and GUI smoke test

Run these steps independently in each clean VM snapshot and capture start/end times, screenshots, commands, and exit codes.

1. Confirm the VM is reverted to the correct clean snapshot and record the clean-state evidence.
2. Recheck the VM copy's SHA-256. Record Windows Installer/WebView2 pre-install state using read-only inventory. Do not change runtime or system settings as a workaround.
3. Install the one package under test. For NSIS, capture the installer UI, selected per-user/per-machine mode and destination, and all optional choices. For MSI, capture the selected install directory and UI choices. Record any UAC prompt and the installer process exit code.
4. For MSI verbose evidence, run from an elevated PowerShell prompt in the VM and record the command and returned process code:

   ```powershell
   $p = Start-Process -FilePath msiexec.exe -ArgumentList @('/i', 'C:\Staging\Lodhi AI_0.1.0_x64_en-US.msi', '/L*V', 'C:\Evidence\msi-install.log') -Wait -PassThru
   $p.ExitCode
   ```

   Replace the package and log paths with the recorded VM paths. Do not infer success from the dialog alone; inspect the exit code and log.

5. Launch Lodhi AI from the installed shortcut or the confirmed installed executable. Record whether a window appears, time to first usable window, screenshots of the main shell and basic navigation, and any visible error. Do not enter live cloud credentials or send external API requests. If startup fails, capture application stdout/stderr or event evidence available in the VM and stop further acceptance claims.
6. Confirm the installed version and installed path. Capture installed-state evidence separately from the static package metadata. For MSI, use Windows Installer inventory/COM and the uninstall registry entry to corroborate the ProductCode. For NSIS, record its uninstall registry metadata and the uninstaller command/path. Do not hardcode a ProductCode from an older package.

## 4. User-data canary and uninstallation

The app's Windows data directory is normally `%APPDATA%\com.lodhiai.desktop`. The NSIS uninstaller has an explicit data deletion checkbox; its generated script removes the app's AppData and LocalAppData directories only when that option is selected and the uninstall is not an update. The MSI package has no configured AppData removal action in the inspected WiX source. Verify runtime behavior rather than treating these static observations as proof.

After installation and GUI smoke testing, close the application normally. In the VM, record whether `%APPDATA%\com.lodhiai.desktop` existed before the canary. Create one harmless canary file inside it with a unique run ID and non-sensitive fixed text; capture its full path, byte count, SHA-256, and timestamp. Do not copy any real user data into the VM.

Uninstall the product using its normal GUI uninstaller. For the NSIS default-preservation run, leave the optional “delete app data” choice unchecked and capture the choice in a screenshot. For MSI, use Apps & Features or the Windows Installer uninstall entry and capture the operation. If collecting MSI verbose uninstall evidence, use the actual ProductCode verified from the current MSI and the VM installed state:

```powershell
$p = Start-Process -FilePath msiexec.exe -ArgumentList @('/x', '{VERIFIED-PRODUCT-CODE}', '/L*V', 'C:\Evidence\msi-uninstall.log') -Wait -PassThru
$p.ExitCode
```

Record the uninstaller exit code, completion time, and logs. Recompute the canary's SHA-256 and verify the file contents remain unchanged. This proves only that this specific canary survived this specific uninstall; it does not prove every application datum is preserved.

If the NSIS checked-delete behavior needs validation, use a separate disposable snapshot with a fresh canary. Do not perform that destructive-data scenario in the default-preservation run. Record the checkbox selection and resulting path state explicitly.

## 5. Residual files and registry verification

After uninstall and a VM restart (if the installer requests one), perform read-only checks and capture output for:

- The exact install directory selected during installation, including whether the directory or product files remain.
- Start Menu and Desktop shortcuts created by that install.
- App-data canary path and hash, plus whether `%APPDATA%\com.lodhiai.desktop` or `%LOCALAPPDATA%\com.lodhiai.desktop` remains.
- The Lodhi AI uninstall entry under the relevant per-user or per-machine `Software\Microsoft\Windows\CurrentVersion\Uninstall` hive.
- The generated app registration path `Software\lodhiai\Lodhi AI` in the relevant registry hive.
- For MSI, Windows Installer installed-product inventory for the verified ProductCode, and any product-specific registration remaining after uninstall.
- Any remaining Lodhi AI files under the installation directory and any unexpected residue created by the package.

Export or record only the relevant registry keys and values. Do not delete unrelated registry entries or files during evidence collection. Distinguish expected user data from installer residue. A residual item is not automatically a failure; record its path, purpose if known, and whether the package configuration says it should remain.

## 6. Evidence checklist and result classification

For **each** installer run, preserve:

- Run ID, tester, local time and timezone, VM name/ID, Windows edition/build/architecture, clean snapshot ID, and package name.
- Package source and VM paths, sizes, timestamps, and matching preflight/copy SHA-256 values.
- Install and uninstall start/end times, exact commands or UI choices, process/installer exit codes, verbose logs, and screenshots.
- GUI launch outcome, first usable window timing, navigation evidence, errors, and relevant event diagnostics.
- Installed-state evidence (MSI ProductCode/UpgradeCode and Windows Installer inventory, or NSIS uninstall metadata).
- Canary before/after path, bytes, hashes, and contents; residual file/registry inventory; and any deviations.

Mark each step PASS, FAIL, BLOCKED, or NOT RUN with a short evidence reference. A missing log, unknown exit code, hash mismatch, VM contamination, or unverified snapshot is BLOCKED. Do not claim VM success based on a report, screenshot, or canary alone.

## 7. Release gate — explicit HOLD

**HOLD remains in force until real, reviewable logs and evidence from both separate clean VM snapshots are available and reviewed.** This runbook is not a test result. Do not mark the product production-ready or “Release Candidate — VM Tests Passed” until the required NSIS and MSI install, GUI smoke, uninstall, residual-state, and user-data checks have actual evidence. Preserve all evidence and release artifacts for the final decision.
