import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { prepareConversationContext } from '../services/chatContext';
import { OllamaStreamEvent } from '../services/tauri';
import { ChatMessage } from '../components/chat/ChatMessage';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage as ChatMessageType } from '../types';
import { AppProvider } from '../store/AppContext';

describe('Phase 2 — Conversation Context Budgeting', () => {
  it('returns single user prompt when conversation history is empty', () => {
    const context = prepareConversationContext([], 'Hello AI');
    expect(context).toEqual([{ role: 'user', content: 'Hello AI' }]);
  });

  it('preserves existing conversation turns when within budget', () => {
    const messages: ChatMessageType[] = [
      { id: '1', role: 'user', content: 'What is 2+2?', timestamp: 1000 },
      { id: '2', role: 'assistant', content: 'It is 4.', timestamp: 2000 },
    ];
    const context = prepareConversationContext(messages, 'And 4+4?');
    expect(context).toHaveLength(3);
    expect(context[0]).toEqual({ role: 'user', content: 'What is 2+2?' });
    expect(context[1]).toEqual({ role: 'assistant', content: 'It is 4.' });
    expect(context[2]).toEqual({ role: 'user', content: 'And 4+4?' });
  });

  it('prunes turns exceeding maxTurns while preserving the root question and continuity note', () => {
    const messages: ChatMessageType[] = [];
    messages.push({ id: 'root', role: 'user', content: 'Root question: setup Rust project', timestamp: 100 });
    for (let i = 1; i <= 25; i++) {
      messages.push({ id: `u-${i}`, role: 'user', content: `User turn ${i}`, timestamp: 100 + i * 2 });
      messages.push({ id: `a-${i}`, role: 'assistant', content: `Assistant turn ${i}`, timestamp: 101 + i * 2 });
    }

    const context = prepareConversationContext(messages, 'Final question', { maxTurns: 6 });
    expect(context.length).toBeLessThanOrEqual(8);
    // Root prompt preserved
    expect(context[0].content).toContain('Root question: setup Rust project');
    // Continuity note added
    expect(context[1].content).toContain('Earlier conversation turns summarized');
    // Final prompt present
    expect(context[context.length - 1].content).toBe('Final question');
  });

  it('filters out system notices and setup shell banners from model context', () => {
    const messages: ChatMessageType[] = [
      { id: 's1', role: 'system', content: 'System notice', timestamp: 100 },
      { id: 's2', role: 'assistant', content: 'Shell banner', timestamp: 101, modelName: 'Lodhi AI System Shell' },
      { id: 'u1', role: 'user', content: 'User query', timestamp: 102 },
    ];
    const context = prepareConversationContext(messages, 'Follow up');
    expect(context).toHaveLength(2);
    expect(context[0]).toEqual({ role: 'user', content: 'User query' });
    expect(context[1]).toEqual({ role: 'user', content: 'Follow up' });
  });
});

