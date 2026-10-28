import React, { useState, useEffect } from 'react';
import {
  getProjectIntelligence,
  runProjectDiagnostics,
  parseDiagnosticsText,
  ProjectIntelligence,
  ProjectDiagnosticsReport,
  DiagnosticItem,
} from '../../services/tauri';
import { logger } from '../../services/logger';

interface CodeIntelligenceCockpitProps {
  onProposeFix?: (file: string, diagnostic: DiagnosticItem) => void;
}

export const CodeIntelligenceCockpit: React.FC<CodeIntelligenceCockpitProps> = ({
  onProposeFix,
}) => {
  const [intel, setIntel] = useState<ProjectIntelligence | null>(null);
  const [report, setReport] = useState<ProjectDiagnosticsReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [selectedToolToRun, setSelectedToolToRun] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all');

  // Custom diagnostic parser sandbox
  const [customText, setCustomText] = useState<string>('');
  const [customSource, setCustomSource] = useState<string>('tsc');
  const [customParsed, setCustomParsed] = useState<DiagnosticItem[]>([]);

  useEffect(() => {
    loadIntelligence();
  }, []);

  const loadIntelligence = async () => {
    setLoading(true);
    try {
      const data = await getProjectIntelligence();
      setIntel(data);
    } catch (err) {
      logger.error('Failed to load project intelligence', 'Diagnostics', { error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRun = (toolId: string) => {
    setSelectedToolToRun(toolId);
    setShowApprovalModal(true);
  };

  const handleConfirmRun = async () => {
    if (!selectedToolToRun) return;
    setShowApprovalModal(false);
    setRunningTool(selectedToolToRun);
    try {
      const res = await runProjectDiagnostics(selectedToolToRun, true);
      setReport(res);
      logger.info('Diagnostics check completed', 'Diagnostics', {
        tool: selectedToolToRun,
        errors: res.totalErrors,
        warnings: res.totalWarnings,
      });
    } catch (err) {
      logger.error('Failed to run diagnostics', 'Diagnostics', { error: String(err) });
    } finally {
      setRunningTool(null);
    }
  };

  const handleParseCustom = async () => {
    if (!customText.trim()) return;
    try {
      const items = await parseDiagnosticsText(customText, customSource);
      setCustomParsed(items);
    } catch (err) {
      logger.error('Failed to parse diagnostic text', 'Diagnostics', { error: String(err) });
    }
  };

  const displayedDiagnostics = report?.diagnostics.filter((d) => {
    if (filterSeverity === 'all') return true;
    return d.severity === filterSeverity;
  }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Overview */}
      <div
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, color: '#f0f6fc', fontSize: '18px' }}>
                Code Intelligence & Diagnostics
              </h3>
              <span
                style={{
                  background: '#238636',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                Polyglot AST & Manifest Aware
              </span>
            </div>
            <p style={{ margin: 0, color: '#8b949e', fontSize: '13px' }}>
              Language & framework detection, dependency intelligence, compiler error parser, and targeted fix suggestions.
            </p>
          </div>
          <button
            onClick={loadIntelligence}
            disabled={loading}
            style={{
              padding: '6px 14px',
              background: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Analyzing...' : 'Refresh Intel'}
          </button>
        </div>

        {intel && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginTop: '16px',
            }}
          >
            <div style={{ background: '#161b22', padding: '12px', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ color: '#8b949e', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                Primary Language
              </div>
              <div style={{ color: '#58a6ff', fontSize: '15px', fontWeight: 600 }}>
                {intel.primaryLanguage}
              </div>
              <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '4px' }}>
                Detected: {intel.detectedLanguages.join(', ') || 'None'}
              </div>
            </div>

            <div style={{ background: '#161b22', padding: '12px', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ color: '#8b949e', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                Frameworks & Libraries
              </div>
              <div style={{ color: '#3fb950', fontSize: '14px', fontWeight: 600 }}>
                {intel.frameworks.join(', ') || 'Standard / Vanilla'}
              </div>
              <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '4px' }}>
                Package Manager: {intel.packageManager}
              </div>
            </div>

            <div style={{ background: '#161b22', padding: '12px', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ color: '#8b949e', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                Entry Points & Target
              </div>
              <div style={{ color: '#d29922', fontSize: '12px', fontWeight: 500 }}>
                {intel.entryPoints.slice(0, 2).join(', ') || 'Root Manifest'}
              </div>
              <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '4px' }}>
                Total Deps: {Object.keys(intel.dependencies).length + Object.keys(intel.devDependencies).length} packages
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Diagnostics Runner */}
      <div
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <h4 style={{ margin: '0 0 12px 0', color: '#f0f6fc', fontSize: '15px' }}>
          Execute Allowlisted Diagnostics & Check Scripts
        </h4>
        <p style={{ margin: '0 0 16px 0', color: '#8b949e', fontSize: '12px' }}>
          Runs the official compiler or linter in the active workspace and parses failures into structured line-targeted diagnostics.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleRequestRun('type-check')}
            disabled={runningTool !== null}
            style={{
              padding: '8px 16px',
              background: runningTool === 'type-check' ? '#1f6feb' : '#238636',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: runningTool !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {runningTool === 'type-check' ? 'Running Type-Check...' : 'Run TypeScript Type-Check'}
          </button>

          <button
            onClick={() => handleRequestRun('test')}
            disabled={runningTool !== null}
            style={{
              padding: '8px 16px',
              background: runningTool === 'test' ? '#1f6feb' : '#1f6feb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: runningTool !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {runningTool === 'test' ? 'Running Tests...' : 'Run Test Suite'}
          </button>

          <button
            onClick={() => handleRequestRun('cargo-check')}
            disabled={runningTool !== null}
            style={{
              padding: '8px 16px',
              background: runningTool === 'cargo-check' ? '#1f6feb' : '#30363d',
              color: '#f0f6fc',
              border: '1px solid #8b949e',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: runningTool !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {runningTool === 'cargo-check' ? 'Running Cargo Check...' : 'Run Cargo Check (Rust)'}
          </button>
        </div>

        {/* Diagnostics Report View */}
        {report && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #21262d', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: report.success ? '#238636' : '#da3633',
                    color: '#ffffff',
                  }}
                >
                  {report.success ? 'PASSED (0 Errors)' : `FAILED (${report.totalErrors} Errors)`}
                </span>
                <span style={{ color: '#8b949e', fontSize: '12px' }}>
                  Warnings: {report.totalWarnings} | Exit Code: {report.exitCode ?? 'N/A'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {(['all', 'error', 'warning'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      border: '1px solid #30363d',
                      background: filterSeverity === sev ? '#388bfd26' : '#161b22',
                      color: filterSeverity === sev ? '#58a6ff' : '#8b949e',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {displayedDiagnostics.length === 0 ? (
              <div style={{ padding: '16px', background: '#161b22', borderRadius: '8px', color: '#8b949e', fontSize: '13px', textAlign: 'center' }}>
                No diagnostic issues detected under filter '{filterSeverity}'.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {displayedDiagnostics.map((diag, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#161b22',
                      border: `1px solid ${diag.severity === 'error' ? '#da3633' : '#d29922'}`,
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span
                          style={{
                            color: '#58a6ff',
                            fontSize: '13px',
                            fontWeight: 600,
                            fontFamily: 'Consolas, monospace',
                          }}
                        >
                          {diag.file}:{diag.line}{diag.column ? `:${diag.column}` : ''}
                        </span>
                        {diag.code && (
                          <span
                            style={{
                              marginLeft: '8px',
                              background: '#30363d',
                              color: '#f0f6fc',
                              fontSize: '11px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontFamily: 'monospace',
                            }}
                          >
                            {diag.code}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          color: diag.severity === 'error' ? '#f85149' : '#d29922',
                        }}
                      >
                        {diag.severity} ({diag.source})
                      </span>
                    </div>

                    <div style={{ color: '#c9d1d9', fontSize: '13px', marginTop: '6px' }}>
                      {diag.message}
                    </div>

                    {diag.suggestedFix && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px 12px',
                          background: '#0d1117',
                          borderLeft: '3px solid #3fb950',
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ color: '#8b949e', fontSize: '12px' }}>
                          <strong style={{ color: '#3fb950' }}>Suggested Fix:</strong> {diag.suggestedFix}
                        </div>
                        {onProposeFix && (
                          <button
                            onClick={() => onProposeFix(diag.file, diag)}
                            style={{
                              padding: '4px 10px',
                              background: '#238636',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              marginLeft: '12px',
                            }}
                          >
                            Propose Fix via Agent
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Parser Sandbox */}
      <div
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', color: '#f0f6fc', fontSize: '15px' }}>
          Live Compiler Error Parser Sandbox
        </h4>
        <p style={{ margin: '0 0 12px 0', color: '#8b949e', fontSize: '12px' }}>
          Paste terminal outputs from tsc, rustc, eslint, or pytest to extract structured diagnostic locations and suggested fixes.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <select
            value={customSource}
            onChange={(e) => setCustomSource(e.target.value)}
            style={{
              padding: '6px 10px',
              background: '#161b22',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            <option value="tsc">TypeScript (tsc)</option>
            <option value="rustc">Rust (cargo/rustc)</option>
            <option value="eslint">ESLint</option>
            <option value="pytest">Python (pytest)</option>
            <option value="generic">Generic Parser</option>
          </select>
          <button
            onClick={handleParseCustom}
            style={{
              padding: '6px 14px',
              background: '#1f6feb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Parse Diagnostics Text
          </button>
        </div>

        <textarea
          rows={4}
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Paste terminal log here, e.g.:&#10;src/App.tsx:42:15 - error TS2322: Type 'string' is not assignable to type 'number'."
          style={{
            width: '100%',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#c9d1d9',
            fontFamily: 'Consolas, monospace',
            fontSize: '12px',
            padding: '10px',
            boxSizing: 'border-box',
          }}
        />

        {customParsed.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px', fontWeight: 600 }}>
              Parsed Diagnostics ({customParsed.length} items):
            </div>
            {customParsed.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                <div style={{ color: '#58a6ff', fontWeight: 600 }}>
                  {item.file}:{item.line} [{item.code || item.severity}]
                </div>
                <div style={{ color: '#c9d1d9', marginTop: '2px' }}>{item.message}</div>
                {item.suggestedFix && (
                  <div style={{ color: '#3fb950', marginTop: '4px' }}>
                    Fix hint: {item.suggestedFix}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Human Confirmation Modal */}
      {showApprovalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '480px',
              width: '90%',
            }}
          >
            <h4 style={{ margin: '0 0 12px 0', color: '#f0f6fc', fontSize: '16px' }}>
              Confirm Diagnostics Tool Execution
            </h4>
            <p style={{ margin: '0 0 16px 0', color: '#c9d1d9', fontSize: '13px' }}>
              Lodhi AI is requesting permission to execute the allowlisted command for tool{' '}
              <strong style={{ color: '#58a6ff' }}>{selectedToolToRun}</strong> within your approved workspace root.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowApprovalModal(false)}
                style={{
                  padding: '8px 14px',
                  background: '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRun}
                style={{
                  padding: '8px 16px',
                  background: '#238636',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Authorize & Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CodeIntelligenceCockpit;
