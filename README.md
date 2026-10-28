# Lodhi AI — Commercial AI Desktop Platform

> **Tagline:** Think • Create • Automate  
> **Platform Target:** Windows 10 / 11 (64-bit), 8 GB RAM Optimized  
> **Product Editions:** Free, Pro, and Business  
> **Phase 1 Milestone:** Windows Desktop Foundation  

---

## 1. About Lodhi AI

Lodhi AI is a privacy-first, high-performance desktop platform designed specifically for software developers, freelancers, students, and businesses. Engineered on a modern desktop stack using **Tauri 2**, **React 18**, **TypeScript**, and **Rust**, Lodhi AI delivers:

- **100% Local Sandbox Isolation:** Zero unauthorized external outbound network requests.
- **8 GB RAM Profile:** Ultra-lightweight footprint without background daemon bloatware.
- **Polyglot Developer Experience:** AI Chat, Coding Assistant, Workspace Management, Automation Agents, and Embedded Vector Knowledge Base.
- **Honest Milestone Transparency:** Screens whose backend functionality is scheduled for subsequent milestones feature clear roadmap indicators.

---

## 2. Technology Stack

- **Desktop Framework:** [Tauri 2](https://v2.tauri.app/) (Rust native core + IPC commands)
- **Frontend Framework:** React 18 with TypeScript (Strict Mode)
- **Bundler & Dev Server:** Vite 6
- **Icons & Visuals:** Lucide React & Custom Design Tokens (Dark Navy `#070b14`, Electric Blue `#38bdf8`, Purple `#818cf8`, Teal `#2dd4bf`)
- **Testing Suite:** Vitest + React Testing Library + JSDOM
- **Version Control:** Git

---

## 3. Quick Start & Development Commands

From the project root (`E:\LodhiAI-Windows`):

### 3.1 Install NPM Dependencies
```bash
npm install
```

### 3.2 Start Local Development Server
Starts the high-speed Vite dev server at `http://localhost:1420/`:
```bash
npm run dev
```

### 3.3 Run TypeScript Type-Check
Runs strict compiler checks without emitting files:
```bash
npm run type-check
```

### 3.4 Run Automated Unit & Integration Tests
Runs the Vitest test suite verifying navigation, chat state, and edition switching:
```bash
npm test
```

### 3.5 Build Frontend Production Bundle
Compiles and tree-shakes optimized assets to `dist/`:
```bash
npm run build
```

---

## 4. Tauri Native Windows Build Prerequisites

To compile the standalone Windows `.exe` desktop application via Tauri, the following native tools are required on Windows:

### Status on Current Environment
| Dependency | Detected Status | Notes |
|---|---|---|
| **Node.js** | `v20.11.1` | Installed & verified |
| **NPM** | `10.2.4` | Installed & verified |
| **Microsoft Edge WebView2** | `155.0.4283.62` | Installed & verified |
| **Visual Studio C++ Build Tools** | Detected & Active | MSVC `link.exe` x64 toolchain active |
| **Rust (`rustc` & `cargo`)** | `1.85.0` (MSVC) | Installed & verified |
| **WiX Toolset (`candle`, `light`)** | Detected & Active | Generates `.msi` Windows installer |
| **NSIS (`makensis`)** | Detected & Active | Generates `.exe` setup installer |

### Installation Instructions for Native Windows Build

#### Step 1: Install Visual Studio C++ Build Tools
1. Download the installer from Microsoft: [vs_BuildTools.exe](https://aka.ms/vs/17/release/vs_BuildTools.exe)
2. Run the installer and select the workload: **"Desktop development with C++"**
3. Ensure the following optional components are checked:
   - *MSVC v143 - VS 2022 C++ x64/x86 build tools*
   - *Windows 10/11 SDK*
4. Complete installation and restart your terminal.

#### Step 2: Install Rust via Rustup
1. Download the official installer from [rustup.rs](https://rustup.rs/): [rustup-init.exe](https://win.rustup.rs/x86_64)
2. Run the installer and choose option `1` (Proceed with installation (default)).
3. Restart your terminal and verify:
   ```powershell
   rustc --version
   cargo --version
   ```

#### Step 3: Run the Native Tauri Desktop App
Once Rust and MSVC tools are installed:
```bash
npm run tauri dev
```

To build the release installer (`.msi` and `.exe` bundle):
```bash
npm run tauri build
```

---

## 5. Phase 1 Application Modules

The application includes 10 fully implemented functional screens:

1. **Home Dashboard:** Hero welcome, hardware performance telemetry, quick-launch modules, and commercial tier overview.
2. **AI Chat:** Interactive chat shell, multi-session management, local encrypted caching, and Phase 1 offline dispatcher.
3. **Coding Assistant:** Language switcher (Rust, TypeScript, Python), task operation selector (Security review, Unit tests, Architecture), and code viewer.
4. **Project Workspaces:** Workspace container inspector (`E:\LodhiAI-Windows`), file tree hierarchy preview, and sandbox isolation status.
5. **Automation Agents:** Security linter, test generator, doc generator, and data cleaner with fine-grained capability requirements.
6. **Documents & Files:** Document dropzone preview, file metadata library, and zero-cloud upload guarantee.
7. **Knowledge Base:** Embedded SQLite-vec vector vault schema, embedding model selection, and memory quota monitor.
8. **Model Providers:** Local runtimes (Ollama, LM Studio) and Cloud API (Claude, OpenAI, Groq) parameter managers with local encryption notice.
9. **General Settings:** Theme selection, display density, telemetry toggles (strictly disabled by default), and Free/Pro/Business edition switcher.
10. **Diagnostics & Logs:** Real-time event log viewer with level filtering (ALL, INFO, WARN, ERROR, DEBUG), JSON export, and native IPC ping command.

---

## 6. Architecture & Security Documentation

Detailed technical documentation is available in the `docs/` folder:
- [Google Gemini Integration Guide](file:///e:/LodhiAI-Windows/docs/GEMINI_PROVIDER_GUIDE.md): Secure setup, native vault key storage, model catalog, and billing.
- [Product Roadmap](file:///e:/LodhiAI-Windows/docs/PRODUCT_ROADMAP.md): Milestones from Phase 1 to Phase 6.
- [Architecture Specification](file:///e:/LodhiAI-Windows/docs/ARCHITECTURE.md): Layered architecture, 8 GB RAM optimization, and folder structure.
- [Security Architecture](file:///e:/LodhiAI-Windows/docs/SECURITY.md): Least-privilege model, data protection, and isolation policies.
- [Test Plan](file:///e:/LodhiAI-Windows/docs/TEST_PLAN.md): Quality assurance, test cases, and acceptance checklist.

---

## 7. License & Isolation Guarantee

- All code and configuration in this repository belong exclusively to `E:\LodhiAI-Windows`.
- The legacy repository at `E:\LodhiAI` is strictly quarantined and was not altered, copied, or touched in any way.
