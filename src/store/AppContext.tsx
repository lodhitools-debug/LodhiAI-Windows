import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppSettings, ChatMessage, ChatSession, NavScreen, ProductEdition, NativeSystemInfo } from '../types';
import { logger } from '../services/logger';
import {
  chatWithOllama,
  chatWithGemini,
  streamChatWithOllama,
  OllamaStreamEvent,
  OllamaOptions,
  fetchSystemInfo,
  isTauriEnvironment,
  OllamaChatResult,
  GeminiChatResult,
} from '../services/tauri';
import { prepareConversationContext, buildChatSystemPrompt } from '../services/chatContext';

interface AppContextType {
  activeScreen: NavScreen;
  setActiveScreen: (screen: NavScreen) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  edition: ProductEdition;
  setEdition: (edition: ProductEdition) => void;
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  chatSessions: ChatSession[];
  activeSessionId: string;
  activeSession: ChatSession | undefined;
  createNewSession: () => string;
  selectSession: (sessionId: string) => void;
  sendMessage: (content: string) => Promise<OllamaChatResult | GeminiChatResult | void>;
  openWorkspaceInChat: (projectName: string, filePath: string, fileContent: string, prompt?: string) => Promise<void>;
  pendingAgentTask: { filePath?: string; prompt?: string } | null;
  clearPendingAgentTask: () => void;
  openWorkspaceInAgent: (filePath?: string, prompt?: string) => void;
  stopGeneration: () => void;
  isGenerating: boolean;
  systemInfo: NativeSystemInfo | null;
  isTauri: boolean;
  refreshSystemInfo: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark-navy',
  fontSize: 'standard',
  edition: 'free',
  telemetryEnabled: false,
  localIsolationOnly: false,
  requireApprovalForFS: true,
  defaultModelId: 'gemini-3.6-flash',
  customOllamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5-coder:3b',
  activeProvider: 'gemini',
  geminiModel: 'gemini-3.6-flash',
  geminiConsentGiven: true,
  temperature: 0.7,
  contextLength: 4096,
  maxOutputTokens: 2048,
  keepAliveMinutes: 30,
};

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session-default',
    title: 'Welcome to Lodhi AI',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    modelId: 'gemini-3.6-flash',
    messages: [
      {
        id: 'msg-welcome-1',
        role: 'system',
        content: 'Google Gemini is active as your default online AI provider. For offline private inference, select Local Ollama in Model Providers.',
        timestamp: Date.now() - 3600000,
        phaseNote: 'Online Gemini Provider Default',
      },
      {
        id: 'msg-welcome-2',
        role: 'assistant',
        content: 'Welcome to Lodhi AI! Google Gemini is set as your default online AI provider. Configure your Google Gemini API key once in Model Providers to begin chatting. If you prefer 100% on-device offline inference, you can switch to Local Ollama at any time in Model Providers.',
        timestamp: Date.now() - 3590000,
        modelName: 'Google Gemini · gemini-3.6-flash',
        phaseNote: 'Gemini Online Ready',
      },
    ],
  },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeScreen, setActiveScreenState] = useState<NavScreen>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [edition, setEditionState] = useState<ProductEdition>('free');
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('lodhi_app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.geminiModel === 'gemini-2.5-flash' || parsed.geminiModel === 'gemini-2.0-flash') {
          parsed.geminiModel = 'gemini-3.6-flash';
        }
        if (parsed.defaultModelId === 'gemini-2.5-flash' || parsed.defaultModelId === 'gemini-2.0-flash') {
          parsed.defaultModelId = 'gemini-3.6-flash';
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('lodhi_chat_sessions');
      return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
    } catch {
      return INITIAL_SESSIONS;
    }
  });

  const [pendingAgentTask, setPendingAgentTask] = useState<{ filePath?: string; prompt?: string } | null>(null);

  const [activeSessionId, setActiveSessionId] = useState<string>(
    chatSessions[0]?.id || 'session-default'
  );
  const [systemInfo, setSystemInfo] = useState<NativeSystemInfo | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const isTauri = isTauriEnvironment();

  useEffect(() => {
    refreshSystemInfo();
    logger.info(`Lodhi AI started in ${isTauri ? 'Native Tauri Desktop' : 'Web Sandbox'} mode`, 'App');
  }, [isTauri]);

  useEffect(() => {
    try {
      localStorage.setItem('lodhi_app_settings', JSON.stringify(settings));
    } catch (e) {
      logger.error('Failed to persist settings to localStorage', 'Storage', { error: String(e) });
    }
  }, [settings]);

  const lastSavedSessionsRef = useRef<string>('');
  useEffect(() => {
    // If actively streaming, debounce localStorage updates so we do not block the UI thread on every token chunk
    if (isGenerating) {
      const handler = setTimeout(() => {
        try {
          const serialized = JSON.stringify(chatSessions);
          if (serialized !== lastSavedSessionsRef.current) {
            localStorage.setItem('lodhi_chat_sessions', serialized);
            lastSavedSessionsRef.current = serialized;
          }
        } catch (e) {
          logger.error('Failed to persist sessions to localStorage (debounced)', 'Storage', { error: String(e) });
        }
      }, 1500);
      return () => clearTimeout(handler);
    } else {
      try {
        const serialized = JSON.stringify(chatSessions);
        if (serialized !== lastSavedSessionsRef.current) {
          localStorage.setItem('lodhi_chat_sessions', serialized);
          lastSavedSessionsRef.current = serialized;
        }
      } catch (e) {
        logger.error('Failed to persist sessions to localStorage', 'Storage', { error: String(e) });
      }
    }
  }, [chatSessions, isGenerating]);

  const setActiveScreen = (screen: NavScreen) => {
    logger.info(`Navigation: switched to screen '${screen}'`, 'Navigation');
    setActiveScreenState(screen);
  };

  const setEdition = (newEdition: ProductEdition) => {
    logger.info(`Edition changed to '${newEdition.toUpperCase()}'`, 'Settings');
    setEditionState(newEdition);
    setSettings(prev => ({ ...prev, edition: newEdition }));
  };

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      logger.info('Application settings updated', 'Settings', { keys: Object.keys(partial) });
      return next;
    });
  };

  const refreshSystemInfo = async () => {
    try {
      const info = await fetchSystemInfo();
      setSystemInfo(info);
      logger.info(`Host environment: ${info.os} (${info.arch}) - RAM Target: ${info.target_ram_gb} GB`, 'System');
    } catch (err) {
      logger.warn('Failed to retrieve system info via bridge', 'System', { error: String(err) });
    }
  };

  const createNewSession = (): string => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: `Conversation ${chatSessions.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelId: settings.ollamaModel,
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: 'New local Ollama conversation. Prompts stay on this PC.',
          timestamp: Date.now(),
          phaseNote: 'Local Ollama',
        },
      ],
    };

    setChatSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    logger.info(`Created new chat session: ${newSession.title}`, 'Chat');
    return newId;
  };

  const selectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    logger.debug(`Active chat session set to: ${sessionId}`, 'Chat');
  };

  const openWorkspaceInChat = async (projectName: string, filePath: string, fileContent: string, prompt?: string) => {
    const fileName = filePath.split('/').pop() || filePath;
    const newId = `session-${Date.now()}`;
    const question = prompt?.trim() || `Please explain ${fileName} and its key functions or structure.`;
    const fullPrompt = `[Project: ${projectName} | File: ${filePath}]\n\`\`\`\n${fileContent}\n\`\`\`\n\n${question}`;

    const newSession: ChatSession = {
      id: newId,
      title: `${fileName} (${projectName})`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelId: settings.activeProvider === 'gemini' ? (settings.geminiModel || 'gemini-2.5-flash') : settings.ollamaModel,
      messages: [
        {
          id: `msg-ctx-${Date.now()}`,
          role: 'system',
          content: `Project context loaded from ${projectName}/${filePath}. Prompts are isolated to the active session.`,
          timestamp: Date.now(),
          phaseNote: 'Workspace Context',
        },
      ],
    };

    setChatSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setActiveScreenState('chat');
    logger.info(`Opened workspace context in AI Chat: ${filePath}`, 'Workspace');

    setTimeout(() => {
      void sendMessage(fullPrompt);
    }, 100);
  };

  const clearPendingAgentTask = () => {
    setPendingAgentTask(null);
  };

  const openWorkspaceInAgent = (filePath?: string, prompt?: string) => {
    setPendingAgentTask({ filePath, prompt });
    setActiveScreenState('code');
    logger.info(`Navigated to AI Coding Agent with context: ${filePath || 'workspace'}`, 'Workspace');
  };

  const stopGeneration = () => {
    if (activeAbortControllerRef.current) {
      logger.info('User requested Stop Generation.', 'Chat');
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
  };

  const sendMessage = async (content: string): Promise<OllamaChatResult | GeminiChatResult | void> => {
    const prompt = content.trim();
    if (!prompt) return;

    const sessionId = activeSessionId;
    const session = chatSessions.find(candidate => candidate.id === sessionId) || chatSessions[0];
    if (!session) throw new Error('Start a new conversation before sending a prompt.');

    const lastMsg = session.messages[session.messages.length - 1];
    const isRetryingSameUserMessage = Boolean(lastMsg && lastMsg.role === 'user' && lastMsg.content === prompt);

    if (!isRetryingSameUserMessage) {
      const userMsg: ChatMessage = {
        id: `msg-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
      };

      setChatSessions(prev =>
        prev.map(s => {
          if (s.id === sessionId) {
            const isFirstUserMessage = s.messages.filter(m => m.role === 'user').length === 0;
            return {
              ...s,
              title: isFirstUserMessage ? prompt.substring(0, 30) + (prompt.length > 30 ? '…' : '') : s.title,
              updatedAt: Date.now(),
              messages: [...s.messages, userMsg],
            };
          }
          return s;
        })
      );
    }

    // Prepare safe context turns respecting model context limits and configured personality
    const systemPrompt = settings.chatLanguage
      ? buildChatSystemPrompt({
          language: settings.chatLanguage,
          personality: settings.chatPersonality,
        })
      : undefined;
    const maxCharsBudget = (settings.contextLength ?? 4096) * 3;
    const previousTurns = isRetryingSameUserMessage ? session.messages.slice(0, -1) : session.messages;
    const history = prepareConversationContext(previousTurns, prompt, {
      maxChars: maxCharsBudget,
      maxTurns: 20,
      preserveFirstPrompt: true,
      systemPrompt,
    });

    const modelOptions: OllamaOptions = {
      temperature: settings.temperature ?? 0.7,
      num_ctx: settings.contextLength ?? 4096,
      num_predict: settings.maxOutputTokens ?? 2048,
      keep_alive: `${settings.keepAliveMinutes ?? 30}m`,
    };

    if (settings.activeProvider === 'gemini') {
      if (!settings.geminiConsentGiven) {
        throw new Error('User consent required: Google Gemini sends prompts to Google cloud servers. Please enable cloud egress consent in Model/Provider Settings.');
      }
      try {
        setIsGenerating(true);
        const bridgeStartedAt = performance.now();
        const model = settings.geminiModel || 'gemini-3.6-flash';
        const result = await chatWithGemini(model, history);
        const totalDurationMs = Math.round(performance.now() - bridgeStartedAt);
        const assistantMessage: ChatMessage = {
          id: `msg-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: result.content,
          timestamp: Date.now(),
          modelName: `Gemini · ${result.model}`,
          metrics: {
            totalDurationMs,
            tokenCount: result.timings?.candidates_tokens ?? undefined,
            promptTokens: result.timings?.prompt_tokens ?? undefined,
          },
        };
        setChatSessions(prev => prev.map(s => s.id === sessionId
          ? { ...s, updatedAt: Date.now(), messages: [...s.messages, assistantMessage] }
          : s));
        logger.info(`Google Gemini cloud response received for session ${sessionId} using model ${result.model}.`, 'Chat');
        logger.info('Gemini chat result received by frontend.', 'ChatLatency', {
          stage: 'frontend_result_received',
          elapsed_ms: totalDurationMs,
          model: result.model,
          ...(result.timings ?? {}),
        });
        return result;
      } catch (error) {
        logger.warn('Google Gemini chat request failed.', 'Chat');
        throw error;
      } finally {
        setIsGenerating(false);
      }
    }

    const assistantMsgId = `msg-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // In non-Tauri test / web sandbox environments, dispatch via chatWithOllama to preserve test mocks
    if (!isTauri) {
      try {
        const bridgeStartedAt = performance.now();
        const result = await chatWithOllama(settings.customOllamaUrl, settings.ollamaModel, history, modelOptions);
        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: result.content,
          timestamp: Date.now(),
          modelName: result.model,
          metrics: {
            totalDurationMs: Math.round(performance.now() - bridgeStartedAt),
            tokenCount: result.timings?.generation_ms ? Math.ceil(result.content.length / 4) : undefined,
            isEstimatedTokens: true,
          },
        };
        setChatSessions(prev =>
          prev.map(s =>
            s.id === sessionId
              ? { ...s, updatedAt: Date.now(), messages: [...s.messages, assistantMessage] }
              : s
          )
        );
        logger.info(`Local Ollama response received for session ${sessionId} using model ${result.model}.`, 'Chat');
        logger.info('Local chat result received by the frontend.', 'ChatLatency', {
          stage: 'frontend_result_received',
          elapsed_ms: Math.round(performance.now() - bridgeStartedAt),
          model: result.model,
          ...(result.timings ?? {}),
        });
        return result;
      } catch (error) {
        logger.warn('Local Ollama chat request failed.', 'Chat');
        throw error;
      }
    }

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;
    setIsGenerating(true);

    const bridgeStartedAt = performance.now();
    let firstTokenTime: number | null = null;
    let accumulatedContent = '';
    let finalEvent: OllamaStreamEvent | null = null;

    // Append initial streaming placeholder message
    const placeholderMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      modelName: settings.ollamaModel,
      isStreaming: true,
    };

    setChatSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, updatedAt: Date.now(), messages: [...s.messages, placeholderMessage] }
          : s
      )
    );

    try {
      const result = await streamChatWithOllama(
        settings.customOllamaUrl,
        settings.ollamaModel,
        history,
        (chunk, event) => {
          if (chunk && firstTokenTime === null) {
            firstTokenTime = performance.now();
          }
          if (chunk) {
            accumulatedContent += chunk;
          }
          finalEvent = event;

          setChatSessions(prev =>
            prev.map(s => {
              if (s.id !== sessionId) return s;
              return {
                ...s,
                messages: s.messages.map(m => {
                  if (m.id !== assistantMsgId) return m;
                  return {
                    ...m,
                    content: accumulatedContent,
                    modelName: event.model || m.modelName,
                    isStreaming: !event.done && !event.cancelled,
                  };
                }),
              };
            })
          );
        },
        { signal: controller.signal, modelOptions }
      );

      const totalDurationMs = Math.round(performance.now() - bridgeStartedAt);
      const ttftMs = firstTokenTime ? Math.round(firstTokenTime - bridgeStartedAt) : undefined;
      const lastStreamEvent = finalEvent as OllamaStreamEvent | null;
      const evalCount = lastStreamEvent?.eval_count;
      const evalDurationNs = lastStreamEvent?.eval_duration_ns;
      const tps = evalDurationNs && evalDurationNs > 0 && evalCount
        ? Math.round((evalCount / (evalDurationNs / 1e9)) * 10) / 10
        : undefined;

      const finalContent = result.content || accumulatedContent;

      setChatSessions(prev =>
        prev.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            updatedAt: Date.now(),
            messages: s.messages.map(m => {
              if (m.id !== assistantMsgId) return m;
              return {
                ...m,
                content: finalContent,
                modelName: result.model || m.modelName,
                isStreaming: false,
                stopped: false,
                metrics: {
                  ttftMs,
                  totalDurationMs,
                  tokenCount: evalCount,
                  tps,
                  isEstimatedTokens: false,
                  promptTokens: lastStreamEvent?.prompt_eval_count ?? undefined,
                  promptEvalMs: lastStreamEvent?.prompt_eval_duration_ns
                    ? Math.round(lastStreamEvent.prompt_eval_duration_ns / 1e6)
                    : undefined,
                },
              };
            }),
          };
        })
      );

      logger.info(`Local Ollama streaming response complete for session ${sessionId} using model ${result.model}.`, 'Chat');
      logger.info('Local chat result received by the frontend.', 'ChatLatency', {
        stage: 'frontend_result_received',
        elapsed_ms: totalDurationMs,
        model: result.model,
        ttft_ms: ttftMs,
        tps,
        tokens: evalCount,
        ...(result.timings ?? {}),
      });

      return result;
    } catch (error) {
      const isStopped =
        controller.signal.aborted ||
        (error instanceof Error && error.message.toLowerCase().includes('stopped by the user'));

      if (isStopped) {
        logger.info('Streaming was stopped by the user.', 'Chat');
        const stoppedDurationMs = Math.round(performance.now() - bridgeStartedAt);
        setChatSessions(prev =>
          prev.map(s => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              messages: s.messages.map(m => {
                if (m.id !== assistantMsgId) return m;
                return {
                  ...m,
                  content: accumulatedContent || '[Generation stopped by user]',
                  isStreaming: false,
                  stopped: true,
                  metrics: {
                    totalDurationMs: stoppedDurationMs,
                    tokenCount: Math.ceil(accumulatedContent.length / 4),
                    isEstimatedTokens: true,
                  },
                };
              }),
            };
          })
        );
        return;
      }

      if (!accumulatedContent) {
        setChatSessions(prev =>
          prev.map(s =>
            s.id === sessionId
              ? { ...s, messages: s.messages.filter(m => m.id !== assistantMsgId) }
              : s
          )
        );
      } else {
        setChatSessions(prev =>
          prev.map(s => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m
              ),
            };
          })
        );
      }

      logger.warn('Local Ollama streaming chat request failed.', 'Chat');
      throw error;
    } finally {
      activeAbortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const activeSession = chatSessions.find(s => s.id === activeSessionId) || chatSessions[0];

  return (
    <AppContext.Provider
      value={{
        activeScreen,
        setActiveScreen,
        sidebarCollapsed,
        setSidebarCollapsed,
        edition,
        setEdition,
        settings,
        updateSettings,
        chatSessions,
        activeSessionId,
        activeSession,
        createNewSession,
        selectSession,
        sendMessage,
        openWorkspaceInChat,
        pendingAgentTask,
        clearPendingAgentTask,
        openWorkspaceInAgent,
        stopGeneration,
        isGenerating,
        systemInfo,
        isTauri,
        refreshSystemInfo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
