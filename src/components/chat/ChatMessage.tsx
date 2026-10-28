import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, Sparkles, User, Zap, Clock, Cpu } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '../../types';
import { Badge } from '../common/Badge';

export interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          margin: '12px 0',
        }}
      >
        <div
          style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '20px',
          backgroundColor: 'rgba(45, 212, 191, 0.08)',
          border: '1px solid rgba(45, 212, 191, 0.25)',
          fontSize: '12px',
          color: '#2dd4bf',
        }}
      >
        <ShieldCheck size={14} />
        <span>{message.content}</span>
        {message.phaseNote && (
          <Badge variant="teal" size="sm">
            {message.phaseNote}
          </Badge>
        )}
      </div>
    </div>
  );
}

  const { metrics, isStreaming, stopped } = message;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        margin: '12px 0',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '5px',
          padding: '0 4px',
        }}
      >
        {isUser ? (
          <>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>You</span>
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <User size={12} />
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '5px',
                backgroundColor: '#0b1329',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Sparkles size={12} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
              {message.modelName || 'Lodhi AI'}
            </span>
            {message.modelName?.toLowerCase().includes('gemini') ? (
              <Badge variant="purple" size="sm">
                Google Gemini
              </Badge>
            ) : (
              <Badge variant="teal" size="sm">
                Local Ollama
              </Badge>
            )}
            {isStreaming && (
              <Badge variant="teal" size="sm">
                Streaming…
              </Badge>
            )}
            {stopped && (
              <Badge variant="amber" size="sm">
                Stopped
              </Badge>
            )}
            {message.phaseNote && (
              <Badge variant="neutral" size="sm">
                {message.phaseNote}
              </Badge>
            )}
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          maxWidth: '85%',
          padding: '12px 16px',
          borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
          backgroundColor: isUser
            ? 'rgba(2, 132, 199, 0.25)'
            : 'rgba(17, 29, 61, 0.85)',
          border: isUser
            ? '1px solid rgba(56, 189, 248, 0.4)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          color: '#f8fafc',
          fontSize: '13.5px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxShadow: isUser
            ? '0 2px 12px rgba(2, 132, 199, 0.2)'
            : '0 4px 16px rgba(0, 0, 0, 0.25)',
        }}
      >
        {message.content}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '14px',
              backgroundColor: '#38bdf8',
              marginLeft: '4px',
              verticalAlign: 'text-bottom',
              animation: 'pulse 1s infinite',
            }}
          />
        )}

        <button
          onClick={handleCopy}
          aria-label="Copy message"
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            background: copied ? 'rgba(45, 212, 191, 0.15)' : 'transparent',
            border: copied ? '1px solid rgba(45, 212, 191, 0.3)' : 'none',
            color: copied ? '#2dd4bf' : '#64748b',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '4px',
            opacity: copied ? 1 : 0.6,
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
          onMouseEnter={e => { if (!copied) e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={e => { if (!copied) e.currentTarget.style.opacity = '0.6'; }}
          title={copied ? "Copied!" : "Copy message"}
        >
          {copied ? (
            <>
              <Check size={12} color="#2dd4bf" />
              <span style={{ fontSize: '10px', color: '#2dd4bf', fontWeight: 600 }}>Copied</span>
            </>
          ) : (
            <Copy size={13} />
          )}
        </button>
      </div>

      {/* Performance Metrics Row */}
      {!isUser && metrics && (
        <div
          data-testid="chat-metrics-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '4px',
            padding: '2px 8px',
            fontSize: '11px',
            color: '#64748b',
          }}
        >
          {metrics.tps !== undefined && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#38bdf8' }}>
              <Zap size={11} /> {metrics.tps} tok/s
            </span>
          )}
          {metrics.ttftMs !== undefined && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={11} /> {metrics.ttftMs}ms TTFT
            </span>
          )}
          {metrics.tokenCount !== undefined && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Cpu size={11} /> {metrics.tokenCount} tokens{metrics.isEstimatedTokens ? ' (est.)' : ''}
            </span>
          )}
          {metrics.promptTokens !== undefined && (
            <span>
              {metrics.promptTokens} prompt tokens
            </span>
          )}
          {metrics.totalDurationMs !== undefined && (
            <span>
              {(metrics.totalDurationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      )}
    </div>
  );
};
