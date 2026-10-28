# Phase 4 — Project Workspace

## Use

1. Open **Project Workspace** and select a project with the native folder picker.
2. Expand folders in the tree. Entries marked excluded or unavailable cannot be opened, and their contents are not shown.
3. Select a supported text file to load its read-only preview.
4. Use **Check local model** to confirm the configured Ollama endpoint and model are available. Configure these under **Model Providers**.
5. Describe a focused change and choose **Generate proposal**. The selected file is sent to the configured local Ollama server through the Rust backend, subject to the backend file and context limits.
6. Review the original and proposed complete contents. **Approve and apply** is the only operation that writes the proposed change. **Discard proposal** clears the pending proposal without writing.

The backend repeats project-boundary, exclusion, symlink, file identity, and original-content checks immediately before applying. Existing files are backed up under `.lodhi-ai-backups` before the staged write. If the file was replaced or edited after analysis, approval is rejected and the user should inspect it and request a fresh proposal.

## Local service

Ollama should remain bound to the local machine (normally `127.0.0.1:11434` or `localhost:11434`). Start it through the installed Ollama desktop application or its supported local service mechanism; do not expose it on a public interface. The workspace does not install Ollama, download models, or start arbitrary executables. If connection or model checks fail, start Ollama and select an already-installed model in Model Providers.

## Limits and scope

The workspace uses the existing secure native picker and Rust project commands. It only sends the selected supported source file(s) and the user's instruction to Ollama. Model responses are untrusted proposals. Test/build script execution remains part of the separate Coding Assistant flow and requires its own review and confirmation.

Workspace component tests use mocked bridge responses; they verify review/approval/discard behavior and do not represent real model inference. Rust tests cover backend path and write protections without requiring a running Ollama model.
