import { DiagnosticLog, LogLevel } from '../types';

type LogListener = (log: DiagnosticLog) => void;

function sanitizeLogText(text: string): string {
  if (!text) return text;
  // Redact Google / Gemini API keys (AIza...)
  let sanitized = text.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
  // Redact Stripe secret keys and webhooks (sk_live_..., whsec_...)
  sanitized = sanitized.replace(/(?:sk_live_|whsec_)[0-9A-Za-z_]{20,}/g, '[REDACTED_SECRET]');
  // Redact JWT Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, 'Bearer [REDACTED_JWT]');
  return sanitized;
}

function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return details;
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    const isTokenCount = lowerKey.endsWith('_tokens') || lowerKey.endsWith('tokens');
    if (!isTokenCount && (lowerKey.includes('key') || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('auth') || lowerKey === 'token' || lowerKey.endsWith('_token') || lowerKey.startsWith('token_'))) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'string') {
      clean[key] = sanitizeLogText(val);
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeDetails(val as Record<string, unknown>);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

class LoggerService {
  private logs: DiagnosticLog[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 300;

  constructor() {
    this.info('Lodhi AI Diagnostic Logger initialized', 'System');
  }

  public getLogs(): DiagnosticLog[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    this.info('Diagnostic logs cleared by user', 'Diagnostics');
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public log(level: LogLevel, message: string, source = 'App', details?: Record<string, unknown>): DiagnosticLog {
    const cleanMessage = sanitizeLogText(message);
    const cleanDetails = sanitizeDetails(details);

    const entry: DiagnosticLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      level,
      message: cleanMessage,
      source,
      timestamp: Date.now(),
      details: cleanDetails,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Also output to dev console
    const tag = `[${level}][${source}]`;
    if (level === 'ERROR') {
      console.error(tag, cleanMessage, cleanDetails || '');
    } else if (level === 'WARN') {
      console.warn(tag, cleanMessage, cleanDetails || '');
    } else {
      console.log(tag, cleanMessage, cleanDetails || '');
    }

    this.listeners.forEach(fn => fn(entry));
    return entry;
  }

  public info(message: string, source = 'App', details?: Record<string, unknown>): DiagnosticLog {
    return this.log('INFO', message, source, details);
  }

  public warn(message: string, source = 'App', details?: Record<string, unknown>): DiagnosticLog {
    return this.log('WARN', message, source, details);
  }

  public error(message: string, source = 'App', details?: Record<string, unknown>): DiagnosticLog {
    return this.log('ERROR', message, source, details);
  }

  public debug(message: string, source = 'App', details?: Record<string, unknown>): DiagnosticLog {
    return this.log('DEBUG', message, source, details);
  }
}

export const logger = new LoggerService();
