import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { VoiceInteractionModal } from '../components/voice/VoiceInteractionModal';
import { voiceService } from '../services/voice';

describe('Phase 3 — Stage 3.4: Modular Voice Assistant Interface Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders VoiceInteractionModal and enforces local privacy mandate', () => {
    render(
      <VoiceInteractionModal
        isOpen={true}
        onClose={vi.fn()}
        onSendPrompt={vi.fn()}
      />
    );

    expect(screen.getByText(/Voice Assistant & Speech Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/Local Offline Voice Processing • Zero Audio Upload/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy Mandate:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Text Input/i })).toBeInTheDocument();
  });

  it('toggles recording state and updates voice status message', async () => {
    vi.spyOn(voiceService, 'requestMicrophonePermission').mockResolvedValue(true);
    vi.spyOn(voiceService, 'startListening').mockImplementation(async () => {
      // Simulate speech recognition listening
      (voiceService as any).state.isListening = true;
      (voiceService as any).notify();
      return true;
    });

    render(
      <VoiceInteractionModal
        isOpen={true}
        onClose={vi.fn()}
        onSendPrompt={vi.fn()}
      />
    );

    const micBtn = screen.getByTitle(/Start Recording/i);
    fireEvent.click(micBtn);

    await waitFor(() => {
      expect(voiceService.startListening).toHaveBeenCalled();
      expect(screen.getByText(/Listening... Speak naturally/i)).toBeInTheDocument();
    });
  });

  it('renders recognized transcript and dispatches to chat when Send to Chat is clicked', async () => {
    const handleSendPrompt = vi.fn();

    render(
      <VoiceInteractionModal
        isOpen={true}
        onClose={vi.fn()}
        onSendPrompt={handleSendPrompt}
      />
    );

    // Simulate speech-to-text transcript arrival within act()
    act(() => {
      (voiceService as any).state.transcript = 'Analyze this React codebase for security bugs';
      (voiceService as any).notify();
    });

    await waitFor(() => {
      expect(screen.getByText(/Analyze this React codebase for security bugs/i)).toBeInTheDocument();
    });

    const sendBtn = screen.getByRole('button', { name: /Send to Chat/i });
    expect(sendBtn).toBeEnabled();
    fireEvent.click(sendBtn);

    expect(handleSendPrompt).toHaveBeenCalledWith('Analyze this React codebase for security bugs');
  });

  it('triggers text-to-speech for assistant response and handles interruption', async () => {
    const speakSpy = vi.spyOn(voiceService, 'speak').mockReturnValue(true);
    const interruptSpy = vi.spyOn(voiceService, 'interrupt').mockImplementation(() => {
      (voiceService as any).state.isSpeaking = false;
      (voiceService as any).notify();
    });

    render(
      <VoiceInteractionModal
        isOpen={true}
        onClose={vi.fn()}
        onSendPrompt={vi.fn()}
        lastAssistantResponse="Hello, all system functions are operational."
      />
    );

    const speakBtn = screen.getByRole('button', { name: /Speak Last Reply/i });
    fireEvent.click(speakBtn);

    expect(speakSpy).toHaveBeenCalledWith('Hello, all system functions are operational.');

    // Simulate speaking active within act()
    act(() => {
      (voiceService as any).state.isSpeaking = true;
      (voiceService as any).notify();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Interrupt Speech/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Interrupt Speech/i }));
    expect(interruptSpy).toHaveBeenCalled();
  });

  it('provides text-only fallback to close voice modal cleanly', () => {
    const handleClose = vi.fn();

    render(
      <VoiceInteractionModal
        isOpen={true}
        onClose={handleClose}
        onSendPrompt={vi.fn()}
      />
    );

    const textFallbackBtn = screen.getByRole('button', { name: /Use Text Input/i });
    fireEvent.click(textFallbackBtn);

    expect(handleClose).toHaveBeenCalled();
  });
});
