import React, { useState, useEffect } from 'react';
import {
  Globe,
  Compass,
  ShieldCheck,
  ShieldX,
  ExternalLink,
  Trash2,
  Lock,
  Play,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  getBrowserCapabilities,
  navigateAndInspectUrl,
  previewBrowserAction,
  executeBrowserAction,
  getBrowserHistory,
  clearBrowserHistory,
} from '../../services/tauri';
import {
  BrowserCapabilities,
  BrowserPageInspection,
  BrowserActionRequest,
  BrowserActionResult,
  BrowserHistoryItem,
} from '../../types';

export const BrowserAutomationCockpit: React.FC = () => {
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);
  const [urlInput, setUrlInput] = useState('https://example.com');
  const [inspection, setInspection] = useState<BrowserPageInspection | null>(null);
  const [history, setHistory] = useState<BrowserHistoryItem[]>([]);
  const [pendingRequest, setPendingRequest] = useState<BrowserActionRequest | null>(null);
  const [lastResult, setLastResult] = useState<BrowserActionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form submit parameters
  const [formInputText, setFormInputText] = useState('Lodhi AI Search Query');

  useEffect(() => {
    void loadInitial();
  }, []);

  async function loadInitial() {
    try {
      const caps = await getBrowserCapabilities();
      setCapabilities(caps);
      const hist = await getBrowserHistory();
      setHistory(hist);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleNavigate(customUrl?: string) {
    const targetUrl = (customUrl || urlInput).trim();
    if (!targetUrl) return;

    setIsLoading(true);
    setError(null);
    setLastResult(null);

    try {
      const result = await navigateAndInspectUrl(targetUrl);
      setInspection(result);
      const hist = await getBrowserHistory();
      setHistory(hist);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFormSubmitPreview() {
    if (!inspection) return;
    setError(null);
    try {
      const req = await previewBrowserAction('submit_form', inspection.url, {
        fields: {
          query: formInputText,
        },
      });
      // Requires human confirmation modal
      setPendingRequest(req);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleConfirmAction(authorized: boolean) {
    if (!pendingRequest) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await executeBrowserAction(pendingRequest, authorized);
      setLastResult(res);
      setPendingRequest(null);
    } catch (err) {
      setError(String(err));
      setPendingRequest(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClearHistory() {
    try {
      await clearBrowserHistory();
      setHistory([]);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
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
        <ShieldCheck size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
        <span>
          <strong>Sandboxed Browser Automation:</strong> External web pages are treated as untrusted input. Scripts, cookies, and local execution overrides are blocked. Form submissions and state-changing actions strictly require explicit human authorization.
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

      {/* URL Navigator Bar */}
      <Card
        title="Web Page Navigator & DOM Inspector"
        subtitle={capabilities?.activeEngine || "Safely inspect web pages, sanitize HTML structures, and extract plain text."}
      >
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: '#0b1329',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0 12px',
              gap: '8px',
            }}
          >
            <Globe size={16} color="#94a3b8" />
            <input
              type="text"
              aria-label="Target Web URL"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://example.com"
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
                padding: '10px 0',
              }}
            />
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<Compass size={14} className={isLoading ? 'spin' : ''} />}
            onClick={() => void handleNavigate()}
            disabled={isLoading || !urlInput.trim()}
          >
            Navigate &amp; Inspect
          </Button>
        </div>

        {/* Quick Example Links */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Test URLs:</span>
          {['https://example.com', 'https://mock.local/test'].map(u => (
            <button
              key={u}
              onClick={() => {
                setUrlInput(u);
                void handleNavigate(u);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                color: '#38bdf8',
                cursor: 'pointer',
              }}
            >
              {u}
            </button>
          ))}
        </div>
      </Card>

      {/* Page Inspection View */}
      {inspection && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          {/* Extracted Content Card */}
          <Card
            title={inspection.title}
            subtitle={inspection.url}
            action={
              <Badge variant={inspection.statusCode === 200 ? 'teal' : 'amber'} size="sm">
                HTTP {inspection.statusCode}
              </Badge>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Sanitized Text Excerpt
                </span>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: '12.5px',
                    color: '#e2e8f0',
                    lineHeight: 1.5,
                    background: 'rgba(15, 23, 42, 0.5)',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {inspection.excerpt}
                </p>
              </div>

              {/* Detected Links */}
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Extracted Links ({inspection.links.length})
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {inspection.links.length === 0 ? (
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>No external links detected.</span>
                  ) : (
                    inspection.links.slice(0, 6).map((lnk, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          fontSize: '11px',
                          color: '#38bdf8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ExternalLink size={10} />
                        {lnk}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Form Automation & Submission Card */}
          <Card
            title="Form Automation Adapter"
            subtitle="Fill and submit forms with strict human authorization gates."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              {inspection.forms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '12.5px' }}>
                  No interactive form fields detected on this page.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {inspection.forms.map((f, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#f8fafc', fontWeight: 600 }}>
                          Field: {f.name}
                        </span>
                        <Badge variant="purple" size="sm">{f.fieldType}</Badge>
                      </div>
                      <input
                        type="text"
                        aria-label={`Form field ${f.name}`}
                        value={formInputText}
                        onChange={e => setFormInputText(e.target.value)}
                        placeholder={`Value for ${f.name}`}
                        style={{
                          background: '#0b1329',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#e2e8f0',
                          padding: '6px 10px',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleFormSubmitPreview()}
                      disabled={isLoading}
                    >
                      Submit Form Data (Approval Req.)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

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
              <strong>{lastResult.actionType}:</strong> {lastResult.output || lastResult.error}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8' }}>
            {lastResult.executionTimeMs}ms
          </span>
        </div>
      )}

      {/* Confirmation Gate Modal for Form Submissions */}
      {pendingRequest && (
        <div
          role="dialog"
          aria-labelledby="browser-modal-title"
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
                <h3 id="browser-modal-title" style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: 600 }}>
                  Authorize External Form Submission
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Target: {pendingRequest.url}
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
                <span style={{ color: '#94a3b8' }}>Action:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 600 }}>
                  {pendingRequest.actionType}
                </span>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>Payload Preview:</span>
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
              Security Policy: Submitting data to an external web server is an irreversible side effect. Confirm only if the destination is trusted.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => void handleConfirmAction(false)}
                disabled={isLoading}
              >
                Deny &amp; Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<Play size={14} />}
                onClick={() => void handleConfirmAction(true)}
                disabled={isLoading}
              >
                Authorize &amp; Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History Card */}
      <Card
        title="Sandboxed Navigation History"
        subtitle="Recent web pages inspected during this local session."
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={13} />}
            onClick={() => void handleClearHistory()}
            disabled={history.length === 0}
          >
            Clear History
          </Button>
        }
      >
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '13px' }}>
            No navigation history recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {history.slice().reverse().map((item, idx) => (
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
                  <Badge variant="teal" size="sm">HTTP {item.statusCode}</Badge>
                  <span style={{ color: '#f8fafc', fontWeight: 500 }}>{item.title}</span>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>({item.url})</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUrlInput(item.url);
                    void handleNavigate(item.url);
                  }}
                >
                  Revisit
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
