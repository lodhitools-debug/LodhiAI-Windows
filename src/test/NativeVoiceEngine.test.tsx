import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { VoiceInteractionModal } from '../components/voice/VoiceInteractionModal';
import { voiceService } from '../services/voice';
import * as tauriBridge from '../services/tauri';

describe('Phase 9 — Native Windows Voice Conversation Engine Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    voiceService.resetToIdle();
  });

  describe('1. Natural Conversation State Machine Transitions', () => {
    it('progresses through IDLE -> LISTENING -> TRANSCRIBING -> THINKING -> SPEAKING -> IDLE states', async () => {
      vi.spyOn(voiceService, 'requestMicrophonePermission').mockResolvedValue(true);
      const onSendPrompt = vi.fn();

      render(
        <VoiceInteractionModal
          isOpen={true}
          onClose={vi.fn()}
          onSendPrompt={onSendPrompt}
          lastAssistantResponse="Lodhi AI is ready."
        />
      );

      // Initial state: Ready
      expect(screen.getByText(/Ready \(Push-to-Talk\)/i)).toBeInTheDocument();

      // Transition to LISTENING
      const micBtn = screen.getByTitle(/Start Recording/i);
      fireEvent.click(micBtn);

      await waitFor(() => {
        expect(screen.getByText(/Listening... Speak naturally/i)).toBeInTheDocument();
      });

      // Simulate transcription text arrival
      act(() => {
        voiceService.setTranscript('Salam, Lodhi AI kya haal hai?');
      });

      expect(screen.getByText(/Salam, Lodhi AI kya haal hai\?/i)).toBeInTheDocument();

      // Click Send to Chat: Transitions to THINKING and dispatches
      const sendBtn = screen.getByRole('button', { name: /Send to Chat/i });
      fireEvent.click(sendBtn);

      expect(onSendPrompt).toHaveBeenCalledWith('Salam, Lodhi AI kya haal hai?');
      expect(voiceService.getState().conversationState).toBe('THINKING');

      // Assistant completes generation: Transition to SPEAKING
      act(() => {
        (voiceService as any).state.conversationState = 'SPEAKING';
        (voiceService as any).state.isSpeaking = true;
        (voiceService as any).notify();
      });

      expect(screen.getByText(/Speaking response.../i)).toBeInTheDocument();

      // Interruption returns to IDLE
      const interruptBtn = screen.getByRole('button', { name: /Interrupt Speech/i });
      fireEvent.click(interruptBtn);

      expect(voiceService.getState().conversationState).toBe('IDLE');
      expect(screen.getByText(/Ready \(Push-to-Talk\)/i)).toBeInTheDocument();
    });

    it('cancels listening immediately and returns safely to IDLE without submitting', async () => {
      vi.spyOn(voiceService, 'requestMicrophonePermission').mockResolvedValue(true);
      const onSendPrompt = vi.fn();

      render(
        <VoiceInteractionModal
          isOpen={true}
          onClose={vi.fn()}
          onSendPrompt={onSendPrompt}
        />
      );

      // Start listening
      fireEvent.click(screen.getByTitle(/Start Recording/i));
      await waitFor(() => {
        expect(voiceService.getState().isListening).toBe(true);
      });

      // Cancel
      act(() => {
        voiceService.cancelListening();
      });

      expect(voiceService.getState().isListening).toBe(false);
      expect(voiceService.getState().conversationState).toBe('IDLE');
      expect(onSendPrompt).not.toHaveBeenCalled();
    });
  });

  describe('2. Real Hardware Probing & Graceful Error Handling', () => {
    it('displays graceful notice when no physical microphone is connected', async () => {
      act(() => {
        (voiceService as any).state.microphoneAvailable = false;
        (voiceService as any).state.detectedMicrophones = [];
        (voiceService as any).notify();
      });

      render(
        <VoiceInteractionModal
          isOpen={true}
          onClose={vi.fn()}
          onSendPrompt={vi.fn()}
        />
      );

      expect(screen.getByText(/Mic: Not Detected/i)).toBeInTheDocument();
      expect(
        screen.getByText(/No active microphone detected. Connect a microphone or headset/i)
      ).toBeInTheDocument();
    });

    it('displays error badge when microphone permission is denied by Windows', async () => {
      vi.spyOn(voiceService, 'requestMicrophonePermission').mockResolvedValue(false);

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
        expect(voiceService.getState().conversationState).toBe('ERROR');
        expect(screen.getByText(/Voice Error/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. Transcript Review, Editing & Privacy Guarantees', () => {
    it('allows user to edit speech transcript before dispatching to AI', async () => {
      const onSendPrompt = vi.fn();

      render(
        <VoiceInteractionModal
          isOpen={true}
          onClose={vi.fn()}
          onSendPrompt={onSendPrompt}
        />
      );

      act(() => {
        voiceService.setTranscript('Mera PC boht slow hai');
      });

      // Click Edit button
      const editBtn = screen.getByRole('button', { name: /Edit/i });
      fireEvent.click(editBtn);

      // Edit the text in the textarea
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Mera PC boht slow hai, RAM 8GB hai' } });

      // Click Send to Chat
      const sendBtn = screen.getByRole('button', { name: /Send to Chat/i });
      fireEvent.click(sendBtn);

      expect(onSendPrompt).toHaveBeenCalledWith('Mera PC boht slow hai, RAM 8GB hai');
    });

    it('displays cloud egress notice when Google Gemini is the active provider', () => {
      render(
        <VoiceInteractionModal
          isOpen={true}
          onClose={vi.fn()}
          onSendPrompt={vi.fn()}
          activeProviderName="Google Gemini"
          isCloudProvider={true}
        />
      );

      expect(screen.getByText(/Cloud Provider Active \(Google Gemini\):/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Audio remains 100% local on your PC. Only the transcribed text prompt is sent/i)
      ).toBeInTheDocument();
    });

    it('enforces privacy mandate banner ensuring audio is never permanently saved', () => {
      render(
        <VoiceInteractionModal
          isOpen={true}
          onClose={vi.fn()}
          onSendPrompt={vi.fn()}
        />
      );

      expect(screen.getByText(/Privacy Mandate:/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Audio recordings are ephemeral and never saved permanently or uploaded to external clouds/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Target: 8 GB RAM • Windows SAPI/i)).toBeInTheDocument();
    });
  });

  describe('4. Native Bridge Invocations & Model Catalog', () => {
    it('invokes speakTextNative bridge function when speak is called', async () => {
      const speakNativeSpy = vi.spyOn(tauriBridge, 'speakTextNative').mockResolvedValue({
        success: true,
        duration_ms: 120,
        spoken_characters: 25,
        voice_used: 'Microsoft David Desktop',
      });

      voiceService.speak('Testing native SAPI speech');

      expect(speakNativeSpy).toHaveBeenCalledWith(
        'Testing native SAPI speech',
        undefined,
        1,
        1
      );
    });

    it('invokes stopSpeechNative bridge function when interrupt is called', async () => {
      const stopNativeSpy = vi.spyOn(tauriBridge, 'stopSpeechNative').mockResolvedValue(true);

      voiceService.interrupt();

      expect(stopNativeSpy).toHaveBeenCalled();
    });
  });
});
