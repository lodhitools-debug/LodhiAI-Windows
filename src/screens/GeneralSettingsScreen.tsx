import React, { useState, useEffect } from 'react';
import { Check, Download, Trash2, ShieldCheck, Lock, CloudOff, Key, Sparkles, AlertCircle, CheckCircle2, Play } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { exportUserData, purgeUserData, getCurrentLicenseStatus, verifyLicenseToken, clearLicense } from '../services/tauri';
import { AndroidCompanionCockpit } from '../components/companion/AndroidCompanionCockpit';
import { LicenseVerificationResult } from '../types';
import { voiceService, VoiceState } from '../services/voice';

export const GeneralSettingsScreen: React.FC = () => {
  const { settings, updateSettings, edition, setEdition } = useApp();
  const [savedNotice, setSavedNotice] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseVerificationResult | null>(null);
  const [licenseInput, setLicenseInput] = useState('');
  const [isVerifyingLicense, setIsVerifyingLicense] = useState(false);
  const [licenseFeedback, setLicenseFeedback] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>(voiceService.getState());
  const [isTestingSpeech, setIsTestingSpeech] = useState(false);

  useEffect(() => {
    void loadLicense();
    return voiceService.subscribe(setVoiceState);
  }, []);

  async function loadLicense() {
    try {
      const res = await getCurrentLicenseStatus();
      setLicenseStatus(res);
      if (res.state === 'valid' && (res.tier === 'pro' || res.tier === 'business')) {
        setEdition(res.tier as any);
      }
    } catch {
      // web sandbox fallback
    }
  }

  const handleApplyLicense = async () => {
    if (!licenseInput.trim()) return;
    setIsVerifyingLicense(true);
    setLicenseFeedback(null);
    try {
      const res = await verifyLicenseToken(licenseInput.trim());
      setLicenseStatus(res);
      setLicenseFeedback(res.message);
      if (res.state === 'valid' && (res.tier === 'pro' || res.tier === 'business')) {
        setEdition(res.tier as any);
        setLicenseInput('');
      }
    } catch (e) {
      setLicenseFeedback(`Verification error: ${String(e)}`);
    } finally {
      setIsVerifyingLicense(false);
    }
  };

  const handleClearLicense = async () => {
    try {
      const res = await clearLicense();
      setLicenseStatus(res);
      setEdition('free');
      setLicenseFeedback('License cleared. Reverted to Free Community Edition.');
      setLicenseInput('');
    } catch (e) {
      setLicenseFeedback(`Clear error: ${String(e)}`);
    }
  };

  const handleToggle = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
    triggerSaveFeedback();
  };

  const triggerSaveFeedback = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const [retentionDays, setRetentionDays] = useState<number>(0);
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);

  const handleExportData = async () => {
    try {
      const dataStr = await exportUserData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lodhi-ai-vault-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err}`);
    }
  };

  const handlePurgeData = async () => {
    const msg = retentionDays === 0
      ? 'Are you sure you want to completely purge ALL conversations and agent tasks? This is irreversible.'
      : `Purge all conversations and tasks older than ${retentionDays} days?`;
    if (confirm(msg)) {
      try {
        const res = await purgeUserData(retentionDays);
        setPurgeStatus(`Purged ${res.conversationsRemoved} conversation(s) and ${res.tasksRemoved} task(s).`);
        setTimeout(() => setPurgeStatus(null), 4000);
      } catch (err) {
        alert(`Purge failed: ${err}`);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            General Application Settings
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Configure desktop appearance, security guardrails, and feature edition.
          </p>
        </div>
        {savedNotice && (
          <Badge variant="teal" size="md" dot>
            Preferences Saved
          </Badge>
        )}
      </div>

      {/* Commercial Edition Switcher */}
      <Card
        title="Active Product Edition"
        subtitle="Toggle preview of Free, Pro, and Business tier interfaces"
        action={<Badge variant="purple" size="md">Phase 1 Tier Preview</Badge>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '12px' }}>
          {(['free', 'pro', 'business'] as const).map(tier => {
            const isSelected = edition === tier;
            return (
              <div
                key={tier}
                onClick={() => {
                  setEdition(tier);
                  triggerSaveFeedback();
                }}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(7, 11, 20, 0.5)',
                  border: `2px solid ${isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>
                    {tier} Edition
                  </span>
                  {isSelected && <Check size={16} color="#38bdf8" />}
                </div>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {tier === 'free'
                    ? '100% offline desktop experience for individual users'
                    : tier === 'pro'
                    ? 'Multi-model orchestration and coding assistant autonomy'
                    : 'Team vector vaults, audit logging & enterprise compliance'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Security & Privacy Settings */}
      <Card
        title="Privacy & Security Boundaries"
        subtitle="Lodhi AI strict least-privilege policies"
        action={<Badge variant="teal" size="sm" dot>Least-Privilege Active</Badge>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          {/* Telemetry Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(7, 11, 20, 0.5)' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#f8fafc' }}>
                Usage Telemetry & External Analytics
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Strictly disabled by default. No data or prompts ever leave your machine.
              </div>
            </div>
            <button
              onClick={() => handleToggle('telemetryEnabled')}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: settings.telemetryEnabled ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: settings.telemetryEnabled ? '22px' : '4px',
                  transition: 'left 0.2s ease',
                }}
              />
            </button>
          </div>

          {/* Local Sandbox Guard */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(7, 11, 20, 0.5)' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#f8fafc' }}>
                Enforce Local Filesystem Isolation
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Prevents access to directories outside E:\LodhiAI-Windows.
              </div>
            </div>
            <Badge variant="teal" size="sm">
              Enforced Always
            </Badge>
          </div>

          {/* User Confirmation Required */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(7, 11, 20, 0.5)' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#f8fafc' }}>
                Require User Confirmation for System Actions
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Displays explicit permission dialog before any file mutation or shell command.
              </div>
            </div>
            <Badge variant="teal" size="sm">
              Enforced Always
            </Badge>
          </div>
        </div>
      </Card>

      {/* Appearance Settings */}
      <Card title="Interface & Visuals" subtitle="Tailor color scheme and desktop display scale">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Color Theme
            </label>
            <select
              value={settings.theme}
              onChange={e => {
                updateSettings({ theme: e.target.value as any });
                triggerSaveFeedback();
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(7, 11, 20, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="dark-navy">Dark Navy (Official Lodhi AI)</option>
              <option value="midnight">Midnight OLED</option>
              <option value="cyber-blue">Cyber Blue Glass</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Display Density
            </label>
            <select
              value={settings.fontSize}
              onChange={e => {
                updateSettings({ fontSize: e.target.value as any });
                triggerSaveFeedback();
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(7, 11, 20, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="standard">Standard (14px base)</option>
              <option value="compact">Compact Developer (13px base)</option>
              <option value="large">Spacious (15px base)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* AI Conversation & Roman Urdu Preferences */}
      <Card
        title="AI Conversation & Personality"
        subtitle="Configure natural Roman Urdu, bilingual adaptation, and conversational tone"
        action={<Badge variant="teal" size="sm">Phase 8</Badge>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Response Language
            </label>
            <select
              value={settings.chatLanguage || 'auto'}
              onChange={e => {
                updateSettings({ chatLanguage: e.target.value as any });
                triggerSaveFeedback();
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(7, 11, 20, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="auto">Auto-Detect (Roman Urdu for Urdu, English for English)</option>
              <option value="roman-urdu">Roman Urdu (Always)</option>
              <option value="english">English Only</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Conversational Personality
            </label>
            <select
              value={settings.chatPersonality || 'natural-companion'}
              onChange={e => {
                updateSettings({ chatPersonality: e.target.value as any });
                triggerSaveFeedback();
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(7, 11, 20, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="natural-companion">Natural Companion (Warm, respectful human tone)</option>
              <option value="concise-developer">Concise Developer (Direct, technical, minimal filler)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Native Voice Conversation Engine (Phase 9) */}
      <Card
        title="Native Voice Conversation Engine"
        subtitle="Offline Speech-to-Text (STT), Windows SAPI Speech Synthesis (TTS), and hardware diagnostics"
        action={
          <Badge variant={voiceState.microphoneAvailable ? 'teal' : 'amber'} size="sm" dot>
            {voiceState.microphoneAvailable ? 'Mic Connected' : 'No Mic Detected'}
          </Badge>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Speech Recognition Engine (STT)
            </label>
            <select
              value={voiceState.selectedModelId}
              onChange={e => voiceService.setSelectedModel(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(7, 11, 20, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="windows-sapi-built-in">Windows SAPI Built-in (0 MB · Instant Native)</option>
              <option value="whisper-tiny">Whisper.cpp Tiny (75 MB · Urdu & Multilingual)</option>
              <option value="whisper-base">Whisper.cpp Base (142 MB · High Accuracy)</option>
            </select>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Runs 100% offline on your CPU without external audio uploads.
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Desktop Speech Voice (TTS)
            </label>
            <select
              value={voiceState.selectedVoiceId || ''}
              onChange={e => voiceService.setVoice(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(7, 11, 20, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              {voiceState.availableVoices.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Windows SAPI synthesizer reads responses aloud via default speakers.
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Speaking Speed ({voiceState.speakingRate.toFixed(2)}x)
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={voiceState.speakingRate}
              onChange={e => voiceService.setSpeakingRate(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Voice Volume ({Math.round(voiceState.volume * 100)}%)
            </label>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={voiceState.volume}
              onChange={e => voiceService.setVolume(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', gap: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={voiceState.confirmationMode}
                onChange={e => voiceService.setConfirmationMode(e.target.checked)}
              />
              Review &amp; Edit Transcript before sending
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={voiceState.autoSpeakResponses}
                onChange={e => voiceService.setAutoSpeakResponses(e.target.checked)}
              />
              Auto-speak AI responses
            </label>
          </div>

          <Button
            variant="secondary"
            size="sm"
            disabled={isTestingSpeech}
            onClick={() => {
              setIsTestingSpeech(true);
              voiceService.speak('Lodhi AI native voice engine operational.', () => {
                setIsTestingSpeech(false);
              });
            }}
            icon={<Play size={13} />}
          >
            {isTestingSpeech ? 'Speaking...' : 'Test Speech'}
          </Button>
        </div>
      </Card>

      {/* Native Vault Storage & Data Portability */}
      <Card
        title="Native Vault Storage & Data Retention"
        subtitle="Manage persistent local database, backup snapshots, and data export"
        action={<Badge variant="teal" size="sm" dot>Schema v1 Active</Badge>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <div style={{ background: '#0d1117', padding: '12px 16px', borderRadius: '8px', border: '1px solid #30363d' }}>
            <div style={{ color: '#8b949e', fontSize: '11px', textTransform: 'uppercase' }}>
              Vault Database Location
            </div>
            <div style={{ color: '#58a6ff', fontSize: '13px', fontFamily: 'monospace', marginTop: '4px' }}>
              %APPDATA%\com.lodhiai.desktop\lodhi_vault_store.json (.bak auto-snapshot)
            </div>
            <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '4px' }}>
              Atomic updates with automated rollback and single-origin disk isolation.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 500 }}>
                Export Complete User Vault Data
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Download an unencrypted, standard JSON archive of all settings, conversations, and tasks.
              </div>
            </div>
            <Button variant="primary" size="sm" icon={<Download size={14} />} onClick={handleExportData}>
              Export Data (JSON)
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 500 }}>
                Data Retention & Auto-Purge Policy
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Purge conversations and task checkpoints older than the selected retention window.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              >
                <option value={0}>Wipe All Records (0 days)</option>
                <option value={30}>Older than 30 days</option>
                <option value={60}>Older than 60 days</option>
                <option value={90}>Older than 90 days</option>
              </select>
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handlePurgeData}>
                Purge Records
              </Button>
            </div>
          </div>

          {purgeStatus && (
            <div style={{ padding: '8px 12px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid #22c55e', borderRadius: '6px', color: '#86efac', fontSize: '12px' }}>
              {purgeStatus}
            </div>
          )}
        </div>
      </Card>

      {/* Account, Licensing & Commercial SaaS Foundations */}
      <Card
        title="Commercial Licensing & Account Architecture"
        subtitle="Verifiable offline licensing with Ed25519/SHA256 signature validation. Free Community Edition operates 100% offline."
        action={
          <Badge
            variant={
              licenseStatus?.state === 'valid'
                ? 'teal'
                : licenseStatus?.state === 'expired'
                ? 'amber'
                : licenseStatus?.state === 'invalid'
                ? 'rose'
                : 'blue'
            }
            size="sm"
            dot
          >
            {licenseStatus?.state === 'valid'
              ? `License Valid · ${licenseStatus.tier.toUpperCase()}`
              : licenseStatus?.state === 'expired'
              ? 'License Expired'
              : licenseStatus?.state === 'invalid'
              ? 'Invalid Signature'
              : 'Community Free (Active)'}
          </Badge>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: '#cbd5e1' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <div style={{ background: '#070b14', padding: 14, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color="#38bdf8" />
                <span>Account Authentication</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', marginTop: 4 }}>
                Local Desktop Profile
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                No external login or remote tracking required. All tokens and preferences are stored encrypted in your local machine's vault.
              </p>
            </div>

            <div style={{ background: '#070b14', padding: 14, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={14} color="#38bdf8" />
                <span>Device Licensing</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#38bdf8', marginTop: 4 }}>
                {licenseStatus?.ticket
                  ? `${licenseStatus.ticket.tier.toUpperCase()} (${licenseStatus.ticket.subject})`
                  : edition === 'free'
                  ? 'Free Community Edition'
                  : edition === 'pro'
                  ? 'Pro Edition (Evaluation)'
                  : 'Business Enterprise (Evaluation)'}
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                {licenseStatus?.ticket?.expiresAt
                  ? `Valid until ${new Date(licenseStatus.ticket.expiresAt * 1000).toLocaleDateString()}. Cryptographically signed.`
                  : 'Unlicensed mode. Free features are 100% active; commercial cloud sync is scheduled for SaaS release.'}
              </p>
            </div>
          </div>

          {/* License Activation Form */}
          <div style={{ padding: 14, background: '#0b1120', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#f8fafc', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={14} color="#38bdf8" />
              <span>Offline License Token Verification</span>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px 0' }}>
              Enter a signed license token (HEADER.PAYLOAD.SIGNATURE). Verification runs 100% offline against Lodhi AI's embedded public verification key.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="eyJhbGciOiJMT0RISS1TSEEyNTYtVjEi...token"
                value={licenseInput}
                onChange={e => setLicenseInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: '#070b14',
                  border: '1px solid var(--border-subtle)',
                  color: '#f8fafc',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              />
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles size={14} />}
                onClick={handleApplyLicense}
                loading={isVerifyingLicense}
                disabled={isVerifyingLicense || !licenseInput.trim()}
              >
                Verify & Activate
              </Button>
              {licenseStatus?.ticket && (
                <Button variant="outline" size="sm" icon={<Trash2 size={14} />} onClick={handleClearLicense}>
                  Clear License
                </Button>
              )}
            </div>

            {licenseFeedback && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: licenseStatus?.state === 'valid' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${licenseStatus?.state === 'valid' ? '#22c55e' : '#ef4444'}`,
                  color: licenseStatus?.state === 'valid' ? '#86efac' : '#fca5a5',
                }}
              >
                {licenseStatus?.state === 'valid' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{licenseFeedback}</span>
              </div>
            )}
          </div>

          <div style={{ padding: 12, background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 8, fontSize: 12, color: '#bae6fd', lineHeight: 1.6, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <CloudOff size={16} color="#38bdf8" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong>Commercial SaaS Integrity Notice:</strong> No private signing keys, payment credentials, or Stripe secrets exist in this desktop binary. Commercial subscriptions connect via an external hosted SaaS gateway. Local Community Free functionality is 100% unrestricted and permanently free.
            </div>
          </div>
        </div>
      </Card>

      {/* Android Companion Integration */}
      <AndroidCompanionCockpit />
    </div>
  );
};
