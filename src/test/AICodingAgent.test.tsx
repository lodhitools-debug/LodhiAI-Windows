import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../store/AppContext';
import { CodingAssistantScreen } from '../screens/CodingAssistantScreen';
import * as tauriService from '../services/tauri';

vi.mock('../services/tauri', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/tauri')>();
  return {
    ...actual,
    listOllamaModels: vi.fn(),
    chatWithOllama: vi.fn(),
    chooseProjectFolder: vi.fn(),
    getProjectTree: vi.fn(),
    readProjectFiles: vi.fn(),
    analyzeProjectFiles: vi.fn(),
    applyCodeProposal: vi.fn(),
    discardCodeProposal: vi.fn(),
    listProjectChecks: vi.fn(),
    runProjectCheck: vi.fn(),
  };
});

async function renderScreen() {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <AppProvider>
        <CodingAssistantScreen />
      </AppProvider>
    );
  });
  return result;
}

describe('Phase 3 — AI Coding Agent Test Suite', () => {
  const mockTree: tauriService.ProjectTree = {
    root: 'E:\\SafeWorkspace',
    entries: [
      {
        path: 'src',
        name: 'src',
        isDirectory: true,
        sizeBytes: null,
        selectable: false,
        excludedReason: null,
      },
      {
        path: 'src/main.ts',
        name: 'main.ts',
        isDirectory: false,
        sizeBytes: 1024,
        selectable: true,
        excludedReason: null,
      },
      {
        path: '.env',
        name: '.env',
        isDirectory: false,
        sizeBytes: 256,
        selectable: false,
        excludedReason: 'Secret file excluded by security policy',
      },
    ],
    truncated: false,
  };

  const mockCheck: tauriService.ProjectCheck = {
    id: 'test',
    command: 'npm test',
    scriptBody: 'vitest run',
    workingDirectory: 'E:\\SafeWorkspace',
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.mocked(tauriService.listOllamaModels).mockResolvedValue(['qwen2.5-coder:3b']);
    vi.mocked(tauriService.chooseProjectFolder).mockResolvedValue('E:\\SafeWorkspace');
    vi.mocked(tauriService.getProjectTree).mockResolvedValue(mockTree);
    vi.mocked(tauriService.listProjectChecks).mockResolvedValue([mockCheck]);
  });

  it('1. Planning without file modifications: generates structured plan, identifies files and explains risks with 0 disk writes', async () => {
    await renderScreen();

    // Select workspace folder
    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/E:\\SafeWorkspace/i)).toBeInTheDocument();
    });

    // Enter a safe coding task
    const textarea = screen.getByLabelText(/Agent Task Description/i);
    fireEvent.change(textarea, { target: { value: 'Add input validation to user registration' } });

    // Generate plan
    const planBtn = screen.getByRole('button', { name: /Generate Implementation Plan/i });
    fireEvent.click(planBtn);

    // Verify structured plan is displayed
    expect(screen.getByText(/Structured Plan of Action/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/Inspect permitted workspace files/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety & Risk Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/No files are modified during planning or staging phases/i)).toBeInTheDocument();

    // Verify status is planned
    expect(screen.getByText(/STATUS: PLANNED/i)).toBeInTheDocument();

    // ZERO file modifications during planning
    expect(tauriService.applyCodeProposal).not.toHaveBeenCalled();
  });

  it('2. Destructive and sensitive prompt rejection: blocks dangerous commands and asks for safe clarification', async () => {
    await renderScreen();

    // Select workspace
    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/E:\\SafeWorkspace/i)).toBeInTheDocument();
    });

    // Enter a destructive prompt
    const textarea = screen.getByLabelText(/Agent Task Description/i);
    fireEvent.change(textarea, { target: { value: 'rm -rf / && delete .git and read .env' } });

    // Click generate plan
    fireEvent.click(screen.getByRole('button', { name: /Generate Implementation Plan/i }));

    // Expect safety guard rejection alert
    expect(
      screen.getByText(/Safety Guard: The task requests destructive operations or secret access/i)
    ).toBeInTheDocument();

    // Plan should not be created
    expect(screen.queryByText(/Structured Plan of Action/i)).not.toBeInTheDocument();
    expect(tauriService.analyzeProjectFiles).not.toHaveBeenCalled();
    expect(tauriService.applyCodeProposal).not.toHaveBeenCalled();
  });

  it('3. Workspace boundary and sensitive-file exclusion: enforces boundary and blocks .env from selection', async () => {
    await renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/E:\\SafeWorkspace/i)).toBeInTheDocument();
    });

    // Tree renders .env with disabled checkbox and excluded reason
    const envCheckbox = screen.getByLabelText(/Select \.env/i);
    expect(envCheckbox).toBeDisabled();
    expect(screen.getByText(/Secret file excluded by security policy/i)).toBeInTheDocument();

    // Expand src folder to reveal nested items
    fireEvent.click(screen.getByRole('button', { name: /Toggle src/i }));
    const mainCheckbox = await screen.findByLabelText(/Select src\/main\.ts/i);
    expect(mainCheckbox).not.toBeDisabled();
  });

  it('4. Cloud consent protection: halts execution and demands consent if Gemini provider is configured', async () => {
    // Configure settings for Gemini without consent
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'gemini',
        geminiConsentGiven: false,
      })
    );

    await renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/E:\\SafeWorkspace/i)).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/Agent Task Description/i);
    fireEvent.change(textarea, { target: { value: 'Refactor main function' } });

    fireEvent.click(screen.getByRole('button', { name: /Generate Implementation Plan/i }));

    // Cloud consent warning must appear
    expect(screen.getByText(/Cloud AI Consent Warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Explicit Consent Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Transmitting local workspace code to a remote cloud API requires your explicit consent/i)).toBeInTheDocument();

    // No network transmission without consent
    expect(tauriService.analyzeProjectFiles).not.toHaveBeenCalled();
  });

  it('5. Staged diff preview and rejection: leaves original files untouched when proposal is rejected', async () => {
    const mockProposal: tauriService.CodeProposal = {
      id: 'prop-101',
      model: 'qwen2.5-coder:3b',
      summary: 'Add validation helper',
      files: [
        {
          path: 'src/main.ts',
          originalContent: 'export function run() {}',
          proposedContent: 'export function run() { validate(); }',
        },
      ],
    };

    vi.mocked(tauriService.analyzeProjectFiles).mockResolvedValue(mockProposal);
    vi.mocked(tauriService.discardCodeProposal).mockResolvedValue('Proposal discarded. No project files were changed.');

    await renderScreen();

    // Select workspace and enter task
    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/E:\\SafeWorkspace/i)).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/Agent Task Description/i);
    fireEvent.change(textarea, { target: { value: 'Add validation to run' } });

    // Plan and Execute
    fireEvent.click(screen.getByRole('button', { name: /Generate Implementation Plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /Execute Plan & Generate Diff/i }));

    // Verify diff review gate appears with approval notice
    await waitFor(() => {
      expect(screen.getByText(/Diff Review Gate/i)).toBeInTheDocument();
      expect(screen.getByText(/APPROVAL REQUIRED \(0 DISK WRITES\)/i)).toBeInTheDocument();
      expect(screen.getByText(/export function run\(\) \{ validate\(\); \}/i)).toBeInTheDocument();
    });

    // Reject proposal
    const rejectBtn = screen.getByRole('button', { name: /Reject Proposal \(Keep Originals\)/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(tauriService.discardCodeProposal).toHaveBeenCalledWith('prop-101');
      expect(screen.getByText(/STATUS: CANCELLED/i)).toBeInTheDocument();
      expect(screen.getByText(/Proposal rejected by user\. Workspace files remain untouched/i)).toBeInTheDocument();
    });

    // Apply was NEVER called
    expect(tauriService.applyCodeProposal).not.toHaveBeenCalled();
  });

  it('6. Explicit approval, atomic write, and recoverable backup creation', async () => {
    const mockProposal: tauriService.CodeProposal = {
      id: 'prop-202',
      model: 'qwen2.5-coder:3b',
      summary: 'Implement input validation',
      files: [
        {
          path: 'src/main.ts',
          originalContent: 'export function run() {}',
          proposedContent: 'export function run() { validate(); }',
        },
      ],
    };

    vi.mocked(tauriService.analyzeProjectFiles).mockResolvedValue(mockProposal);
    vi.mocked(tauriService.applyCodeProposal).mockResolvedValue(
      'Applied 1 approved file change(s). Recoverable originals are saved in .lodhi-ai-backups.'
    );

    await renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/E:\\SafeWorkspace/i)).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/Agent Task Description/i);
    fireEvent.change(textarea, { target: { value: 'Add validation' } });

    fireEvent.click(screen.getByRole('button', { name: /Generate Implementation Plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /Execute Plan & Generate Diff/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Approve and Apply Changes/i })).toBeInTheDocument();
    });

    // User explicitly approves
    fireEvent.click(screen.getByRole('button', { name: /Approve and Apply Changes/i }));

    await waitFor(() => {
      expect(tauriService.applyCodeProposal).toHaveBeenCalledWith('prop-202', true);
      // Workspace tree was refreshed
      expect(tauriService.getProjectTree).toHaveBeenCalled();
    });
  });

  it('7. Stale-file detection: reports concurrent modification error honestly without overwriting', async () => {
    const mockProposal: tauriService.CodeProposal = {
      id: 'prop-stale',
      model: 'qwen2.5-coder:3b',
      summary: 'Stale edit test',
      files: [
        {
          path: 'src/main.ts',
          originalContent: 'original',
          proposedContent: 'modified',
        },
      ],
    };

    vi.mocked(tauriService.analyzeProjectFiles).mockResolvedValue(mockProposal);
    vi.mocked(tauriService.applyCodeProposal).mockRejectedValue(
      new Error("'src/main.ts' changed after analysis. Re-run analysis to avoid overwriting newer work.")
    );

    await renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/E:\\SafeWorkspace/i)).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/Agent Task Description/i);
    fireEvent.change(textarea, { target: { value: 'Stale test' } });

    fireEvent.click(screen.getByRole('button', { name: /Generate Implementation Plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /Execute Plan & Generate Diff/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Approve and Apply Changes/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Approve and Apply Changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/STATUS: FAILED/i)).toBeInTheDocument();
      expect(screen.getAllByText(/changed after analysis/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('8. Validation command execution: requires explicit confirmation showing exact command and directory', async () => {
    vi.mocked(tauriService.runProjectCheck).mockResolvedValue({
      id: 'test',
      exitCode: 0,
      success: true,
      timedOut: false,
      cancelled: false,
      output: 'All 12 tests passed.',
    });

    await renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/npm test/i)).toBeInTheDocument();
    });

    // Click "Review and Run"
    fireEvent.click(screen.getByRole('button', { name: /Review and Run/i }));

    // Approval dialog must be presented with exact details
    expect(screen.getByRole('alertdialog', { name: /Confirm project check/i })).toBeInTheDocument();
    expect(screen.getByText(/Do you approve running this exact command\?/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Working directory:/i).length).toBeGreaterThanOrEqual(1);

    // Command should not have executed yet
    expect(tauriService.runProjectCheck).not.toHaveBeenCalled();

    // Click "I approve this run"
    fireEvent.click(screen.getByRole('button', { name: /I approve this run/i }));

    await waitFor(() => {
      expect(tauriService.runProjectCheck).toHaveBeenCalledWith('test', true);
      expect(screen.getByText(/Exit Code: 0 · Passed/i)).toBeInTheDocument();
      expect(screen.getByText(/All 12 tests passed\./i)).toBeInTheDocument();
    });
  });

  it('9. Honest reporting of test failure: captures actual non-zero exit code and marks task failed', async () => {
    vi.mocked(tauriService.runProjectCheck).mockResolvedValue({
      id: 'test',
      exitCode: 1,
      success: false,
      timedOut: false,
      cancelled: false,
      output: 'FAIL src/auth.test.ts: Expected true to be false',
    });

    await renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/npm test/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Review and Run/i }));
    fireEvent.click(screen.getByRole('button', { name: /I approve this run/i }));

    await waitFor(() => {
      expect(screen.getByText(/Exit Code: 1 · Failed/i)).toBeInTheDocument();
      expect(screen.getByText(/FAIL src\/auth\.test\.ts/i)).toBeInTheDocument();
      expect(screen.getByText(/STATUS: FAILED/i)).toBeInTheDocument();
      expect(screen.getByText(/Task completed file modifications, but validation checks reported failures/i)).toBeInTheDocument();
    });
  });

  it('10. Task cancellation and reset: aborts active task and clears state cleanly', async () => {
    await renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Select Project Folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/E:\\SafeWorkspace/i)).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/Agent Task Description/i);
    fireEvent.change(textarea, { target: { value: 'Audit dependencies' } });

    fireEvent.click(screen.getByRole('button', { name: /Generate Implementation Plan/i }));
    expect(screen.getByText(/STATUS: PLANNED/i)).toBeInTheDocument();

    // Click Reset
    fireEvent.click(screen.getByRole('button', { name: /Reset/i }));

    // Cockpit should be reset to idle
    expect(screen.getByText(/STATUS: IDLE/i)).toBeInTheDocument();
    expect(screen.queryByText(/Structured Plan of Action/i)).not.toBeInTheDocument();
  });
});
