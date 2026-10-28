# Lodhi AI — Test Plan & Quality Assurance

## 1. Scope & Objective

This test plan defines the automated verification strategy, coverage targets, and test criteria for **Lodhi AI Phase 1: Windows Desktop Foundation**. It ensures stability across UI navigation, application state persistence, IPC command reliability, and security boundary enforcement.

---

## 2. Test Suites & Tools

| Level | Framework | Scope | Command |
|---|---|---|---|
| **Static Analysis** | TypeScript Compiler | Strict type checking (`noEmit`, strict null checks) | `npm run type-check` |
| **Unit & Integration** | Vitest + React Testing Library | Component lifecycle, screen navigation, state dispatch | `npm test` |
| **Native Rust Unit Tests** | Cargo Test Runner | System info struct validation, IPC ping command | `cargo test --manifest-path src-tauri/Cargo.toml` |
| **Production Bundle** | Vite Build Pipeline | ES2021 minification, asset tree, chunk splitting | `npm run build` |

---

## 3. Test Cases (Phase 1 Baseline)

### TC-01: Brand Identity & Shell Rendering
- **Objective:** Verify that the titlebar renders the "Lodhi AI" brand, the tagline "Think • Create • Automate", the status badges, and window controls.
- **Result:** **PASSED** (`src/test/App.test.tsx`)

### TC-02: Seamless Screen Navigation (10 Planned Screens)
- **Objective:** Verify that clicking each sidebar item immediately transitions the view without DOM crashes or unhandled exceptions:
  - Dashboard
  - AI Chat
  - Coding Assistant
  - Project Workspaces
  - Automation Agents
  - Documents & Files
  - Knowledge Base
  - Model Providers
  - General Settings
  - Diagnostics & Event Logs
- **Result:** **PASSED** (`src/test/App.test.tsx`)

### TC-03: Responsible Offline Chat Verification
- **Objective:** Verify that user messages submitted to the chat interface are recorded in local session state, and that the system returns an honest Phase 1 dispatcher notice without fabricating LLM output.
- **Result:** **PASSED** (`src/test/App.test.tsx`)

### TC-04: Commercial Edition Switcher
- **Objective:** Verify that toggling between Free, Pro, and Business editions updates application state and reflects immediately across the interface.
- **Result:** **PASSED** (`src/test/App.test.tsx`)

### TC-05: IPC Bridge Diagnostics & Ping Command
- **Objective:** Verify that triggering `pingNativeBackend()` successfully returns a structured timestamped response with roundtrip latency metrics.
- **Result:** **PASSED** (Verified in Diagnostics screen & Vitest suite)

### TC-06: Granular Screen Component QA Suite
- **Objective:** Verify that each individual screen component mounts independently with proper fallback states, language switchers, filter inputs, and configuration tabs.
- **Result:** **PASSED** (`src/test/Screens.test.tsx` — 11/11 tests passing)

### TC-07: Error Boundary Isolation & Self-Healing
- **Objective:** Verify that unhandled component exceptions are caught cleanly by `ErrorBoundary`, logged to the diagnostic service, and present a non-destructive "Try Again" recovery action.
- **Result:** **PASSED** (`src/test/Screens.test.tsx`)

### TC-08: LoadingState & Visual Spinners
- **Objective:** Verify that `LoadingState` renders animated spinners and context messages during async data transitions.
- **Result:** **PASSED** (`src/test/Screens.test.tsx`)

---

## 4. Acceptance Sign-Off Checklist

- [x] Absolute workspace isolation: `E:\LodhiAI` was not touched.
- [x] Application foundation successfully established at `E:\LodhiAI-Windows`.
- [x] TypeScript compiler passes with 0 errors in strict mode (`npm run type-check`).
- [x] Vitest test suite executes and passes 15/15 test cases (100% pass rate).
- [x] Production build bundle generates valid minified assets without warnings (`npm run build`).
- [x] ErrorBoundary and LoadingState components integrated into root layout.
- [x] Responsive CSS breakpoints added for tablet, mobile, and compact window modes.
- [x] All 10 screens feature clear, honest status banners describing future milestones.
- [x] Missing native build dependencies (Rust / MSVC) clearly documented with setup guides.
