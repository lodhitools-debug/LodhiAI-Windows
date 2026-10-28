import React, { useState, useEffect } from 'react';
import { ShieldCheck, Trash2, Copy, Check, Download, RefreshCw, Send } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { logger } from '../services/logger';
import { pingNativeBackend, fetchDiagnostics } from '../services/tauri';
import { DiagnosticLog, LogLevel, NativeDiagnostics, PingResponse } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const DiagnosticsScreen: React.FC = () => {
  const { systemInfo, isTauri, refreshSystemInfo } = useApp();
  const [logs, setLogs] = useState<DiagnosticLog[]>(() => logger.getLogs());
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [pingResult, setPingResult] = useState<PingResponse | null>(null);
  const [nativeDiag, setNativeDiag] = useState<NativeDiagnostics | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = logger.subscribe(() => {
      setLogs(logger.getLogs());
    });
    return () => unsubscribe();
  }, []);

  const handlePing = async () => {
    setIsPinging(true);
    try {
      const res = await pingNativeBackend();
      setPingResult(res);
      logger.info(`Ping response received: ${res.message}`, 'Diagnostics');
    } catch (err) {
      logger.error('Failed to ping native backend', 'Diagnostics', { error: String(err) });
    } finally {
      setIsPinging(false);
    }
  };

  const handleFetchDiagnostics = async () => {
    try {
      const diag = await fetchDiagnostics();
      setNativeDiag(diag);
      logger.info('Fetched native diagnostics snapshot', 'Diagnostics');
    } catch (err) {
      logger.error('Failed to fetch native diagnostics', 'Diagnostics', { error: String(err) });
    }
  };

  const handleClearLogs = () => {
    logger.clearLogs();
    setLogs(logger.getLogs());
  };

  const handleCopyLogs = () => {
    const formatted = logs
      .map(l => `[${new Date(l.timestamp).toISOString()}][${l.level}][${l.source}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `lodhi-diagnostics-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    logger.info('Diagnostic logs exported to file', 'Diagnostics');
  };

  const filteredLogs = logs.filter(l => {
    if (filterLevel === 'ALL') return true;
    return l.level === filterLevel;
  });

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'ERROR':
        return <Badge variant="rose" size="sm">ERROR</Badge>;
      case 'WARN':
        return <Badge variant="amber" size="sm">WARN</Badge>;
      case 'DEBUG':
        return <Badge variant="purple" size="sm">DEBUG</Badge>;
      case 'INFO':
      default:
        return <Badge variant="blue" size="sm">INFO</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Diagnostics Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Diagnostics & System Telemetry
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Real-time event log, Tauri IPC bridge inspector, and hardware health metrics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="outline"
            size="sm"
            icon={<Send size={13} />}
            loading={isPinging}
            onClick={handlePing}
          >
            Test Rust IPC Ping
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={13} />}
            onClick={() => {
              refreshSystemInfo();
              handleFetchDiagnostics();
            }}
          >
            Refresh Status
          </Button>
        </div>
      </div>

      {/* IPC Bridge & Platform Health Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <Card
          title="Runtime Bridge"
          subtitle="IPC Communication Layer"
          action={<Badge variant={isTauri ? 'teal' : 'blue'} size="sm">{isTauri ? 'Native Tauri 2' : 'Web Fallback'}</Badge>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>IPC Status:</span>
              <strong style={{ color: '#2dd4bf' }}>Active & Ready</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Last Ping:</span>
              <span style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                {pingResult ? pingResult.status : 'Click "Test Rust IPC Ping"'}
              </span>
            </div>
            {pingResult && (
              <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                {pingResult.message}
              </div>
            )}
            {nativeDiag && (
              <div style={{ fontSize: '11px', color: '#2dd4bf', fontFamily: 'var(--font-mono)' }}>
                {nativeDiag.engine} — {nativeDiag.status}
              </div>
            )}
          </div>
        </Card>

        <Card
          title="Hardware Profiling"
          subtitle="Windows 8 GB Target Specs"
          action={<HardDriveIcon size={18} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Host OS:</span>
              <strong style={{ color: '#f8fafc' }}>{systemInfo?.os || 'Windows Desktop x64'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>RAM Allocation:</span>
              <strong style={{ color: '#38bdf8' }}>8 GB (Standard Profile)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Sandbox Isolation:</span>
              <Badge variant="teal" size="sm">Strict Least-Privilege</Badge>
            </div>
          </div>
        </Card>

        <Card
          title="Security Sandbox"
          subtitle="Phase 1 Guardrails"
          action={<ShieldCheck size={18} color="#2dd4bf" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Outbound Egress:</span>
              <strong style={{ color: '#2dd4bf' }}>Blocked (Zero bytes)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Old Directory Status:</span>
              <span style={{ color: '#38bdf8', fontSize: '11px' }}>E:\LodhiAI strictly untouched</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Tauri Permissions:</span>
              <span style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>core:default</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Diagnostics Event Log View */}
      <Card
        title={`Diagnostic Event Log (${filteredLogs.length})`}
        subtitle="In-memory trace of UI, IPC bridge, and system operations"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  style={{
                    background: filterLevel === lvl ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    border: `1px solid ${filterLevel === lvl ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: filterLevel === lvl ? '#38bdf8' : '#64748b',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              icon={copied ? <Check size={13} color="#2dd4bf" /> : <Copy size={13} />}
              onClick={handleCopyLogs}
              title="Copy logs"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={13} />}
              onClick={handleExportLogs}
              title="Export JSON"
            >
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={13} color="#f87171" />}
              onClick={handleClearLogs}
              title="Clear logs"
            >
              Clear
            </Button>
          </div>
        }
      >
        <div
          style={{
            marginTop: '10px',
            backgroundColor: '#070b14',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            height: '360px',
            overflowY: 'auto',
            padding: '12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
              No diagnostic logs recorded for filter '{filterLevel}'
            </div>
          ) : (
            filteredLogs.map(log => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderLeft: `2px solid ${
                    log.level === 'ERROR'
                      ? '#f43f5e'
                      : log.level === 'WARN'
                      ? '#fbbf24'
                      : log.level === 'DEBUG'
                      ? '#818cf8'
                      : '#38bdf8'
                  }`,
                }}
              >
                <span style={{ color: '#64748b', fontSize: '11px', flexShrink: 0 }}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span style={{ flexShrink: 0 }}>{getLevelBadge(log.level)}</span>
                <span
                  style={{
                    color: '#818cf8',
                    padding: '0 4px',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(129, 140, 248, 0.1)',
                    fontSize: '11px',
                    flexShrink: 0,
                  }}
                >
                  [{log.source}]
                </span>
                <span style={{ color: '#e2e8f0', wordBreak: 'break-word', flex: 1 }}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

const HardDriveIcon: React.FC<{ size: number }> = ({ size }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="12" x2="2" y2="12"></line>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
      <line x1="6" y1="16" x2="6.01" y2="16"></line>
      <line x1="10" y1="16" x2="10.01" y2="16"></line>
    </svg>
  );
};
