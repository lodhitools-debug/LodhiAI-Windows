# Lodhi AI Release Blocker Resolution — Baseline

Captured: 2026-10-23 (Asia/Karachi)
Project root verified: `E:\LodhiAI-Windows`

## Git baseline

- Branch: `master`
- Repository has no commits yet (`No commits yet on master`). Consequently there are no tracked modifications; existing project content is untracked, including `.gitignore`, source/config/docs, `dist/`, `src-tauri/`, and `test-fixtures/`.
- `git status --short --branch` was read using a per-command `-c safe.directory=E:/LodhiAI-Windows` override because the sandbox account differs from the checkout owner. No persistent Git config was changed.
- No backup candidates matching `*backup*`, `*.bak`, `*.old`, `*~`, or `*.orig` were found outside build output.
- No cleanup or source modifications occurred before this baseline was saved.

## Package/config baseline

- Frontend package version `0.1.0`; Tauri `productName` Lodhi AI, version `0.1.0`, identifier `com.lodhiai.desktop`; Rust crate version `0.1.0`.
- Existing scripts: `npm run type-check` (`tsc --noEmit`), `npm test` (`vitest run`), `npm run build` (`tsc && vite build`), and `npm run tauri` (`tauri`).
- Lockfiles present: `package-lock.json`, `src-tauri/Cargo.lock`.
- Tauri bundle is active with targets `all`. Rust package is edition 2021. No source `AGENTS.md` was found in the initial repository file inventory.
- Existing report `docs/PHASE4_5_SAFE_RELEASE_LAUNCH_VERIFICATION.md` records a previous release launch failure with WebView2 `0x800700AA`; it is prior evidence, not a new test in this run.

## Existing release artifacts (captured before checks)

| Kind | Exact path | Bytes | Last write (local) | SHA-256 |
|---|---|---:|---|---|
| Release EXE | `src-tauri/target/release/lodhi-ai.exe` | 5,727,744 | 2026-10-23T22:24:49.1947520+05:00 | `47BDBD3DEA2BA1C9E9B1D37B921B09D4BD4AB89B887BA03FD775A0B1BE2824ED` |
| MSI | `src-tauri/target/release/bundle/msi/Lodhi AI_0.1.0_x64_en-US.msi` | 3,305,472 | 2026-10-23T22:24:35.4100000+05:00 | `B27BE92B33428DD9A77631C3CB692B3B93C1E732B5E44775A25C2073AEEAD2D3` |
| NSIS | `src-tauri/target/release/bundle/nsis/Lodhi AI_0.1.0_x64-setup.exe` | 2,251,052 | 2026-10-23T22:24:49.1634989+05:00 | `F690CCE61AF28107E0F14BAFE598FEF364EE19E399DE47E85C2853D1C41DA1AC` |
| Older phase4 EXE | `src-tauri/target/phase4/release/lodhi-ai.exe` | 4,218,368 | 2026-10-22T18:47:53.5147512+05:00 | `AA1DD0883FA0F7E76E12958BDA2385EC9F889FE0C9365B9B19C48ECE49B6A97B` |
| Older phase4 NSIS | `src-tauri/target/phase4/release/bundle/nsis/Lodhi AI_0.1.0_x64-setup.exe` | 1,564,340 | 2026-10-22T18:47:53.4575364+05:00 | `9BAF5763037F7A95EA050E758C2EAD584B9482BD4DFE092D5CDA8584674A9B1A` |

No phase4 MSI exists at its expected bundle path. Current MSI metadata was read through Windows Installer COM in read-only database mode: ProductCode `{F89FC162-EB9F-4425-9003-5475971994BE}`, UpgradeCode `{6C50665C-80A7-59D7-B94A-A213A1B394A5}`, ProductVersion `0.1.0`, ALLUSERS `1`.

## Tool availability baseline

- Available: Node, npm, rustc, cargo, rustfmt, msiexec.
- Not found on PATH: MSVC `cl`/`link`, `makensis`, WiX `wix`/`light`/`candle`, `signtool`, 7-Zip CLI (`7z`/`7za`). This is a PATH discovery result; bundled/cached tooling is checked separately.
- No release artifact was modified during baseline capture.
