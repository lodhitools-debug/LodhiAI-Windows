import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../store/AppContext';
import { ProjectWorkspaceScreen } from '../screens/ProjectWorkspaceScreen';
import {
  chooseProjectFolder,
  getProjectTree,
  readProjectFiles,
  saveProjectFile,
  searchProjectContent,
  analyzeProjectFiles,
  applyCodeProposal,
  discardCodeProposal,
  listOllamaModels,
  type ProjectTree,
} from '../services/tauri';

vi.mock('../services/tauri', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/tauri')>();
  return {
    ...actual,
    chooseProjectFolder: vi.fn(),
    getProjectTree: vi.fn(),
    readProjectFiles: vi.fn(),
    saveProjectFile: vi.fn(),
    searchProjectContent: vi.fn(),
    analyzeProjectFiles: vi.fn(),
    applyCodeProposal: vi.fn(),
    discardCodeProposal: vi.fn(),
    listOllamaModels: vi.fn(),
  };
});

async function renderWorkspace() {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <AppProvider>
        <ProjectWorkspaceScreen />
      </AppProvider>
    );
  });
  return result;
}

const mockTree: ProjectTree = {
  root: 'E:\\LodhiAI-Windows',
  entries: [
    {
      name: 'Cargo.toml',
      path: 'Cargo.toml',
      isDirectory: false,
      sizeBytes: 450,
      selectable: true,
      excludedReason: null,
    },
    {
      name: 'src',
      path: 'src',
      isDirectory: true,
      sizeBytes: null,
      selectable: false,
      excludedReason: null,
    },
    {
      name: 'App.tsx',
      path: 'src/App.tsx',
      isDirectory: false,
      sizeBytes: 1024,
      selectable: true,
      excludedReason: null,
    },
    {
      name: 'main.tsx',
      path: 'src/main.tsx',
      isDirectory: false,
      sizeBytes: 512,
      selectable: true,
      excludedReason: null,
    },
  ],
  truncated: false,
};

