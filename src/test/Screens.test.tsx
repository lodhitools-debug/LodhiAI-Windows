import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../store/AppContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { CodingAssistantScreen } from '../screens/CodingAssistantScreen';
import { ProjectWorkspaceScreen } from '../screens/ProjectWorkspaceScreen';
import { AutomationAgentsScreen } from '../screens/AutomationAgentsScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { KnowledgeBaseScreen } from '../screens/KnowledgeBaseScreen';
import { ModelSettingsScreen } from '../screens/ModelSettingsScreen';
import { GeneralSettingsScreen } from '../screens/GeneralSettingsScreen';
import { DiagnosticsScreen } from '../screens/DiagnosticsScreen';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LoadingState } from '../components/common/LoadingState';
import { analyzeProjectFiles, applyCodeProposal, chatWithOllama, chatWithGemini, chooseProjectFolder, discardCodeProposal, getProjectTree, listOllamaModels, readProjectFiles } from '../services/tauri';

vi.mock('../services/tauri', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/tauri')>();
  return {
    ...actual,
    listOllamaModels: vi.fn(),
    chatWithOllama: vi.fn(),
    chatWithGemini: vi.fn(),
    chooseProjectFolder: vi.fn(),
    getProjectTree: vi.fn(),
    readProjectFiles: vi.fn(),
    analyzeProjectFiles: vi.fn(),
    applyCodeProposal: vi.fn(),
    discardCodeProposal: vi.fn(),
    listDocuments: vi.fn().mockResolvedValue([
      { id: '1', name: 'PRODUCT_ROADMAP.md', path: 'docs/PRODUCT_ROADMAP.md', size_bytes: 14500, content_hash: 'abc', chunk_count: 18, mime_type: 'text/markdown', collection_id: 'default', indexed_at_ms: Date.now() },
      { id: '2', name: 'ARCHITECTURE.md', path: 'docs/ARCHITECTURE.md', size_bytes: 28000, content_hash: 'def', chunk_count: 36, mime_type: 'text/markdown', collection_id: 'default', indexed_at_ms: Date.now() },
      { id: '3', name: 'SECURITY.md', path: 'docs/SECURITY.md', size_bytes: 18000, content_hash: 'ghi', chunk_count: 22, mime_type: 'text/markdown', collection_id: 'default', indexed_at_ms: Date.now() },
    ]),
  };
});

async function renderWithProvider(ui: Parameters<typeof render>[0]) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<AppProvider>{ui}</AppProvider>);
  });
  return result;
}

