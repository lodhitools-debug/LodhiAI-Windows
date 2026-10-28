import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeIntelligenceCockpit } from '../components/agent/CodeIntelligenceCockpit';
import * as tauriService from '../services/tauri';

describe('CodeIntelligenceCockpit Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(tauriService, 'getProjectIntelligence').mockResolvedValue({
      rootPath: 'E:/LodhiAI-Windows',
      primaryLanguage: 'TypeScript',
      detectedLanguages: ['TypeScript', 'Rust'],
      frameworks: ['React', 'Vite', 'Tauri'],
      packageManager: 'npm',
      entryPoints: ['src/main.tsx', 'src-tauri/src/main.rs'],
      dependencies: { react: '^18.3.1', '@tauri-apps/api': '^2.0.0' },
      devDependencies: { vite: '^5.4.0', vitest: '^2.0.0' },
      availableChecks: ['type-check', 'test', 'build', 'cargo-check'],
      timestampMs: Date.now(),
    });

    vi.spyOn(tauriService, 'runProjectDiagnostics').mockResolvedValue({
      toolId: 'type-check',
      success: false,
      exitCode: 2,
      rawOutput: "src/App.tsx:42:15 - error TS2322: Type 'string' is not assignable to type 'number'.",
      diagnostics: [
        {
          file: 'src/App.tsx',
          line: 42,
          column: 15,
          severity: 'error',
          code: 'TS2322',
          message: "Type 'string' is not assignable to type 'number'.",
          source: 'tsc',
          suggestedFix: 'Type mismatch; verify target type or use proper type assertion/narrowing.',
        },
      ],
      totalErrors: 1,
      totalWarnings: 0,
      timestampMs: Date.now(),
    });

    vi.spyOn(tauriService, 'parseDiagnosticsText').mockResolvedValue([
      {
        file: 'src/main.rs',
        line: 14,
        column: 5,
        severity: 'error',
        code: 'E0425',
        message: 'cannot find value `x` in this scope',
        source: 'rustc',
        suggestedFix: 'Verify the variable is declared in current scope or import missing module with `use`.',
      },
    ]);
  });

  it('renders project intelligence overview and manifest metrics', async () => {
    render(<CodeIntelligenceCockpit />);

    await waitFor(() => {
      expect(screen.getByText('Code Intelligence & Diagnostics')).toBeInTheDocument();
    });

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React, Vite, Tauri')).toBeInTheDocument();
    expect(screen.getByText(/Package Manager: npm/)).toBeInTheDocument();
  });

  it('triggers human authorization modal before running diagnostics check', async () => {
    render(<CodeIntelligenceCockpit />);

    await waitFor(() => {
      expect(screen.getByText('Run TypeScript Type-Check')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Run TypeScript Type-Check'));

    expect(screen.getByText('Confirm Diagnostics Tool Execution')).toBeInTheDocument();
    expect(screen.getByText(/Lodhi AI is requesting permission/)).toBeInTheDocument();

    // Authorize & Run
    fireEvent.click(screen.getByText('Authorize & Run'));

    await waitFor(() => {
      expect(screen.getByText('FAILED (1 Errors)')).toBeInTheDocument();
      expect(screen.getByText('src/App.tsx:42:15')).toBeInTheDocument();
      expect(screen.getByText('TS2322')).toBeInTheDocument();
      expect(screen.getByText(/Type mismatch; verify target type/)).toBeInTheDocument();
    });
  });

  it('invokes onProposeFix when Propose Fix via Agent is clicked', async () => {
    const handlePropose = vi.fn();
    render(<CodeIntelligenceCockpit onProposeFix={handlePropose} />);

    await waitFor(() => {
      expect(screen.getByText('Run TypeScript Type-Check')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Run TypeScript Type-Check'));
    fireEvent.click(screen.getByText('Authorize & Run'));

    await waitFor(() => {
      expect(screen.getByText('Propose Fix via Agent')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Propose Fix via Agent'));

    expect(handlePropose).toHaveBeenCalledWith(
      'src/App.tsx',
      expect.objectContaining({
        file: 'src/App.tsx',
        line: 42,
        code: 'TS2322',
      }),
    );
  });

  it('parses raw compiler error text in the live sandbox', async () => {
    render(<CodeIntelligenceCockpit />);

    const textarea = screen.getByPlaceholderText(/Paste terminal log here/);
    fireEvent.change(textarea, {
      target: {
        value: "error[E0425]: cannot find value `x` in this scope\n  --> src/main.rs:14:5",
      },
    });

    const parseBtn = screen.getByText('Parse Diagnostics Text');
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText(/Parsed Diagnostics \(1 items\):/)).toBeInTheDocument();
      expect(screen.getByText('src/main.rs:14 [E0425]')).toBeInTheDocument();
      expect(screen.getByText(/Verify the variable is declared in current scope/)).toBeInTheDocument();
    });
  });
});