describe('Phase 2 — Project Workspace & Safe File Operations', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(chooseProjectFolder).mockReset();
    vi.mocked(getProjectTree).mockReset();
    vi.mocked(readProjectFiles).mockReset();
    vi.mocked(saveProjectFile).mockReset();
    vi.mocked(searchProjectContent).mockReset();
    vi.mocked(analyzeProjectFiles).mockReset();
    vi.mocked(applyCodeProposal).mockReset();
    vi.mocked(discardCodeProposal).mockReset();
    vi.mocked(listOllamaModels).mockReset();

    vi.mocked(getProjectTree).mockResolvedValue(mockTree);
    vi.mocked(listOllamaModels).mockResolvedValue(['qwen2.5-coder:3b']);
  });

  it('renders Project Workspace with boundary protection badges and folder action', async () => {
    await renderWorkspace();

    expect(screen.getByRole('heading', { name: /Project Workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/Project boundary protected/i)).toBeInTheDocument();
    expect(screen.getByText(/E:\\LodhiAI isolation enforced/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Select project folder/i })).toBeInTheDocument();
  });
  it('allows opening a new project folder via native picker', async () => {
    await renderWorkspace();
    await screen.findByText('Cargo.toml');

    const newTree: ProjectTree = {
      root: 'E:\\NewProject',
      entries: [
        {
          name: 'index.ts',
          path: 'index.ts',
          isDirectory: false,
          sizeBytes: 100,
          selectable: true,
          excludedReason: null,
        },
      ],
      truncated: false,
    };

    vi.mocked(chooseProjectFolder).mockResolvedValue('E:\\NewProject');
    vi.mocked(getProjectTree).mockResolvedValue(newTree);

    const openBtn = screen.getByRole('button', { name: /Select project folder/i });
    await act(async () => {
      fireEvent.click(openBtn);
    });

    expect(chooseProjectFolder).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('NewProject')).toBeInTheDocument();
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });
  });

  it('displays project tree and loads file content into editor when clicked', async () => {
    vi.mocked(readProjectFiles).mockResolvedValue([
      {
        path: 'Cargo.toml',
        content: '[package]\nname = "lodhi-ai"\nversion = "0.1.0"',
        sizeBytes: 45,
      },
    ]);

    await renderWorkspace();

    const fileItem = await screen.findByText('Cargo.toml');
    await act(async () => {
      fireEvent.click(fileItem);
    });

    expect(readProjectFiles).toHaveBeenCalledWith(['Cargo.toml'], 256 * 1024, 24000);
    const textarea = await screen.findByDisplayValue(/name = "lodhi-ai"/);
    expect(textarea).toBeInTheDocument();
    expect(screen.getByText(/Context Budget: 45/i)).toBeInTheDocument();
    expect(screen.getByText(/Lines: 3/i)).toBeInTheDocument();
  });

  it('expands folder and displays nested files', async () => {
    await renderWorkspace();

    const folderBtn = await screen.findByText('src');
    await act(async () => {
      fireEvent.click(folderBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('main.tsx')).toBeInTheDocument();
    });
  });

  it('filters file list by filename search term', async () => {
    await renderWorkspace();

    const searchInput = screen.getByPlaceholderText(/Filter filenames/i);
    fireEvent.change(searchInput, { target: { value: 'Cargo' } });

    expect(await screen.findByText('Cargo.toml')).toBeInTheDocument();
    expect(screen.queryByText('main.tsx')).not.toBeInTheDocument();
  });

  it('supports content search and displays matched lines and snippets', async () => {
    vi.mocked(searchProjectContent).mockResolvedValue([
      {
        path: 'src/App.tsx',
        lineNumber: 2,
        lineContent: 'export function App() { return <div>Lodhi</div>; }',
      },
    ]);

    await renderWorkspace();

    // Switch to Search tab
    const searchTab = screen.getByRole('button', { name: /Search Content/i });
    fireEvent.click(searchTab);

    const queryInput = screen.getByPlaceholderText(/Search code text \/ symbols/i);
    fireEvent.change(queryInput, { target: { value: 'export function' } });

    const runSearchBtn = screen.getByRole('button', { name: /^Search$/i });
    await act(async () => {
      fireEvent.click(runSearchBtn);
    });

    expect(searchProjectContent).toHaveBeenCalledWith('export function', false, 50);
    await waitFor(() => {
      expect(screen.getByText('src/App.tsx')).toBeInTheDocument();
      expect(screen.getByText('L:2')).toBeInTheDocument();
      expect(screen.getByText(/export function App\(\)/)).toBeInTheDocument();
    });
  });

  it('shows dirty indicator when editing file, permits revert, and saves with backup', async () => {
    vi.mocked(readProjectFiles).mockResolvedValue([
      {
        path: 'Cargo.toml',
        content: 'version = "0.1.0"',
        sizeBytes: 17,
      },
    ]);
    vi.mocked(saveProjectFile).mockResolvedValue(
      'Successfully saved Cargo.toml (23 bytes). Backup created at .lodhi-ai-backups/2026-10-25_00-00-00/Cargo.toml'
    );

    await renderWorkspace();

    const fileItem = await screen.findByText('Cargo.toml');
    await act(async () => {
      fireEvent.click(fileItem);
    });

    const textarea = await screen.findByDisplayValue('version = "0.1.0"');
    fireEvent.change(textarea, { target: { value: 'version = "0.2.0"' } });

    // Verify dirty indicator appears
    expect(screen.getByText(/Unsaved edits/i)).toBeInTheDocument();

    // Save file
    const saveBtn = screen.getByRole('button', { name: /Save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(saveProjectFile).toHaveBeenCalledWith('Cargo.toml', 'version = "0.2.0"');
    await waitFor(() => {
      expect(screen.getByText(/Backup created/i)).toBeInTheDocument();
    });
  });

  it('shows unsaved changes confirmation modal when switching files while dirty', async () => {
    vi.mocked(readProjectFiles).mockImplementation(async paths => {
      if (paths[0] === 'Cargo.toml') {
        return [{ path: 'Cargo.toml', content: 'cargo content', sizeBytes: 13 }];
      }
      return [{ path: 'src/App.tsx', content: 'app content', sizeBytes: 11 }];
    });

    await renderWorkspace();

    // Select Cargo.toml
    const cargoFile = await screen.findByText('Cargo.toml');
    await act(async () => {
      fireEvent.click(cargoFile);
    });

    // Make edits
    const textarea = await screen.findByDisplayValue('cargo content');
    fireEvent.change(textarea, { target: { value: 'modified cargo content' } });
    expect(screen.getByText(/Unsaved edits/i)).toBeInTheDocument();

    // Expand src folder to reveal App.tsx
    const folder = screen.getByText('src');
    await act(async () => {
      fireEvent.click(folder);
    });
    const appFile = await screen.findByText('App.tsx');

    // Attempt to click App.tsx
    await act(async () => {
      fireEvent.click(appFile);
    });

    // Modal should appear
    expect(screen.getByText(/You have unsaved changes in/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keep Editing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discard & Switch/i })).toBeInTheDocument();

    // Clicking Keep Editing cancels switch
    fireEvent.click(screen.getByRole('button', { name: /Keep Editing/i }));
    expect(screen.queryByText(/You have unsaved changes in/i)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('modified cargo content')).toBeInTheDocument();

    // Clicking App.tsx again and choosing Discard & Switch
    await act(async () => {
      fireEvent.click(appFile);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Discard & Switch/i }));
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('app content')).toBeInTheDocument();
    });
  });

  it('generates an AI code proposal and allows reviewing diff before explicit approval', async () => {
    vi.mocked(readProjectFiles).mockResolvedValue([
      {
        path: 'Cargo.toml',
        content: 'name = "lodhi"',
        sizeBytes: 14,
      },
    ]);
    vi.mocked(analyzeProjectFiles).mockResolvedValue({
      id: 'prop-123',
      model: 'qwen2.5-coder:3b',
      summary: 'Update package name',
      files: [
        {
          path: 'Cargo.toml',
          originalContent: 'name = "lodhi"',
          proposedContent: 'name = "lodhi-ai"',
        },
      ],
    });
    vi.mocked(applyCodeProposal).mockResolvedValue('Applied changes to 1 file safely with backups.');

    await renderWorkspace();

    const fileItem = await screen.findByText('Cargo.toml');
    await act(async () => {
      fireEvent.click(fileItem);
    });

    // Wait for editor to appear
    await screen.findByDisplayValue('name = "lodhi"');

    const instructionBox = screen.getByPlaceholderText(/Describe code changes to propose/i);
    fireEvent.change(instructionBox, { target: { value: 'Rename package' } });

    const generateBtn = screen.getByRole('button', { name: /Generate proposal/i });
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    expect(analyzeProjectFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Rename package',
        paths: ['Cargo.toml'],
      })
    );

    // Verify Review Card appears with diff
    await waitFor(() => {
      expect(screen.getByText(/Review proposed change/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Approve and apply/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Discard proposal/i })).toBeInTheDocument();
    });

    // Approve the change
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Approve and apply/i }));
    });

    expect(applyCodeProposal).toHaveBeenCalledWith('prop-123', true);
  });

  it('allows discarding an AI code proposal safely with no file changes', async () => {
    vi.mocked(readProjectFiles).mockResolvedValue([
      {
        path: 'Cargo.toml',
        content: 'original code',
        sizeBytes: 13,
      },
    ]);
    vi.mocked(analyzeProjectFiles).mockResolvedValue({
      id: 'prop-456',
      model: 'qwen2.5-coder:3b',
      summary: 'Change something',
      files: [
        {
          path: 'Cargo.toml',
          originalContent: 'original code',
          proposedContent: 'original code\nadded',
        },
      ],
    });
    vi.mocked(discardCodeProposal).mockResolvedValue('Discarded proposal prop-456');

    await renderWorkspace();

    const fileItem = await screen.findByText('Cargo.toml');
    await act(async () => {
      fireEvent.click(fileItem);
    });

    // Wait for editor
    await screen.findByDisplayValue('original code');

    const instructionBox = screen.getByPlaceholderText(/Describe code changes to propose/i);
    fireEvent.change(instructionBox, { target: { value: 'change code' } });

    const generateBtn = screen.getByRole('button', { name: /Generate proposal/i });
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Review proposed change/i)).toBeInTheDocument();
    });

    // Discard
    const discardBtn = screen.getByRole('button', { name: /Discard proposal/i });
    await act(async () => {
      fireEvent.click(discardBtn);
    });

    expect(discardCodeProposal).toHaveBeenCalledWith('prop-456');
    await waitFor(() => {
      expect(screen.getByText(/Proposal discarded\. No project files were changed\./i)).toBeInTheDocument();
      expect(screen.queryByText(/Review proposed change/i)).not.toBeInTheDocument();
    });
  });

  it('protects proprietary code by showing Cloud Egress Consent modal if Gemini is active without consent', async () => {
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'gemini',
        geminiConsentGiven: false,
      })
    );

    vi.mocked(readProjectFiles).mockResolvedValue([
      {
        path: 'Cargo.toml',
        content: 'code',
        sizeBytes: 4,
      },
    ]);

    await renderWorkspace();

    const fileItem = await screen.findByText('Cargo.toml');
    await act(async () => {
      fireEvent.click(fileItem);
    });

    // Wait for file preview to load
    await screen.findByDisplayValue('code');

    // Attempt to Send to Chat
    const sendBtn = screen.getByRole('button', { name: /Open in AI Chat/i });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // Consent modal should block egress
    expect(screen.getByText(/Cloud Egress Consent Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Google Gemini is configured as your active provider/i)).toBeInTheDocument();
  });
});
