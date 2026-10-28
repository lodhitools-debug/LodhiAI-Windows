# Local Ollama startup and verification

Lodhi AI talks to Ollama through the Rust backend at a loopback-only HTTP endpoint. The default endpoint is `http://localhost:11434`; the backend rejects non-loopback hosts. No cloud provider or API key is needed.

## Start Ollama on this Windows installation

The Ollama desktop app is installed under `E:\Ollama\App`. Its tray app may start a local server automatically. If the app does not leave the server available, open PowerShell and run the supported CLI server with cloud features disabled:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = 'E:\Ollama\Models'
$env:OLLAMA_NO_CLOUD = '1'
& 'E:\Ollama\App\ollama.exe' serve
```

Keep that PowerShell window open while using Lodhi AI. These settings apply to that Ollama process only. The explicit host keeps the server on this PC; `OLLAMA_NO_CLOUD=1` disables Ollama cloud features. No model is downloaded by this procedure.

## Verify the server and model

In another PowerShell window, list installed models:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

This installation has the `qwen2.5-coder:3b` model already present. In Lodhi AI, open Model Providers, select or confirm that model, and use **Check models**. Then send a short prompt from Chat. A successful reply comes from the local model; Rust unit tests using fake HTTP servers do not count as real inference.

An opt-in real Rust command smoke test is available after starting Ollama:

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
cargo test --manifest-path src-tauri\Cargo.toml live_local_ollama_chat_command_smoke -- --ignored --nocapture
```

The smoke test invokes the same Tauri `chat_with_ollama` command handler used by the UI. It does not run as part of the ordinary offline test suite.
