import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Bot,
  Play,
  Square,
  CheckCircle,
  AlertTriangle,
  Clock,
  Terminal,
  ShieldCheck,
  ShieldX,
  List,
  Wrench,
  Sparkles,
  Monitor,
  Globe,
  MessageSquare,
  Code2,
} from 'lucide-react';
import { RoadmapBanner } from '../components/common/RoadmapBanner';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { WindowsAutomationCockpit } from '../components/automation/WindowsAutomationCockpit';
import { BrowserAutomationCockpit } from '../components/automation/BrowserAutomationCockpit';
import { WhatsAppWorkflowCockpit } from '../components/automation/WhatsAppWorkflowCockpit';
import { CodeIntelligenceCockpit } from '../components/agent/CodeIntelligenceCockpit';
import {
  listAvailableTools,
  createAgentTask,
  stepAgentTask,
  abortAgentTask,
} from '../services/tauri';
import { AgentTask, AgentStep, ToolDefinition, ToolCall } from '../types';

interface AgentTemplate {
  id: string;
  name: string;
  tagline: string;
  trigger: string;
  defaultPrompt: string;
  permissions: string[];
  status: 'active' | 'idle' | 'standby';
}

const AGENTS: AgentTemplate[] = [
  {
    id: 'agent-security-linter',
    name: 'Security & Dependency Auditor',
    tagline: 'Continuously monitors package manifests and Rust crates for known vulnerabilities and secret files.',
    trigger: 'Manual / On Workspace Open',
    defaultPrompt: 'Run workspace_diagnostics and check for secret files (.env, keys) or outdated dependencies.',
    permissions: ['fs:read-only', 'workspace_diagnostics'],
    status: 'active',
  },
  {
    id: 'agent-test-generator',
    name: 'Unit Test Coverage Agent',
    tagline: 'Analyzes modified TypeScript and Rust files and drafts high-coverage unit tests.',
    trigger: 'Manual / On Request',
    defaultPrompt: 'Search for untested functions in workspace files and propose a new unit test suite.',
    permissions: ['fs:read-only', 'workspace_propose_edit', 'workspace_run_check (approval)'],
    status: 'active',
  },
  {
    id: 'agent-doc-generator',
    name: 'API Documentation Synthesizer',
    tagline: 'Extracts markdown docstrings, API schemas, and architecture summaries.',
    trigger: 'Manual / Daily Schedule',
    defaultPrompt: 'Inspect active project tree and summarize workspace architecture into docs/ARCH_SUMMARY.md.',
    permissions: ['fs:read-only', 'workspace_propose_edit'],
    status: 'standby',
  },
  {
    id: 'agent-data-cleaner',
    name: 'Data Pipeline & Schema Normalizer',
    tagline: 'Cleans, validates, and transforms CSV/JSON datasets into SQLite-ready tables.',
    trigger: 'Dropzone File Trigger',
    defaultPrompt: 'Scan workspace for JSON/CSV datasets and validate their schemas.',
    permissions: ['fs:read-only', 'workspace_search'],
    status: 'idle',
  },
];