describe('Phase 2 — Real-Time Streaming & Request Routing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accumulates chunks in order and invokes onChunk callback', async () => {
    const chunksReceived: string[] = [];
    const mockEvents: OllamaStreamEvent[] = [
      { request_id: 'req-1', chunk: 'Real', done: false },
      { request_id: 'req-1', chunk: '-time', done: false },
      { request_id: 'req-1', chunk: ' token', done: false },
      { request_id: 'req-1', chunk: ' stream!', done: true, eval_count: 4, eval_duration_ns: 200000000 },
    ];

    // Mock Tauri environment
    const unlistenMock = vi.fn();
    let registeredCallback: ((event: { payload: OllamaStreamEvent }) => void) | null = null;

    vi.stubGlobal('__TAURI_INTERNALS__', {});

    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn(async (channel: string, cb: (e: { payload: OllamaStreamEvent }) => void) => {
        if (channel === 'chat-stream://req-1') {
          registeredCallback = cb;
        }
        return unlistenMock;
      }),
    }));

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn(async (cmd: string, _args: Record<string, unknown>) => {
        if (cmd === 'stream_chat_with_ollama') {
          // Simulate streaming chunks
          for (const evt of mockEvents) {
            registeredCallback?.({ payload: evt });
          }
          return {
            model: 'qwen2.5-coder:3b',
            content: 'Real-time token stream!',
            timings: {
              handler_elapsed_ms: 220,
              http_elapsed_ms: 200,
              ollama_total_ms: 200,
              model_load_ms: 10,
              prompt_eval_ms: 20,
              generation_ms: 170,
            },
          };
        }
        return null;
      }),
    }));

    // Import dynamic streamChatWithOllama with mocks
    const { streamChatWithOllama: streamFn } = await import('../services/tauri');

    const result = await streamFn(
      'http://127.0.0.1:11434',
      'qwen2.5-coder:3b',
      [{ role: 'user', content: 'test' }],
      (chunk) => {
        if (chunk) chunksReceived.push(chunk);
      },
      { requestId: 'req-1' }
    );

    expect(chunksReceived).toEqual(['Real', '-time', ' token', ' stream!']);
    expect(result.content).toBe('Real-time token stream!');
    expect(unlistenMock).toHaveBeenCalled();
  });

  it('strictly isolates chunks by request_id avoiding cross-session leak', async () => {
    const session1Chunks: string[] = [];
    let registeredCallback: ((event: { payload: OllamaStreamEvent }) => void) | null = null;

    vi.stubGlobal('__TAURI_INTERNALS__', {});

    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn(async (channel: string, cb: (e: { payload: OllamaStreamEvent }) => void) => {
        if (channel === 'chat-stream://session-1-req') {
          registeredCallback = cb;
        }
        return vi.fn();
      }),
    }));

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn(async () => {
        // Send a chunk belonging to ANOTHER session request
        registeredCallback?.({
          payload: { request_id: 'session-2-different-req', chunk: 'Alien chunk!', done: false },
        });
        // Send genuine chunk
        registeredCallback?.({
          payload: { request_id: 'session-1-req', chunk: 'Authentic chunk', done: true },
        });
        return { model: 'qwen2.5-coder:3b', content: 'Authentic chunk' };
      }),
    }));

    const { streamChatWithOllama: streamFn } = await import('../services/tauri');

    await streamFn(
      'http://127.0.0.1:11434',
      'qwen2.5-coder:3b',
      [{ role: 'user', content: 'hi' }],
      (chunk) => {
        if (chunk) session1Chunks.push(chunk);
      },
      { requestId: 'session-1-req' }
    );

    // Foreign request chunk must NEVER leak into session 1
    expect(session1Chunks).toEqual(['Authentic chunk']);
    expect(session1Chunks).not.toContain('Alien chunk!');
  });

  it('triggers abortChat and cleans up listener when abort signal is triggered', async () => {
    const abortMock = vi.fn().mockResolvedValue(true);
    const unlistenMock = vi.fn();
    const controller = new AbortController();

    vi.stubGlobal('__TAURI_INTERNALS__', {});

    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn().mockResolvedValue(unlistenMock),
    }));

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn(async (cmd: string) => {
        if (cmd === 'abort_chat') return abortMock();
        if (cmd === 'stream_chat_with_ollama') {
          // Trigger abort midway
          controller.abort();
          throw new Error('Chat request was stopped by the user.');
        }
        return null;
      }),
    }));

    const { streamChatWithOllama: streamFn } = await import('../services/tauri');

    await expect(
      streamFn(
        'http://127.0.0.1:11434',
        'qwen2.5-coder:3b',
        [{ role: 'user', content: 'long query' }],
        vi.fn(),
        { requestId: 'abort-test', signal: controller.signal }
      )
    ).rejects.toThrow(/stopped by the user/);

    expect(unlistenMock).toHaveBeenCalled();
  });
});

