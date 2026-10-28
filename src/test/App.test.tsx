import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../store/AppContext';
import App from '../App';
import { chatWithOllama } from '../services/tauri';
import { logger } from '../services/logger';

vi.mock('../services/tauri', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/tauri')>();
  return { ...actual, chatWithOllama: vi.fn() };
});

async function renderApp() {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <AppProvider>
        <App />
      </AppProvider>
    );
  });
  return result;
}

describe('Lodhi AI Windows Desktop Application', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'ollama',
      })
    );
    vi.mocked(chatWithOllama).mockReset();
  });

  it('renders application shell with titlebar branding and tagline', async () => {
    await renderApp();

    expect(screen.getAllByText(/LODHI AI/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Think • Create • Automate/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Local Sandbox/i).length).toBeGreaterThan(0);
  });

  it('navigates seamlessly between all 10 planned Phase 1 screens', async () => {
    await renderApp();

    // Initial screen: Dashboard
    expect(screen.getByRole('heading', { level: 1, name: /Lodhi AI — Think • Create • Automate/i })).toBeInTheDocument();

    // 1. Switch to AI Chat
    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));
    expect(screen.getByPlaceholderText(/Ask your local Ollama model/i)).toBeInTheDocument();

    // 2. Switch to Coding Assistant
    fireEvent.click(screen.getByRole('button', { name: /Coding Assistant/i }));
    expect(screen.getByText(/Autonomous Coding Assistant & AST Engine/i)).toBeInTheDocument();

    // 3. Switch to Workspaces
    fireEvent.click(screen.getByRole('button', { name: /(?:Project )?Workspaces?/i }));
    expect(screen.getAllByText(/Project Workspace/i).length).toBeGreaterThan(0);

    // 4. Switch to Automation Agents
    fireEvent.click(screen.getByRole('button', { name: /Automation Agents/i }));
    expect(screen.getByText(/Multi-Step Autonomous Background Agents/i)).toBeInTheDocument();

    // 5. Switch to Documents & Files
    fireEvent.click(screen.getByRole('button', { name: /Documents & Files/i }));
    expect(screen.getByText(/Local Document Ingestion & Vector Parsing/i)).toBeInTheDocument();

    // 6. Switch to Knowledge Base
    fireEvent.click(screen.getByRole('button', { name: /Knowledge Base/i }));
    expect(screen.getByText(/Local Vector Knowledge Base/i)).toBeInTheDocument();

    // 7. Switch to Model Providers
    fireEvent.click(screen.getByRole('button', { name: /Model Providers/i }));
    expect(screen.getByText(/Local AI Chat/i)).toBeInTheDocument();

    // 8. Switch to Settings
    fireEvent.click(screen.getByRole('button', { name: /^Settings$/i }));
    expect(screen.getByText(/General Application Settings/i)).toBeInTheDocument();

    // 9. Switch to Diagnostics & Logs
    fireEvent.click(screen.getByRole('button', { name: /Diagnostics & Logs/i }));
    expect(screen.getByText(/Diagnostics & System Telemetry/i)).toBeInTheDocument();
  }, 15000);

  it('sends a prompt and displays the response returned by the local model service', async () => {
    vi.mocked(chatWithOllama).mockResolvedValue({ model: 'qwen2.5-coder:3b', content: 'A real model response.' });
    await renderApp();

    // Go to chat screen
    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));

    const input = screen.getByPlaceholderText(/Ask your local Ollama model/i);
    const sendBtn = screen.getByRole('button', { name: /Send/i });

    // Type a message
    fireEvent.change(input, { target: { value: 'Analyze Windows 8GB RAM performance profile' } });
    fireEvent.click(sendBtn);

    await waitFor(() => expect(screen.getByText('A real model response.')).toBeInTheDocument());
    expect(screen.getByText('Analyze Windows 8GB RAM performance profile')).toBeInTheDocument();
    expect(chatWithOllama).toHaveBeenCalledWith(
      'http://localhost:11434',
      'qwen2.5-coder:3b',
      [{ role: 'user', content: 'Analyze Windows 8GB RAM performance profile' }],
      expect.objectContaining({
        keep_alive: '30m',
        num_ctx: 4096,
        num_predict: 2048,
        temperature: 0.7,
      }),
    );
    expect(screen.getAllByText('qwen2.5-coder:3b').length).toBeGreaterThan(0);
  });

  it('shows pending feedback, blocks duplicate sends, and logs timing without prompt or response text', async () => {
    let resolveRequest!: (value: { model: string; content: string; timings: {
      handler_elapsed_ms: number; http_elapsed_ms: number; ollama_total_ms: number;
      model_load_ms: number; prompt_eval_ms: number; generation_ms: number;
    } }) => void;
    vi.mocked(chatWithOllama).mockReturnValue(new Promise(resolve => { resolveRequest = resolve; }));
    logger.clearLogs();
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ask your local Ollama model/i), { target: { value: 'PRIVATE_PROMPT_SENTINEL' } });
    const send = screen.getByRole('button', { name: /Send/i });
    fireEvent.click(send);
    fireEvent.click(send);

    expect(await screen.findByRole('status')).toHaveTextContent(/Waiting for Ollama/i);
    expect(chatWithOllama).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText(/Ask your local Ollama model/i)).toBeDisabled();

    await act(async () => resolveRequest({
      model: 'qwen2.5-coder:3b',
      content: 'PRIVATE_RESPONSE_SENTINEL',
      timings: {
        handler_elapsed_ms: 321,
        http_elapsed_ms: 300,
        ollama_total_ms: 280,
        model_load_ms: 15,
        prompt_eval_ms: 80,
        generation_ms: 185,
      },
    }));
    expect(await screen.findByText('PRIVATE_RESPONSE_SENTINEL')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    const timingLogs = logger.getLogs().filter(entry => entry.source === 'ChatLatency');
    expect(timingLogs.map(entry => entry.details?.stage)).toEqual(expect.arrayContaining([
      'user_submit', 'loading_visible', 'frontend_result_received', 'response_rendered',
    ]));
    const serializedTimings = JSON.stringify(timingLogs);
    expect(serializedTimings).not.toContain('PRIVATE_PROMPT_SENTINEL');
    expect(serializedTimings).not.toContain('PRIVATE_RESPONSE_SENTINEL');
  });

  it('sends earlier local conversation turns as context to the next prompt', async () => {
    vi.mocked(chatWithOllama)
      .mockResolvedValueOnce({ model: 'qwen2.5-coder:3b', content: 'First model answer.' })
      .mockResolvedValueOnce({ model: 'qwen2.5-coder:3b', content: 'Second model answer.' });
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));

    const input = screen.getByPlaceholderText(/Ask your local Ollama model/i);
    fireEvent.change(input, { target: { value: 'First question' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));
    expect(await screen.findByText('First model answer.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Follow-up question' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));
    expect(await screen.findByText('Second model answer.')).toBeInTheDocument();
    expect(vi.mocked(chatWithOllama).mock.calls[1][2]).toEqual([
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First model answer.' },
      { role: 'user', content: 'Follow-up question' },
    ]);
  });

  it('keeps the user prompt and shows an actionable error if Ollama is unavailable', async () => {
    vi.mocked(chatWithOllama).mockRejectedValue(new Error('Ollama is not running at the configured local address. Start Ollama and try again.'));
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ask your local Ollama model/i), { target: { value: 'Please help' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ollama is not running.*Model Providers/i);
    expect(screen.getAllByText('Please help').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Phase 1 Offline Evaluation Mode/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('does not call the model service for an empty prompt', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));
    expect(screen.getByRole('button', { name: /Send/i })).toBeDisabled();
    expect(chatWithOllama).not.toHaveBeenCalled();
  });

  it('updates edition tier correctly when switched', async () => {
    await renderApp();

    // Go to settings
    fireEvent.click(screen.getByRole('button', { name: /^Settings$/i }));

    // Click Pro edition card
    const proCards = screen.getAllByText(/Pro Edition/i);
    fireEvent.click(proCards[0]);

    // Verify edition reflects Pro in UI
    expect(screen.getAllByText(/PRO Edition/i).length).toBeGreaterThan(0);
  });
});
