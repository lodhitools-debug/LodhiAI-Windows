import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutomationAgentsScreen } from '../screens/AutomationAgentsScreen';
import { AppProvider } from '../store/AppContext';
import * as tauriService from '../services/tauri';
import { ToolDefinition, AgentTask } from '../types';

describe('Phase 3 — Stage 3.1 & 3.2: Developer Agent & Tool Registry Suite', () => {
  const mockTools: ToolDefinition[] = [
    {
      name: 'workspace_tree',
      description: 'Lists all selectable files in the active project directory.',
      permissionLevel: 'readOnly',
      parametersSchema: {},
    },
    {
      name: 'workspace_apply_diff',
      description: 'Applies an approved file proposal to disk.',
      permissionLevel: 'requiresApproval',
      parametersSchema: {},
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(tauriService, 'listAvailableTools').mockResolvedValue(mockTools);
  });

  it('renders AutomationAgentsScreen and displays registered tools', async () => {
    render(
      <AppProvider>
        <AutomationAgentsScreen />
      </AppProvider>
    );

    expect(screen.getByText(/AI Developer Agent Cockpit/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Typed Tool Execution Registry/i).length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText('workspace_tree')).toBeInTheDocument();
      expect(screen.getByText('workspace_apply_diff')).toBeInTheDocument();
      expect(screen.getByText('Approval Req.')).toBeInTheDocument();
    });
  });

  it('creates an agent task and renders initial plan of action', async () => {
    const mockTask: AgentTask = {
      id: 'task-test-101',
      prompt: 'Audit project structure',
      status: 'planning',
      plan: [
        'Analyze prompt and inspect workspace files',
        'Formulate code fix or architecture proposal',
      ],
      steps: [
        {
          stepIndex: 1,
          thought: 'Scanning workspace tree',
          toolCall: { name: 'workspace_diagnostics', arguments: {} },
          toolResult: {
            toolName: 'workspace_diagnostics',
            status: 'success',
            output: { detectedLanguages: ['Rust', 'TypeScript'] },
            timestampMs: 1000,
          },
          timestampMs: 1000,
        },
      ],
      maxSteps: 10,
      createdAtMs: 1000,
      updatedAtMs: 1000,
    };

    vi.spyOn(tauriService, 'createAgentTask').mockResolvedValue(mockTask);
    vi.spyOn(tauriService, 'stepAgentTask').mockResolvedValue(mockTask);

    render(
      <AppProvider>
        <AutomationAgentsScreen />
      </AppProvider>
    );

    const textarea = screen.getByLabelText(/Agent Task Prompt/i);
    fireEvent.change(textarea, { target: { value: 'Audit project structure' } });

    const startBtn = screen.getByRole('button', { name: /Start Agent Task/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Task: task-test-101/i)).toBeInTheDocument();
      expect(screen.getByText(/Scanning workspace tree/i)).toBeInTheDocument();
      expect(screen.getByText(/Plan of Action:/i)).toBeInTheDocument();
      expect(screen.getByText(/Analyze prompt and inspect workspace files/i)).toBeInTheDocument();
    });
  });

  it('presents human authorization required modal when tool is privileged', async () => {
    const approvalTask: AgentTask = {
      id: 'task-test-approval',
      prompt: 'Write new configuration',
      status: 'awaitingApproval',
      plan: ['Stage changes', 'Apply diff'],
      steps: [
        {
          stepIndex: 1,
          thought: 'Staging configuration edit',
          toolCall: { name: 'workspace_propose_edit', arguments: { path: 'config.json' } },
          toolResult: { toolName: 'workspace_propose_edit', status: 'success', timestampMs: 1000 },
          timestampMs: 1000,
        },
      ],
      pendingApproval: {
        name: 'workspace_apply_diff',
        arguments: { proposalId: 'prop-789' },
      },
      maxSteps: 10,
      createdAtMs: 1000,
      updatedAtMs: 1000,
    };

    vi.spyOn(tauriService, 'createAgentTask').mockResolvedValue(approvalTask);
    vi.spyOn(tauriService, 'stepAgentTask').mockResolvedValue(approvalTask);

    render(
      <AppProvider>
        <AutomationAgentsScreen />
      </AppProvider>
    );

    const textarea = screen.getByLabelText(/Agent Task Prompt/i);
    fireEvent.change(textarea, { target: { value: 'Write new configuration' } });

    fireEvent.click(screen.getByRole('button', { name: /Start Agent Task/i }));

    await waitFor(() => {
      expect(screen.getByText(/Human Authorization Required/i)).toBeInTheDocument();
      expect(screen.getAllByText(/workspace_apply_diff/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /Approve Tool Action/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reject & Continue/i })).toBeInTheDocument();
    });
  });

  it('aborts active task and reflects aborted state when Abort Task is clicked', async () => {
    const runningTask: AgentTask = {
      id: 'task-test-running',
      prompt: 'Infinite loop task',
      status: 'executing',
      plan: ['Step 1'],
      steps: [],
      maxSteps: 10,
      createdAtMs: 1000,
      updatedAtMs: 1000,
    };

    vi.spyOn(tauriService, 'createAgentTask').mockResolvedValue(runningTask);
    vi.spyOn(tauriService, 'stepAgentTask').mockResolvedValue(runningTask);
    vi.spyOn(tauriService, 'abortAgentTask').mockResolvedValue(true);

    render(
      <AppProvider>
        <AutomationAgentsScreen />
      </AppProvider>
    );

    const textarea = screen.getByLabelText(/Agent Task Prompt/i);
    fireEvent.change(textarea, { target: { value: 'Infinite loop task' } });
    fireEvent.click(screen.getByRole('button', { name: /Start Agent Task/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Abort Task/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Abort Task/i }));

    await waitFor(() => {
      expect(screen.getByText(/ABORTED/i)).toBeInTheDocument();
      expect(screen.getByText(/Task was cancelled by user/i)).toBeInTheDocument();
    });
  });
});