export const AutomationAgentsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'developerAgent' | 'codeIntelligence' | 'windowsAutomation' | 'browserAutomation' | 'whatsappWorkflow'>('developerAgent');
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [activeTask, setActiveTask] = useState<AgentTask | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxSteps, setMaxSteps] = useState(10);

  useEffect(() => {
    void loadTools();
  }, []);

  async function loadTools() {
    try {
      const available = await listAvailableTools();
      setTools(available);
    } catch (err) {
      console.error('Failed to load tools:', err);
    }
  }

  async function handleStartTask(customPrompt?: string) {
    const taskPrompt = (customPrompt || prompt).trim();
    if (!taskPrompt) {
      setError('Please provide a goal or prompt for the Developer Agent.');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const task = await createAgentTask(taskPrompt, maxSteps);
      setActiveTask(task);

      // Execute first automated step: workspace tree inspection
      const initialStep = await stepAgentTask(
        task.id,
        'Scanning project tree to understand workspace structure',
        { name: 'workspace_diagnostics', arguments: {} },
        false,
      );
      setActiveTask(initialStep);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStepTask(actionCall?: ToolCall, approval = false) {
    if (!activeTask) return;
    setIsBusy(true);
    setError(null);
    try {
      const nextCall = actionCall || (activeTask.pendingApproval ? activeTask.pendingApproval : undefined);
      const updated = await stepAgentTask(
        activeTask.id,
        approval ? 'User approved tool execution' : 'Continuing planned task execution',
        nextCall,
        approval,
      );
      setActiveTask(updated);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAbortTask() {
    if (!activeTask) return;
    setIsBusy(true);
    try {
      await abortAgentTask(activeTask.id);
      setActiveTask((prev: AgentTask | null) => prev ? { ...prev, status: 'aborted', summary: 'Task was cancelled by user.' } : null);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'executing':
      case 'planning':
        return <Badge variant="teal" size="sm" dot>RUNNING</Badge>;
      case 'awaitingApproval':
        return <Badge variant="amber" size="sm" dot>APPROVAL REQUIRED</Badge>;
      case 'completed':
        return <Badge variant="teal" size="sm">COMPLETED</Badge>;
      case 'failed':
        return <Badge variant="rose" size="sm">FAILED</Badge>;
      case 'aborted':
        return <Badge variant="neutral" size="sm">ABORTED</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status.toUpperCase()}</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Roadmap Banner */}
      <RoadmapBanner
        phase="Phase 3 · Active Agent Platform"
        featureName="Multi-Step Autonomous Background Agents & Developer Cockpit"
        description="The Lodhi AI Developer Agent executes bounded multi-step reasoning with loop detection, explicit step limits, and strict human-in-the-loop authorization gates for modifications."
        upcomingDeliverables={[
          'Typed tool execution registry with schema validation',
          'Autonomous plan formulation and progressive step execution',
          'Loop detection and maximum step limits (anti-spin guarantee)',
          'Cryptographic confirmation modal for write and check actions',
        ]}
      />

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('developerAgent')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: activeTab === 'developerAgent' ? '1px solid #38bdf8' : '1px solid transparent',
            backgroundColor: activeTab === 'developerAgent' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            color: activeTab === 'developerAgent' ? '#38bdf8' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Bot size={16} />
          AI Developer Agent
        </button>
        <button
          onClick={() => setActiveTab('codeIntelligence')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: activeTab === 'codeIntelligence' ? '1px solid #38bdf8' : '1px solid transparent',
            backgroundColor: activeTab === 'codeIntelligence' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            color: activeTab === 'codeIntelligence' ? '#38bdf8' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Code2 size={16} />
          Code Intelligence & Diagnostics
        </button>
        <button
          onClick={() => setActiveTab('windowsAutomation')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: activeTab === 'windowsAutomation' ? '1px solid #2dd4bf' : '1px solid transparent',
            backgroundColor: activeTab === 'windowsAutomation' ? 'rgba(45, 212, 191, 0.12)' : 'transparent',
            color: activeTab === 'windowsAutomation' ? '#2dd4bf' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Monitor size={16} />
          Windows PC Automation
        </button>
        <button
          onClick={() => setActiveTab('browserAutomation')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: activeTab === 'browserAutomation' ? '1px solid #a78bfa' : '1px solid transparent',
            backgroundColor: activeTab === 'browserAutomation' ? 'rgba(167, 139, 250, 0.12)' : 'transparent',
            color: activeTab === 'browserAutomation' ? '#a78bfa' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Globe size={16} />
          Browser Automation
        </button>
        <button
          onClick={() => setActiveTab('whatsappWorkflow')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: activeTab === 'whatsappWorkflow' ? '1px solid #22c55e' : '1px solid transparent',
            backgroundColor: activeTab === 'whatsappWorkflow' ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
            color: activeTab === 'whatsappWorkflow' ? '#22c55e' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <MessageSquare size={16} />
          WhatsApp Workflows
        </button>
      </div>

      {activeTab === 'developerAgent' ? (
        <>
          {/* Security Architecture Principle */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '10px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '12.5px',
              color: '#bae6fd',
            }}
          >
            <ShieldAlert size={18} color="#38bdf8" style={{ flexShrink: 0 }} />
            <span>
              <strong>Security Mandate:</strong> Arbitrary shell backdoors are strictly prohibited. The Agent only invokes allowlisted tools within project workspace boundaries. Every file modification or test execution requires explicit user authorization.
            </span>
          </div>

          {/* Interactive Developer Agent Cockpit */}
          <Card
        title="AI Developer Agent Cockpit"
        subtitle="Provide a high-level task for the autonomous developer agent."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Max Steps:</span>
            <input
              type="number"
              min={1}
              max={20}
              value={maxSteps}
              onChange={e => setMaxSteps(Math.max(1, Math.min(20, Number(e.target.value) || 10)))}
              style={{
                width: 50,
                background: '#0b1329',
                color: '#e2e8f0',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '4px 6px',
                fontSize: 12,
              }}
            />
          </div>
        }
      >
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <textarea
            aria-label="Agent Task Prompt"
            placeholder="e.g. Audit the active workspace, identify bug in authentication logic, and suggest a verified fix..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={isBusy || (activeTask !== null && (activeTask.status === 'executing' || activeTask.status === 'awaitingApproval'))}
            rows={2}
            style={{
              flex: 1,
              background: '#0b1329',
              color: '#e2e8f0',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Button
              icon={<Play size={15} />}
              onClick={() => void handleStartTask()}
              loading={isBusy}
              disabled={isBusy}
            >
              Start Agent Task
            </Button>
            {activeTask && (activeTask.status === 'executing' || activeTask.status === 'awaitingApproval') && (
              <Button
                variant="outline"
                icon={<Square size={14} />}
                onClick={() => void handleAbortTask()}
                disabled={isBusy}
              >
                Abort Task
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(244,63,94,0.1)', color: '#fca5a5', fontSize: 13, border: '1px solid rgba(244,63,94,0.3)' }}>
            <AlertTriangle size={15} style={{ display: 'inline', marginRight: 6 }} />
            {error}
          </div>
        )}

        {/* Active Task Execution Monitor */}
        {activeTask && (
          <div style={{ marginTop: 18, padding: 14, background: 'rgba(7, 11, 20, 0.5)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bot size={18} color="#38bdf8" />
                <strong style={{ fontSize: 14, color: '#f8fafc' }}>Task: {activeTask.id}</strong>
                {getStatusBadge(activeTask.status)}
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Step {activeTask.steps.length} / {activeTask.maxSteps}
              </span>
            </div>

            {/* Structured Plan */}
            <div style={{ marginBottom: 14, padding: 10, background: 'rgba(15, 23, 42, 0.4)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <List size={14} /> Plan of Action:
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#cbd5e1' }}>
                {activeTask.plan.map((item: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: 3 }}>{item}</li>
                ))}
              </ol>
            </div>

            {/* Human in the Loop Authorization Gate */}
            {activeTask.status === 'awaitingApproval' && activeTask.pendingApproval && (
              <div style={{ marginBottom: 14, padding: 14, borderRadius: 8, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fcd34d', fontSize: 13, fontWeight: 600 }}>
                  <ShieldAlert size={16} /> Human Authorization Required
                </div>
                <p style={{ fontSize: 12, color: '#e2e8f0', margin: '6px 0 10px 0' }}>
                  The agent requests to invoke privileged tool: <code style={{ color: '#38bdf8' }}>{activeTask.pendingApproval.name}</code>.
                  Arguments: <code style={{ fontSize: 11 }}>{JSON.stringify(activeTask.pendingApproval.arguments)}</code>
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    size="sm"
                    icon={<ShieldCheck size={14} />}
                    onClick={() => void handleStepTask(activeTask.pendingApproval, true)}
                    loading={isBusy}
                  >
                    Approve Tool Action
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<ShieldX size={14} />}
                    onClick={() => void handleStepTask(undefined, false)}
                    disabled={isBusy}
                  >
                    Reject & Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Progressive Step Log */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {activeTask.steps.map((step: AgentStep) => (
                <div key={step.stepIndex} style={{ padding: 10, borderRadius: 8, background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>Step {step.stepIndex}: {step.thought}</span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>
                      <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                      {new Date(step.timestampMs).toLocaleTimeString()}
                    </span>
                  </div>
                  {step.toolCall && (
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#a5f3fc', marginTop: 4 }}>
                      <Terminal size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {step.toolCall.name}({JSON.stringify(step.toolCall.arguments)})
                    </div>
                  )}
                  {step.toolResult && (
                    <div style={{ marginTop: 6, fontSize: 11, padding: 6, borderRadius: 6, background: 'rgba(0,0,0,0.2)', color: step.toolResult.status === 'success' ? '#86efac' : step.toolResult.status === 'awaitingApproval' ? '#fcd34d' : '#fca5a5' }}>
                      Status: {step.toolResult.status} {step.toolResult.error ? `· Error: ${step.toolResult.error}` : ''}
                      {step.toolResult.output !== undefined && (
                        <pre style={{ margin: '4px 0 0 0', maxHeight: 100, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(step.toolResult.output, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary Banner */}
            {activeTask.summary && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: activeTask.status === 'completed' ? 'rgba(45, 212, 191, 0.1)' : 'rgba(244, 63, 94, 0.1)', color: activeTask.status === 'completed' ? '#d1fae5' : '#fca5a5', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeTask.status === 'completed' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <strong>{activeTask.summary}</strong>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Typed Tool Registry View */}
      <Card
        title="Typed Tool Execution Registry"
        subtitle="Individual tools registered with the AI developer agent, their permission levels, and schemas."
        action={<Badge variant="teal" size="sm">{tools.length} Tools Available</Badge>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: 8 }}>
          {tools.map(tool => (
            <div
              key={tool.name}
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#38bdf8', fontWeight: 600 }}>
                  <Wrench size={12} style={{ display: 'inline', marginRight: 4 }} />
                  {tool.name}
                </span>
                <Badge variant={tool.permissionLevel === 'readOnly' ? 'teal' : 'amber'} size="sm">
                  {tool.permissionLevel === 'readOnly' ? 'Read-Only' : 'Approval Req.'}
                </Badge>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                {tool.description}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Agent Profiles Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {AGENTS.map(agent => (
          <Card
            key={agent.id}
            title={agent.name}
            subtitle={agent.tagline}
            action={
              <Badge variant={agent.status === 'active' ? 'teal' : 'neutral'} size="sm">
                {agent.status.toUpperCase()}
              </Badge>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#94a3b8' }}>Trigger:</span>
                <span style={{ color: '#38bdf8', fontWeight: 500 }}>{agent.trigger}</span>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Required Capabilities
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {agent.permissions.map((p, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: '#cbd5e1',
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles size={13} />}
                  onClick={() => {
                    setPrompt(agent.defaultPrompt);
                    void handleStartTask(agent.defaultPrompt);
                  }}
                  disabled={isBusy}
                >
                  Run Agent Task
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
        </>
      ) : activeTab === 'codeIntelligence' ? (
        <CodeIntelligenceCockpit
          onProposeFix={(file, diag) => {
            setActiveTab('developerAgent');
            setPrompt(`Diagnose and propose a targeted fix for ${file}:${diag.line} [${diag.code || diag.severity}]: ${diag.message}`);
          }}
        />
      ) : activeTab === 'windowsAutomation' ? (
        <WindowsAutomationCockpit />
      ) : activeTab === 'browserAutomation' ? (
        <BrowserAutomationCockpit />
      ) : (
        <WhatsAppWorkflowCockpit />
      )}
    </div>
  );
};
