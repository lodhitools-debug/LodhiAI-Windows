# Phase 4.4 — Native chat verification and model residency

## Result

**READY WITH LIMITATIONS.** The current release build and installer build successfully. Real local inference and Ollama residency behavior were verified through the direct API and the Rust chat handler, but the native Chat UI could not be exercised because the release executable crashed before creating a WebView2 window. The exact release launch failed twice with `0x800700AA` (“The requested resource is in use”), including once after the user normally closed the older Lodhi AI window. No process was terminated and no WebView2 or application data was removed.

## Exact release and launch outcome

- Release executable: `E:\LodhiAI-Windows\src-tauri\target\phase4\release\lodhi-ai.exe`
- Final build modified UTC: **2026-10-22T13:47:53.5147512Z**
- Size: **4,218,368 bytes**
- This path is the optimized Tauri release executable. It is not `target\phase4\release\deps\lodhi_ai.exe` and is not the installed older `E:\Local\Lodhi AI\lodhi-ai.exe`.
- The Windows app-launch helper resolved to the older installed path. That old window was not used for testing; the user closed it normally after the path mismatch was reported.
- Direct launch of the exact release executable exited with **-1073740791 (`0xC0000409`)** before showing a window. Captured stderr: `failed to create webview ... HRESULT(0x800700AA), "The requested resource is in use."` This happened once before and once after the final release rebuild. The second attempt was made while no Lodhi process was running.
- Diagnostic stderr is preserved at `test-fixtures/phase4-e2e/launch-diagnostics/phase4-4-final-20261022-stderr.txt`.

### Native UI chat status

**Not tested.** No prompt was sent through the native Chat UI; no first/second UI latency is claimed. Because WebView2 failed before app initialization, this build could not show its loading state or Chat screen. Frontend tests verify that a pending request shows “Waiting for Ollama…”, disables the input, rejects a rapid duplicate submit, shows a success response, clears loading after success/error, and retains the user's prompt after an error. Those are mocked UI tests, not native desktop verification.

Minimum manual continuation: after Windows releases the WebView2 resource lock (a normal Windows restart is one option if the error persists), launch the exact release executable above, not the older installed path. In Chat, send two short prompts back-to-back and inspect the bounded in-memory Diagnostics logs for `user_submit`, `loading_visible`, `tauri_invoke_complete`, `frontend_result_received`, and `response_rendered`. Rust/Ollama timing fields accompany successful results. Compare the first and second prompt separately. Do not delete the WebView2 profile or application data to clear the lock.

## Timing evidence (not native UI)

The current local model is `qwen2.5-coder:3b`; Ollama is **0.40.6**. Timings below are direct Ollama HTTP or the real Rust chat-handler smoke test, not UI timing. Each successful handler call returned a nonempty response from the installed model.

### Direct HTTP baseline from Phase 4.3

| Request | Client elapsed | Ollama total | Model load | Prompt evaluation | Generation |
|---|---:|---:|---:|---:|---:|
| First measured (not a true cold sample; `load_duration` was 51 ms) | 1,704 ms | 1,514 ms | 51 ms | 1,206 ms | 199 ms |
| Immediate warm repeat | 434 ms | 435 ms | 20 ms | 205 ms | 205 ms |

### Real Rust handler from Phase 4.3

| Request | Handler elapsed | HTTP exchange | Ollama total | Model load | Prompt evaluation | Generation |
|---|---:|---:|---:|---:|---:|---:|
| Slow/reload request | 47,642 ms | 47,509 ms | 47,274 ms | 41,087 ms | 2,514 ms | 3,519 ms |
| Warm repeat | 1,961 ms | 1,960 ms | 1,951 ms | 151 ms | 213 ms | 1,578 ms |

The handler smoke test calls the Rust Tauri command function, but does not exercise Tauri IPC or the WebView. Ollama's `load_duration` confirms that the slow reproduced request loaded the model; the exact earlier user UI request remains uninstrumented.

## Ollama request and residency investigation

