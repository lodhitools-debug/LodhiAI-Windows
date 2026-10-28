import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Send,
  Trash2,
  Settings,
  Keyboard,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import { voiceService, VoiceState } from '../../services/voice';
import { Button } from '../common/Button';

export interface VoiceInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPrompt: (prompt: string) => void;
  lastAssistantResponse?: string;
  activeProviderName?: string;
  isCloudProvider?: boolean;
}

export const VoiceInteractionModal: React.FC<VoiceInteractionModalProps> = ({
  isOpen,
  onClose,
  onSendPrompt,
  lastAssistantResponse,
  activeProviderName = 'Local Ollama',
  isCloudProvider = false,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>(voiceService.getState());
  const [showConfig, setShowConfig] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState(voiceState.transcript);

  useEffect(() => {
    return voiceService.subscribe(state => {
      setVoiceState(state);
      setEditableTranscript(state.transcript);
    });
  }, []);

  if (!isOpen) return null;

  const handleToggleListening = () => {
    if (voiceState.isListening) {
      voiceService.stopListening();
    } else {
      void voiceService.startListening();
    }
  };

  const handleSend = () => {
    const fullText = (editableTranscript || voiceState.transcript || voiceState.interimTranscript).trim();
    if (!fullText) return;

    if (voiceState.isListening) {
      voiceService.stopListening();
    }
    voiceService.setThinking();
    onSendPrompt(fullText);
    voiceService.clearTranscript();
    setEditableTranscript('');
  };

  const handleSpeakLast = () => {
    if (lastAssistantResponse) {
      voiceService.speak(lastAssistantResponse);
    }
  };

  const handleInterrupt = () => {
    voiceService.interrupt();
  };

  const handleClear = () => {
    voiceService.clearTranscript();
    setEditableTranscript('');
  };

  // State machine badge styling
  const getStateBadge = () => {
    if (voiceState.isListening || voiceState.conversationState === 'LISTENING') {
      return { label: 'Listening... Speak naturally', color: '#38bdf8', pulse: true };
    }
    if (voiceState.isSpeaking || voiceState.conversationState === 'SPEAKING') {
      return { label: 'Speaking response...', color: '#10b981', pulse: true };
    }
    if (voiceState.isTranscribing || voiceState.conversationState === 'TRANSCRIBING') {
      return { label: 'Transcribing speech...', color: '#a855f7', pulse: true };
    }
    if (voiceState.conversationState === 'THINKING') {
      return { label: `Thinking (${activeProviderName})...`, color: '#f59e0b', pulse: true };
    }
    if (voiceState.conversationState === 'ERROR') {
      return { label: 'Voice Error', color: '#ef4444', pulse: false };
    }
    return { label: 'Ready (Push-to-Talk)', color: '#94a3b8', pulse: false };
  };

  const badge = getStateBadge();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '620px',
          backgroundColor: 'rgba(11, 19, 41, 0.98)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Mic size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                Voice Assistant &amp; Speech Engine
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                Local Offline Voice Processing • Zero Audio Upload
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowConfig(!showConfig)}
              title="Voice Settings"
              style={{
                padding: '6px',
                backgroundColor: showConfig ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onClose}
              title="Close Voice Assistant"
              style={{
                padding: '6px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cloud Egress Notice if Gemini is active */}
        {isCloudProvider && (
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: '#f59e0b',
            }}
          >
            <AlertTriangle size={14} />
            <span>
              <strong>Cloud Provider Active ({activeProviderName}):</strong> Audio remains 100% local on your PC. Only the transcribed text prompt is sent to Google Gemini upon dispatch.
            </span>
          </div>
        )}

        {/* Hardware Status & State Machine Pill */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {/* Active State Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${badge.color}`,
              fontSize: '11px',
              fontWeight: 600,
              color: badge.color,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: badge.color,
                boxShadow: badge.pulse ? `0 0 8px ${badge.color}` : 'none',
              }}
            />
            {badge.label}
          </div>

          {/* Hardware Diagnostic Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: voiceState.microphoneAvailable
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                color: voiceState.microphoneAvailable ? '#34d399' : '#f87171',
                border: `1px solid ${
                  voiceState.microphoneAvailable ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                }`,
              }}
            >
              Mic: {voiceState.microphoneAvailable ? 'Detected' : 'Not Detected'}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              Engine: {voiceState.selectedModelId === 'windows-sapi-built-in' ? 'Windows SAPI' : 'Whisper'}
            </span>
          </div>
        </div>

        {/* Configuration Drawer */}
        {showConfig && (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '12px',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#f8fafc', fontSize: '13px' }}>
              Voice Engine &amp; Hardware Configuration
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>
                  Speech Recognition (STT):
                </label>
                <select
                  value={voiceState.selectedModelId}
                  onChange={e => voiceService.setSelectedModel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                  }}
                >
                  <option value="windows-sapi-built-in">Windows SAPI Built-in (0 MB · Instant)</option>
                  <option value="whisper-tiny">Whisper.cpp Tiny (75 MB · Urdu/Multilingual)</option>
                  <option value="whisper-base">Whisper.cpp Base (142 MB · High Accuracy)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>
                  Text-to-Speech Voice (TTS):
                </label>
                <select
                  value={voiceState.selectedVoiceId || ''}
                  onChange={e => voiceService.setVoice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                  }}
                >
                  {voiceState.availableVoices.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>
                  Speech Speed ({voiceState.speakingRate.toFixed(2)}x):
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
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>
                  Speech Volume ({Math.round(voiceState.volume * 100)}%):
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

            <div style={{ marginTop: '10px', display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={voiceState.confirmationMode}
                  onChange={e => voiceService.setConfirmationMode(e.target.checked)}
                />
                Review &amp; Edit Transcript before sending (Safe)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={voiceState.autoSpeakResponses}
                  onChange={e => voiceService.setAutoSpeakResponses(e.target.checked)}
                />
                Auto-speak assistant replies
              </label>
            </div>
          </div>
        )}

        {/* Central Waveform & Push-to-Talk Orb */}
        <div
          style={{
            padding: '28px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          {/* Main Action Push-to-Talk Button */}
          <div style={{ position: 'relative' }}>
            {voiceState.isListening && (
              <div
                style={{
                  position: 'absolute',
                  inset: '-12px',
                  borderRadius: '50%',
                  border: '2px solid rgba(56, 189, 248, 0.4)',
                  animation: 'pulse 1.5s infinite',
                }}
              />
            )}
            <button
              onClick={handleToggleListening}
              title={voiceState.isListening ? 'Stop Recording' : 'Start Recording'}
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                backgroundColor: voiceState.isListening
                  ? '#ef4444'
                  : 'rgba(56, 189, 248, 0.15)',
                border: voiceState.isListening
                  ? '3px solid #f87171'
                  : '2px solid rgba(56, 189, 248, 0.5)',
                color: voiceState.isListening ? '#ffffff' : '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: voiceState.isListening
                  ? '0 0 24px rgba(239, 68, 68, 0.5)'
                  : '0 0 16px rgba(56, 189, 248, 0.2)',
              }}
            >
              {voiceState.isListening ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
          </div>

          {/* Audio Activity Visualizer (Decibels 0-100) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '24px' }}>
            {[10, 25, 45, 70, 90, 70, 45, 25, 10].map((h, i) => {
              const active = voiceState.isListening && voiceState.audioLevel > h * 0.5;
              return (
                <div
                  key={i}
                  style={{
                    width: '4px',
                    height: `${voiceState.isListening ? Math.max(4, (voiceState.audioLevel / 100) * 24) : 4}px`,
                    borderRadius: '2px',
                    backgroundColor: active ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                    transition: 'height 0.08s ease, background-color 0.08s ease',
                  }}
                />
              );
            })}
          </div>

          {/* User Guide or Error Notice */}
          {voiceState.error ? (
            <div
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '11px',
                color: '#f87171',
                textAlign: 'center',
                maxWidth: '480px',
              }}
            >
              {voiceState.error}
            </div>
          ) : !voiceState.microphoneAvailable ? (
            <div
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                textAlign: 'center',
                maxWidth: '440px',
              }}
            >
              No active microphone detected. Connect a microphone or headset to use speech input, or continue typing in chat.
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
              Click the microphone button to start speaking in Roman Urdu or English.
            </div>
          )}
        </div>

        {/* Live Transcript / Review Box */}
        <div
          style={{
            padding: '0 20px 16px 20px',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              minHeight: '80px',
              maxHeight: '140px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              <span>Recognized Speech Transcript:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                  title="Toggle Edit Transcript"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Edit3 size={12} />
                  {isEditingTranscript ? 'Done Editing' : 'Edit'}
                </button>
                {voiceState.transcript && (
                  <button
                    onClick={handleClear}
                    title="Clear transcript"
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>

            {isEditingTranscript ? (
              <textarea
                value={editableTranscript}
                onChange={e => {
                  setEditableTranscript(e.target.value);
                  voiceService.setTranscript(e.target.value);
                }}
                rows={3}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#f8fafc',
                  fontSize: '13px',
                  resize: 'none',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <div style={{ fontSize: '13px', color: '#f8fafc', lineHeight: 1.5 }}>
                {voiceState.transcript ? (
                  <span>{voiceState.transcript}</span>
                ) : (
                  <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                    Transcript will appear here as you speak...
                  </span>
                )}
                {voiceState.interimTranscript && (
                  <span style={{ color: '#38bdf8', opacity: 0.8 }}>
                    {' ' + voiceState.interimTranscript}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Controls */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(3, 7, 18, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          {/* Left: TTS last reply & Interrupt buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {voiceState.isSpeaking ? (
              <Button
                variant="danger"
                size="sm"
                onClick={handleInterrupt}
                icon={<VolumeX size={14} />}
              >
                Interrupt Speech
              </Button>
            ) : (
              lastAssistantResponse && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSpeakLast}
                  icon={<Volume2 size={14} />}
                >
                  Speak Last Reply
                </Button>
              )
            )}
            <Button variant="ghost" size="sm" onClick={onClose} icon={<Keyboard size={14} />}>
              Use Text Input
            </Button>
          </div>

          {/* Right: Dispatch to AI Chat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="primary"
              size="sm"
              disabled={!(editableTranscript || voiceState.transcript || voiceState.interimTranscript).trim()}
              onClick={handleSend}
              icon={<Send size={14} />}
            >
              Send to Chat
            </Button>
          </div>
        </div>

        {/* Privacy Mandate Guarantee Banner */}
        <div
          style={{
            padding: '8px 20px',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: '10px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <strong>Privacy Mandate:</strong> Audio recordings are ephemeral and never saved permanently or uploaded to external clouds.
          </span>
          <span>Target: 8 GB RAM • Windows SAPI</span>
        </div>
      </div>
    </div>
  );
};
