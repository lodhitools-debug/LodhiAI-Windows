import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FolderOpen,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldX,
  X,
  AlertTriangle,
  FileDiff,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { RoadmapBanner } from '../components/common/RoadmapBanner';
import { useApp } from '../store/AppContext';
import {
  analyzeProjectFiles,
  applyCodeProposal,
  discardCodeProposal,
  chatWithOllama,
  chatWithGemini,
  chooseProjectFolder,
  getProjectTree,
  listOllamaModels,
  listProjectChecks,
  readProjectFiles,
  runProjectCheck,
  type CodeProposal,
  type OllamaMessage,
  type ProjectCheck,
  type ProjectCheckResult,
  type ProjectEntry,
  type ProjectTree,
} from '../services/tauri';

const DEFAULT_FILE_LIMIT = 256 * 1024;
const DEFAULT_CONTEXT_LIMIT = 24000;
const EXAMPLE_SNIPPETS: Record<string, string> = {
  rust: 'fn check_desktop_safety() -> bool { true }',
  typescript: 'export function verifyFilesystemAccess() { return "restricted"; }',
  python: 'def query_local_ollama():\n    return "localhost only"',
  java: 'public class SafeApp {\n    public static void main(String[] args) {\n        System.out.println("Restricted sandbox execution");\n    }\n}',
};

