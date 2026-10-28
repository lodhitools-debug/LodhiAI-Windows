import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../store/AppContext';
import App from '../App';
import { logger } from '../services/logger';
import {
  chatWithOllama,
  chatWithGemini,
  getGeminiStatus,
  saveGeminiApiKey,
  clearGeminiApiKey,
  testGeminiConnection,
} from '../services/tauri';

vi.mock('../services/tauri', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/tauri')>();
  return {
    ...actual,
    chatWithOllama: vi.fn(),
    chatWithGemini: vi.fn(),
    getGeminiStatus: vi.fn(),
    saveGeminiApiKey: vi.fn(),
    clearGeminiApiKey: vi.fn(),
    testGeminiConnection: vi.fn(),
  };
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

describe('Google Gemini Provider Integration & Regression Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(chatWithOllama).mockReset();
    vi.mocked(chatWithGemini).mockReset();
    vi.mocked(getGeminiStatus).mockReset();
    vi.mocked(saveGeminiApiKey).mockReset();
    vi.mocked(clearGeminiApiKey).mockReset();
    vi.mocked(testGeminiConnection).mockReset();

    vi.mocked(getGeminiStatus).mockResolvedValue({
      configured: false,
      source: 'web_sandbox',
      masked_key: 'Not configured',
    });
  });

  it('allows explicit provider selection between Ollama and Google Gemini in Model Settings', async () => {
    await renderApp();

    // Navigate to Model Providers
    fireEvent.click(screen.getByRole('button', { name: /Model Providers/i }));
    expect(screen.getByText(/Active AI Provider/i)).toBeInTheDocument();

    // Switch to Gemini tab
    fireEvent.click(screen.getByRole('button', { name: /Google Gemini Cloud Settings/i }));
    expect(screen.getByText(/Native Vault Key Security:/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini API Key Vault/i)).toBeInTheDocument();
  });

  it('makes Google Gemini the default online AI provider on initial setup without requiring Ollama', async () => {
    // Fresh install: localStorage is completely empty
    await renderApp();

    // Navigate to AI Chat
    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));
    expect(screen.getAllByText(/Google Gemini/i).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/Ask Google Gemini.../i)).toBeInTheDocument();

    // Verify initial welcome session reflects Gemini
    expect(screen.getByText(/Google Gemini is set as your default online AI provider/i)).toBeInTheDocument();
  });

  it('keeps Ollama as an explicitly selectable local provider (Ollama regression check)', async () => {
    // Explicitly configure Ollama as local provider
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'ollama',
        ollamaModel: 'qwen2.5-coder:3b',
      })
    );

    vi.mocked(chatWithOllama).mockResolvedValue({
      model: 'qwen2.5-coder:3b',
      content: 'Ollama local response verified.',
      timings: {
        handler_elapsed_ms: 100,
        http_elapsed_ms: 90,
        ollama_total_ms: 80,
        model_load_ms: 10,
        prompt_eval_ms: 20,
        generation_ms: 50,
      },
    });

    await renderApp();

    // Navigate to AI Chat
    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));
    expect(screen.getAllByText(/Local Ollama/i).length).toBeGreaterThan(0);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello local Ollama' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Ollama local response verified./i)).toBeInTheDocument();
    });

    expect(chatWithOllama).toHaveBeenCalled();
    expect(chatWithGemini).not.toHaveBeenCalled();
  });

  it('requires explicit user consent before sending external requests to Gemini', async () => {
    // Configure settings with activeProvider='gemini' but geminiConsentGiven=false
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'gemini',
        geminiConsentGiven: false,
        geminiModel: 'gemini-2.0-flash',
      })
    );

    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));
    expect(screen.getByText(/Google Gemini \(Cloud\)/i)).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Explain rust closures' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/User consent required/i);
    });

    // Zero cloud calls dispatched
    expect(chatWithGemini).not.toHaveBeenCalled();
  });

  it('successfully dispatches chat to Gemini when provider is selected and consent is granted', async () => {
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'gemini',
        geminiConsentGiven: true,
        geminiModel: 'gemini-3.6-flash',
      })
    );

    vi.mocked(chatWithGemini).mockResolvedValue({
      model: 'gemini-3.6-flash',
      content: 'Here is the response from Google Gemini 3.6 Flash.',
      timings: {
        handler_elapsed_ms: 210,
        http_elapsed_ms: 195,
        total_tokens: 42,
      },
    });

    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Write a python fibonacci' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Here is the response from Google Gemini 3.6 Flash./i)).toBeInTheDocument();
    });

    expect(chatWithGemini).toHaveBeenCalledWith(
      'gemini-3.6-flash',
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Write a python fibonacci' }),
      ])
    );
    expect(chatWithOllama).not.toHaveBeenCalled();
  });

  it('handles Gemini key-missing or invalid key error clearly without leaking keys', async () => {
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'gemini',
        geminiConsentGiven: true,
        geminiModel: 'gemini-3.6-flash',
      })
    );

    vi.mocked(chatWithGemini).mockRejectedValue(
      new Error('Invalid Google Gemini API key: Google rejected the key as invalid or unauthorized.')
    );

    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Trigger invalid key test' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid Google Gemini API key/i);
    });
  });

  it('handles Gemini rate limit (429) errors gracefully', async () => {
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'gemini',
        geminiConsentGiven: true,
        geminiModel: 'gemini-3.6-flash',
      })
    );

    vi.mocked(chatWithGemini).mockRejectedValue(
      new Error('Gemini rate limit exceeded (429): Resource has been exhausted (check quota).')
    );

    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Trigger rate limit test' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Gemini rate limit exceeded/i);
    });
  });

  it('handles Gemini retired model 404 error with actionable guidance', async () => {
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'gemini',
        geminiConsentGiven: true,
        geminiModel: 'gemini-3.6-flash',
      })
    );

    vi.mocked(chatWithGemini).mockRejectedValue(
      new Error("Gemini model not found or retired (404): This model models/gemini-2.5-flash is no longer available to new users. Select 'gemini-3.6-flash' in Model Providers.")
    );

    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Test 404 handling' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Gemini model not found or retired \(404\)/i);
      expect(screen.getByRole('alert')).toHaveTextContent(/gemini-3.6-flash/i);
    });
  });

  it('safely retries failed requests without duplicating user messages', async () => {
    localStorage.setItem(
      'lodhi_app_settings',
      JSON.stringify({
        activeProvider: 'gemini',
        geminiConsentGiven: true,
        geminiModel: 'gemini-3.6-flash',
      })
    );

    // First attempt fails with 503
    vi.mocked(chatWithGemini)
      .mockRejectedValueOnce(new Error('Google Gemini service is temporarily overloaded (503). Please retry in a moment.'))
      .mockResolvedValueOnce({
        model: 'gemini-3.6-flash',
        content: 'Successful reply after retry.',
        timings: { handler_elapsed_ms: 150, http_elapsed_ms: 140 },
      });

    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: /AI Chat/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Retry test prompt' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/temporarily overloaded \(503\)/i);
    });

    // Click the Retry button
    const retryBtn = screen.getByRole('button', { name: /^Retry$/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/Successful reply after retry./i)).toBeInTheDocument();
    });

    // Verify user prompt was not duplicated in the message history: exactly 1 user message
    expect(screen.getAllByText('You').length).toBe(1);
    expect(chatWithGemini).toHaveBeenCalledTimes(2);
  });

  it('renders vault status truthfully with secure DPAPI source and masked key', async () => {
    vi.mocked(getGeminiStatus).mockResolvedValue({
      configured: true,
      source: 'Windows DPAPI Encrypted Vault (%APPDATA%)',
      masked_key: 'AIza****9988',
    });

    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: /Model Providers/i }));
    fireEvent.click(screen.getByRole('button', { name: /Google Gemini Cloud Settings/i }));

    await waitFor(() => {
      expect(screen.getByText(/Configured \(Windows DPAPI Encrypted Vault \(%APPDATA%\)\)/i)).toBeInTheDocument();
      expect(screen.getByText('AIza****9988')).toBeInTheDocument();
    });
  });

  it('enforces secret zero-leakage: raw API keys never appear in localStorage, settings, or client logs', async () => {
    const rawSecretKey = 'AIzaSyTestSecretVaultKey123456789';
    vi.mocked(saveGeminiApiKey).mockResolvedValue({
      configured: true,
      source: 'Windows DPAPI Encrypted Vault (%APPDATA%)',
      masked_key: 'AIza****6789',
    });

    await renderApp();

    // Navigate to Model Providers
    fireEvent.click(screen.getByRole('button', { name: /Model Providers/i }));
    fireEvent.click(screen.getByRole('button', { name: /Google Gemini Cloud Settings/i }));

    const keyInput = screen.getByPlaceholderText('AIzaSy...');
    fireEvent.change(keyInput, { target: { value: rawSecretKey } });
    fireEvent.click(screen.getByRole('button', { name: /Save to Vault/i }));

    await waitFor(() => {
      expect(saveGeminiApiKey).toHaveBeenCalledWith(rawSecretKey);
    });

    // Verify localStorage does not contain the secret key
    const rawSettings = localStorage.getItem('lodhi_app_settings') || '';
    expect(rawSettings).not.toContain(rawSecretKey);

    // Verify diagnostic logs do not contain the secret key
    const allLogs = JSON.stringify(logger.getLogs());
    expect(allLogs).not.toContain(rawSecretKey);
  });
});