describe('Phase 2 — UI Metrics, Streaming Cursor & Stop Generation Button', () => {
  it('renders streaming indicator when isStreaming is true', () => {
    const msg: ChatMessageType = {
      id: 'msg-stream-1',
      role: 'assistant',
      content: 'Thinking and typing',
      timestamp: Date.now(),
      modelName: 'qwen2.5-coder:3b',
      isStreaming: true,
    };

    render(<ChatMessage message={msg} />);
    expect(screen.getByText(/Streaming…/i)).toBeInTheDocument();
  });

  it('renders authentic metrics row with TPS, TTFT, and token count', () => {
    const msg: ChatMessageType = {
      id: 'msg-perf-1',
      role: 'assistant',
      content: 'Here is your optimized code.',
      timestamp: Date.now(),
      modelName: 'qwen2.5-coder:3b',
      metrics: {
        tps: 28.4,
        ttftMs: 245,
        tokenCount: 142,
        totalDurationMs: 5000,
        isEstimatedTokens: false,
      },
    };

    render(<ChatMessage message={msg} />);
    const metricsRow = screen.getByTestId('chat-metrics-row');
    expect(metricsRow).toHaveTextContent(/28.4 tok\/s/);
    expect(metricsRow).toHaveTextContent(/245ms TTFT/);
    expect(metricsRow).toHaveTextContent(/142 tokens/);
    expect(metricsRow).toHaveTextContent(/5.0s/);
  });

  it('labels estimated token count clearly when not exact', () => {
    const msg: ChatMessageType = {
      id: 'msg-est-1',
      role: 'assistant',
      content: 'Partial response content',
      timestamp: Date.now(),
      modelName: 'qwen2.5-coder:3b',
      stopped: true,
      metrics: {
        tokenCount: 6,
        isEstimatedTokens: true,
        totalDurationMs: 1200,
      },
    };

    render(<ChatMessage message={msg} />);
    const metricsRow = screen.getByTestId('chat-metrics-row');
    expect(metricsRow).toHaveTextContent(/6 tokens \(est\.\)/);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('shows Stop Generation button when isGenerating is true and invokes callback on click', () => {
    const onStop = vi.fn();
    render(
      <AppProvider>
        <ChatInput
          onSendMessage={vi.fn()}
          isGenerating={true}
          onStopGeneration={onStop}
        />
      </AppProvider>
    );

    const stopBtn = screen.getByRole('button', { name: /Stop Generation/i });
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 1 Performance & Parameter Options', () => {
  it('forwards modelOptions (num_ctx, num_predict, keep_alive) to invoke', async () => {
    let capturedArgs: Record<string, unknown> | null = null;
    vi.stubGlobal('__TAURI_INTERNALS__', {});

    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn().mockResolvedValue(vi.fn()),
    }));

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn(async (cmd: string, args: Record<string, unknown>) => {
        if (cmd === 'stream_chat_with_ollama') {
          capturedArgs = args;
          return { model: 'qwen2.5-coder:3b', content: 'Option test passed' };
        }
        return null;
      }),
    }));

    const { streamChatWithOllama: streamFn } = await import('../services/tauri');

    await streamFn(
      'http://127.0.0.1:11434',
      'qwen2.5-coder:3b',
      [{ role: 'user', content: 'test options' }],
      vi.fn(),
      {
        requestId: 'opt-req-1',
        modelOptions: {
          num_ctx: 4096,
          num_predict: 2048,
          temperature: 0.7,
          keep_alive: '30m',
        },
      }
    );

    expect(capturedArgs).not.toBeNull();
    const resolvedArgs = capturedArgs as unknown as { options?: unknown };
    expect(resolvedArgs.options).toEqual({
      num_ctx: 4096,
      num_predict: 2048,
      temperature: 0.7,
      keep_alive: '30m',
    });
  });

  it('prewarmOllamaModel invokes prewarm_ollama_model with correct parameters', async () => {
    let prewarmArgs: Record<string, unknown> | null = null;
    vi.stubGlobal('__TAURI_INTERNALS__', {});

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn(async (cmd: string, args: Record<string, unknown>) => {
        if (cmd === 'prewarm_ollama_model') {
          prewarmArgs = args;
          return true;
        }
        return false;
      }),
    }));

    const { prewarmOllamaModel: prewarmFn } = await import('../services/tauri');
    const result = await prewarmFn('http://127.0.0.1:11434', 'qwen2.5-coder:3b', '30m');

    expect(result).toBe(true);
    expect(prewarmArgs).toEqual({
      endpoint: 'http://127.0.0.1:11434',
      model: 'qwen2.5-coder:3b',
      keepAlive: '30m',
    });
  });
});
