# Lodhi AI — Security Architecture & Isolation Policy

## 1. Absolute Workspace Isolation

### 1.1 Strict Boundary Definition
- **Active Workspace Root:** `E:\LodhiAI-Windows`
- **Protected Legacy Repository:** `E:\LodhiAI` is strictly quarantined and designated off-limits.
  - No read, write, copy, migration, or indexing operations are permitted on `E:\LodhiAI`.
  - The application configuration, file pickers, and workspace listeners strictly filter out paths matching `E:\LodhiAI` or external drives without explicit consent.

---

## 2. Least-Privilege Permissions Model

Lodhi AI adheres to the Tauri 2 Least-Privilege Capabilities matrix:
- **Capability Manifest (`src-tauri/capabilities/default.json`):**
  - Configured with `core:default` permissions only.
  - Arbitrary shell execution (`tauri-plugin-shell:execute` or `open`) is strictly restricted.
  - No unrestricted operating system command injection surfaces are exposed to frontend scripts or AI agents.
- **Elevation Policy:**
  - The application runs strictly in standard user space.
  - Administrative elevation (UAC prompt / Run as Administrator) is explicitly forbidden for standard operations.

---

## 3. Data Protection & Local Inference

1. **Local Network Boundary:**
   - Ollama requests are issued by the Rust backend only and are restricted to loopback addresses. Prompts and explicitly selected source files are sent to that local Ollama service.
   - No cloud API integration is implemented in this build. The cloud provider screen is a nonfunctional preview.
   - The app does not download models or change Ollama's network binding.
2. **Secrets & API Credential Safety:**
   - No hardcoded API keys or private secrets exist in the source repository.
   - Cloud credential fields are preview-only, remain in component state, and are not saved or transmitted.
3. **Local Session Cache:**
   - Chat history and user preferences are stored locally in `localStorage`; they are not encrypted in this build.

See [PHASE3_LOCAL_CODING_ASSISTANT.md](PHASE3_LOCAL_CODING_ASSISTANT.md) for local model startup and project workflow details.

---

## 4. Human-in-the-Loop Safeguards

1. **Atomic File Mutation Consent:**
   - Automation agents and coding assistants cannot modify source code without presenting an interactive visual diff modal and awaiting explicit user confirmation.
2. **Symlink Traversal Prevention:**
   - Filesystem indexers reject symbolic links pointing outside the designated workspace root to prevent path traversal attacks.
3. **Audit Trail Logging:**
   - All native commands, configuration changes, and IPC requests are recorded in the local in-memory diagnostic log for user inspection.