- `src-tauri/src/ollama.rs` sends `model`, `messages`, and `stream:false` to `POST /api/chat`. It does **not** send `keep_alive`, does not call an unload endpoint, and does not configure `OLLAMA_KEEP_ALIVE`.
- The Ollama API documents `keep_alive` as controlling post-request residency, with a default of `5m`. The current shell and user/machine environment registry had no `OLLAMA_KEEP_ALIVE` override. The Ollama process's inherited environment could not be read, so a process-only override is not ruled out. [Ollama API reference](https://github.com/ollama/ollama/blob/main/docs/api.md)
- There was exactly **one** `ollama.exe` server process. `GET /api/ps` showed zero loaded models before the temporary experiment. No concurrent Ollama process or other loaded model was observed; other callers to the local server cannot be ruled out from this check.
- A bounded direct API experiment used the installed model, a short prompt, `num_predict:8`, and request-only `keep_alive:"5m"`. It returned a nonempty response in **62,543 ms**, including **59,583 ms model load**. `/api/ps` then listed `qwen2.5-coder:3b`, size **2,168,371,281 bytes**, with an expiry five minutes after the request. It remained loaded shortly before expiry and `/api/ps` listed zero models by 18:44:03, after its 18:43:44 expiry. No global setting was changed; this per-request keep-alive expired naturally.
- Available system memory was **1,129 MB** shortly before expiry and **2,969 MB** after unload. During the initial post-load sample it read **648 MB**. These readings varied over time and are not a controlled memory benchmark. A reliable immediately-before-load total-memory baseline was unavailable; Windows denied the OS memory query. The `ollama ps` model size and available-memory readings show meaningful memory pressure is possible on this 8 GB target, but do not prove it caused the long load.
- The current Ollama default is five minutes according to its API documentation. The application request omits the override, and the explicit five-minute experiment confirms the local API honors that per-request setting. Actual residency behavior for app requests can still depend on the Ollama server process's environment and memory pressure.

**Finding:** Model loading/reloading is confirmed in the slow Rust/API requests by Ollama's own `load_duration` metric, and the explicit 5-minute residency experiment confirmed that Ollama holds and later unloads the model. Reload after the default app request is **likely** tied to Ollama's five-minute residency window; the exact cause of the user's original delay and the server process's inherited keep-alive environment remain unconfirmed. No permanent keep-alive change is recommended automatically because the model occupies about 2.17 GB in Ollama's process report and keeping it resident competes with the rest of an 8 GB system.

## Changes and security

- No application source code was changed in Phase 4.4. This phase adds this report and preserves the failed-launch diagnostics file.
- No model was downloaded, no cloud API was used, and no Ollama/app process was terminated.
- Tauri CSP/capabilities, loopback validation, request timeout, model selection, project path controls, and Ollama's public-network binding were not changed.
- Temporary `keep_alive:"5m"` applied to one direct request only and expired; no environment, registry, or persistent server configuration was changed.

## Automated verification

| Check | Result |
|---|---|
| Frontend tests (`npm test -- --run`) | **23 passed, 0 failed** across 2 files; chat bridge/model results are mocked. |
| TypeScript (`npm run type-check`) | **Passed**. |
| Vite (`npm run build`) | **Passed**. |
| Rust tests (`cargo test --target-dir target/phase4`) | **25 passed, 0 failed, 1 ignored**. |
| Rust handler real-inference smoke | **Passed twice** in Phase 4.3, using the installed local model; timing rows above. |
| `cargo check --target-dir target/phase4` | **Passed**. |
| `cargo fmt --manifest-path Cargo.toml --check` | **Passed**. |
| Tauri release NSIS build | **Passed**; current release executable and installer were rebuilt. |

## Current installer

- Path: `E:\LodhiAI-Windows\src-tauri\target\phase4\release\bundle\nsis\Lodhi AI_0.1.0_x64-setup.exe`
- Size: **1,564,340 bytes**
- Modified UTC: **2026-10-22T13:47:53.4575364Z**
- SHA-256: `9BAF5763037F7A95EA050E758C2EAD584B9482BD4DFE092D5CDA8584674A9B1A`

## Repository boundary

Initial Git status showed the project as untracked; no clean/reset was run and no existing files were deleted. The old project `E:\LodhiAI` was not accessed.
