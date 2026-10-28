import React, { useState, useRef } from 'react';
import { Send, Paperclip, Shield, AlertCircle, Sparkles, Square, Mic } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useApp } from '../../store/AppContext';
import { VoiceInteractionModal } from '../voice/VoiceInteractionModal';

export interface ChatInputProps {
  onSendMessage: (content: string) => void | Promise<void>;
  disabled?: boolean;
  isGenerating?: boolean;
  onStopGeneration?: () => void;
  onOpenVoice?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  isGenerating = false,
  onStopGeneration,
  onOpenVoice,
}) => {
  const { settings } = useApp();
  const isGemini = settings?.activeProvider === 'gemini';
  const [input, setInput] = useState('');
  const [showAttachmentNotice, setShowAttachmentNotice] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || disabled) return;
    onSendMessage(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: 'auto' }}>
      {showAttachmentNotice && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '12px',
            marginBottom: '8px',
            padding: '8px 14px',
            backgroundColor: '#0b1329',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#38bdf8',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            zIndex: 10,
          }}
        >
          <AlertCircle size={14} />
          <span>Local Document RAG is active. Index PDFs, Markdown, and text in the Documents screen to ground conversations.</span>
          <button
            onClick={() => setShowAttachmentNotice(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              marginLeft: '8px',
              fontSize: '11px',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(11, 19, 41, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '14px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          transition: 'border-color 0.2s ease',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isGemini ? "Ask Google Gemini... (Enter to send, Shift+Enter for new line)" : "Ask your local Ollama model... (Enter to send, Shift+Enter for new line)"}
          rows={1}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#f8fafc',
            fontSize: '13.5px',
            lineHeight: 1.5,
            resize: 'none',
            maxHeight: '160px',
            fontFamily: 'inherit',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            backgroundColor: 'rgba(7, 11, 20, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowAttachmentNotice(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                transition: 'all 0.15s ease',
              }}
              title="Local Knowledge Base (Documents)"
            >
              <Paperclip size={15} />
              <span style={{ fontSize: '11px' }}>Attach</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenVoice) {
                  onOpenVoice();
                } else {
                  setShowVoiceModal(true);
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                transition: 'all 0.15s ease',
              }}
              title="Voice Assistant & Dictation"
            >
              <Mic size={15} />
              <span style={{ fontSize: '11px' }}>Voice</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isGemini ? (
                <>
                  <Badge variant="purple" size="sm" dot>
                    <Sparkles size={11} style={{ marginRight: '3px' }} />
                    Google Gemini
                  </Badge>
                  <span style={{ fontSize: '11px', color: '#c084fc' }}>
                    Cloud API
                  </span>
                </>
              ) : (
                <>
                  <Badge variant="teal" size="sm" dot>
                    <Shield size={11} style={{ marginRight: '3px' }} />
                    Local Ollama
                  </Badge>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Loopback only
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isGenerating && onStopGeneration ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onStopGeneration}
                icon={<Square size={12} fill="#f43f5e" color="#f43f5e" />}
                style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: '#fda4af' }}
              >
                Stop Generation
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!input.trim() || disabled}
                icon={<Send size={13} />}
              >
                Send
              </Button>
            )}
          </div>
        </div>
      </form>

      <VoiceInteractionModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSendPrompt={(spokenPrompt) => {
          setShowVoiceModal(false);
          void onSendMessage(spokenPrompt);
        }}
        activeProviderName={isGemini ? 'Google Gemini' : 'Local Ollama'}
        isCloudProvider={isGemini}
      />
    </div>
  );
};
