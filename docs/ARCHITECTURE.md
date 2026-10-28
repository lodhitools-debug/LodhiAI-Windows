# Lodhi AI — Architecture Specification

## 1. Architectural Overview

Lodhi AI is architected as a lightweight, secure, and privacy-first commercial desktop platform. Built on **Tauri 2**, **React 18**, **TypeScript**, and **Rust**, the application decouples frontend UI presentation from privileged native execution while enforcing least-privilege security boundaries.

```
+-----------------------------------------------------------------+
|                   UI Presentation Layer                         |
|         React 18 • TypeScript • Vite • Custom Design System     |
|   (Dashboard, Chat, Coding Assistant, Workspaces, Settings)     |
+-----------------------------------------------------------------+
                                |
             IPC Bridge (tauri::generate_handler!)
             Strict Capability Schema (core:default)
                                |
                                v
+-----------------------------------------------------------------+
|                   Native Desktop Core (Rust)                    |
|      Hardware Telemetry • File Sandbox • IPC Security Guard     |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                   Host Operating System (Windows)               |
|      Windows 10/11 x64 • WebView2 Runtime • 8 GB RAM Target     |
+-----------------------------------------------------------------+
```

---

## 2. Layer Responsibilities

### 2.1 UI Presentation Layer (`src/`)
- **Technology:** React 18, TypeScript (Strict Mode), Vite 6.
- **Styling Architecture:** High-contrast Dark Navy theme (`#070b14`, `#0b1329`, `#111d3d`), electric blue accents (`#38bdf8`), purple accents (`#818cf8`), teal accents (`#2dd4bf`).
- **State Management:** Centralized React Context (`AppContext.tsx`) managing active screens, edition tier, chat sessions, application settings, and native telemetry cache.
- **Diagnostic Logging:** In-memory diagnostic service (`logger.ts`) capturing application lifecycle events with log export and real-time filtering.

### 2.2 IPC Bridge & Communication Layer (`src/services/tauri.ts`)
- Utilizes `@tauri-apps/api/core` for asynchronous message dispatching.
- Implements graceful fallback detection (`isTauriEnvironment()`) to enable testing and headless web execution while preserving complete diagnostic traceability.

### 2.3 Native Desktop Core (`src-tauri/`)
- **Technology:** Rust 2021 Edition, Tauri 2.
- **Commands Implemented:**
  - `get_system_info`: Returns host OS, architecture, memory allocation profile (8 GB target), and sandbox state.
  - `get_app_diagnostics`: Returns engine health, uptime, and security isolation status.
  - `get_app_version`: Returns semantic version and current milestone tier.
  - `ping`: Verifies bidirectional native IPC responsiveness with millisecond timestamp delta.

---

## 3. Windows 8 GB RAM Optimization Strategy

To ensure seamless multitasking on mainstream 8 GB RAM Windows PCs:
1. **Zero Daemon Bloatware:** The application does not spawn persistent background daemons or heavy Node.js runtime processes in production; Tauri utilizes Windows' built-in Evergreen WebView2.
2. **Embedded Vector Database:** In Phase 3, vector retrieval will utilize embedded `SQLite-vec`, eliminating the need for standalone Docker containers or heavy Python RAG servers.
3. **Memory Budget Cap:** The entire application core, UI, and active chat history operate within a strict **< 200 MB memory footprint** in Phase 1.
4. **Lazy Resource Allocation:** High-memory modules (e.g. AST parsing and embedding generators) are initialized on demand and deallocated immediately upon completion.

---

## 4. Component & Directory Structure

```
E:\LodhiAI-Windows\
├── docs/                        # Architectural, security, and roadmap documentation
│   ├── ARCHITECTURE.md
│   ├── PRODUCT_ROADMAP.md
│   ├── SECURITY.md
│   └── TEST_PLAN.md
├── public/                      # Static assets & brand SVG logo
│   └── logo.svg
├── src/                         # Frontend React + TypeScript application
│   ├── assets/
│   ├── components/
│   │   ├── chat/                # ChatInput and ChatMessage components
│   │   ├── common/              # Button, Card, Badge, Input, Modal, RoadmapBanner
│   │   └── layout/              # TitleBar, Sidebar, StatusBar, AppLayout
│   ├── screens/                 # 10 Phase 1 application screens
│   │   ├── DashboardScreen.tsx
│   │   ├── ChatScreen.tsx
│   │   ├── CodingAssistantScreen.tsx
│   │   ├── ProjectWorkspaceScreen.tsx
│   │   ├── AutomationAgentsScreen.tsx
│   │   ├── DocumentsScreen.tsx
│   │   ├── KnowledgeBaseScreen.tsx
│   │   ├── ModelSettingsScreen.tsx
│   │   ├── GeneralSettingsScreen.tsx
│   │   └── DiagnosticsScreen.tsx
│   ├── services/                # Tauri IPC bridge & logger
│   ├── store/                   # AppContext global state
│   ├── styles/                  # Design tokens and global CSS
│   ├── test/                    # Vitest test suite and DOM setup
│   ├── types/                   # TypeScript domain models
│   ├── App.tsx                  # Root screen switcher
│   └── main.tsx                 # DOM entrypoint
├── src-tauri/                   # Rust desktop core & Tauri configuration
│   ├── capabilities/            # Least-privilege permissions schema
│   │   └── default.json
│   ├── icons/                   # Generated Windows .ico and .png assets
│   ├── src/
│   │   ├── lib.rs               # Native commands and library entry
│   │   └── main.rs              # Windows entrypoint
│   ├── build.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json                 # Dependency manifests & NPM scripts
├── tsconfig.json                # TypeScript strict configuration
└── vite.config.ts               # Vite & Vitest configuration
```