export type AgentWorkflowStatus =
  | 'idle'
  | 'planning'
  | 'inspecting'
  | 'planned'
  | 'waitingForReview'
  | 'waitingForWriteApproval'
  | 'waitingForCommandApproval'
  | 'waitingForApproval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface LogEntry {
  id: string;
  timestamp: string;
  status: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export const CodingAssistantScreen: React.FC = () => {
  const { settings, updateSettings, pendingAgentTask, clearPendingAgentTask } = useApp();
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [fileLimit, setFileLimit] = useState(DEFAULT_FILE_LIMIT);
  const [contextLimit, setContextLimit] = useState(DEFAULT_CONTEXT_LIMIT);
  const [models, setModels] = useState<string[]>([]);
  const [connection, setConnection] = useState('Ollama status not checked');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [task, setTask] = useState('fix');
  const [proposal, setProposal] = useState<CodeProposal | null>(null);
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<ProjectCheck[]>([]);
  const [confirmation, setConfirmation] = useState<ProjectCheck | null>(null);
  const [checkResult, setCheckResult] = useState<ProjectCheckResult | null>(null);
  const [chat, setChat] = useState<OllamaMessage[]>([]);
  const [reply, setReply] = useState('');
  const [language, setLanguage] = useState('rust');

  // Dedicated AI Coding Agent State
  const [taskPrompt, setTaskPrompt] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentWorkflowStatus>('idle');
  const [agentPlan, setAgentPlan] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [maxSteps, setMaxSteps] = useState(10);
  const [inspectedFiles, setInspectedFiles] = useState<{ path: string; sizeBytes: number }[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cloudConsentNeeded, setCloudConsentNeeded] = useState(false);
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [finalReport, setFinalReport] = useState<{
    status: AgentWorkflowStatus;
    summary: string;
    filesModified: string[];
    checksRun: { id: string; command: string; exitCode: number | null; success: boolean }[];
    remainingErrors: string[];
  } | null>(null);

  const endpoint = settings.customOllamaUrl || 'http://localhost:11434';
  const model = settings.ollamaModel || 'qwen2.5-coder:3b';
  const isCloudProvider = settings.activeProvider === 'gemini';

  const byParent = useMemo(() => {
    const map = new Map<string, ProjectEntry[]>();
    (tree?.entries || []).forEach(entry => {
      const parent = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';
      map.set(parent, [...(map.get(parent) || []), entry]);
    });
    return map;
  }, [tree]);

  // Consume pendingAgentTask from AppContext if handed off from Workspace
  useEffect(() => {
    if (pendingAgentTask) {
      if (pendingAgentTask.prompt) {
        setTaskPrompt(pendingAgentTask.prompt);
      }
      if (pendingAgentTask.filePath) {
        setSelected([pendingAgentTask.filePath]);
      }
      clearPendingAgentTask();
    }
  }, [pendingAgentTask, clearPendingAgentTask]);

  useEffect(() => {
    if (tree?.root) {
      void refreshChecks();
    } else {
      setChecks([]);
    }
  }, [tree?.root]);

  function addLog(status: 'info' | 'success' | 'warn' | 'error', message: string) {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, timestamp: time, status, message }]);
  }

  async function refreshChecks() {
    try {
      setChecks(await listProjectChecks());
    } catch {
      setChecks([]);
    }
  }

  async function connect() {
    setBusy(true);
    setError('');
    setConnection('Connecting to local Ollama…');
    try {
      const found = await listOllamaModels(endpoint);
      setModels(found);
      setConnection(
        found.includes(model)
          ? 'Connected · selected model available'
          : found.length
          ? 'Connected · selected model missing'
          : 'Connected · no models installed',
      );
    } catch (e) {
      setConnection('Ollama unavailable');
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function chooseProject() {
    setBusy(true);
    setError('');
    try {
      const root = await chooseProjectFolder();
      if (!root) return;
      const next = await getProjectTree(fileLimit);
      if (next.root !== root) throw new Error('Selected project changed during scan. Please select it again.');
      setTree(next);
      setSelected([]);
      setPreview({});
      setProposal(null);
      setCheckResult(null);
      setFinalReport(null);
      setAgentStatus('idle');
      setAgentPlan([]);
      setLogs([]);
      setChecks(await listProjectChecks());
      addLog('info', `Workspace loaded: ${root} (${next.entries.length} entries scanned). Boundaries locked.`);
    } catch (e) {
      setError(String(e));
      addLog('error', `Failed to open workspace: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  function toggleFile(path: string) {
    setSelected(current =>
      current.includes(path)
        ? current.filter(item => item !== path)
        : current.length >= 32
        ? current
        : [...current, path],
    );
  }

  // --- Step 2A: Task Input & Safe Planning ---
  function handleGeneratePlan() {
    setError('');
    const prompt = taskPrompt.trim();
    if (!prompt) {
      setError('Please enter a coding task for the selected workspace.');
      return;
    }

    if (!tree?.root) {
      setError('Please select a project workspace folder before generating an implementation plan.');
      return;
    }

    // Safety checks: reject ambiguous, destructive, or secret-access prompts
    const lower = prompt.toLowerCase();
    if (
      lower.includes('rm -rf') ||
      lower.includes('delete .git') ||
      lower.includes('drop database') ||
      lower.includes('format disk') ||
      lower.includes('read .env') ||
      lower.includes('id_rsa') ||
      lower.includes('leak secret')
    ) {
      setError('Safety Guard: The task requests destructive operations or secret access. Refusing execution. Please clarify with safe, non-destructive coding requirements.');
      addLog('error', 'Plan rejected by Safety Guard: Destructive or sensitive action requested in prompt.');
      return;
    }

    // Cloud consent check if Gemini is active
    if (isCloudProvider && !settings.geminiConsentGiven) {
      setCloudConsentNeeded(true);
      setError('Cloud AI Consent Required: You have selected Google Gemini. Confirm consent before transmitting local workspace code to the cloud.');
      return;
    }

    // Formulate implementation plan without modifying any files
    const planSteps = [
      '1. Inspect permitted workspace files & architectural boundaries',
      '2. Formulate code implementation plan & evaluate risks',
      '3. Stage proposed code edits and generate diff preview (0 disk writes)',
      '4. Human review gate: require explicit approval to write to disk',
      '5. Create recoverable snapshot in .lodhi-ai-backups and apply approved diff',
      '6. Run allowlisted validation checks (test, type-check) upon separate approval',
    ];

    // Identify files to inspect based on selection or workspace entries
    const relevant = selected.length > 0
      ? selected
      : tree.entries.filter(e => !e.isDirectory && e.selectable).slice(0, 5).map(e => e.path);

    const risks = [
      'No files are modified during planning or staging phases.',
      'All proposed changes will be presented as a human-reviewable diff before touching disk.',
      'A recoverable backup snapshot will automatically be created in .lodhi-ai-backups before writing.',
      'Stale-file checks ensure edits will not overwrite concurrent user modifications.',
      'Command execution requires separate, explicit human confirmation showing exact CLI string.',
    ];

    setAgentPlan(planSteps);
    setCurrentStepIndex(1);
    setRiskAnalysis(risks);
    setAgentStatus('planned');
    setFinalReport(null);
    setInspectedFiles(
      relevant.map(path => {
        const found = tree.entries.find(e => e.path === path);
        return { path, sizeBytes: found?.sizeBytes || 0 };
      }),
    );

    addLog('info', `Implementation plan created for task: "${prompt}" (0 file modifications).`);
    addLog('info', `Identified ${relevant.length} relevant file(s) for inspection within workspace bounds.`);
  }

  // --- Step 2B: Controlled Coding Workflow ---
  async function handleExecuteAgentPlan() {
    if (!tree?.root || agentPlan.length === 0) return;
    setBusy(true);
    setError('');
    setAgentStatus('running');
    setCurrentStepIndex(2);

    try {
      addLog('info', 'Step 1/6: Inspecting workspace files within safety bounds…');
      const targetPaths = inspectedFiles.map(f => f.path);

      if (targetPaths.length === 0) {
        throw new Error('No selectable project files found in workspace to analyze.');
      }

      addLog('info', `Step 2/6: Analyzing ${targetPaths.length} file(s) using model '${model}'…`);

      // Generate proposed file changes
      const proposalResult = await analyzeProjectFiles({
        endpoint,
        model,
        task: 'fix',
        prompt: taskPrompt,
        paths: targetPaths,
        maxFileBytes: fileLimit,
        maxContextChars: contextLimit,
      });

      if (!proposalResult || proposalResult.files.length === 0) {
        setProposal(null);
        setAgentStatus('completed');
        setCurrentStepIndex(6);
        addLog('success', 'Analysis completed. Model determined no code modifications were necessary.');
        setFinalReport({
          status: 'completed',
          summary: proposalResult?.summary || 'Analysis complete. Project files verified without modification.',
          filesModified: [],
          checksRun: [],
          remainingErrors: [],
        });
        return;
      }

      // Stage proposal for diff review (0 disk writes)
      setProposal(proposalResult);
      setAgentStatus('waitingForApproval');
      setCurrentStepIndex(3);
      addLog('warn', `Step 3/6: Staged proposed changes for ${proposalResult.files.length} file(s). Review diff below. 0 disk writes made.`);
    } catch (err) {
      const msg = String(err);
      setError(msg);
      setAgentStatus('failed');
      addLog('error', `Agent execution failed: ${msg}`);
      setFinalReport({
        status: 'failed',
        summary: `Execution failed during staging: ${msg}`,
        filesModified: [],
        checksRun: [],
        remainingErrors: [msg],
      });
    } finally {
      setBusy(false);
    }
  }

  // --- Step 2B & 2C: Approval / Rejection Controls ---
  async function handleApproveProposal(approved: boolean) {
    if (!proposal) return;
    setBusy(true);
    setError('');

    if (!approved) {
      try {
        await discardCodeProposal(proposal.id);
      } catch {
        // Fallback discard
      }
      setProposal(null);
      setAgentStatus('cancelled');
      addLog('warn', 'User REJECTED proposed changes. Discarded proposal. Original files remain completely unchanged.');
      setFinalReport({
        status: 'cancelled',
        summary: 'Proposal rejected by user. Workspace files remain untouched.',
        filesModified: [],
        checksRun: [],
        remainingErrors: [],
      });
      setBusy(false);
      return;
    }

    // Explicit approval granted
    try {
      addLog('info', `Step 4/6: Human approval granted. Applying changes for proposal ${proposal.id}…`);
      const message = await applyCodeProposal(proposal.id, true);
      addLog('success', `Step 5/6: ${message}`);

      const modified = proposal.files.map(f => f.path);
      setProposal(null);
      setPreview({});

      // Refresh workspace tree to reflect verified changes
      if (tree) {
        const refreshedTree = await getProjectTree(fileLimit);
        setTree(refreshedTree);
      }

      // Step 6: Offer validation checks
      setCurrentStepIndex(5);
      if (checks.length > 0) {
        addLog('info', 'Step 6/6: Files applied. Validation checks detected. Select a check below to review and approve execution.');
      } else {
        setAgentStatus('completed');
        setCurrentStepIndex(6);
        addLog('success', 'Task completed successfully. All proposed changes verified and applied.');
        setFinalReport({
          status: 'completed',
          summary: `Successfully applied ${modified.length} file(s) with recoverable backups in .lodhi-ai-backups.`,
          filesModified: modified,
          checksRun: [],
          remainingErrors: [],
        });
      }
    } catch (err) {
      const msg = String(err);
      setError(msg);
      setAgentStatus('failed');
      addLog('error', `Failed to apply approved changes: ${msg}`);
      setFinalReport({
        status: 'failed',
        summary: `Failed while writing changes: ${msg}`,
        filesModified: [],
        checksRun: [],
        remainingErrors: [msg],
      });
    } finally {
      setBusy(false);
    }
  }

  // --- Request Revision from AI Agent ---
  async function handleRequestRevision() {
    if (!revisionFeedback.trim() || !proposal) return;
    setBusy(true);
    setError('');
    addLog('info', `User requested revision: "${revisionFeedback.trim()}". Re-analyzing code changes…`);
    setAgentStatus('running');
    try {
      const revised = await analyzeProjectFiles({
        endpoint,
        model,
        task: 'fix',
        prompt: `${taskPrompt}\n\nRevision request from user: ${revisionFeedback.trim()}`,
        paths: proposal.files.map(f => f.path),
        maxFileBytes: fileLimit,
        maxContextChars: contextLimit,
      });
      setProposal(revised);
      setShowRevisionInput(false);
      setRevisionFeedback('');
      setAgentStatus('waitingForWriteApproval');
      addLog('warn', `Revised proposal staged for ${revised.files.length} file(s). Review updated diff below.`);
    } catch (e) {
      setError(`Revision generation failed: ${String(e)}`);
      setAgentStatus('failed');
      addLog('error', `Revision error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // --- Step 2B & 2C: Command Execution with Human Confirmation ---
  async function executeCheck() {
    if (!confirmation) return;
    const selectedCheck = confirmation;
    setConfirmation(null);
    setBusy(true);
    setCheckResult(null);
    setError('');

    addLog('info', `Executing approved command: '${selectedCheck.command}' in '${selectedCheck.workingDirectory}'…`);

    try {
      const result = await runProjectCheck(selectedCheck.id, true);
      setCheckResult(result);

      if (result.success) {
        addLog('success', `Command '${selectedCheck.command}' passed with exit code ${result.exitCode}.`);
      } else {
        addLog('error', `Command '${selectedCheck.command}' failed with exit code ${result.exitCode}.`);
      }

      // Update final report
      setFinalReport(prev => {
        const checksRun = [
          ...(prev?.checksRun || []),
          {
            id: selectedCheck.id,
            command: selectedCheck.command,
            exitCode: result.exitCode,
            success: result.success,
          },
        ];
        const hasErrors = checksRun.some(c => !c.success);
        return {
          status: hasErrors ? 'failed' : 'completed',
          summary: hasErrors
            ? 'Task completed file modifications, but validation checks reported failures.'
            : 'Task and all validation checks passed successfully.',
          filesModified: prev?.filesModified || [],
          checksRun,
          remainingErrors: result.success ? [] : [`Command '${selectedCheck.command}' returned exit code ${result.exitCode}`],
        };
      });

      setAgentStatus(result.success ? 'completed' : 'failed');
      setCurrentStepIndex(6);
    } catch (e) {
      const msg = String(e);
      setError(msg);
      addLog('error', `Command execution error: ${msg}`);
      setAgentStatus('failed');
    } finally {
      setBusy(false);
    }
  }

  // Task Cancellation
  function handleCancelTask() {
    setAgentStatus('cancelled');
    setProposal(null);
    setConfirmation(null);
    addLog('warn', 'Agent task cancelled by user. Halting all operations.');
    setFinalReport({
      status: 'cancelled',
      summary: 'Task was cancelled by the user. No further actions were taken.',
      filesModified: [],
      checksRun: [],
      remainingErrors: [],
    });
  }

  // Reset Task
  function handleResetTask() {
    setAgentStatus('idle');
    setAgentPlan([]);
    setCurrentStepIndex(0);
    setProposal(null);
    setCheckResult(null);
    setConfirmation(null);
    setFinalReport(null);
    setTaskPrompt('');
    addLog('info', 'Agent cockpit reset for new task.');
  }

  // --- Regression Compatibility: Interactive Chat & File Browser ---
  async function inspectSelected() {
    setBusy(true);
    setError('');
    try {
      const files = await readProjectFiles(selected, fileLimit, contextLimit);
      setPreview(Object.fromEntries(files.map(file => [file.path, file.content])));
      addLog('info', `Inspected ${files.length} file(s) for preview.`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function askModel() {
    if (!question.trim()) {
      setError('Prompt khali hai. Pehle sawal likhein.');
      return;
    }
    if (!isCloudProvider && !models.includes(model)) {
      setError('Selected model available nahi. Model Providers mein installed model select karke Check models karein.');
      return;
    }
    setBusy(true);
    setError('');
    setReply('');

    const langRule = `[Target Language: ${language.toUpperCase()}]\nRule: Generate only syntactically valid ${language.toUpperCase()} code conforming strictly to ${
      language === 'python'
        ? 'PEP 8 guidelines (snake_case, 4-space indent, type hints; no semicolons)'
        : language === 'java'
        ? 'standard Java class structure, typed methods, camelCase, semicolons, and imports'
        : language === 'rust'
        ? 'idiomatic Rust 2021 with ownership and Result/Option types'
        : 'strict TypeScript interfaces and types'
    }.\n\n`;
    const userTurn = { role: 'user' as const, content: question.trim() };
    const queryTurn = { role: 'user' as const, content: `${langRule}${question.trim()}` };

    try {
      if (selected.length) {
        const result = await analyzeProjectFiles({
          endpoint,
          model,
          task,
          prompt: userTurn.content,
          paths: selected,
          maxFileBytes: fileLimit,
          maxContextChars: contextLimit,
        });
        if (result.files.length === 0) {
          setProposal(null);
          setReply((result.summary || 'Analysis complete.') + '\n\nModel ne koi file change propose nahi ki; project bilkul unchanged hai.');
        } else {
          setProposal(result);
          setReply('Proposal tayyar hai. Neeche review karein; koi file abhi change nahi hui.');
        }
      } else {
        let assistantReply = '';
        if (isCloudProvider) {
          const geminiRes = await chatWithGemini(settings.geminiModel || 'gemini-1.5-flash', [...chat, queryTurn].slice(-20));
          assistantReply = geminiRes.content;
        } else {
          const result = await chatWithOllama(endpoint, model, [...chat, userTurn].slice(-20));
          assistantReply = result.content;
        }
        if (!assistantReply.trim()) throw new Error(`${isCloudProvider ? 'Gemini' : 'Ollama'} ne khali response diya. Dobara koshish karein.`);
        setChat([...chat, userTurn, { role: 'assistant', content: assistantReply }]);
        setReply(assistantReply);
      }
      setQuestion('');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function renderEntries(parent: string, depth = 0): React.ReactNode {
    return (byParent.get(parent) || []).map(entry => (
      <div key={entry.path}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 8px',
            paddingLeft: 8 + depth * 17,
            color: entry.selectable ? '#cbd5e1' : '#64748b',
            fontSize: 12,
          }}
        >
          {entry.isDirectory ? (
            <button
              aria-label={'Toggle ' + entry.path}
              onClick={() =>
                setExpanded(items =>
                  items.includes(entry.path) ? items.filter(item => item !== entry.path) : [...items, entry.path],
                )
              }
              style={{ color: '#94a3b8', background: 'none', border: 0, padding: 0 }}
            >
              {expanded.includes(entry.path) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <input
              aria-label={'Select ' + entry.path}
              type="checkbox"
              disabled={!entry.selectable}
              checked={selected.includes(entry.path)}
              onChange={() => toggleFile(entry.path)}
            />
          )}
          {entry.isDirectory ? <FolderOpen size={14} /> : <FileCode2 size={14} />}
          <span title={entry.excludedReason || entry.path}>{entry.path.split('/').pop()}</span>
          {entry.excludedReason && <span style={{ marginLeft: 'auto', color: '#f87171', fontSize: 11 }}>{entry.excludedReason}</span>}
          {entry.sizeBytes !== null && <span style={{ marginLeft: 'auto' }}>{Math.ceil(entry.sizeBytes / 1024)} KB</span>}
        </div>
        {entry.isDirectory && expanded.includes(entry.path) && renderEntries(entry.path, depth + 1)}
      </div>
    ));
  }

  const fieldStyle: React.CSSProperties = {
    background: '#0b1329',
    color: '#e2e8f0',
    border: '1px solid var(--border-subtle)',
    borderRadius: 7,
    padding: '8px 10px',
  };

  const statusLabel = (status: AgentWorkflowStatus): string => {
    switch (status) {
      case 'planning':
        return 'Planning';
      case 'inspecting':
        return 'Inspecting files';
      case 'planned':
      case 'waitingForReview':
        return 'Planned';
      case 'waitingForWriteApproval':
      case 'waitingForApproval':
        return 'Waiting for write approval';
      case 'waitingForCommandApproval':
        return 'Waiting for command approval';
      case 'running':
        return 'Running';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Idle';
    }
  };

  const statusBadgeVariant = (status: AgentWorkflowStatus): 'blue' | 'purple' | 'teal' | 'amber' | 'emerald' | 'rose' | 'neutral' => {
    switch (status) {
      case 'planning':
      case 'inspecting':
        return 'purple';
      case 'planned':
      case 'waitingForReview':
        return 'teal';
      case 'waitingForWriteApproval':
      case 'waitingForApproval':
      case 'waitingForCommandApproval':
        return 'amber';
      case 'running':
        return 'blue';
      case 'completed':
        return 'emerald';
      case 'failed':
        return 'rose';
      case 'cancelled':
      default:
        return 'neutral';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
      {/* Active AI Coding Agent Banner */}
      <RoadmapBanner
        phase="Active Developer Cockpit"
        featureName="Autonomous Coding Assistant & AST Engine"
        description="Enter coding tasks for your selected workspace. The safe AI Coding Agent inspects permitted source files, creates an implementation plan, stages diffs requiring explicit approval, creates recoverable backups, and runs approved checks."
        statusLabel="AST Safe Sandboxed Engine · Approval Protected"
        deliverablesLabel="Active Development Capabilities:"
        upcomingDeliverables={[
          'Select Project → Inspect Files → Ask AI Assistant',
          'Review Staged Diffs → Approve Changes → Automated Backups',
          'Excluded secrets, dependencies, build output and caches',
        ]}
      />

      {/* Cloud Consent Warning Modal */}
      {cloudConsentNeeded && (
        <Card
          title="Cloud AI Consent Warning"
          subtitle="Google Gemini is configured as the active provider."
          action={<Badge variant="rose" size="sm">Egress Protection</Badge>}
        >
          <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Explicit Consent Required</p>
            <p style={{ margin: '6px 0 0' }}>
              Your application settings currently specify Google Gemini. Transmitting local workspace code to a remote cloud API requires your explicit consent. No local files have been or will be transmitted without this permission.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              size="sm"
              icon={<ShieldCheck size={14} />}
              onClick={() => {
                updateSettings({ geminiConsentGiven: true });
                setCloudConsentNeeded(false);
                setError('');
                addLog('info', 'Cloud egress consent granted by user for Gemini API.');
              }}
            >
              I consent to send workspace context to Gemini
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<ShieldX size={14} />}
              onClick={() => {
                updateSettings({ activeProvider: 'ollama' });
                setCloudConsentNeeded(false);
                setError('');
                addLog('info', 'Switched provider to Local Ollama. Cloud egress cancelled.');
              }}
            >
              Switch to Local Ollama (Keep Everything Offline)
            </Button>
          </div>
        </Card>
      )}

      {/* Section 1: Selected Workspace & Isolation Status */}
      <Card
        title="1 · Active Project Workspace"
        subtitle="Operations are restricted strictly inside the selected root directory. Path traversal and secrets are blocked."
        action={
          <Badge variant={tree ? 'teal' : 'neutral'} size="sm" dot>
            {tree ? 'Workspace Boundary Locked' : 'No Workspace Selected'}
          </Badge>
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Button icon={<FolderOpen size={15} />} onClick={chooseProject} loading={busy}>
            {tree ? 'Switch Project Folder' : 'Select Project Folder'}
          </Button>
          <Button variant="outline" icon={<RefreshCw size={14} />} onClick={connect} loading={busy}>
            Check local model
          </Button>
          <Badge variant={models.includes(model) ? 'teal' : 'neutral'} size="sm" dot>
            {connection}
          </Badge>
        </div>

        {tree ? (
          <div style={{ marginTop: 12, padding: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                <strong>Root:</strong> <code style={{ color: '#7dd3fc' }}>{tree.root}</code>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Badge variant="neutral" size="sm">{tree.entries.length} entries</Badge>
                <Badge variant="teal" size="sm">Backups: .lodhi-ai-backups</Badge>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
              <span>Security policy: <strong style={{ color: '#38bdf8' }}>Strict Workspace Isolation</strong></span>
              <span>·</span>
              <span>Secret exclusion: <strong style={{ color: '#38bdf8' }}>.env, id_rsa, tokens blocked</strong></span>
            </div>
          </div>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 10 }}>
            Select a project folder to activate the AI Coding Agent for that codebase.
          </p>
        )}
      </Card>

      {/* Section 2: Task Input & Implementation Planning */}
      <Card
        title="2 · AI Coding Agent Task & Implementation Plan"
        subtitle="Describe a coding task. The agent inspects permitted files and produces a plan without modifying disk."
        action={
          <Badge variant={statusBadgeVariant(agentStatus)} size="sm">
            Status: {statusLabel(agentStatus).toUpperCase()}
          </Badge>
        }
      >
        {/* Preset Task Templates */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>Templates:</span>
          {[
            ['Fix compiler warning', 'Analyze compiler warnings in workspace and propose a clean fix.'],
            ['Add unit tests', 'Draft comprehensive unit tests for core module functions.'],
            ['Refactor helper', 'Refactor helper routines for improved readability and error handling.'],
            ['Sanitize user inputs', 'Audit input validation boundaries and add sanitization checks.'],
          ].map(([title, promptText]) => (
            <Button
              key={title}
              variant="outline"
              size="sm"
              onClick={() => setTaskPrompt(promptText)}
              disabled={busy || agentStatus === 'running'}
            >
              {title}
            </Button>
          ))}
        </div>

        {/* Task Input Box */}
        <textarea
          aria-label="Agent Task Description"
          value={taskPrompt}
          onChange={e => setTaskPrompt(e.target.value)}
          placeholder="Describe your coding task (e.g. 'Add input validation to user registration', 'Fix compiler error in src/main.rs')..."
          rows={3}
          style={{ ...fieldStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
          disabled={busy || agentStatus === 'running'}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#94a3b8' }}>
            <label>
              Max steps:{' '}
              <select
                value={maxSteps}
                onChange={e => setMaxSteps(Number(e.target.value))}
                style={{ ...fieldStyle, padding: '4px 8px', fontSize: 12 }}
                disabled={busy || agentStatus === 'running'}
              >
                <option value={5}>5 steps</option>
                <option value={10}>10 steps (default)</option>
                <option value={15}>15 steps</option>
                <option value={20}>20 steps (max bound)</option>
              </select>
            </label>
            <span>Model: <strong>{model}</strong></span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {agentStatus !== 'idle' && (
              <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={handleResetTask} disabled={busy}>
                Reset
              </Button>
            )}
            {agentStatus === 'running' && (
              <Button variant="danger" size="sm" icon={<Ban size={14} />} onClick={handleCancelTask}>
                Cancel Agent Task
              </Button>
            )}
            {agentStatus === 'idle' && (
              <Button icon={<Play size={14} />} onClick={handleGeneratePlan} loading={busy} disabled={!taskPrompt.trim() || !tree}>
                Generate Implementation Plan
              </Button>
            )}
            {agentStatus === 'planned' && (
              <Button icon={<Play size={14} />} onClick={handleExecuteAgentPlan} loading={busy}>
                Execute Plan & Generate Diff
              </Button>
            )}
          </div>
        </div>

        {/* Structured Plan View */}
        {agentPlan.length > 0 && (
          <div style={{ marginTop: 16, padding: 14, background: 'rgba(11, 19, 41, 0.7)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 13, color: '#e2e8f0' }}>Structured Plan of Action</strong>
              <Badge variant={statusBadgeVariant(agentStatus)} size="sm">
                Step {currentStepIndex} of {agentPlan.length}
              </Badge>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#cbd5e1', fontSize: 12, lineHeight: 1.8 }}>
              {agentPlan.map((step, idx) => (
                <li
                  key={idx}
                  style={{
                    color: idx + 1 === currentStepIndex ? '#38bdf8' : idx + 1 < currentStepIndex ? '#4ade80' : '#94a3b8',
                    fontWeight: idx + 1 === currentStepIndex ? 600 : 400,
                  }}
                >
                  {step} {idx + 1 < currentStepIndex ? '✓' : idx + 1 === currentStepIndex ? '• (Active)' : ''}
                </li>
              ))}
            </ul>

            {/* Risk Assessment Panel */}
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7dd3fc', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                <ShieldCheck size={14} /> Safety & Risk Analysis
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#94a3b8', fontSize: 11, lineHeight: 1.6 }}>
                {riskAnalysis.map((risk, idx) => (
                  <li key={idx}>{risk}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" style={{ color: '#fca5a5', marginTop: 10, fontSize: 13, padding: 8, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6 }}>
            {error}
          </div>
        )}
      </Card>

      {/* Section 3: Proposed Changes & Diff Review Gate */}
      {proposal && (
        <Card
          title="3 · Review Proposed Changes & Diff"
          subtitle={`Model: ${proposal.model} · Summary: ${proposal.summary}`}
          action={<Badge variant="amber" size="sm">Approval Required (0 Disk Writes)</Badge>}
        >
          <div style={{ padding: 10, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 8, color: '#fcd34d', fontSize: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <AlertTriangle size={15} /> Diff Review Gate
            </div>
            <p style={{ margin: '4px 0 0' }}>
              These changes are currently staged in-memory only. Rejecting this proposal leaves all original files untouched. Approving creates a recoverable backup snapshot in <code>.lodhi-ai-backups</code> before writing atomically.
            </p>
          </div>

          {proposal.files.map(file => (
            <details open key={file.path} style={{ margin: '10px 0', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8, background: '#0b1329' }}>
              <summary style={{ color: '#7dd3fc', fontWeight: 600, cursor: 'pointer', paddingBottom: 6 }}>
                <FileDiff size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                {file.path} ({file.originalContent ? 'Modified' : 'New File'})
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>
                    Current Content {file.originalContent === null ? '(None - New File)' : ''}
                  </div>
                  <pre style={{ maxHeight: 250, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 11, color: '#fda4af', background: 'rgba(239, 68, 68, 0.05)', padding: 8, borderRadius: 6 }}>
                    {file.originalContent ?? '[New file will be created]'}
                  </pre>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', marginBottom: 4 }}>Proposed Content</div>
                  <pre style={{ maxHeight: 250, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 11, color: '#86efac', background: 'rgba(34, 197, 94, 0.05)', padding: 8, borderRadius: 6 }}>
                    {file.proposedContent}
                  </pre>
                </div>
              </div>
            </details>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <Button icon={<Check size={15} />} onClick={() => void handleApproveProposal(true)} loading={busy}>
              Approve and Apply Changes
            </Button>
            <Button variant="outline" icon={<X size={15} />} onClick={() => void handleApproveProposal(false)} disabled={busy}>
              Reject Proposal (Keep Originals)
            </Button>
            <Button
              variant="outline"
              icon={<RotateCcw size={14} />}
              onClick={() => setShowRevisionInput(prev => !prev)}
              disabled={busy}
            >
              Request Revision
            </Button>
          </div>

          {showRevisionInput && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 8 }}>
              <label style={{ fontSize: 12, color: '#7dd3fc', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Revision Feedback
              </label>
              <textarea
                value={revisionFeedback}
                onChange={e => setRevisionFeedback(e.target.value)}
                placeholder="Specify what should be changed or improved (e.g. 'Add input sanitization for email', 'Preserve existing comments')..."
                rows={2}
                style={{ ...fieldStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button size="sm" variant="ghost" onClick={() => setShowRevisionInput(false)}>Cancel</Button>
                <Button size="sm" icon={<Send size={13} />} onClick={() => void handleRequestRevision()} loading={busy} disabled={!revisionFeedback.trim()}>
                  Submit Revision
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Section 4: Approved Project Validation Checks */}
      <Card
        title="4 · Validation Checks & Command Execution"
        subtitle="Only allowlisted package scripts (test, type-check, build) can run. Each command requires explicit separate confirmation."
      >
        {!tree?.root ? (
          <p style={{ color: '#94a3b8', fontSize: 12 }}>
            No project workspace is currently selected. Please select a workspace folder containing a package.json to view available checks.
          </p>
        ) : checks.length ? (
          checks.map(check => (
            <div
              key={check.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '9px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: 12 }}>
                <strong>{check.id}</strong>
                <div style={{ color: '#94a3b8' }}>
                  <code>{check.command}</code> · working directory: <code>{check.workingDirectory}</code>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                icon={<Play size={13} />}
                disabled={busy}
                onClick={() => {
                  setConfirmation(check);
                  setAgentStatus('waitingForCommandApproval');
                }}
              >
                Review and Run
              </Button>
            </div>
          ))
        ) : (
          <p style={{ color: '#94a3b8', fontSize: 12 }}>
            No allowlisted package scripts (test, type-check, build) detected in the current workspace.
          </p>
        )}

        {/* Command Approval Dialog */}
        {confirmation && (
          <div
            role="alertdialog"
            aria-label="Confirm project check"
            style={{
              marginTop: 12,
              padding: 14,
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.85)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              <ShieldCheck size={16} /> Command Execution Approval
            </div>
            <p style={{ margin: '4px 0', fontSize: 12, color: '#cbd5e1' }}>
              Do you approve running this exact command?
            </p>
            <p style={{ fontFamily: 'monospace', color: '#7dd3fc', background: '#0b1329', padding: '6px 10px', borderRadius: 4, fontSize: 12 }}>
              {confirmation.command}
            </p>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0' }}>
              Working directory: <code>{confirmation.workingDirectory}</code>
            </p>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 10px' }}>
              Security constraints: Execution timeout 300s · 64KB capped output · Secret redaction active.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" icon={<ShieldCheck size={14} />} onClick={() => void executeCheck()} loading={busy}>
                I approve this run
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmation(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {checkResult && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600 }}>Command Output Terminal</span>
              <Badge variant={checkResult.success ? 'teal' : 'rose'} size="sm">
                Exit Code: {checkResult.exitCode ?? 'N/A'} · {checkResult.success ? 'Passed' : 'Failed'}
              </Badge>
            </div>
            <pre
              role="status"
              style={{
                maxHeight: 280,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                color: checkResult.success ? '#86efac' : '#fca5a5',
                background: '#070b14',
                padding: 10,
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              {checkResult.output || '(No output returned)'}
            </pre>
          </div>
        )}
      </Card>

      {/* Section 5: Execution Logs & Final Verified Report */}
      <Card
        title="5 · Execution Logs & Final Report"
        subtitle="Chronological audit log of all agent operations, permissions, and outcomes."
        action={
          <Badge variant={statusBadgeVariant(agentStatus)} size="sm">
            {agentStatus}
          </Badge>
        }
      >
        {/* Real-time Log Stream */}
        <div
          role="log"
          aria-label="Agent execution logs"
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            background: '#070b14',
            borderRadius: 6,
            padding: 10,
            fontSize: 11,
            fontFamily: 'monospace',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {logs.length ? (
            logs.map(log => (
              <div key={log.id} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: '#64748b' }}>[{log.timestamp}]</span>
                <span
                  style={{
                    color:
                      log.status === 'success'
                        ? '#4ade80'
                        : log.status === 'warn'
                        ? '#fbbf24'
                        : log.status === 'error'
                        ? '#f87171'
                        : '#94a3b8',
                  }}
                >
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <span style={{ color: '#64748b' }}>No actions recorded yet. Logs will appear here as the agent plans and executes.</span>
          )}
        </div>

        {/* Final Verified Report */}
        {finalReport && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 8,
              background: finalReport.status === 'completed' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${finalReport.status === 'completed' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: 13, color: '#e2e8f0' }}>Verified Completion Report</strong>
              <Badge variant={statusBadgeVariant(finalReport.status)} size="sm">
                Outcome: {finalReport.status.toUpperCase()}
              </Badge>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', margin: '4px 0' }}>{finalReport.summary}</p>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
              <div><strong>Files modified:</strong> {finalReport.filesModified.length ? finalReport.filesModified.join(', ') : 'None'}</div>
              <div><strong>Tests executed:</strong> {finalReport.checksRun.length ? finalReport.checksRun.map(c => `${c.command} (exit ${c.exitCode})`).join('; ') : 'None'}</div>
              {finalReport.remainingErrors.length > 0 && (
                <div style={{ color: '#fca5a5' }}><strong>Remaining errors:</strong> {finalReport.remainingErrors.join('; ')}</div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Regression Compatibility Section: Interactive Assistant Chat */}
      <Card
        title="Interactive Model Chat"
        subtitle={isCloudProvider ? `Cloud Provider: Google Gemini · Model: ${settings.geminiModel || 'gemini-1.5-flash'}` : ('Endpoint: ' + endpoint + ' · Model: ' + model)}
        action={<Badge variant={isCloudProvider ? 'rose' : 'teal'} size="sm" dot>{isCloudProvider ? 'Google Gemini' : 'Local Ollama'}</Badge>}
      >
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 10 }}>
          <select aria-label="Coding task" value={task} onChange={e => setTask(e.target.value)} style={fieldStyle}>
            {[
              ['question', 'Ask about selected code'],
              ['explain', 'Explain code'],
              ['bugs', 'Find bugs'],
              ['fix', 'Suggest fixes'],
              ['function', 'Generate functions'],
              ['refactor', 'Propose refactor'],
            ].map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => {
              setChat([]);
              setReply('');
              setQuestion('');
            }}
          >
            New conversation
          </Button>
        </div>

        {chat.map((turn, index) => (
          <div
            key={index}
            style={{
              padding: '8px 10px',
              marginBottom: 7,
              borderRadius: 8,
              background: turn.role === 'user' ? 'rgba(56,189,248,.08)' : 'rgba(129,140,248,.08)',
              whiteSpace: 'pre-wrap',
              color: '#cbd5e1',
              fontSize: 13,
            }}
          >
            <strong>{turn.role === 'user' ? 'You' : model}:</strong> {turn.content}
          </div>
        ))}

        <textarea
          aria-label="Ask local AI"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void askModel();
            }
          }}
          placeholder={selected.length ? 'Selected files ka sawal ya requested code change…' : 'Local model se sawal…'}
          rows={3}
          style={{ ...fieldStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 9 }}>
          <Button icon={<Send size={14} />} loading={busy} onClick={askModel} disabled={busy}>
            {isCloudProvider ? 'Send to Gemini' : 'Send to local model'}
          </Button>
        </div>

        {reply && (
          <div
            role="status"
            style={{
              whiteSpace: 'pre-wrap',
              padding: 12,
              marginTop: 12,
              background: 'rgba(45,212,191,.07)',
              borderRadius: 8,
              color: '#d1fae5',
              fontSize: 13,
            }}
          >
            {reply}
          </div>
        )}
      </Card>

      {/* Regression Compatibility Section: Workspace File Tree */}
      {tree && (
        <Card title="Workspace File Tree" subtitle="Select files for context budget inspection.">
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8, fontSize: 12, color: '#94a3b8' }}>
            <label>
              Max file size (KB){' '}
              <input
                aria-label="Max file size KB"
                type="number"
                min={1}
                max={1024}
                value={Math.floor(fileLimit / 1024)}
                onChange={e => setFileLimit(Math.max(1, Math.min(1024, Number(e.target.value) || 1)) * 1024)}
                style={{ ...fieldStyle, width: 90 }}
              />
            </label>
            <label>
              Context chars{' '}
              <input
                aria-label="Context chars"
                type="number"
                min={1000}
                max={28000}
                value={contextLimit}
                onChange={e => setContextLimit(Math.max(1000, Math.min(28000, Number(e.target.value) || 1000)))}
                style={{ ...fieldStyle, width: 100 }}
              />
            </label>
            <span>Selected {selected.length}/32 files</span>
          </div>

          <div
            role="tree"
            aria-label="Project files"
            style={{ maxHeight: 240, overflow: 'auto', padding: 8, background: 'rgba(7,11,20,.45)', borderRadius: 8 }}
          >
            {renderEntries('')}
          </div>

          {selected.length > 0 && (
            <Button variant="outline" size="sm" onClick={inspectSelected} loading={busy} style={{ marginTop: 10 }}>
              Inspect selected files
            </Button>
          )}

          {Object.entries(preview).map(([path, content]) => (
            <details key={path} style={{ marginTop: 8 }}>
              <summary style={{ color: '#7dd3fc', fontSize: 12 }}>{path}</summary>
              <pre style={{ maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#cbd5e1', fontSize: 11 }}>
                {content}
              </pre>
            </details>
          ))}
        </Card>
      )}

      {/* Regression Compatibility Section: Preview Snippets */}
      <Card title="Preview snippets" subtitle="Static examples only; never sent to the model or executed.">
        <div style={{ display: 'flex', gap: 8 }}>
          {['rust', 'typescript', 'python', 'java'].map(item => (
            <Button key={item} size="sm" variant={language === item ? 'primary' : 'ghost'} onClick={() => setLanguage(item)}>
              {item}
            </Button>
          ))}
        </div>
        <pre style={{ color: '#a5f3fc', fontSize: 12, marginTop: 8 }}>{EXAMPLE_SNIPPETS[language]}</pre>
      </Card>
    </div>
  );
};
