import React, { useState, useEffect } from 'react';
import {
  Send,
  ShieldCheck,
  ShieldX,
  Lock,
  Trash2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  getWhatsAppCapabilities,
  getWhatsAppConfig,
  configureWhatsAppSettings,
  validateRecipientPhone,
  draftWhatsAppMessage,
  dispatchWhatsAppMessage,
  getWhatsAppAuditLog,
  clearWhatsAppAuditLog,
} from '../../services/tauri';
import {
  WhatsAppCapabilities,
  WhatsAppConfig,
  WhatsAppDraft,
  WhatsAppDispatchResult,
  WhatsAppAuditEntry,
} from '../../types';

export const WhatsAppWorkflowCockpit: React.FC = () => {
  const [capabilities, setCapabilities] = useState<WhatsAppCapabilities | null>(null);
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<WhatsAppAuditEntry[]>([]);
  const [pendingDraft, setPendingDraft] = useState<WhatsAppDraft | null>(null);
  const [lastResult, setLastResult] = useState<WhatsAppDispatchResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form composer state
  const [recipient, setRecipient] = useState('+14155552671');
  const [bodyText, setBodyText] = useState('Hello from Lodhi AI Desktop Assistant. Your requested build status is complete.');
  const [selectedTemplate, setSelectedTemplate] = useState('welcome_notification');
  const [phoneValidationMsg, setPhoneValidationMsg] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      const caps = await getWhatsAppCapabilities();
      setCapabilities(caps);
      const cfg = await getWhatsAppConfig();
      setConfig(cfg);
      const logs = await getWhatsAppAuditLog();
      setAuditLogs(logs);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleValidatePhone(phoneVal: string) {
    setRecipient(phoneVal);
    if (!phoneVal.trim()) {
      setPhoneValidationMsg(null);
      return;
    }
    try {
      await validateRecipientPhone(phoneVal);
      setPhoneValidationMsg('Valid E.164 phone format');
    } catch (err) {
      setPhoneValidationMsg(String(err));
    }
  }

  async function handleToggleTestMode() {
    if (!config) return;
    const updated: WhatsAppConfig = {
      ...config,
      testMode: !config.testMode,
    };
    try {
      await configureWhatsAppSettings(updated);
      setConfig(updated);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handlePrepareDraft() {
    setError(null);
    setLastResult(null);
    try {
      const draft = await draftWhatsAppMessage(recipient, bodyText, selectedTemplate || undefined);
      // Opens human authorization gate modal
      setPendingDraft(draft);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleConfirmDispatch(authorized: boolean) {
    if (!pendingDraft) return;
    setIsBusy(true);
    setError(null);
    try {
      const result = await dispatchWhatsAppMessage(pendingDraft, authorized);
      setLastResult(result);
      setPendingDraft(null);
      const logs = await getWhatsAppAuditLog();
      setAuditLogs(logs);
    } catch (err) {
      setError(String(err));
      setPendingDraft(null);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleClearLogs() {
    try {
      await clearWhatsAppAuditLog();
      setAuditLogs([]);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Official Business API Compliance Notice */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: '10px',
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          fontSize: '12.5px',
          color: '#bbf7d0',
        }}
      >
        <ShieldCheck size={20} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <strong>Official Meta WhatsApp Business Cloud API Integration:</strong>
          <span>
            {capabilities?.businessVerificationRequiredNotice ||
              'Lodhi AI integrates strictly with the official Meta WhatsApp Business Platform API. Ordinary personal WhatsApp accounts cannot legally or technically use the Business API without official Meta business verification. Test Mode is enabled by default.'}
          </span>
        </div>
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

      {/* Configuration & Status Card */}
      <Card
        title="WhatsApp Platform Configuration & Credentials"
        subtitle="Manage business credentials, test mode sandbox, and dispatch policies."
        action={
          <Badge variant={config?.testMode ? 'teal' : 'purple'} size="sm" dot>
            {config?.testMode ? 'Test Mode (Sandbox)' : 'Live Meta API Mode'}
          </Badge>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '10px' }}>
          {/* Test Mode Switcher */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                Safe Test Mode Sandbox
              </span>
              <Button
                variant={config?.testMode ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => void handleToggleTestMode()}
              >
                {config?.testMode ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.4 }}>
              When enabled, messages are simulated and verified locally without making external HTTP requests to Meta servers.
            </p>
          </div>

          {/* Credential Status */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
              Meta Cloud API Credentials
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#94a3b8' }}>Token Protection:</span>
              <span style={{ color: '#2dd4bf', fontWeight: 500 }}>Windows DPAPI Vault</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#94a3b8' }}>Rate Limit:</span>
              <span style={{ color: '#38bdf8', fontWeight: 500 }}>{config?.rateLimitPerMinute || 20} msgs/min</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Message Composer & Template Drafter */}
      <Card
        title="Compose & Draft WhatsApp Workflow Message"
        subtitle="Prepare validated template or freeform text messages with recipient formatting."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
          {/* Recipient Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              Recipient Phone Number (E.164 Format with Country Code)
            </label>
            <input
              type="text"
              aria-label="Recipient Phone Number"
              value={recipient}
              onChange={e => void handleValidatePhone(e.target.value)}
              placeholder="+14155552671"
              style={{
                background: '#0b1329',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '8px 12px',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
              }}
            />
            {phoneValidationMsg && (
              <span
                style={{
                  fontSize: '11px',
                  color: phoneValidationMsg.includes('Valid') ? '#2dd4bf' : '#f43f5e',
                }}
              >
                {phoneValidationMsg}
              </span>
            )}
          </div>

          {/* Template Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              Message Template
            </label>
            <select
              aria-label="Message Template"
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(e.target.value)}
              style={{
                background: '#0b1329',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '8px 12px',
                fontSize: '13px',
              }}
            >
              <option value="welcome_notification">welcome_notification (Standard Onboarding)</option>
              <option value="system_alert">system_alert (DevOps &amp; Build Notification)</option>
              <option value="custom_message">custom_message (Freeform Text)</option>
            </select>
          </div>

          {/* Message Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                Message Content
              </label>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {bodyText.length} / 4096 chars
              </span>
            </div>
            <textarea
              aria-label="Message Content"
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              rows={3}
              placeholder="Enter message text..."
              style={{
                background: '#0b1329',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '8px 12px',
                fontSize: '13px',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Button
              variant="primary"
              size="md"
              icon={<Send size={14} />}
              onClick={() => void handlePrepareDraft()}
              disabled={isBusy || !recipient.trim() || !bodyText.trim()}
            >
              Prepare Draft for Approval
            </Button>
          </div>
        </div>
      </Card>

      {/* Last Result Banner */}
      {lastResult && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: lastResult.status === 'simulatedDelivered' || lastResult.status === 'sent'
              ? 'rgba(45, 212, 191, 0.1)'
              : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${
              lastResult.status === 'simulatedDelivered' || lastResult.status === 'sent'
                ? 'rgba(45, 212, 191, 0.3)'
                : 'rgba(244, 63, 94, 0.3)'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12.5px',
            color: lastResult.status === 'simulatedDelivered' || lastResult.status === 'sent'
              ? '#99f6e4'
              : '#fecdd3',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {lastResult.status === 'simulatedDelivered' || lastResult.status === 'sent' ? (
              <CheckCircle size={16} color="#2dd4bf" />
            ) : (
              <ShieldX size={16} color="#f43f5e" />
            )}
            <span>
              <strong>Dispatch Result:</strong> {lastResult.status.toUpperCase()} to {lastResult.recipient}{' '}
              (ID: {lastResult.messageId})
            </span>
          </div>
          {lastResult.isTestMode && (
            <Badge variant="teal" size="sm">TEST SANDBOX</Badge>
          )}
        </div>
      )}

      {/* Human-in-the-Loop Confirmation Gate Modal */}
      {pendingDraft && (
        <div
          role="dialog"
          aria-labelledby="wa-modal-title"
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
              border: '1px solid rgba(34, 197, 94, 0.4)',
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
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lock size={20} color="#22c55e" />
              </div>
              <div>
                <h3 id="wa-modal-title" style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: 600 }}>
                  Authorize WhatsApp Message Dispatch
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Draft ID: {pendingDraft.id}
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
                <span style={{ color: '#94a3b8' }}>Recipient:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#2dd4bf', fontWeight: 600 }}>
                  {pendingDraft.recipientPhone}
                </span>
              </div>
              {pendingDraft.templateName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8' }}>Template:</span>
                  <span style={{ color: '#38bdf8' }}>{pendingDraft.templateName}</span>
                </div>
              )}
              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>Message Body:</span>
                <p style={{ margin: '4px 0 0', color: '#e2e8f0' }}>
                  {pendingDraft.bodyText}
                </p>
              </div>
            </div>

            <div
              style={{
                fontSize: '12px',
                color: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(34, 197, 94, 0.2)',
              }}
            >
              {config?.testMode
                ? 'Test Mode Active: This dispatch will be verified and simulated locally. No real message will be sent, and no fees will be charged.'
                : 'Live Dispatch Warning: This message will be sent directly via Meta Cloud API. Review the recipient carefully.'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => void handleConfirmDispatch(false)}
                disabled={isBusy}
              >
                Deny &amp; Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<Send size={14} />}
                onClick={() => void handleConfirmDispatch(true)}
                disabled={isBusy}
              >
                Authorize &amp; Dispatch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Card */}
      <Card
        title="WhatsApp Dispatch Audit Trail"
        subtitle="Privacy-preserving logs with masked recipient phone numbers and permission decisions."
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
            No dispatch records yet. All simulated or live dispatches will be recorded here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                    variant={log.permissionDecision === 'user_approved' ? 'teal' : 'rose'}
                    size="sm"
                  >
                    {log.permissionDecision.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#2dd4bf' }}>
                    {log.recipientMasked}
                  </span>
                  <span style={{ color: '#94a3b8' }}>({log.messageType})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: log.status === 'simulatedDelivered' || log.status === 'sent' ? '#2dd4bf' : '#f43f5e', fontWeight: 600 }}>
                    {log.status.toUpperCase()}
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
