import React, { useRef, useEffect, useState } from 'react';
import { Plus, MessageSquare, Shield, Sparkles, Cpu, Loader2, AlertCircle, ArrowDown, Mic } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { ChatMessage } from '../components/chat/ChatMessage';
import { ChatInput } from '../components/chat/ChatInput';
import { VoiceInteractionModal } from '../components/voice/VoiceInteractionModal';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { logger } from '../services/logger';

export const ChatScreen: React.FC = () => {
  const {
    chatSessions,
    activeSessionId,
    activeSession,
    createNewSession,
    selectSession,
    sendMessage,
    stopGeneration,
    isGenerating,
    settings,
  } = useApp();

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestStartedAtRef = useRef<number | null>(null);
  const requestLockRef = useRef(false);
  const pendingRenderRef = useRef<{ sessionId: string; messageCount: number; startedAt: number } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const threshold = 150;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    setIsNearBottom(atBottom);
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setIsNearBottom(true);
  };

  useEffect(() => {
    if (isNearBottom) {
      if (isGenerating) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [activeSession?.messages, isGenerating, isNearBottom]);

  useEffect(() => {
    if (isSending && requestStartedAtRef.current !== null) {
      logger.debug('Chat loading indicator became visible.', 'ChatLatency', {
        stage: 'loading_visible',
        elapsed_ms: Math.round(performance.now() - requestStartedAtRef.current),
      });
    }
  }, [isSending]);

  useEffect(() => {
    const pending = pendingRenderRef.current;
    const lastMessage = activeSession?.messages[activeSession.messages.length - 1];
    if (pending && activeSessionId === pending.sessionId && activeSession &&
        activeSession.messages.length > pending.messageCount && lastMessage?.role === 'assistant') {
      logger.debug('Chat assistant response rendered.', 'ChatLatency', {
        stage: 'response_rendered',
        elapsed_ms: Math.round(performance.now() - pending.startedAt),
      });
      pendingRenderRef.current = null;
      requestStartedAtRef.current = null;
      requestLockRef.current = false;
    }
  }, [activeSessionId, activeSession?.messages]);

  const handleSendMessage = async (content: string) => {
    if (requestLockRef.current || !content.trim()) return;
    const startedAt = performance.now();
    requestStartedAtRef.current = startedAt;
    pendingRenderRef.current = {
      sessionId: activeSessionId,
      messageCount: activeSession?.messages.length ?? 0,
      startedAt,
    };
    requestLockRef.current = true;
    logger.info('Chat prompt submitted.', 'ChatLatency', { stage: 'user_submit' });
    setChatError(null);
    setIsSending(true);
    try {
      await sendMessage(content);
    } catch (error) {
      pendingRenderRef.current = null;
      requestStartedAtRef.current = null;
      requestLockRef.current = false;
      const errorMessage = error instanceof Error
        ? error.message
        : (typeof error === 'string' && error.trim() ? error : null);
      const defaultError = settings.activeProvider === 'gemini'
        ? 'Google Gemini chat request failed. Check your API key or model in Model Providers and try again.'
        : 'Ollama chat request failed. Check Model Providers and try again.';
      setChatError(errorMessage || defaultError);
    } finally {
      requestLockRef.current = false;
      setIsSending(false);
    }
  };

  const lastUserMessage = [...(activeSession?.messages ?? [])].reverse().find(m => m.role === 'user');
  const lastMessage = activeSession?.messages[activeSession.messages.length - 1];
  const isWaitingForFirstChunk = (isSending || isGenerating) && (!lastMessage || lastMessage.role !== 'assistant' || !lastMessage.content);

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        gap: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Chat Sessions Sidebar */}
      <div
        className="glass-panel"
        style={{
          width: '260px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => createNewSession()}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            New Conversation
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '6px 8px',
              display: 'block',
            }}
          >
            Saved Sessions ({chatSessions.length})
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
            {chatSessions.map(session => {
              const isActive = session.id === activeSessionId;
              return (
                <button
                  key={session.id}
                  onClick={() => selectSession(session.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.3)' : 'transparent'}`,
                    color: isActive ? '#f8fafc' : '#94a3b8',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '12.5px',
                    transition: 'all 0.15s ease',
                    overflow: 'hidden',
                  }}
                >
                  <MessageSquare size={14} color={isActive ? '#38bdf8' : '#64748b'} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {session.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            padding: '12px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(7, 11, 20, 0.5)',
            fontSize: '11px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Local Session History</span>
          <Badge variant="teal" size="sm">
            This PC
          </Badge>
        </div>
      </div>

      {/* Main Chat Conversation View */}
      <div
        className="glass-panel"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          padding: '16px',
        }}
      >
        {/* Chat Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                {activeSession?.title || 'Chat Workspace'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {settings.activeProvider === 'gemini'
                    ? `Google Gemini · ${settings.geminiModel || 'gemini-2.5-flash'}`
                    : `Ollama · ${settings.ollamaModel || 'Choose a model'}`}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowVoiceModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 500,
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Open Voice Assistant & Dictation"
            >
              <Mic size={13} />
              <span>Voice Mode</span>
            </button>
            <Badge variant="neutral" size="sm">
              {settings.chatLanguage === 'roman-urdu'
                ? 'Roman Urdu'
                : settings.chatLanguage === 'english'
                ? 'English'
                : 'Auto Urdu/English'}
            </Badge>
            {settings.activeProvider === 'gemini' ? (
              <>
                <Badge variant="purple" size="sm" dot>
                  <Sparkles size={11} style={{ marginRight: '3px' }} />
                  Google Gemini (Cloud)
                </Badge>
                <Badge variant="neutral" size="sm">
                  Cloud Egress
                </Badge>
              </>
            ) : (
              <>
                <Badge variant="teal" size="sm" dot>
                  <Shield size={11} style={{ marginRight: '3px' }} />
                  Local Ollama
                </Badge>
                <Badge variant="purple" size="sm">
                  No cloud provider
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Phase Notice Card */}
        <div
          style={{
            margin: '10px 0',
            padding: '8px 12px',
            backgroundColor: settings.activeProvider === 'gemini' ? 'rgba(168, 85, 247, 0.08)' : 'rgba(129, 140, 248, 0.08)',
            border: settings.activeProvider === 'gemini' ? '1px solid rgba(168, 85, 247, 0.25)' : '1px solid rgba(129, 140, 248, 0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: settings.activeProvider === 'gemini' ? '#e9d5ff' : '#c7d2fe',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {settings.activeProvider === 'gemini' ? (
            <Sparkles size={14} color="#c084fc" style={{ flexShrink: 0 }} />
          ) : (
            <Cpu size={14} color="#818cf8" style={{ flexShrink: 0 }} />
          )}
          <span>
            {settings.activeProvider === 'gemini' ? (
              <>
                <strong>Cloud AI:</strong> Prompts are sent to Google Gemini cloud servers ({settings.geminiModel || 'gemini-3.6-flash'}). Zero local files are transmitted without explicit consent.
              </>
            ) : (
              <>
                <strong>Local AI:</strong> Prompts go to the configured Ollama server on this PC ({settings.ollamaModel || 'qwen2.5-coder:3b'}). Lodhi AI does not send them to a cloud provider.
              </>
            )}
          </span>
        </div>

        {chatError && (
          <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', padding: '10px 12px', borderRadius: '8px', color: '#fecaca', background: 'rgba(127, 29, 29, 0.25)', border: '1px solid rgba(248, 113, 113, 0.35)', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>
                {chatError}{' '}
                {settings.activeProvider === 'gemini'
                  ? (chatError.includes('Model Providers') ? '' : 'Check your Gemini API key or model in Model Providers.')
                  : (chatError.includes('Model Providers') ? '' : 'Check the Ollama endpoint and installed model in Model Providers.')}
              </span>
            </div>
            {lastUserMessage && (
              <button
                type="button"
                onClick={() => handleSendMessage(lastUserMessage.content)}
                style={{
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                  color: '#fecaca',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Messages Scroll Area */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          style={{
            position: 'relative',
            flex: 1,
            overflowY: 'auto',
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {activeSession?.messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isWaitingForFirstChunk && (
            <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: '#94a3b8', fontSize: '12px' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Waiting for {settings.activeProvider === 'gemini' ? 'Gemini' : 'Ollama'}…
            </div>
          )}
          <div ref={messagesEndRef} />

          {/* Floating Scroll to Bottom button when user is scrolled up */}
          {!isNearBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              style={{
                position: 'sticky',
                bottom: '12px',
                alignSelf: 'center',
                backgroundColor: 'rgba(11, 19, 41, 0.95)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '11.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)',
                zIndex: 10,
              }}
            >
              <ArrowDown size={13} />
              <span>Scroll to bottom</span>
            </button>
          )}
        </div>

        {/* Input Bar */}
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={isSending || isGenerating}
          isGenerating={isSending || isGenerating}
          onStopGeneration={stopGeneration}
          onOpenVoice={() => setShowVoiceModal(true)}
        />

        <VoiceInteractionModal
          isOpen={showVoiceModal}
          onClose={() => setShowVoiceModal(false)}
          onSendPrompt={(spokenPrompt) => {
            setShowVoiceModal(false);
            void handleSendMessage(spokenPrompt);
          }}
          lastAssistantResponse={lastMessage?.role === 'assistant' ? lastMessage.content : undefined}
          activeProviderName={settings.activeProvider === 'gemini' ? 'Google Gemini' : 'Local Ollama'}
          isCloudProvider={settings.activeProvider === 'gemini'}
        />
      </div>
    </div>
  );
};
