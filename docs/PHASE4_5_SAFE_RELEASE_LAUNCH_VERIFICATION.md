# Phase 4.5 — Safe release launch and chat verification

## Status: BLOCKED

The verified release executable still exits before creating a desktop window. Its captured error is WebView2 `0x800700AA` (“The requested resource is in use”). The native Chat UI and its two requested prompts therefore remain **NOT VERIFIED**. No user data, WebView2 process, installation, runtime setting, or security configuration was changed.

## Confirmed facts

- The project files remain untracked in Git; the existing user state was preserved. No cleanup, reset, or file deletion was performed.
- Exact release executable: `E:\LodhiAI-Windows\src-tauri\target\phase4\release\lodhi-ai.exe`.
- Release executable size: **4,218,368 bytes**; modified UTC: **2026-10-22T13:47:53.5147512Z**; SHA-256: `AA1DD0883FA0F7E76E12958BDA2385EC9F889FE0C9365B9B19C48ECE49B6A97B`.
- Exact NSIS installer: `E:\LodhiAI-Windows\src-tauri\target\phase4\release\bundle\nsis\Lodhi AI_0.1.0_x64-setup.exe`.
- Installer size: **1,564,340 bytes**; modified UTC: **2026-10-22T13:47:53.4575364Z**; SHA-256: `9BAF5763037F7A95EA050E758C2EAD584B9482BD4DFE092D5CDA8584674A9B1A`.
- This is the optimized release executable in `target\phase4\release`, not Cargo's `deps` executable, the NSIS installer, or the old installed app. The documented release build command is `CARGO_TARGET_DIR=E:\LodhiAI-Windows\src-tauri\target\phase4` with `npm run tauri -- build --bundles nsis`.
- Microsoft Edge WebView2 Runtime is installed at `C:\Program Files (x86)\Microsoft\EdgeWebView\Application\155.0.4283.62\msedgewebview2.exe`, file version **155.0.4283.62**.
- Ollama process was present at `E:\Ollama\App\ollama.exe`, version **0.40.6** per prior verification. A read-only request to `http://127.0.0.1:11434/api/tags` succeeded and listed `qwen2.5-coder:3b` (reported model size **1,929,912,626 bytes**). The Ollama server is reachable on loopback; it was not restarted or reconfigured.
- At the immediate pre-launch process snapshot, no Lodhi AI or WebView2 process appeared in the queried process inventories. Windows process queries do not expose all process metadata consistently in this environment.
- The exact release executable was launched directly once from its verified path with stdout/stderr redirected to new, phase-specific files under `test-fixtures/phase4-e2e/launch-diagnostics/`. It failed before a window appeared. Captured stderr: `Failed to setup app: runtime error: failed to create webview: WebView2 error: WindowsError(Error { code: HRESULT(0x800700AA), message: "The requested resource is in use." })`.
- The new launch diagnostics are `test-fixtures/phase4-e2e/launch-diagnostics/phase4-5-20261022-185315-stdout.txt` (empty) and `test-fixtures/phase4-e2e/launch-diagnostics/phase4-5-20261022-185315-stderr.txt` (panic above). No Lodhi process remained after the attempt.
- No matching Application Error, Windows Error Reporting, or SideBySide event was returned by the read-only query for the last 24 hours.

## Confirmed causes versus hypotheses

**Confirmed:** WebView2 runtime exists; release startup reaches Tauri's WebView creation and fails with `0x800700AA`; the error repeated in this attempt even though the process snapshot showed no Lodhi/WebView2 process. Phase 4.4 also recorded two failures with this same error, including one after the old Lodhi window was normally closed.

**Not confirmed:** Which process or Windows/WebView2 resource owns the lock, whether the resource is a stale OS/runtime state, and whether a Windows restart will resolve it. The runtime installation itself is not proven corrupt. No WebView2 workers were terminated and no profile, registry, or runtime settings were altered.

## Native desktop Chat verification

**NOT VERIFIED.** The release window did not open, so neither requested prompt was entered and there are no desktop-visible responses or UI timings:

1. `Reply with exactly: LODHI TEST ONE` — not sent.
2. `What is 2 + 3? Reply with the answer only.` — not sent.

The Ollama tags endpoint responding proves only local server/model availability, not inference. It is not a real chat test. No prompt was sent during this Phase 4.5 attempt.

## Backend timings (separate from UI)

Previously recorded in the Phase 4.3/4.4 reports, not captured in the desktop UI during this phase:

| Rust chat handler request | Handler total | Ollama total | Model load | Prompt evaluation | Generation |
|---|---:|---:|---:|---:|---:|
| Slow/reload request | 47,642 ms | 47,274 ms | 41,087 ms | 2,514 ms | 3,519 ms |
| Warm follow-up | 1,961 ms | 1,951 ms | 151 ms | 213 ms | 1,578 ms |

Those earlier handler smoke requests returned nonempty responses from the real local `qwen2.5-coder:3b`; they did not exercise Tauri IPC or the desktop UI. Ollama's reported `load_duration` confirmed model loading in the slow request. No keep-alive setting was changed in this phase.

## Tests and builds

No source code was changed, so test suites and builds were **not rerun** during Phase 4.5. The following are prior Phase 4.4 results, reported there and not newly verified here: frontend tests **23 passed**; Rust tests **25 passed, 1 ignored**; TypeScript check passed; Vite production build passed; `cargo check` passed; `cargo fmt --check` passed; Tauri NSIS release build passed. They do not resolve the runtime launch blocker.

## Remaining steps

1. After saving work, perform a normal Windows restart to release possible WebView2/OS resources; do not delete WebView2 profile data or kill shared WebView2 processes to work around the error.
2. Launch the exact release executable above directly (do not use the old app/helper). If it opens, enter the two prompts listed above manually and record visible responses and stopwatch timings separately.
3. If the same error persists after restart, inspect the WebView2/Tauri runtime environment with the system administrator or Windows event diagnostics before changing user data, registry, or runtime installation.

No Ollama model was downloaded, no cloud API was used, no security setting was weakened, and `E:\LodhiAI` was not accessed.