describe('Lodhi AI Screens & Quality Assurance Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(listOllamaModels).mockReset();
    vi.mocked(chatWithOllama).mockReset();
    vi.mocked(chatWithGemini).mockReset();
    vi.mocked(chooseProjectFolder).mockReset();
    vi.mocked(getProjectTree).mockReset();
    vi.mocked(readProjectFiles).mockReset();
    vi.mocked(analyzeProjectFiles).mockReset();
    vi.mocked(applyCodeProposal).mockReset();
    vi.mocked(discardCodeProposal).mockReset();
  });

  it('renders DashboardScreen with hero heading and 8GB RAM profile', async () => {
    await renderWithProvider(<DashboardScreen />);

    expect(screen.getByRole('heading', { level: 1, name: /Lodhi AI — Think • Create • Automate/i })).toBeInTheDocument();
    expect(screen.getAllByText(/8 GB RAM Target/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Zero Egress/i)).toBeInTheDocument();
  });

  it('renders CodingAssistantScreen and switches languages', async () => {
    await renderWithProvider(<CodingAssistantScreen />);

    expect(screen.getByText(/Autonomous Coding Assistant & AST Engine/i)).toBeInTheDocument();

    // Default language is Rust
    expect(screen.getByText(/check_desktop_safety/i)).toBeInTheDocument();

    // Switch to TypeScript
    fireEvent.click(screen.getByRole('button', { name: /^typescript$/i }));
    expect(screen.getByText(/verifyFilesystemAccess/i)).toBeInTheDocument();

    // Switch to Python
    fireEvent.click(screen.getByRole('button', { name: /^python$/i }));
    expect(screen.getByText(/query_local_ollama/i)).toBeInTheDocument();

    // Switch to Java
    fireEvent.click(screen.getByRole('button', { name: /^java$/i }));
    expect(screen.getByText(/Restricted sandbox execution/i)).toBeInTheDocument();
  });

  it('dispatches to chatWithGemini when cloud provider is active without contacting Ollama', async () => {
    vi.mocked(chatWithGemini).mockResolvedValue({
      model: 'gemini-1.5-flash',
      content: 'Here is Java code for your request.',
    });
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'gemini',
        geminiModel: 'gemini-1.5-flash',
        geminiConsentGiven: true,
      })
    );
    await renderWithProvider(<CodingAssistantScreen />);

    expect(screen.getByText(/Cloud Provider: Google Gemini/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Ask local AI/i }), {
      target: { value: 'Write a Java class for logging' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send to Gemini/i }));

    expect((await screen.findAllByText(/Here is Java code for your request/i)).length).toBeGreaterThan(0);
    expect(chatWithGemini).toHaveBeenCalled();
    expect(chatWithOllama).not.toHaveBeenCalled();
  });

  it('sends a nonempty coding-assistant chat to the local backend and shows its response', async () => {
    localStorage.setItem('lodhi_app_settings', JSON.stringify({ activeProvider: 'ollama', ollamaModel: 'qwen2.5-coder:3b' }));
    vi.mocked(listOllamaModels).mockResolvedValue(['qwen2.5-coder:3b']);
    vi.mocked(chatWithOllama).mockResolvedValue({ model: 'qwen2.5-coder:3b', content: 'Mocked local response for the UI test.' });
    await renderWithProvider(<CodingAssistantScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Check local model/i }));
    expect(await screen.findByText(/selected model available/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Ask local AI/i }), { target: { value: 'Explain a Rust ownership rule.' } });
    fireEvent.click(screen.getByRole('button', { name: /Send to local model/i }));

    expect((await screen.findAllByText(/Mocked local response for the UI test/i)).length).toBeGreaterThan(0);
    expect(chatWithOllama).toHaveBeenCalledWith('http://localhost:11434', 'qwen2.5-coder:3b', [
      { role: 'user', content: 'Explain a Rust ownership rule.' },
    ]);
  });

  it('renders ProjectWorkspaceScreen with an empty folder-selection state', async () => {
    await renderWithProvider(<ProjectWorkspaceScreen />);

    expect(screen.getByRole('heading', { name: /Project Workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/Select a project folder to browse its files/i)).toBeInTheDocument();
    expect(screen.getByText(/contents are never previewed/i)).toBeInTheDocument();
  });

  it('previews a permitted file, displays the proposal and writes only after explicit approval', async () => {
    const projectTree = { root: 'E:\\SafeProject', entries: [
      { path: 'src', name: 'src', isDirectory: true, sizeBytes: null, selectable: false, excludedReason: null },
      { path: 'src/main.ts', name: 'main.ts', isDirectory: false, sizeBytes: 12, selectable: true, excludedReason: null },
      { path: '.env', name: '.env', isDirectory: false, sizeBytes: null, selectable: false, excludedReason: 'Excluded secret file' },
    ], truncated: false };
    vi.mocked(chooseProjectFolder).mockResolvedValue('E:\\SafeProject');
    vi.mocked(getProjectTree).mockResolvedValue(projectTree);
    vi.mocked(readProjectFiles).mockResolvedValue([{ path: 'src/main.ts', content: 'const value = 1;\n', sizeBytes: 17 }]);
    vi.mocked(listOllamaModels).mockResolvedValue(['qwen2.5-coder:3b']);
    vi.mocked(analyzeProjectFiles).mockResolvedValue({ id: 'proposal-1', model: 'qwen2.5-coder:3b', summary: 'Add a value.', files: [{ path: 'src/main.ts', originalContent: 'const value = 1;\n', proposedContent: 'const value = 2;\n' }] });
    vi.mocked(applyCodeProposal).mockResolvedValue('Applied 1 approved file change(s).');
    await renderWithProvider(<ProjectWorkspaceScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Select project folder/i }));
    expect(await screen.findByText('SafeProject')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('treeitem', { name: /src/i }));
    fireEvent.click(await screen.findByRole('treeitem', { name: /main.ts/i }));
    expect(await screen.findByLabelText(/Selected file preview/i)).toHaveTextContent('const value = 1;');
    fireEvent.change(screen.getByLabelText(/Describe the change/i), { target: { value: 'Change the value to two.' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate proposal/i }));
    expect(await screen.findByText(/Would change: src\/main.ts/i)).toBeInTheDocument();
    expect(applyCodeProposal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Approve and apply/i }));
    await waitFor(() => expect(applyCodeProposal).toHaveBeenCalledWith('proposal-1', true));
  });

  it('discards a proposal without applying it', async () => {
    const projectTree = { root: 'E:\\SafeProject', entries: [{ path: 'main.ts', name: 'main.ts', isDirectory: false, sizeBytes: 10, selectable: true, excludedReason: null }], truncated: false };
    vi.mocked(chooseProjectFolder).mockResolvedValue('E:\\SafeProject');
    vi.mocked(getProjectTree).mockResolvedValue(projectTree);
    vi.mocked(readProjectFiles).mockResolvedValue([{ path: 'main.ts', content: 'let x = 1;\n', sizeBytes: 11 }]);
    vi.mocked(listOllamaModels).mockResolvedValue(['qwen2.5-coder:3b']);
    vi.mocked(analyzeProjectFiles).mockResolvedValue({ id: 'proposal-discard', model: 'qwen2.5-coder:3b', summary: 'Change x.', files: [{ path: 'main.ts', originalContent: 'let x = 1;\n', proposedContent: 'let x = 2;\n' }] });
    vi.mocked(discardCodeProposal).mockResolvedValue('Proposal discarded. No project files were changed.');
    await renderWithProvider(<ProjectWorkspaceScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Select project folder/i }));
    fireEvent.click(await screen.findByRole('treeitem', { name: /main.ts/i }));
    fireEvent.change(await screen.findByLabelText(/Describe the change/i), { target: { value: 'Change x.' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate proposal/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Discard proposal/i }));
    await waitFor(() => expect(discardCodeProposal).toHaveBeenCalledWith('proposal-discard'));
    expect(applyCodeProposal).not.toHaveBeenCalled();
  });

  it('renders AutomationAgentsScreen and security boundaries', async () => {
    await renderWithProvider(<AutomationAgentsScreen />);

    expect(screen.getByText(/Multi-Step Autonomous Background Agents/i)).toBeInTheDocument();
    expect(screen.getByText(/Security & Dependency Auditor/i)).toBeInTheDocument();
    expect(screen.getByText(/Unit Test Coverage Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Security Mandate:/i)).toBeInTheDocument();
  });

  it('renders DocumentsScreen and filters document list', async () => {
    await renderWithProvider(<DocumentsScreen />);

    expect(screen.getByText(/Local Document Ingestion & Vector Parsing/i)).toBeInTheDocument();
    expect(screen.getByText(/PRODUCT_ROADMAP.md/i)).toBeInTheDocument();
    expect(screen.getByText(/ARCHITECTURE.md/i)).toBeInTheDocument();

    // Filter by search
    const searchInput = screen.getByPlaceholderText(/Search documents.../i);
    fireEvent.change(searchInput, { target: { value: 'SECURITY' } });

    expect(screen.getByText(/SECURITY.md/i)).toBeInTheDocument();
    expect(screen.queryByText(/PRODUCT_ROADMAP.md/i)).not.toBeInTheDocument();
  });

  it('renders KnowledgeBaseScreen with embedded SQLite-vec specifications', async () => {
    await renderWithProvider(<KnowledgeBaseScreen />);

    expect(screen.getByText(/Local Vector Knowledge Base/i)).toBeInTheDocument();
    expect(screen.getAllByText(/SQLite-vec/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/nomic-embed-text/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Active Workspace Vector Store/i)).toBeInTheDocument();
  });

  it('renders ModelSettingsScreen and switches between local and cloud providers', async () => {
    await renderWithProvider(<ModelSettingsScreen />);

    // Initial tab: Local
    expect(screen.getByText(/Ollama Local Daemon/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/http:\/\/localhost:11434/i)).toBeInTheDocument();

    // Switch to Cloud Providers
    fireEvent.click(screen.getByRole('button', { name: /Cloud API Providers/i }));
    expect(screen.getByText(/Anthropic Claude/i)).toBeInTheDocument();
    expect(screen.getAllByText(/OpenAI/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cloud provider preview:/i)).toBeInTheDocument();

    // Switch to Inference Parameters
    fireEvent.click(screen.getByRole('button', { name: /Inference Parameters/i }));
    expect(screen.getByText(/Default Inference Parameters/i)).toBeInTheDocument();
  });

  it('discovers installed Ollama models and saves the selected local chat model', async () => {
    vi.mocked(listOllamaModels).mockResolvedValue(['phi3:mini', 'qwen2.5:3b']);
    await renderWithProvider(<ModelSettingsScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Check models/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Found 2 installed models/i);
    expect(listOllamaModels).toHaveBeenCalledWith('http://localhost:11434');

    fireEvent.change(screen.getByLabelText(/Chat model/i), { target: { value: 'phi3:mini' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Configuration/i }));
    expect(JSON.parse(localStorage.getItem('lodhi_app_settings') || '{}').ollamaModel).toBe('phi3:mini');
  });

  it('renders GeneralSettingsScreen and updates preferences', async () => {
    await renderWithProvider(<GeneralSettingsScreen />);

    expect(screen.getByText(/General Application Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy & Security Boundaries/i)).toBeInTheDocument();

    // Switch theme
    const themeSelect = screen.getByDisplayValue(/Dark Navy \(Official Lodhi AI\)/i);
    fireEvent.change(themeSelect, { target: { value: 'midnight' } });

    expect(screen.getByText(/Preferences Saved/i)).toBeInTheDocument();
  });

  it('renders DiagnosticsScreen and handles IPC ping trigger', async () => {
    await renderWithProvider(<DiagnosticsScreen />);

    expect(screen.getByText(/Diagnostics & System Telemetry/i)).toBeInTheDocument();

    // Trigger ping
    const pingBtn = screen.getByRole('button', { name: /Test Rust IPC Ping/i });
    await act(async () => {
      fireEvent.click(pingBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Pong from Lodhi AI/i).length).toBeGreaterThan(0);
    });
  });

  it('catches UI errors cleanly with ErrorBoundary and allows recovery', () => {
    const ProblematicChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Simulation of catastrophic component rendering failure');
      }
      return <div>Clean Component Rendered</div>;
    };

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary fallbackTitle="Custom Error Boundary Test">
        <ProblematicChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Custom Error Boundary Test/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulation of catastrophic component rendering failure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();

    // Rerender with clean state and click try again
    rerender(
      <ErrorBoundary fallbackTitle="Custom Error Boundary Test">
        <ProblematicChild shouldThrow={false} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    expect(screen.getByText(/Clean Component Rendered/i)).toBeInTheDocument();

    spy.mockRestore();
  });

  it('renders LoadingState with custom message and subtext', () => {
    render(
      <LoadingState
        message="Verifying Windows 8GB RAM Allocator..."
        subtext="Zero Egress Sandbox Active"
        size="lg"
      />
    );

    expect(screen.getByText('Verifying Windows 8GB RAM Allocator...')).toBeInTheDocument();
    expect(screen.getByText('Zero Egress Sandbox Active')).toBeInTheDocument();
  });

  it('safely queries listProjectChecks and handles empty checks without failing', async () => {
    const { listProjectChecks } = await import('../services/tauri');
    const checks = await listProjectChecks();
    expect(checks).toEqual([]);
  });
});
