# Phase 3 local coding assistant

## Local setup

1. Start the Ollama desktop application for the signed-in Windows user. Ollama normally exposes its local API at `http://127.0.0.1:11434`.
2. In Lodhi AI, open Model Providers, confirm the endpoint and an already-installed model, then use **Check models**.
3. In Coding Assistant, use **Check local model** to confirm that the configured model is available.

The app does not install or download models and does not change Ollama's bind address. Use loopback only. If Ollama is stopped, start the installed Ollama app from the Windows Start menu; avoid starting another server instance if the tray app is already running.

## Project workflow and safeguards

Select a project with the native Windows folder picker. The Rust backend canonicalizes the chosen root and rejects the protected legacy `E:\LodhiAI` path. It skips version control, dependencies, build products, caches, likely credentials, keys, symlinks, unsupported files, and files over the selected limit. Only checked files are read and sent to the local model.

With no project files selected, the screen provides a local chat. With files selected, the model returns a proposal for review. Nothing is written until **Approve and apply changes** is pressed. Existing files are checked for changes since analysis and recoverable originals are saved under `.lodhi-ai-backups` before replacement.

Project checks are limited to detected `test`, `type-check`, and `build` npm scripts. The screen displays the script and working directory and asks for confirmation before each run. Generated terminal commands are never run.

Tauri keeps its existing `core:default` capability and restrictive CSP. Local Ollama HTTP and project filesystem access are implemented in Rust; the frontend receives no broad network or filesystem permission.
