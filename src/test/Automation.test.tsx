import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutomationAgentsScreen } from '../screens/AutomationAgentsScreen';
import { WindowsAutomationCockpit } from '../components/automation/WindowsAutomationCockpit';
import { AppProvider } from '../store/AppContext';
import * as tauriService from '../services/tauri';
import {
  AutomationCapabilities,
  AutomationActionRequest,
  AutomationAuditEntry,
} from '../types';

describe('Phase 3 — Stage 3.5: Permission-Based Windows PC Automation Suite', () => {
  const mockCapabilities: AutomationCapabilities = {
    canLaunchApprovedApps: true,
    canInspectWindows: true,
    canOpenWorkspacePath: true,
    canManageClipboard: true,
    approvedApps: [
      {
        id: 'notepad',
        displayName: 'Notepad',
        executable: 'notepad.exe',
        description: 'Windows text editor for viewing and editing approved workspace documents.',
        category: 'Editor',
      },
      {
        id: 'calc',
        displayName: 'Calculator',
        executable: 'calc.exe',
        description: 'Standard Windows calculator for utility arithmetic and validation.',
        category: 'Utility',
      },
      {
        id: 'paint',
        displayName: 'Paint',
        executable: 'mspaint.exe',
        description: 'Windows image viewer and bitmap editor for inspecting visual assets.',
        category: 'Graphics',
      },
      {
        id: 'explorer',
        displayName: 'File Explorer',
        executable: 'explorer.exe',
        description: 'Windows File Explorer strictly scoped to approved workspace paths.',
        category: 'System',
      },
    ],
    auditLogCount: 1,
    securityNotice: 'All automated Windows actions are bounded by strict human-in-the-loop authorization.',
  };

  const mockAuditLogs: AutomationAuditEntry[] = [
    {
      id: 'audit-1001',
      actionType: 'open_workspace_path',
      target: 'E:/LodhiAI-Windows',
      permissionDecision: 'user_approved',
      success: true,
      durationMs: 45,
      timestamp: Date.now() - 60000,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(tauriService, 'getAutomationCapabilities').mockResolvedValue(mockCapabilities);
    vi.spyOn(tauriService, 'getAutomationAuditLog').mockResolvedValue(mockAuditLogs);
  });

  it('renders Windows PC Automation cockpit and displays allowlisted applications', async () => {
    render(
      <AppProvider>
        <WindowsAutomationCockpit />
      </AppProvider>
    );

    expect(screen.getByText(/Permission-Based Windows Automation/i)).toBeInTheDocument();
    expect(screen.getByText(/Allowlisted Windows Applications/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Notepad')).toBeInTheDocument();
      expect(screen.getByText('Calculator')).toBeInTheDocument();
      expect(screen.getByText('File Explorer')).toBeInTheDocument();
      expect(screen.getByText('mspaint.exe')).toBeInTheDocument();
    });
  });

  it('switches to Windows PC Automation tab from Developer Agent screen', async () => {
    render(
      <AppProvider>
        <AutomationAgentsScreen />
      </AppProvider>
    );

    const winTab = screen.getByRole('button', { name: /Windows PC Automation/i });
    expect(winTab).toBeInTheDocument();
    fireEvent.click(winTab);

    await waitFor(() => {
      expect(screen.getByText(/Allowlisted Windows Applications/i)).toBeInTheDocument();
      expect(screen.getByText(/Reveal in Windows Explorer/i)).toBeInTheDocument();
    });
  });

  it('inspects active desktop windows and renders process list', async () => {
    const mockWindowInspectOutput = JSON.stringify([
      {
        pid: 1420,
        processName: 'notepad.exe',
        windowTitle: 'Untitled - Notepad',
        isResponsive: true,
      },
      {
        pid: 2840,
        processName: 'code.exe',
        windowTitle: 'LodhiAI-Windows - Visual Studio Code',
        isResponsive: true,
      },
    ]);

    const previewSpy = vi.spyOn(tauriService, 'previewAutomationAction').mockResolvedValue({
      id: 'req-inspect-1',
      actionType: 'inspect_windows',
      description: 'Inspect active windows',
      target: 'active_desktop_windows',
      parameters: {},
      permissionLevel: 'safe',
      riskLevel: 'low',
      preview: 'Inspect active desktop windows',
      requiresConfirmation: false,
      status: 'pending',
      createdAt: Date.now(),
    });

    const executeSpy = vi.spyOn(tauriService, 'executeAutomationAction').mockResolvedValue({
      requestId: 'req-inspect-1',
      actionType: 'inspect_windows',
      success: true,
      output: mockWindowInspectOutput,
      executionTimeMs: 32,
    });

    render(
      <AppProvider>
        <WindowsAutomationCockpit />
      </AppProvider>
    );

    const inspectBtn = screen.getByRole('button', { name: /Inspect Windows/i });
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith('inspect_windows', {});
      expect(executeSpy).toHaveBeenCalled();
      expect(screen.getByText('Untitled - Notepad')).toBeInTheDocument();
      expect(screen.getByText(/PID: 1420/i)).toBeInTheDocument();
      expect(screen.getByText('LodhiAI-Windows - Visual Studio Code')).toBeInTheDocument();
    });
  });

  it('triggers action preview and requires human-in-the-loop authorization modal', async () => {
    const mockReq: AutomationActionRequest = {
      id: 'req-launch-99',
      actionType: 'launch_app',
      description: "Launch approved application 'notepad.exe'",
      target: 'notepad.exe',
      parameters: { app: 'notepad.exe', file: 'README.md' },
      permissionLevel: 'requiresApproval',
      riskLevel: 'medium',
      preview: "Launch allowlisted application 'notepad.exe' with workspace file 'README.md'",
      requiresConfirmation: true,
      status: 'pending',
      createdAt: Date.now(),
    };

    const previewSpy = vi.spyOn(tauriService, 'previewAutomationAction').mockResolvedValue(mockReq);
    const executeSpy = vi.spyOn(tauriService, 'executeAutomationAction').mockResolvedValue({
      requestId: 'req-launch-99',
      actionType: 'launch_app',
      success: true,
      output: "Approved application 'notepad.exe' launched successfully.",
      executionTimeMs: 50,
    });

    render(
      <AppProvider>
        <WindowsAutomationCockpit />
      </AppProvider>
    );

    const launchBtn = screen.getByRole('button', { name: /Launch App/i });
    fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith('launch_app', { app: 'notepad.exe', file: 'README.md' });
      // Modal should appear
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Authorize Windows Automation Action/i)).toBeInTheDocument();
      expect(screen.getByText(/MEDIUM RISK/i)).toBeInTheDocument();
      expect(screen.getByText(/Launch allowlisted application 'notepad.exe' with workspace file 'README.md'/i)).toBeInTheDocument();
    });

    // Authorize & Execute
    const authBtn = screen.getByRole('button', { name: /Authorize & Execute/i });
    fireEvent.click(authBtn);

    await waitFor(() => {
      expect(executeSpy).toHaveBeenCalledWith(mockReq, true);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('handles user denial in confirmation modal and blocks action execution', async () => {
    const mockReq: AutomationActionRequest = {
      id: 'req-explorer-42',
      actionType: 'open_workspace_path',
      description: 'Reveal path in Windows Explorer',
      target: 'E:/LodhiAI-Windows',
      parameters: { path: '.' },
      permissionLevel: 'requiresApproval',
      riskLevel: 'low',
      preview: "Reveal '.' in Windows File Explorer",
      requiresConfirmation: true,
      status: 'pending',
      createdAt: Date.now(),
    };

    vi.spyOn(tauriService, 'previewAutomationAction').mockResolvedValue(mockReq);
    const executeSpy = vi.spyOn(tauriService, 'executeAutomationAction').mockResolvedValue({
      requestId: 'req-explorer-42',
      actionType: 'open_workspace_path',
      success: false,
      output: '',
      executionTimeMs: 10,
      error: 'Action blocked: explicit human authorization was not provided.',
    });

    render(
      <AppProvider>
        <WindowsAutomationCockpit />
      </AppProvider>
    );

    const openBtn = screen.getByRole('button', { name: /Open Folder/i });
    fireEvent.click(openBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const denyBtn = screen.getByRole('button', { name: /Deny & Cancel/i });
    fireEvent.click(denyBtn);

    await waitFor(() => {
      expect(executeSpy).toHaveBeenCalledWith(mockReq, false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('clears audit trail when Clear Audit Trail is clicked', async () => {
    const clearSpy = vi.spyOn(tauriService, 'clearAutomationAuditLog').mockResolvedValue();

    render(
      <AppProvider>
        <WindowsAutomationCockpit />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('open_workspace_path')).toBeInTheDocument();
      expect(screen.getByText('USER APPROVED')).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole('button', { name: /Clear Audit Trail/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalled();
      expect(screen.getByText(/No audit records yet/i)).toBeInTheDocument();
    });
  });
});
