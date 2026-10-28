# Phase 4.1 — Real Desktop E2E and Release Readiness

## Result

**READY WITH LIMITATIONS.** Automated checks, the current NSIS build, direct local Ollama inference, and the Rust chat command handler passed. Native Tauri UI workflows could not be observed because the Windows UI capture helper timed out. A direct second launch of the release executable exited because another Lodhi AI instance already held the shared WebView2 user-data resource. The existing app was left running; it was not terminated or reinstalled.

## Environment and model

- Windows x64; Tauri 2 project; Ollama 0.40.6.
- \`http://127.0.0.1:11434/api/tags\` responded successfully. It listed \`qwen2.5-coder:3b\` (3.1B, Q4_K_M, approximately 1.93 GB).
- Ollama was already installed and running. No model was downloaded, no server was started, and no cloud endpoint was used.
- A dedicated manual-test project was created under \`test-fixtures/phase4-e2e/\`: \`src/greeting.ts\` and an \`.env\` fixture containing only a non-secret marker. Its contents were not used for real inference or modified by the app.

## Inference results

| Path | Result |
|---|---|
| Direct Ollama HTTP | **Passed**, real response from \`qwen2.5-coder:3b\`: \`Local inference verified.\` The prompt requested that exact sentence; the client timeout was 120 seconds. |
| Rust chat command handler | **Passed**, ran the ignored \`live_local_ollama_chat_command_smoke\` test against the running local model. Output: \`LIVE_MODEL=qwen2.5-coder:3b; LIVE_RESPONSE=Hello! This is a local test.\` This invokes the Rust \`chat_with_ollama\` command handler function; it does not exercise Tauri IPC transport. |
| Actual desktop Chat UI | **Not verified.** No UI prompt was sent. |

The direct and Rust responses above are real Ollama inference, not mock results. Frontend tests use mocked bridge responses.

## Automated checks

Rust commands used the isolated target \`src-tauri/target/phase4\` after the default Cargo target returned an access-denied error.

| Check | Result |
|---|---|
| \`npm test -- --run\` | **22 passed, 0 failed** across 2 files. Workspace proposal UI tests use mocked bridge responses. |
| \`npm run type-check\` | **Passed**, no TypeScript errors. |
| \`npm run build\` | **Passed**, Vite production bundle generated. |
| \`cargo test --target-dir target/phase4\` | **25 passed, 0 failed, 1 ignored**. The ignored live Ollama smoke test was separately run and passed as recorded above. |
| \`cargo check --target-dir target/phase4\` | **Passed.** |
| \`cargo fmt --manifest-path Cargo.toml --check\` (from \`src-tauri\`) | Initially reported existing formatting differences in task-relevant \`src/lib.rs\` and \`src/project.rs\`; only those files were formatted. Final check **passed**. |
| \`npm run tauri -- build --bundles nsis\` | **Passed** after final source/test changes; produced the x64 NSIS installer below. |

## Native UI and release executable

- Computer Use discovered one running Lodhi AI window, but screenshot/state capture failed twice: \`FrameArrived timed out: timed out waiting on channel\`, then on the single recovery attempt \`window capture timed out: timed out waiting on channel\`. Per the tool recovery rules, no further UI actions were attempted.
- The release executable was started directly while an installed Lodhi AI process was already running. It exited within five seconds with code \`-1073740791\` (\`0xC0000409\`). Redirected diagnostics reported: \`failed to create webview ... HRESULT(0x800700AA), "The requested resource is in use."\` This is consistent with the other app instance holding the shared WebView2 user-data resource. The existing app was left untouched. This probe does **not** establish a clean first-instance launch.
- The native folder picker, tree/preview, excluded \`.env\` display, actual UI chat, proposal diff, Cancel/Discard file invariance, approved write/backup, stale-proposal rejection, and absence of automatic command execution were **not** exercised in the desktop UI.

## Installer

- Path: \`src-tauri/target/phase4/release/bundle/nsis/Lodhi AI_0.1.0_x64-setup.exe\`
- Size: **1,564,406 bytes** (about 1.49 MiB)
- Modified UTC: **2026-10-22T12:35:39.2591847Z**
- SHA-256: \`9612A5DD7360B493206678BAFA7CA9B226E66B8AD7E71C25C431350FC0CB6E88\`
- Tauri release build completed after the final Rust source timestamps and bounded-tree regression test. The working tree has no commit/revision identifier because project files were already untracked; this artifact is tied to the successful build of that current tree, not to a commit hash.
- No install, upgrade, uninstall, or application-data deletion was performed.

## Security regression review

- **Passed in Rust tests:** absolute/traversal/Windows alternate-stream path rejection; excluded secrets/dependencies/oversized files; credential redaction; stale-content rejection; replacement file-identity rejection; approval-gated writes and recovery backup; discard-without-write; unsafe backup location rejection; failed preflight leaves originals unchanged; bounded tree scan stops at 4,000 entries and reports truncation; project checks are allowlisted and unapproved execution is cancelled.
- **Symlink limitation:** both OS symlink tests were run with \`--nocapture\` and reported that this Windows account cannot create file or directory symlinks; their test functions returned without exercising actual OS symlinks. No security setting was changed to enable symlink creation.
- Tauri \`core:default\` capability and restrictive CSP were not changed. No frontend filesystem API, broader permissions, generated command execution, public Ollama binding, or cloud inference was introduced.

## Git and remaining manual checks

Initial and final \`git status --short\` showed the project tree as untracked (\`??\`); this was present before work. Nothing was cleaned or reset. \`E:\\LodhiAI\` was not accessed. New test data and launch diagnostics remain under \`test-fixtures/phase4-e2e/\`.

Manual checks still needed when desktop capture is available:

1. Close the existing Lodhi AI window normally, then launch the built release executable and verify a fresh window opens.
2. In Project Workspace, select \`test-fixtures/phase4-e2e/\`, expand \`src\`, preview \`greeting.ts\`, and verify \`.env\` is marked excluded without showing its contents.
3. Connect to the local model, request one harmless change to \`greeting.ts\`, inspect the proposal, then use **Cancel review** or **Discard proposal** and confirm the file and backup directory are unchanged.
4. Generate another harmless proposal, approve it, and verify only the fixture file changes and its original is backed up in \`.lodhi-ai-backups\`.
5. Generate another proposal, edit the fixture before approval, and verify stale approval is rejected.
6. Confirm no terminal command runs during any proposal workflow.
