# Phase 4.3 — Chat latency diagnostics

## Summary and diagnosis

**Root cause classification: likely Ollama model load/reload for the reported long wait; the exact earlier desktop session remains unmeasured.** A live request through the existing Rust Tauri command handler took 47,642 ms. Ollama reported 41,087 ms for loading the model, 2,514 ms for prompt evaluation, and 3,519 ms for generation. A second live handler request took 1,961 ms total, with 151 ms model load. That comparison reproduces the >30-second delay and strongly points to model loading, rather than frontend rendering or Tauri IPC, as the main cause on the slow request. It does not establish what happened in the user's earlier session.

No model, model quality setting, Ollama keep-alive policy, or timeout was changed. Keeping a model resident can reduce reload time but consumes memory on an 8 GB PC, so that trade-off is left to the user.

## Measured real local requests

All real requests used the already installed `qwen2.5-coder:3b` through `127.0.0.1:11434`, with small prompts and no cloud service. Durations use Rust `Instant` or PowerShell `Stopwatch`; Ollama reports its duration metrics in nanoseconds, converted here to milliseconds. Returned response text is intentionally omitted from this diagnostics report.

### Direct Ollama HTTP

Two similar `stream:false` requests completed successfully. `num_predict` was limited to 12; both generated two tokens.

| Request | Client elapsed | Ollama total | Model load | Prompt evaluation | Generation |
|---|---:|---:|---:|---:|---:|
| First measured request | 1,704 ms | 1,514 ms | 51 ms | 1,206 ms | 199 ms |
| Second (warm) request | 434 ms | 435 ms | 20 ms | 205 ms | 205 ms |

The first direct request was not a true cold-load sample: Ollama reported only 51 ms model load. It should not be presented as a cold start.

### Rust Tauri chat handler

The opt-in live smoke test called the same `chat_with_ollama` Rust command handler used by the desktop UI. Each check returned a nonempty real model response.

| Run | Handler elapsed | HTTP exchange | Ollama total | Model load | Prompt evaluation | Generation |
|---|---:|---:|---:|---:|---:|---:|
| Slow/reload request | 47,642 ms | 47,509 ms | 47,274 ms | 41,087 ms | 2,514 ms | 3,519 ms |
| Warm follow-up | 1,961 ms | 1,960 ms | 1,951 ms | 151 ms | 213 ms | 1,578 ms |

The `HTTP exchange` measure includes the complete non-streaming request and response read. The Rust handler duration includes command work and dispatch to its blocking worker. The small difference between Ollama total and HTTP exchange is transport/response handling. This test does not exercise Tauri IPC or UI rendering.

## Instrumentation added

- Rust uses monotonic elapsed-time measurement for the Ollama HTTP exchange and returns Ollama-provided total, model-load, prompt-evaluation, and generation durations when available.
- The Tauri chat command returns total handler elapsed time.
- Frontend diagnostic entries now mark submit, loading-indicator visibility, Tauri invocation start/completion/failure, frontend result receipt, and response rendering. Timings are elapsed milliseconds, with no prompt or response content. Diagnostics stay in the existing bounded in-memory logger; no telemetry or network transmission was introduced.
- The request path is non-streaming (`stream:false`), so first-response-byte timing is unavailable and is not claimed as measured. Model API generation duration is available separately.
- A synchronous in-flight guard now prevents two submissions in the short interval before React applies the disabled state. Existing loading UI remains in use; tests verify the pending state and guard.
- A mocked frontend test verifies timing logs omit sentinel prompt and response strings. Mocked test results are not real inference.

## Native UI limitation

No native desktop UI timing was captured. The available Windows Computer Use window capture had previously failed twice for the still-running Lodhi AI window (`FrameArrived timed out: timed out waiting on channel`, then `window capture timed out: timed out waiting on channel`). The running user's app was not closed, killed, or replaced. The fresh release installer was built, but launching it over the existing WebView2 instance would not verify a clean UI session and risks repeating the documented WebView2 resource-in-use issue. A manual Chat UI measurement remains outstanding.

## Automated checks

| Check | Result |
|---|---|
| Frontend unit tests (`npm test -- --run`) | **23 passed, 0 failed** across 2 files. UI chat bridge calls are mocked in this suite. |
| TypeScript (`npm run type-check`) | **Passed**. |
| Vite production build (`npm run build`) | **Passed**. |
| Rust unit tests (`cargo test --target-dir target/phase4`) | **25 passed, 0 failed, 1 ignored**. Tests use local mock servers; symlink test limitations are documented in Phase 4.2. |
| Real Rust handler smoke, separately run twice | **Both passed** against installed `qwen2.5-coder:3b`; timings are listed above. |
| Rust check (`cargo check --target-dir target/phase4`) | **Passed**. |
| Rust formatting (`cargo fmt --manifest-path Cargo.toml --check`) | **Passed**. |
| Tauri NSIS release build (`CARGO_TARGET_DIR=E:\LodhiAI-Windows\src-tauri\target\phase4`, `npm run tauri -- build --bundles nsis`) | **Passed**. |

## Release installer

- Path: `src-tauri/target/phase4/release/bundle/nsis/Lodhi AI_0.1.0_x64-setup.exe`
- Size: **1,564,287 bytes**
- Modified UTC: **2026-10-22T13:23:49.1664642Z**
- SHA-256: `7389C207F13CC855CA62A017022543638FF556E5A3ACC0BCA980E7AF2993DFEA`

## Scope and remaining work

- Changed the Ollama response timing shape, Rust handler timing, frontend chat timing logs, the chat pending/duplicate-submit test, and this report.
- Tauri capabilities, CSP, loopback endpoint validation, timeout, request streaming mode, model selection, project path protections, and Ollama binding were not changed.
- No model was downloaded, no cloud API was used, and no Ollama or Lodhi process was terminated.
- `E:\LodhiAI` was not accessed. Initial Git status showed the project files as untracked; no cleanup/reset was performed.
- For a true native UI measurement, close the existing Lodhi AI window normally, then launch the new release build and send one short prompt. Record the UI elapsed time separately from these real HTTP/handler checks.
