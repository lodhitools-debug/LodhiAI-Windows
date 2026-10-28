import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  Folder,
  FolderOpen,
  FolderSearch,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
  Save,
  Search,
  MessageSquare,
  Sparkles,
  Lock,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import {
  analyzeProjectFiles,
  applyCodeProposal,
  chooseProjectFolder,
  discardCodeProposal,
  getProjectTree,
  listOllamaModels,
  readProjectFiles,
  saveProjectFile,
  searchProjectContent,
  type CodeProposal,
  type ProjectEntry,
  type ProjectFile,
  type ProjectSearchMatch,
  type ProjectTree,
} from '../services/tauri';

const FILE_LIMIT = 256 * 1024;
const CONTEXT_LIMIT = 24_000;
const panel: React.CSSProperties = {
  background: '#070b14',
  border: '1px solid rgba(255,255,255,.09)',
  borderRadius: 8,
  padding: 12,
  minHeight: 220,
  overflow: 'auto',
};

export const ProjectWorkspaceScreen: React.FC = () => {
  const { settings, openWorkspaceInChat, openWorkspaceInAgent, setActiveScreen } = useApp();
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProjectFile | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [proposal, setProposal] = useState<CodeProposal | null>(null);
  const [instruction, setInstruction] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filename & Content Search States
  const [activeTab, setActiveTab] = useState<'files' | 'search'>('files');
  const [filenameFilter, setFilenameFilter] = useState('');
  const [contentQuery, setContentQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchResults, setSearchResults] = useState<ProjectSearchMatch[]>([]);
  const [isSearchingContent, setIsSearchingContent] = useState(false);

  // Unsaved changes confirmation modal
  const [pendingSwitchPath, setPendingSwitchPath] = useState<ProjectEntry | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // Cloud consent check modal
  const [showCloudConsentModal, setShowCloudConsentModal] = useState(false);
  const [pendingCloudPrompt, setPendingCloudPrompt] = useState<string>('');

  const isDirty = useMemo(() => {
    if (!preview) return false;
    return editorContent !== preview.content;
  }, [preview, editorContent]);

  // Synchronize editorContent when preview changes
  useEffect(() => {
    if (preview) {
      setEditorContent(preview.content);
    } else {
      setEditorContent('');
    }
  }, [preview]);

  // Keyboard shortcut Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (selected && isDirty && !busy) {
          void handleSaveFile();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, isDirty, busy, editorContent]);

  // Load existing project tree on mount if available
  useEffect(() => {
    void (async () => {
      try {
        const initial = await getProjectTree(FILE_LIMIT);
        if (initial && initial.root) {
          setTree(initial);
        }
      } catch {
        // Safe fallback if no project active yet
      }
    })();
  }, []);

  const rows = useMemo(() => {
    if (!tree) return [];
    const filter = filenameFilter.trim().toLowerCase();

    const byParent = new Map<string, ProjectEntry[]>();
    for (const entry of tree.entries) {
      const parent = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';
      byParent.set(parent, [...(byParent.get(parent) || []), entry]);
    }
    for (const entries of byParent.values()) {
      entries.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
    }

    const result: Array<{ entry: ProjectEntry; depth: number }> = [];
    const visit = (parent: string, depth: number) => {
      for (const entry of byParent.get(parent) || []) {
        if (filter) {
          // When filtering, show matching files and their parents
          const matches = entry.name.toLowerCase().includes(filter);
          const hasMatchingDescendant = entry.isDirectory && tree.entries.some(
            child => child.path.startsWith(`${entry.path}/`) && child.name.toLowerCase().includes(filter)
          );
          if (matches || hasMatchingDescendant) {
            result.push({ entry, depth });
            if (entry.isDirectory) {
              visit(entry.path, depth + 1);
            }
          }
        } else {
          result.push({ entry, depth });
          if (entry.isDirectory && expanded.has(entry.path)) {
            visit(entry.path, depth + 1);
          }
        }
      }
    };
    visit('', 0);
    return result;
  }, [tree, expanded, filenameFilter]);

  const refreshTree = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setTree(await getProjectTree(FILE_LIMIT));
      setPreview(null);
      setSelected(null);
      setProposal(null);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const selectFolder = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    setProposal(null);
    try {
      const root = await chooseProjectFolder();
      if (!root) return;
      const next = await getProjectTree(FILE_LIMIT);
      if (next.root.replace(/\\/g, '/').toLowerCase() !== root.replace(/\\/g, '/').toLowerCase()) {
        throw new Error('Selected project changed during scan. Select the folder again.');
      }
      setTree(next);
      setPreview(null);
      setSelected(null);
      setExpanded(new Set());
      setSearchResults([]);
    } catch (cause) {
      setTree(null);
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async (entry: ProjectEntry) => {
    if (entry.excludedReason) return;
    if (entry.isDirectory) {
      setExpanded(current => {
        const next = new Set(current);
        next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path);
        return next;
      });
      return;
    }
    if (!entry.selectable) return;

    // Check if user has unsaved changes before switching
    if (isDirty && selected && selected !== entry.path) {
      setPendingSwitchPath(entry);
      setShowUnsavedModal(true);
      return;
    }

    await loadFileContent(entry.path);
  };

  const loadFileContent = async (path: string) => {
    setSelected(path);
    setPreview(null);
    setError('');
    setNotice('');
    setProposal(null);
    setBusy(true);
    try {
      const files = await readProjectFiles([path], FILE_LIMIT, CONTEXT_LIMIT);
      setPreview(files[0] || null);
      if (!files.length) setError('Selected file returned no readable text.');
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSwitchDiscard = async () => {
    setShowUnsavedModal(false);
    if (pendingSwitchPath) {
      const target = pendingSwitchPath;
      setPendingSwitchPath(null);
      await loadFileContent(target.path);
    }
  };

  const handleSaveFile = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await saveProjectFile(selected, editorContent);
      setNotice(res);
      if (preview) {
        setPreview({ ...preview, content: editorContent, sizeBytes: editorContent.length });
      }
    } catch (cause) {
      setError(`Failed to save file: ${String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSearchContent = async () => {
    const q = contentQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setIsSearchingContent(true);
    setError('');
    try {
      const matches = await searchProjectContent(q, caseSensitive, 50);
      setSearchResults(matches);
      if (matches.length === 0) {
        setNotice(`No matching occurrences found for “${q}”.`);
      }
    } catch (cause) {
      setError(`Search failed: ${String(cause)}`);
    } finally {
      setIsSearchingContent(false);
    }
  };

  const handleOpenSearchResult = async (match: ProjectSearchMatch) => {
    if (isDirty && selected && selected !== match.path) {
      setPendingSwitchPath({
        path: match.path,
        name: match.path.split('/').pop() || match.path,
        isDirectory: false,
        sizeBytes: null,
        selectable: true,
        excludedReason: null,
      });
      setShowUnsavedModal(true);
      return;
    }
    await loadFileContent(match.path);
  };

  const connect = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const available = await listOllamaModels(settings.customOllamaUrl);
      setModels(available);
      if (!available.includes(settings.ollamaModel)) {
        setError(`Model “${settings.ollamaModel}” is not available at ${settings.customOllamaUrl}. Open Model Providers to select an installed local model.`);
      } else {
        setNotice(`Connected to local Ollama. Model ${settings.ollamaModel} is ready.`);
      }
    } catch (cause) {
      setModels([]);
      setError(`Could not connect to local Ollama at ${settings.customOllamaUrl}. Start Ollama and check Model Providers. ${String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const askModel = async () => {
    const prompt = instruction.trim();
    if (!prompt) {
      setError('Describe the requested file change first.');
      return;
    }
    if (!preview || !selected) {
      setError('Select a readable file before asking for a change.');
      return;
    }

    // Check Cloud Egress Consent if provider is Gemini
    if (settings.activeProvider === 'gemini' && !settings.geminiConsentGiven) {
      setPendingCloudPrompt(prompt);
      setShowCloudConsentModal(true);
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    setProposal(null);
    try {
      const available = models.length ? models : await listOllamaModels(settings.customOllamaUrl);
      setModels(available);
      if (!available.includes(settings.ollamaModel)) {
        throw new Error(`Model “${settings.ollamaModel}” is not installed at the configured local Ollama endpoint.`);
      }
      const result = await analyzeProjectFiles({
        endpoint: settings.customOllamaUrl,
        model: settings.ollamaModel,
        task: 'Make the requested focused code change.',
        prompt,
        paths: [selected],
        maxFileBytes: FILE_LIMIT,
        maxContextChars: CONTEXT_LIMIT,
      });
      setProposal(result);
      if (!result.files.length) {
        setNotice(result.summary || 'The model proposed no file changes. Nothing was written.');
      }
    } catch (cause) {
      setError(`Could not create a reviewable proposal. Confirm Ollama is running, the selected model is installed, and the request is valid. ${String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSendToChat = async (presetPrompt?: string) => {
    if (!preview || !selected || !tree) return;
    const prompt = presetPrompt || instruction.trim() || `Please explain the implementation, architecture, and exported functions of ${selected}.`;

    // Guard against cloud transmission without explicit consent
    if (settings.activeProvider === 'gemini' && !settings.geminiConsentGiven) {
      setPendingCloudPrompt(prompt);
      setShowCloudConsentModal(true);
      return;
    }

    await openWorkspaceInChat(rootName, selected, editorContent || preview.content, prompt);
  };

  const discard = async () => {
    if (!proposal) return;
    setBusy(true);
    setError('');
    try {
      if (proposal.files.length) await discardCodeProposal(proposal.id);
      setProposal(null);
      setInstruction('');
      setNotice('Proposal discarded. No project files were changed.');
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const cancelReview = async () => {
    if (!proposal) return;
    setBusy(true);
    setError('');
    try {
      if (proposal.files.length) await discardCodeProposal(proposal.id);
      setProposal(null);
      setNotice('Review cancelled. No project files were changed; your instruction is still available to edit.');
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!proposal?.files.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await applyCodeProposal(proposal.id, true);
      setNotice(result);
      setProposal(null);
      const updated = await getProjectTree(FILE_LIMIT);
      setTree(updated);
      if (selected) {
        const files = await readProjectFiles([selected], FILE_LIMIT, CONTEXT_LIMIT);
        setPreview(files[0] || null);
        if (files[0]) setEditorContent(files[0].content);
      }
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const rootName = tree?.root.split(/[\\/]/).filter(Boolean).at(-1) || '';
  const currentChars = (editorContent || preview?.content || '').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1380, width: '100%', margin: '0 auto' }}>
      {/* Workspace Header Card */}
      <Card
        title="Project Workspace"
        subtitle="Local project inspection, safe file editing, and AI-proposed edits with explicit approval"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge variant="teal" dot>Project boundary protected</Badge>
            <Badge variant="neutral">E:\LodhiAI isolation enforced</Badge>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button icon={<FolderSearch size={15} />} onClick={() => void selectFolder()} loading={busy}>
            Select project folder
          </Button>
          <Button variant="outline" icon={<RefreshCw size={14} />} onClick={() => void refreshTree()} disabled={!tree || busy}>
            Retry scan
          </Button>
          <Button variant="outline" icon={<ShieldCheck size={14} />} onClick={() => void connect()} loading={busy}>
            Check local model
          </Button>
          <Badge variant={models.includes(settings.ollamaModel) ? 'emerald' : 'neutral'} dot>
            {models.includes(settings.ollamaModel) ? `Connected · ${settings.ollamaModel}` : 'Ollama not checked'}
          </Badge>
        </div>

        {tree && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, border: '1px solid rgba(56,189,248,.25)', background: 'rgba(7,11,20,.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <strong style={{ fontSize: 14, color: '#f8fafc' }}>{rootName}</strong>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, wordBreak: 'break-all' }}>{tree.root}</div>
              {tree.truncated && (
                <p role="status" style={{ color: '#fbbf24', fontSize: 12, marginTop: 4 }}>
                  File listing reached the safe scan limit; some entries may not be shown.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Total indexed entries: <strong style={{ color: '#cbd5e1' }}>{tree.entries.length}</strong>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Notice / Alert banner */}
      {(error || notice) && (
        <div
          role={error ? 'alert' : 'status'}
          style={{
            padding: 12,
            borderRadius: 8,
            background: error ? 'rgba(127,29,29,.25)' : 'rgba(13,80,70,.25)',
            border: `1px solid ${error ? 'rgba(248,113,113,.35)' : 'rgba(45,212,191,.35)'}`,
            color: error ? '#fca5a5' : '#99f6e4',
            fontSize: 13,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          {error ? <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> : <Check size={16} style={{ flexShrink: 0, marginTop: 2 }} />}
          <span>{error || notice}</span>
        </div>
      )}

      {/* Main Split Layout: Left File Explorer / Search & Right Editor */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(420px, 1.8fr)', gap: 16 }}>
        {/* Left Explorer Card */}
        <Card
          title="Project files"
          subtitle="Excluded and unsupported entries are shown by status; their contents are never previewed."
        >
          {/* Search Sub-Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 8 }}>
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              style={{
                background: activeTab === 'files' ? 'rgba(56,189,248,.15)' : 'transparent',
                color: activeTab === 'files' ? '#38bdf8' : '#94a3b8',
                border: 0,
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: activeTab === 'files' ? 600 : 400,
              }}
            >
              Files ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              style={{
                background: activeTab === 'search' ? 'rgba(56,189,248,.15)' : 'transparent',
                color: activeTab === 'search' ? '#38bdf8' : '#94a3b8',
                border: 0,
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: activeTab === 'search' ? 600 : 400,
              }}
            >
              Search Content
            </button>
          </div>

          {activeTab === 'files' ? (
            <>
              {/* Filename Filter Input */}
              {tree && (
                <div style={{ marginBottom: 10, position: 'relative' }}>
                  <input
                    type="text"
                    value={filenameFilter}
                    onChange={e => setFilenameFilter(e.target.value)}
                    placeholder="Filter filenames..."
                    aria-label="Filter filenames"
                    style={{
                      width: '100%',
                      background: '#070b14',
                      border: '1px solid rgba(255,255,255,.12)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12,
                      color: '#f8fafc',
                    }}
                  />
                  {filenameFilter && (
                    <button
                      type="button"
                      onClick={() => setFilenameFilter('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {!tree ? (
                <div style={{ ...panel, display: 'grid', placeItems: 'center', color: '#94a3b8', textAlign: 'center' }}>
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" /> Scanning project…
                    </>
                  ) : error ? (
                    'Project scan failed. Select the folder again or retry.'
                  ) : (
                    'Select a project folder to browse its files.'
                  )}
                </div>
              ) : rows.length === 0 ? (
                <div style={{ ...panel, color: '#94a3b8' }}>This project has no entries to display.</div>
              ) : (
                <div role="tree" aria-label="Project file tree" style={{ ...panel, padding: 6, minHeight: 380, maxHeight: 540 }}>
                  {rows.map(({ entry, depth }) => (
                    <button
                      type="button"
                      role="treeitem"
                      aria-expanded={entry.isDirectory ? expanded.has(entry.path) : undefined}
                      key={entry.path}
                      onClick={() => void chooseFile(entry)}
                      disabled={busy || !!entry.excludedReason || (!entry.isDirectory && !entry.selectable)}
                      title={entry.excludedReason || entry.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        gap: 6,
                        padding: '6px 7px',
                        paddingLeft: 7 + depth * 16,
                        border: 0,
                        borderRadius: 5,
                        textAlign: 'left',
                        background: selected === entry.path ? 'rgba(56,189,248,.14)' : 'transparent',
                        color: !entry.excludedReason && (entry.selectable || entry.isDirectory) ? '#cbd5e1' : '#64748b',
                        cursor: !entry.excludedReason && (entry.selectable || entry.isDirectory) ? 'pointer' : 'not-allowed',
                        fontSize: 12,
                      }}
                    >
                      {entry.isDirectory ? (
                        expanded.has(entry.path) ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                      ) : (
                        <span style={{ width: 13 }} />
                      )}
                      {entry.isDirectory ? (
                        expanded.has(entry.path) ? <FolderOpen size={14} color="#38bdf8" /> : <Folder size={14} color="#38bdf8" />
                      ) : entry.selectable ? (
                        <FileCode2 size={14} color={selected === entry.path ? '#38bdf8' : '#94a3b8'} />
                      ) : (
                        <File size={14} />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {entry.name}
                      </span>
                      {entry.excludedReason && (
                        <span style={{ color: '#fbbf24', fontSize: 10, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.excludedReason}
                        </span>
                      )}
                      {!entry.excludedReason && !entry.isDirectory && !entry.selectable && (
                        <span style={{ color: '#fbbf24', fontSize: 10 }}>Unavailable</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Search Content Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={contentQuery}
                  onChange={e => setContentQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void handleSearchContent(); }}
                  placeholder="Search code text / symbols..."
                  aria-label="Search code text"
                  style={{
                    flex: 1,
                    background: '#070b14',
                    border: '1px solid rgba(255,255,255,.12)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: 12,
                    color: '#f8fafc',
                  }}
                />
                <Button
                  size="sm"
                  icon={<Search size={13} />}
                  onClick={() => void handleSearchContent()}
                  loading={isSearchingContent}
                  disabled={!contentQuery.trim()}
                >
                  Search
                </Button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                <input
                  type="checkbox"
                  id="caseSensitiveCheck"
                  checked={caseSensitive}
                  onChange={e => setCaseSensitive(e.target.checked)}
                />
                <label htmlFor="caseSensitiveCheck" style={{ cursor: 'pointer' }}>Match case</label>
              </div>

              <div style={{ ...panel, minHeight: 320, maxHeight: 480, padding: 6 }}>
                {isSearchingContent ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#94a3b8' }}>
                    <LoaderCircle className="spin" /> Searching project files…
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 12, padding: 12, textAlign: 'center' }}>
                    {contentQuery ? 'No matching occurrences found.' : 'Enter a query and press Search.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      Found {searchResults.length} match{searchResults.length === 1 ? '' : 'es'}
                    </div>
                    {searchResults.map((match, i) => (
                      <button
                        key={`${match.path}-${match.lineNumber}-${i}`}
                        type="button"
                        onClick={() => void handleOpenSearchResult(match)}
                        style={{
                          textAlign: 'left',
                          background: selected === match.path ? 'rgba(56,189,248,.12)' : 'transparent',
                          border: 0,
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#38bdf8' }}>
                          <span>{match.path}</span>
                          <span style={{ color: '#94a3b8' }}>L:{match.lineNumber}</span>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {match.lineContent}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Right Editor & AI Assistant Card */}
        <Card
          title={selected ? `Editor · ${selected}` : 'File preview'}
          subtitle={selected ? 'Edit text directly or generate reviewable AI proposals' : 'Read-only preview. File contents are sent only when you request a local model proposal.'}
          action={
            preview && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {isDirty && (
                  <Badge variant="amber" dot>
                    Unsaved edits
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant={isDirty ? 'primary' : 'outline'}
                  icon={<Save size={13} />}
                  onClick={() => void handleSaveFile()}
                  loading={busy}
                  disabled={!isDirty}
                  title="Save changes (Ctrl+S)"
                >
                  Save File
                </Button>
                {isDirty && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<RotateCcw size={13} />}
                    onClick={() => setEditorContent(preview.content)}
                    disabled={busy}
                    title="Revert to disk content"
                  >
                    Revert
                  </Button>
                )}
              </div>
            )
          }
        >
          {preview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* File stats bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#94a3b8', padding: '4px 8px', background: 'rgba(255,255,255,.03)', borderRadius: 4 }}>
                <span>
                  Size: {(preview.sizeBytes / 1024).toFixed(1)} KB · Lines: {editorContent.split('\n').length}
                </span>
                <span>
                  Context Budget: {currentChars.toLocaleString()} / {CONTEXT_LIMIT.toLocaleString()} chars
                </span>
              </div>

              {/* Editable Code Box */}
              <textarea
                aria-label="Selected file preview"
                value={editorContent}
                onChange={e => setEditorContent(e.target.value)}
                rows={16}
                style={{
                  ...panel,
                  width: '100%',
                  minHeight: 280,
                  maxHeight: 460,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 12,
                  color: '#e2e8f0',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />

              {/* Ask AI Context Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, padding: 12, background: 'rgba(15,23,42,.6)', borderRadius: 8, border: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="workspace-change-instruction" style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} color="#38bdf8" />
                    <span>Ask AI Assistant with Selected File Context</span>
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<MessageSquare size={13} />}
                      onClick={() => void handleSendToChat()}
                      disabled={busy}
                      title="Send file context to AI Chat screen"
                    >
                      Open in AI Chat
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Sparkles size={13} />}
                      onClick={() => openWorkspaceInAgent(selected || undefined, instruction.trim() || (selected ? `Implement coding task for ${selected}` : 'Implement workspace coding task'))}
                      disabled={busy}
                      title="Send file context to AI Coding Agent screen"
                    >
                      Open in Coding Agent
                    </Button>
                  </div>
                </div>

                {/* Quick prompt templates */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => void handleSendToChat('Explain this file and summarize its architecture.')}
                    style={{ background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 4, color: '#bae6fd', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
                  >
                    Explain this file
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendToChat('Analyze this file for potential bugs, security flaws, or edge cases.')}
                    style={{ background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 4, color: '#bae6fd', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
                  >
                    Find likely bugs
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstruction('Refactor this file to improve clarity and type safety while preserving behavior.')}
                    style={{ background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 4, color: '#bae6fd', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
                  >
                    Suggest refactor
                  </button>
                </div>

                <textarea
                  id="workspace-change-instruction"
                  value={instruction}
                  onChange={event => setInstruction(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="Describe code changes to propose (e.g., 'Add input validation for empty strings')..."
                  aria-label="Describe the change for the selected file"
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    background: '#070b14',
                    color: '#f8fafc',
                    border: '1px solid rgba(255,255,255,.14)',
                    borderRadius: 7,
                    padding: 8,
                    font: 'inherit',
                    fontSize: 12,
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>
                    Active Provider: <strong style={{ color: '#cbd5e1' }}>{settings.activeProvider === 'gemini' ? `Google Gemini (${settings.geminiModel})` : `Ollama (${settings.ollamaModel})`}</strong>
                  </span>
                  <Button
                    icon={<Send size={14} />}
                    onClick={() => void askModel()}
                    loading={busy}
                    disabled={!instruction.trim() || !selected}
                  >
                    Generate proposal
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...panel, display: 'grid', placeItems: 'center', color: '#94a3b8', minHeight: 340 }}>
              {busy ? 'Reading selected file…' : 'Select a supported text file from the tree to preview it.'}
            </div>
          )}
        </Card>
      </div>

      {/* Recoverable Backups Guidance Card */}
      {tree && (
        <Card
          title="Automatic Recoverable Backups"
          subtitle="All approved file writes and editor saves automatically capture pre-modification backups."
          action={<Badge variant="teal" size="sm">Zero Data Loss</Badge>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#cbd5e1' }}>
            <p style={{ margin: 0 }}>
              Before any file modification is committed to disk, Lodhi AI creates an immutable snapshot of the original file inside:
            </p>
            <code style={{ background: '#0b1329', padding: '6px 10px', borderRadius: 6, color: '#7dd3fc', width: 'fit-content' }}>
              {tree.root}\.lodhi-ai-backups\&lt;timestamp&gt;\
            </code>
            <div style={{ display: 'flex', gap: 16, marginTop: 4, color: '#94a3b8', fontSize: 11 }}>
              <span>• Stored locally inside workspace</span>
              <span>• Preserves exact directory structure</span>
              <span>• Reversible without git or network access</span>
            </div>
          </div>
        </Card>
      )}

      {/* Review Proposed Change Card */}
      {proposal && (
        <Card
          title="Review proposed change"
          subtitle={`Model: ${proposal.model} · ${proposal.summary || 'Review the complete proposed content below.'}`}
          action={
            <Badge variant={proposal.files.length ? 'amber' : 'neutral'}>
              {proposal.files.length ? `${proposal.files.length} file(s) would change` : 'No changes proposed'}
            </Badge>
          }
        >
          {proposal.files.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No file will be written. Discard this response to clear it.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {proposal.files.map(file => (
                <section key={file.path} style={{ border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, padding: 10 }}>
                  <strong style={{ color: '#fbbf24', fontSize: 12 }}>Would change: {file.path}</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 5 }}>Original content</div>
                      <pre style={{ ...panel, minHeight: 100, maxHeight: 280, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#cbd5e1', fontSize: 11 }}>
                        {file.originalContent ?? '(New file)'}
                      </pre>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 5 }}>Proposed content</div>
                      <pre style={{ ...panel, minHeight: 100, maxHeight: 280, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#cbd5e1', fontSize: 11 }}>
                        {file.proposedContent}
                      </pre>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <Button icon={<Check size={14} />} onClick={() => void approve()} loading={busy} disabled={!proposal.files.length}>
              Approve and apply
            </Button>
            <Button variant="ghost" icon={<X size={14} />} onClick={() => void cancelReview()} disabled={busy}>
              Cancel review
            </Button>
            <Button variant="danger" icon={<X size={14} />} onClick={() => void discard()} disabled={busy}>
              Discard proposal
            </Button>
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, marginBottom: 0 }}>
            No change is written until you explicitly approve. Before writing, the backend rechecks project containment, exclusions, symlinks, file identity and contents, then creates a recoverable backup.
          </p>
        </Card>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#0b1120', border: '1px solid rgba(248,113,113,.4)', borderRadius: 10, padding: 20, maxWidth: 440, width: '90%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#f87171' }}>
              <AlertTriangle size={20} />
              <strong style={{ fontSize: 15 }}>Unsaved Changes</strong>
            </div>
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
              You have unsaved changes in <strong style={{ color: '#f8fafc' }}>{selected}</strong>. If you switch files now, your unsaved edits will be discarded.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowUnsavedModal(false)}>
                Keep Editing
              </Button>
              <Button variant="danger" size="sm" onClick={() => void handleConfirmSwitchDiscard()}>
                Discard & Switch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Egress Consent Modal */}
      {showCloudConsentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#0b1120', border: '1px solid rgba(168,85,247,.4)', borderRadius: 10, padding: 20, maxWidth: 480, width: '90%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#c084fc' }}>
              <Lock size={20} />
              <strong style={{ fontSize: 15 }}>Cloud Egress Consent Required</strong>
            </div>
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
              Google Gemini is configured as your active provider. Sending project code will transmit file contents to Google cloud servers.
            </p>
            {pendingCloudPrompt && (
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, fontSize: 12, color: '#cbd5e1' }}>
                <span style={{ color: '#94a3b8' }}>Requested Query: </span>&ldquo;{pendingCloudPrompt}&rdquo;
              </div>
            )}
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              To protect proprietary code, explicit consent is required. You can grant consent in Model Providers, or switch your active provider to Local Ollama for 100% on-device private processing.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowCloudConsentModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setShowCloudConsentModal(false);
                  setActiveScreen('models');
                }}
              >
                Open Model Providers
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
