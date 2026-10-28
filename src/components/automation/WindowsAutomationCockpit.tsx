import React, { useState, useEffect } from 'react';
import {
  Monitor,
  FolderOpen,
  Clipboard,
  FileText,
  ShieldCheck,
  ShieldX,
  Play,
  RotateCw,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  getAutomationCapabilities,
  previewAutomationAction,
  executeAutomationAction,
  getAutomationAuditLog,
  clearAutomationAuditLog,
} from '../../services/tauri';
import {
  AutomationCapabilities,
  AutomationActionRequest,
  AutomationActionResult,
  AutomationAuditEntry,
  WindowInfo,
} from '../../types';

export const WindowsAutomationCockpit: React.FC = () => {
  const [capabilities, setCapabilities] = useState<AutomationCapabilities | null>(null);
  const [activeWindows, setActiveWindows] = useState<WindowInfo[]>([]);
  const [auditLogs, setAuditLogs] = useState<AutomationAuditEntry[]>([]);
  const [pendingRequest, setPendingRequest] = useState<AutomationActionRequest | null>(null);
  const [lastResult, setLastResult] = useState<AutomationActionResult | null>(null);
  const [isInspectingWindows, setIsInspectingWindows] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form parameters
  const [selectedFile, setSelectedFile] = useState('README.md');
  const [clipboardText, setClipboardText] = useState('Lodhi AI Windows Automation Payload');
  const [readClipboardResult, setReadClipboardResult] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      const caps = await getAutomationCapabilities();
      setCapabilities(caps);
      const logs = await getAutomationAuditLog();
      setAuditLogs(logs);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleInspectWindows() {
    setIsInspectingWindows(true);
    setError(null);
    try {
      const req = await previewAutomationAction('inspect_windows', {});
      const res = await executeAutomationAction(req, true);
      if (res.success && res.output) {
        const parsed = JSON.parse(res.output) as WindowInfo[];
        setActiveWindows(parsed);
      }
      setLastResult(res);
      const logs = await getAutomationAuditLog();
      setAuditLogs(logs);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsInspectingWindows(false);
    }
  }

  async function handleTriggerAction(actionType: string, parameters: Record<string, unknown>) {
    setError(null);
    setLastResult(null);
    try {
      const req = await previewAutomationAction(actionType, parameters);
      if (req.requiresConfirmation) {
        // Open confirmation gate modal
        setPendingRequest(req);
      } else {
        // Execute immediately for safe actions
        setIsExecutingAction(true);
        const res = await executeAutomationAction(req, true);
        setLastResult(res);
        if (actionType === 'get_clipboard') {
          setReadClipboardResult(res.output);
        }
        const logs = await getAutomationAuditLog();
        setAuditLogs(logs);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsExecutingAction(false);
    }
  }

  async function handleConfirmAction(authorized: boolean) {
    if (!pendingRequest) return;
    setIsExecutingAction(true);
    setError(null);
    try {
      const res = await executeAutomationAction(pendingRequest, authorized);
      setLastResult(res);
      setPendingRequest(null);
      const logs = await getAutomationAuditLog();
      setAuditLogs(logs);
    } catch (err) {
      setError(String(err));
      setPendingRequest(null);
    } finally {
      setIsExecutingAction(false);
    }
  }

  async function handleClearLogs() {
    try {
      await clearAutomationAuditLog();
      setAuditLogs([]);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Security Principles Banner */}
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
        <ShieldCheck size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
        <span>
          <strong>Permission-Based Windows Automation:</strong> Lodhi AI strictly enforces human-in-the-loop authorization before launching applications, opening files, or modifying system state. Only allowlisted applications within workspace boundaries are permitted.
        </span>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fda4af',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Capabilities & Allowlisted Apps Grid */}
      <Card
        title="Allowlisted Windows Applications"
        subtitle="Only approved, individually reviewed applications can be launched by the automation service."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '10px' }}>
          {capabilities?.approvedApps.map(app => (
            <div
              key={app.id}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>
                  {app.displayName}
                </span>
                <Badge variant="teal" size="sm">{app.category}</Badge>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#38bdf8' }}>
                {app.executable}
              </span>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.4 }}>
                {app.description}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Interactive Actions & Inspection Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
        {/* Action Dispatcher Card */}
        <Card
          title="Windows PC Automation Actions"
          subtitle="Trigger allowlisted desktop workflows with human approval gates."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            {/* Action 1: Open Explorer */}
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong style={{ fontSize: '13px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FolderOpen size={15} color="#38bdf8" />
                  Reveal in Windows Explorer
                </strong>
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                  Opens the active project folder in File Explorer.
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink size={13} />}
                onClick={() => void handleTriggerAction('open_workspace_path', { path: '.' })}
                disabled={isExecutingAction}
              >
                Open Folder
              </Button>
            </div>

            {/* Action 2: Launch Notepad */}
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '13px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={15} color="#2dd4bf" />
                  Launch Notepad with Workspace File
                </strong>
                <Badge variant="amber" size="sm">Approval Req.</Badge>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  aria-label="Workspace file path"
                  value={selectedFile}
                  onChange={e => setSelectedFile(e.target.value)}
                  placeholder="e.g. README.md"
                  style={{
                    flex: 1,
                    background: '#0b1329',
                    color: '#e2e8f0',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '12px',
                  }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleTriggerAction('launch_app', { app: 'notepad.exe', file: selectedFile })}
                  disabled={isExecutingAction || !selectedFile.trim()}
                >
                  Launch App
                </Button>
              </div>
            </div>

            {/* Action 3: Set Clipboard */}
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '13px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clipboard size={15} color="#a78bfa" />
                  Write Text to Windows Clipboard
                </strong>
                <Badge variant="amber" size="sm">Approval Req.</Badge>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  aria-label="Clipboard payload text"
                  value={clipboardText}
                  onChange={e => setClipboardText(e.target.value)}
                  placeholder="Text to copy..."
                  style={{
                    flex: 1,
                    background: '#0b1329',
                    color: '#e2e8f0',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '12px',
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleTriggerAction('set_clipboard', { text: clipboardText })}
                  disabled={isExecutingAction || !clipboardText.trim()}
                >
                  Copy to Clipboard
                </Button>
              </div>
            </div>

            {/* Action 4: Read Clipboard */}
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong style={{ fontSize: '13px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clipboard size={15} color="#38bdf8" />
                  Read Windows Clipboard
                </strong>
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                  Inspects current clipboard content safely.
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleTriggerAction('get_clipboard', {})}
                disabled={isExecutingAction}
              >
                Read Clipboard
              </Button>
            </div>

            {readClipboardResult !== null && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: '#0b1329',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  color: '#cbd5e1',
                  fontFamily: 'var(--font-mono)',
                  wordBreak: 'break-all',
                }}
              >
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>Clipboard Contents: </span>
                {readClipboardResult || '(empty)'}
              </div>
            )}
          </div>
        </Card>

        {/* Window & Desktop Inspector Card */}
        <Card
          title="Active Desktop Windows Inspector"
          subtitle="Non-invasive inspection of active desktop applications with sensitive title redaction."
          action={
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCw size={13} className={isInspectingWindows ? 'spin' : ''} />}
              onClick={() => void handleInspectWindows()}
              disabled={isInspectingWindows}
            >
              Inspect Windows
            </Button>
          }
        >
          {activeWindows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '13px' }}>
              <Monitor size={32} color="#64748b" style={{ margin: '0 auto 8px', display: 'block' }} />
              Click &quot;Inspect Windows&quot; to view active allowlisted desktop applications.
            </div>
          ) : (
            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeWindows.map((win, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {win.windowTitle}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#64748b' }}>
                      {win.processName} (PID: {win.pid})
                    </span>
                  </div>
                  <Badge variant={win.isResponsive ? 'teal' : 'amber'} size="sm">
                    {win.isResponsive ? 'Responsive' : 'Unresponsive'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Last Result Banner */}
      {lastResult && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: lastResult.success ? 'rgba(45, 212, 191, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${lastResult.success ? 'rgba(45, 212, 191, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12.5px',
            color: lastResult.success ? '#99f6e4' : '#fecdd3',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {lastResult.success ? <CheckCircle size={16} color="#2dd4bf" /> : <ShieldX size={16} color="#f43f5e" />}
            <span>
              <strong>{lastResult.actionType}:</strong>{' '}
              {lastResult.output || lastResult.error}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8' }}>
            {lastResult.executionTimeMs}ms
          </span>
        </div>
      )}

      {/* Human-in-the-Loop Confirmation Gate Modal */}
      {pendingRequest && (
        <div
          role="dialog"
          aria-labelledby="auth-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lock size={20} color="#f59e0b" />
              </div>
              <div>
                <h3 id="auth-modal-title" style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: 600 }}>
                  Authorize Windows Automation Action
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Request ID: {pendingRequest.id}
                </span>
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8' }}>Action Type:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 600 }}>
                  {pendingRequest.actionType}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8' }}>Risk Level:</span>
                <Badge variant={pendingRequest.riskLevel === 'high' ? 'rose' : 'amber'} size="sm">
                  {pendingRequest.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8' }}>Target:</span>
                <span style={{ color: '#f1f5f9', fontWeight: 500 }}>
                  {pendingRequest.target}
                </span>
              </div>
              <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>Intended Execution Preview:</span>
                <p style={{ margin: '4px 0 0', color: '#e2e8f0', fontWeight: 500 }}>
                  {pendingRequest.preview}
                </p>
              </div>
            </div>

            <div
              style={{
                fontSize: '12px',
                color: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
            >
              Security Policy: This action directly interacts with your Windows operating system. Authorize only if you recognize the target.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => void handleConfirmAction(false)}
                disabled={isExecutingAction}
              >
                Deny &amp; Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<Play size={14} />}
                onClick={() => void handleConfirmAction(true)}
                disabled={isExecutingAction}
              >
                Authorize &amp; Execute
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Audit Trail Card */}
      <Card
        title="Automation Action Audit Trail"
        subtitle="Cryptographic history of every automated Windows action, permission decision, and outcome."
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={13} />}
            onClick={() => void handleClearLogs()}
            disabled={auditLogs.length === 0}
          >
            Clear Audit Trail
          </Button>
        }
      >
        {auditLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '13px' }}>
            No audit records yet. All executed or denied actions will be logged here with timestamps.
          </div>
        ) : (
          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {auditLogs.slice().reverse().map((log, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Badge
                    variant={
                      log.permissionDecision === 'user_approved'
                        ? 'teal'
                        : log.permissionDecision === 'auto_permitted'
                        ? 'purple'
                        : 'rose'
                    }
                    size="sm"
                  >
                    {log.permissionDecision.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{log.actionType}</span>
                  <span style={{ color: '#94a3b8' }}>&rarr; {log.target}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: log.success ? '#2dd4bf' : '#f43f5e', fontWeight: 600 }}>
                    {log.success ? 'SUCCESS' : 'FAILED / DENIED'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#64748b' }}>
                    {log.durationMs}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
