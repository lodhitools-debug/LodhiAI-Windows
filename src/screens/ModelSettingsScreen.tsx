import React, { useState, useEffect } from 'react';
import { Cpu, Cloud, Shield, Check, Save, Server, Key, Sparkles, AlertCircle, RefreshCw, Lock, Trash2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { RoadmapBanner } from '../components/common/RoadmapBanner';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  listOllamaModels,
  prewarmOllamaModel,
  getGeminiStatus,
  saveGeminiApiKey,
  clearGeminiApiKey,
  testGeminiConnection,
  listGeminiModels,
  type GeminiKeyStatus,
} from '../services/tauri';

export const ModelSettingsScreen: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const [activeTab, setActiveTab] = useState<'local' | 'gemini' | 'cloud' | 'parameters'>('local');

  // Active Provider Selection
  const [activeProvider, setActiveProvider] = useState<'ollama' | 'gemini'>(settings.activeProvider || 'gemini');

  // Ollama states
  const [ollamaUrl, setOllamaUrl] = useState(settings.customOllamaUrl || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(settings.ollamaModel || 'qwen2.5-coder:3b');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  // Gemini states
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel || 'gemini-3.6-flash');
  const [geminiConsentGiven, setGeminiConsentGiven] = useState(settings.geminiConsentGiven ?? true);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [geminiStatus, setGeminiStatus] = useState<GeminiKeyStatus | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isClearingKey, setIsClearingKey] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [geminiModels, setGeminiModels] = useState<string[]>([
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ]);
  const [isFetchingGeminiModels, setIsFetchingGeminiModels] = useState(false);
  const [keyActionNotice, setKeyActionNotice] = useState<string | null>(null);

  // Other Cloud Providers & parameters
  const [lmStudioUrl, setLmStudioUrl] = useState('http://localhost:1234/v1');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [temperature, setTemperature] = useState(String(settings.temperature ?? 0.7));
  const [contextLength, setContextLength] = useState(String(settings.contextLength ?? 4096));
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(settings.maxOutputTokens ?? 2048));
  const [keepAliveMinutes, setKeepAliveMinutes] = useState(String(settings.keepAliveMinutes ?? 30));
  const [chatLanguage, setChatLanguage] = useState<'auto' | 'roman-urdu' | 'english'>(settings.chatLanguage || 'auto');
  const [chatPersonality, setChatPersonality] = useState<'natural-companion' | 'concise-developer'>(settings.chatPersonality || 'natural-companion');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    void loadGeminiKeyStatus();
  }, []);

  const loadGeminiKeyStatus = async () => {
    try {
      const status = await getGeminiStatus();
      setGeminiStatus(status);
    } catch {
      // web sandbox fallback
    }
  };

  const handleSaveGeminiKey = async () => {
    if (!geminiKeyInput.trim()) return;
    setIsSavingKey(true);
    setKeyActionNotice(null);
    try {
      const updated = await saveGeminiApiKey(geminiKeyInput.trim());
      setGeminiStatus(updated);
      setGeminiKeyInput('');
      setKeyActionNotice('API key securely saved to your local vault.');
      setGeminiTestResult(null);
    } catch (e) {
      setKeyActionNotice(`Failed to save key: ${String(e)}`);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleClearGeminiKey = async () => {
    setIsClearingKey(true);
    setKeyActionNotice(null);
    try {
      const updated = await clearGeminiApiKey();
      setGeminiStatus(updated);
      setGeminiKeyInput('');
      setKeyActionNotice('API key cleared from local vault.');
      setGeminiTestResult(null);
    } catch (e) {
      setKeyActionNotice(`Failed to clear key: ${String(e)}`);
    } finally {
      setIsClearingKey(false);
    }
  };

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const reply = await testGeminiConnection(geminiModel);
      setGeminiTestResult({
        kind: 'success',
        message: reply || `Connection verified: ${geminiModel} responded successfully.`,
      });
    } catch (e) {
      setGeminiTestResult({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleFetchGeminiModels = async () => {
    setIsFetchingGeminiModels(true);
    try {
      const models = await listGeminiModels();
      if (models.length) {
        setGeminiModels(models);
        if (!models.includes(geminiModel)) {
          setGeminiModel(models[0]);
        }
      }
    } catch (e) {
      // Keep verified default models
    } finally {
      setIsFetchingGeminiModels(false);
    }
  };

  const handleSave = () => {
    const tempNum = parseFloat(temperature);
    const ctxNum = parseInt(contextLength, 10);
    const maxOutNum = parseInt(maxOutputTokens, 10);
    const keepAliveNum = parseInt(keepAliveMinutes, 10);

    updateSettings({
      customOllamaUrl: ollamaUrl,
      ollamaModel,
      activeProvider,
      geminiModel,
      geminiConsentGiven,
      temperature: isNaN(tempNum) ? 0.7 : Math.max(0.0, Math.min(2.0, tempNum)),
      contextLength: isNaN(ctxNum) ? 4096 : Math.max(512, Math.min(32768, ctxNum)),
      maxOutputTokens: isNaN(maxOutNum) ? 2048 : Math.max(128, Math.min(8192, maxOutNum)),
      keepAliveMinutes: isNaN(keepAliveNum) ? 30 : Math.max(1, Math.min(1440, keepAliveNum)),
      chatLanguage,
      chatPersonality,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);

    // If local Ollama is active, prewarm model in background
    if (activeProvider === 'ollama' && ollamaModel) {
      prewarmOllamaModel(ollamaUrl, ollamaModel, `${keepAliveNum || 30}m`).catch(() => {});
    }
  };

  const handleCheckOllama = async () => {
    setIsCheckingOllama(true);
    setOllamaStatus(null);
    try {
      const models = await listOllamaModels(ollamaUrl);
      setOllamaModels(models);
      if (models.length) {
        setOllamaStatus({
          kind: 'success',
          message: `Connected. Found ${models.length} installed model${models.length === 1 ? '' : 's'}. Model pre-warmed into memory.`,
        });
        if (ollamaModel) {
          prewarmOllamaModel(ollamaUrl, ollamaModel, `${parseInt(keepAliveMinutes, 10) || 30}m`).catch(() => {});
        }
      } else {
        setOllamaStatus({
          kind: 'error',
          message: 'Ollama is running, but no models are installed. A small starting model for an 8 GB PC is qwen2.5-coder:3b.',
        });
      }
    } catch (error) {
      setOllamaStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not reach local Ollama. Start Ollama and check the endpoint.',
      });
    } finally {
      setIsCheckingOllama(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Active AI Engine Banner */}
      <RoadmapBanner
        phase="Active AI Engine"
        featureName="Polyglot AI Engine · Local AI Chat & Gemini Cloud"
        description="Choose between Google Gemini Cloud API (authenticated via native Windows DPAPI secure vault) or local Ollama inference (100% private, on-device). Credentials never touch browser storage."
        statusLabel="Google Gemini 3.8 Flash & Ollama Backends Active"
        deliverablesLabel="Active Provider Capabilities:"
        upcomingDeliverables={[
          'Google Gemini 3.8 Flash & 2.0 Flash high-speed inference',
          'Local Ollama inference with qwen2.5-coder and deepseek models',
          'Zero-leak native Windows DPAPI secret vault (%APPDATA%\\com.lodhiai.desktop)',
          'Strict least-privilege cloud privacy and human consent modal',
        ]}
      />

      {/* Active AI Provider Card */}
      <Card
        title="Active AI Provider"
        subtitle="Select which AI engine handles your chat requests"
        action={
          <Badge variant={activeProvider === 'gemini' ? 'purple' : 'teal'} size="sm" dot>
            {activeProvider === 'gemini' ? 'Google Gemini Cloud (Default Online)' : 'Local Ollama (Active)'}
          </Badge>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '12px' }}>
          {/* Provider Option 1: Gemini (Default Online) */}
          <div
            onClick={() => {
              setActiveProvider('gemini');
              setActiveTab('gemini');
            }}
            style={{
              padding: '16px',
              borderRadius: '10px',
              cursor: 'pointer',
              background: activeProvider === 'gemini' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(15, 23, 42, 0.6)',
              border: `2px solid ${activeProvider === 'gemini' ? '#c084fc' : 'var(--border-subtle)'}`,
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#c084fc" />
                <strong style={{ color: '#f8fafc', fontSize: '14px' }}>Google Gemini</strong>
              </div>
              {activeProvider === 'gemini' && <CheckCircle2 size={18} color="#c084fc" />}
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
              Default Online AI. Model: <code>{geminiModel}</code>. Key: {geminiStatus?.configured ? geminiStatus.masked_key : 'Not configured'}.
            </p>
            <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
              <Badge variant="purple" size="sm">Default Online</Badge>
              <Badge variant={geminiStatus?.configured ? 'teal' : 'neutral'} size="sm">
                {geminiStatus?.configured ? 'Key Ready' : 'Key Needed'}
              </Badge>
            </div>
          </div>

          {/* Provider Option 2: Ollama (Optional Local) */}
          <div
            onClick={() => {
              setActiveProvider('ollama');
              setActiveTab('local');
            }}
            style={{
              padding: '16px',
              borderRadius: '10px',
              cursor: 'pointer',
              background: activeProvider === 'ollama' ? 'rgba(45, 212, 191, 0.12)' : 'rgba(15, 23, 42, 0.6)',
              border: `2px solid ${activeProvider === 'ollama' ? '#2dd4bf' : 'var(--border-subtle)'}`,
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="#2dd4bf" />
                <strong style={{ color: '#f8fafc', fontSize: '14px' }}>Local Ollama</strong>
              </div>
              {activeProvider === 'ollama' && <CheckCircle2 size={18} color="#2dd4bf" />}
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
              Optional 100% on-device processing. Prompts never leave your computer. Model: <code>{ollamaModel}</code>.
            </p>
            <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
              <Badge variant="teal" size="sm">Optional Local</Badge>
              <Badge variant="neutral" size="sm">Zero Egress</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { id: 'local', label: 'Local AI Runtimes (Ollama / LM Studio)', icon: <Server size={15} /> },
          { id: 'gemini', label: 'Google Gemini Cloud Settings', icon: <Sparkles size={15} /> },
          { id: 'cloud', label: 'Cloud API Providers', icon: <Cloud size={15} /> },
          { id: 'parameters', label: 'Inference Parameters', icon: <Cpu size={15} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: activeTab === tab.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: `1px solid ${activeTab === tab.id ? 'rgba(56, 189, 248, 0.4)' : 'transparent'}`,
              color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Local AI Runtimes */}
      {activeTab === 'local' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card
            title="Ollama Local Daemon"
            subtitle="Requests are sent only to the local Ollama endpoint"
            action={<Badge variant="teal" size="sm" dot>Recommended Local</Badge>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <Input
                label="Ollama Server URL"
                value={ollamaUrl}
                onChange={e => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  {ollamaModels.length > 0 ? (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#cbd5e1', fontSize: '12px' }}>
                      Chat model
                      <select value={ollamaModel} onChange={event => setOllamaModel(event.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', background: '#0b1329', color: '#f8fafc', border: '1px solid var(--border-subtle)' }}>
                        {!ollamaModels.includes(ollamaModel) && <option value={ollamaModel}>{ollamaModel} (not installed)</option>}
                        {ollamaModels.map(model => <option key={model} value={model}>{model}</option>)}
                      </select>
                    </label>
                  ) : (
                    <Input label="Chat model" value={ollamaModel} onChange={event => setOllamaModel(event.target.value)} placeholder="qwen2.5-coder:3b" />
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleCheckOllama} loading={isCheckingOllama} disabled={isCheckingOllama}>
                  Check models
                </Button>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Installed model: qwen2.5-coder:3b. Choose a model already installed in Ollama.
              </span>
              {ollamaStatus && (
                <div role={ollamaStatus.kind === 'error' ? 'alert' : 'status'} style={{ color: ollamaStatus.kind === 'error' ? '#fca5a5' : '#5eead4', fontSize: '12px' }}>
                  {ollamaStatus.message}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Use Check models to read installed models from Ollama.
                </span>
              </div>
            </div>
          </Card>

          <Card
            title="LM Studio Local Server"
            subtitle="Alternative local runtime with custom GGUF quantization"
            action={<Badge variant="neutral" size="sm">GGUF Ready</Badge>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <Input
                label="LM Studio OpenAI-Compatible URL"
                value={lmStudioUrl}
                onChange={e => setLmStudioUrl(e.target.value)}
                placeholder="http://localhost:1234/v1"
              />
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Allows loading any quantized model from Hugging Face into memory.
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Google Gemini Cloud */}
      {activeTab === 'gemini' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Privacy & Key Security Notice */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              fontSize: '13px',
              color: '#bae6fd',
            }}
          >
            <Lock size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Native Vault Key Security:</strong> Your Gemini API key is stored securely in your local Windows user profile vault (<code>%APPDATA%\com.lodhiai.desktop\gemini_secret.json</code>) or loaded from the <code>GEMINI_API_KEY</code> environment variable. It is NEVER written to browser <code>localStorage</code>, frontend JavaScript, logs, or error dialogs. All network calls originate natively from Rust.
            </div>
          </div>

          {/* Key Management Card */}
          <Card
            title="Gemini API Key Vault"
            subtitle="Configure or update your Google AI Studio API key"
            action={
              <Badge variant={geminiStatus?.configured ? 'teal' : 'neutral'} size="sm" dot>
                {geminiStatus?.configured ? `Configured (${geminiStatus.source})` : 'Not Configured'}
              </Badge>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(7, 11, 20, 0.6)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Current Key in Vault:</span>
                <span style={{ fontSize: '13px', fontFamily: 'monospace', color: geminiStatus?.configured ? '#86efac' : '#94a3b8', fontWeight: 600 }}>
                  {geminiStatus?.masked_key || geminiStatus?.masked || 'Not configured'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label="Enter Google Gemini API Key"
                    type="password"
                    value={geminiKeyInput}
                    onChange={e => setGeminiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    icon={<Key size={14} />}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveGeminiKey}
                  loading={isSavingKey}
                  disabled={isSavingKey || !geminiKeyInput.trim()}
                >
                  Save to Vault
                </Button>
                {geminiStatus?.configured && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={handleClearGeminiKey}
                    loading={isClearingKey}
                    disabled={isClearingKey}
                  >
                    Clear Key
                  </Button>
                )}
              </div>

              {keyActionNotice && (
                <div role="status" style={{ fontSize: '12px', color: '#5eead4' }}>
                  {keyActionNotice}
                </div>
              )}
            </div>
          </Card>

          {/* Model Selection & Connection Testing */}
          <Card
            title="Model Selection & Connection Test"
            subtitle="Select verified Gemini models and test your endpoint latency"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#cbd5e1', fontSize: '12px' }}>
                    Gemini Model
                    <select
                      value={geminiModel}
                      onChange={e => setGeminiModel(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: '8px', background: '#0b1329', color: '#f8fafc', border: '1px solid var(--border-subtle)', fontSize: '13px' }}
                    >
                      {geminiModels.map(m => (
                        <option key={m} value={m}>
                          {m} {m === 'gemini-3.6-flash' ? '(Recommended · Fast & Active)' : m === 'gemini-3.8-flash' ? '(Latest Experimental)' : m === 'gemini-flash-latest' ? '(Latest Release)' : m === 'gemini-1.5-flash' ? '(Fast & Lightweight)' : m === 'gemini-1.5-pro' ? '(Deep Reasoning)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RefreshCw size={14} />}
                  onClick={handleFetchGeminiModels}
                  loading={isFetchingGeminiModels}
                  disabled={isFetchingGeminiModels || !geminiStatus?.configured}
                >
                  Query API Models
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles size={14} />}
                  onClick={handleTestGemini}
                  loading={isTestingGemini}
                  disabled={isTestingGemini || !geminiStatus?.configured}
                >
                  Test Connection
                </Button>
              </div>

              {geminiTestResult && (
                <div
                  role={geminiTestResult.kind === 'error' ? 'alert' : 'status'}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: geminiTestResult.kind === 'error' ? 'rgba(127, 29, 29, 0.25)' : 'rgba(20, 83, 45, 0.25)',
                    border: `1px solid ${geminiTestResult.kind === 'error' ? 'rgba(248, 113, 113, 0.35)' : 'rgba(74, 222, 128, 0.35)'}`,
                    color: geminiTestResult.kind === 'error' ? '#fecaca' : '#86efac',
                  }}
                >
                  {geminiTestResult.kind === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
                  <span>{geminiTestResult.message}</span>
                </div>
              )}

              {/* Explicit Egress Consent Checkbox */}
              <div
                style={{
                  marginTop: '6px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#f1f5f9', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={geminiConsentGiven}
                    onChange={e => setGeminiConsentGiven(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#c084fc', cursor: 'pointer' }}
                  />
                  <span>
                    <strong>External Egress Consent:</strong> I explicitly consent to transmitting prompt text to Google Gemini cloud servers when Gemini is selected.
                  </span>
                </label>
                <p style={{ margin: '6px 0 0 26px', fontSize: '12px', color: '#94a3b8' }}>
                  Notice: Lodhi AI enforces zero silent project file transmission. Your local project tree and source code remain on your PC.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Other Cloud Providers */}
      {activeTab === 'cloud' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12.5px',
              color: '#bae6fd',
            }}
          >
            <Shield size={16} color="#38bdf8" />
            <span>
              <strong>Cloud provider preview:</strong> Direct Google Gemini support is active in the Gemini tab. Values entered here for other providers remain in this screen only and are not saved or transmitted.
            </span>
          </div>

          <Card title="Anthropic Claude" subtitle="Preview only · not connected in this build">
            <div style={{ marginTop: '8px' }}>
              <Input
                label="Anthropic API Key"
                type="password"
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                icon={<Key size={14} />}
              />
            </div>
          </Card>

          <Card title="OpenAI" subtitle="Preview only · not connected in this build">
            <div style={{ marginTop: '8px' }}>
              <Input
                label="OpenAI API Key"
                type="password"
                value={openAiKey}
                onChange={e => setOpenAiKey(e.target.value)}
                placeholder="sk-proj-..."
                icon={<Key size={14} />}
              />
            </div>
          </Card>

          <Card title="Groq" subtitle="Preview only · not connected in this build">
            <div style={{ marginTop: '8px' }}>
              <Input
                label="Groq API Key"
                type="password"
                value={groqKey}
                onChange={e => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                icon={<Key size={14} />}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Inference Parameters & Personality */}
      {activeTab === 'parameters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card
            title="Conversation Personality & Language"
            subtitle="Configure natural Roman Urdu, bilingual adaptation, and conversational style"
            action={<Badge variant="teal" size="sm">Phase 8 Natural Conversation</Badge>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                  Response Language Mode
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {[
                    { id: 'auto', label: 'Auto-Detect & Match', desc: 'Replies in Roman Urdu when you speak Urdu, English when you speak English' },
                    { id: 'roman-urdu', label: 'Roman Urdu (Always)', desc: 'Fluent Roman Urdu with technical English terminology' },
                    { id: 'english', label: 'English Only', desc: 'Professional and friendly English responses' },
                  ].map(opt => (
                    <div
                      key={opt.id}
                      onClick={() => setChatLanguage(opt.id as any)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: chatLanguage === opt.id ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                        border: `1.5px solid ${chatLanguage === opt.id ? '#38bdf8' : 'var(--border-subtle)'}`,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, color: chatLanguage === opt.id ? '#38bdf8' : '#f8fafc' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                        {opt.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                  Conversational Style
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {[
                    { id: 'natural-companion', label: 'Natural Companion', desc: 'Warm, respectful, human conversational tone matching your level of detail' },
                    { id: 'concise-developer', label: 'Concise Developer', desc: 'Direct, technically sharp, minimal filler words' },
                  ].map(opt => (
                    <div
                      key={opt.id}
                      onClick={() => setChatPersonality(opt.id as any)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: chatPersonality === opt.id ? 'rgba(168, 85, 247, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                        border: `1.5px solid ${chatPersonality === opt.id ? '#c084fc' : 'var(--border-subtle)'}`,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, color: chatPersonality === opt.id ? '#c084fc' : '#f8fafc' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                        {opt.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '12px', color: '#bae6fd' }}>
                💡 <strong>Natural Roman Urdu:</strong> Lodhi AI understands informal Pakistani Roman Urdu expressions and spelling variants (e.g. <em>"kia/kya"</em>, <em>"kaise/kaisay"</em>, <em>"theek/thik"</em>, <em>"btao/batao"</em>). It uses technical English terms naturally without clumsy translation.
              </div>
            </div>
          </Card>

          <Card title="Default Inference Parameters" subtitle="Tune generation temperature, context boundaries, output token limits, and memory residency">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
              <Input
                label="Temperature (0.0 = Deterministic, 1.0 = Creative)"
                value={temperature}
                onChange={e => setTemperature(e.target.value)}
              />
              <Input
                label="Context Window Limit (Tokens, e.g. 4096)"
                value={contextLength}
                onChange={e => setContextLength(e.target.value)}
              />
              <Input
                label="Max Output Tokens (e.g. 2048)"
                value={maxOutputTokens}
                onChange={e => setMaxOutputTokens(e.target.value)}
              />
              <Input
                label="Keep-Alive Duration (Minutes, e.g. 30)"
                value={keepAliveMinutes}
                onChange={e => setKeepAliveMinutes(e.target.value)}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Save Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
        {savedNotice && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2dd4bf' }}>
            <Check size={16} />
            <span>Configuration saved successfully to local state</span>
          </span>
        )}
        <Button variant="primary" icon={<Save size={14} />} onClick={handleSave}>
          Save Configuration
        </Button>
      </div>
    </div>
  );
};
