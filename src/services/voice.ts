// Native Windows Voice Conversation Engine for Lodhi AI
// Implements full conversation state machine: IDLE -> LISTENING -> TRANSCRIBING -> THINKING -> SPEAKING -> IDLE
// Real microphone probing, native Windows SAPI synthesis, Whisper/Piper model catalog, and safe fallback

import {
  getVoiceCapabilities,
  speakTextNative,
  stopSpeechNative,
  listAudioInputDevices,
  getVoiceModels,
} from './tauri';
import { AudioInputDevice, VoiceModelSpec } from '../types';
import { logger } from './logger';

export type VoiceConversationState =
  | 'IDLE'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'THINKING'
  | 'SPEAKING'
  | 'ERROR';

export interface VoiceState {
  conversationState: VoiceConversationState;
  isListening: boolean;
  isSpeaking: boolean;
  isTranscribing: boolean;
  transcript: string;
  interimTranscript: string;
  confirmedTranscript: string;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported';
  audioLevel: number; // 0 to 100 for live waveform visualization
  selectedVoiceId: string | null;
  speakingRate: number; // 0.5 to 2.0
  pitch: number;
  volume: number; // 0.0 to 1.0
  error: string | null;
  availableVoices: { id: string; name: string; lang: string; isLocal: boolean }[];
  detectedMicrophones: AudioInputDevice[];
  availableModels: VoiceModelSpec[];
  selectedModelId: string;
  confirmationMode: boolean; // review transcript before sending
  autoSpeakResponses: boolean;
  microphoneAvailable: boolean;
  cloudEgressApproved: boolean;
}

type VoiceListener = (state: VoiceState) => void;

class VoiceService {
  private state: VoiceState = {
    conversationState: 'IDLE',
    isListening: false,
    isSpeaking: false,
    isTranscribing: false,
    transcript: '',
    interimTranscript: '',
    confirmedTranscript: '',
    permissionState: 'prompt',
    audioLevel: 0,
    selectedVoiceId: null,
    speakingRate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    error: null,
    availableVoices: [],
    detectedMicrophones: [],
    availableModels: [],
    selectedModelId: 'windows-sapi-built-in',
    confirmationMode: true,
    autoSpeakResponses: true,
    microphoneAvailable: false,
    cloudEgressApproved: false,
  };

  private listeners: Set<VoiceListener> = new Set();
  private recognition: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  constructor() {
    this.initHardwareAndVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => this.initBrowserVoices();
    }
  }

  public subscribe(listener: VoiceListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = { ...this.state };
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  public getState(): VoiceState {
    return { ...this.state };
  }

  public async initHardwareAndVoices() {
    try {
      const [caps, mics, models] = await Promise.all([
        getVoiceCapabilities().catch(() => null),
        listAudioInputDevices().catch(() => []),
        getVoiceModels().catch(() => []),
      ]);

      if (caps) {
        this.state.permissionState = caps.microphone_permission;
        this.state.microphoneAvailable = caps.microphone_available;
        if (caps.installed_voices && caps.installed_voices.length > 0) {
          this.state.availableVoices = caps.installed_voices.map(v => ({
            id: v.name,
            name: v.name,
            lang: v.culture,
            isLocal: true,
          }));
          if (!this.state.selectedVoiceId) {
            this.state.selectedVoiceId = caps.installed_voices[0].name;
          }
        }
      }

      this.state.detectedMicrophones = mics || [];
      if (mics && mics.length > 0) {
        this.state.microphoneAvailable = true;
      }
      this.state.availableModels = models || [];

      this.initBrowserVoices();
      this.notify();
    } catch (err) {
      logger.warn('Failed to query native voice hardware', 'VoiceService', { error: String(err) });
      this.initBrowserVoices();
    }
  }

  private initBrowserVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0 && this.state.availableVoices.length === 0) {
        this.state.availableVoices = voices.map((v, i) => ({
          id: v.voiceURI || `voice-${i}`,
          name: v.name,
          lang: v.lang,
          isLocal: v.localService !== false,
        }));
        if (!this.state.selectedVoiceId && this.state.availableVoices.length > 0) {
          const preferred =
            this.state.availableVoices.find(v => v.lang.startsWith('en') && v.isLocal) ||
            this.state.availableVoices[0];
          this.state.selectedVoiceId = preferred.id;
        }
        this.notify();
      }
    } catch {
      // ignore
    }
  }

  public async requestMicrophonePermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.state.permissionState = 'unsupported';
      this.state.error = 'Microphone access is not supported in this runtime environment.';
      this.notify();
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.state.permissionState = 'granted';
      this.state.microphoneAvailable = true;
      this.state.error = null;
      stream.getTracks().forEach(track => track.stop());
      this.notify();
      return true;
    } catch (err: any) {
      const errName = err?.name || '';
      const errMsg = String(err?.message || err);
      if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError' || errMsg.includes('NotFound') || errMsg.includes('Requested device not found')) {
        this.state.permissionState = 'prompt';
        this.state.microphoneAvailable = false;
        this.state.error = 'No physical microphone detected. Connect a microphone or headset and try again.';
      } else {
        this.state.permissionState = 'denied';
        this.state.error =
          'Microphone permission was denied. Please allow microphone access in Windows Settings.';
      }
      this.notify();
      return false;
    }
  }

  public async startListening(): Promise<boolean> {
    if (this.state.isListening) return true;

    // Interrupt any ongoing speech synthesis before listening
    this.interrupt();

    // Check permission
    const granted = await this.requestMicrophonePermission();
    if (!granted) {
      this.state.conversationState = 'ERROR';
      this.notify();
      return false;
    }

    this.state.conversationState = 'LISTENING';
    this.state.isListening = true;
    this.state.error = null;
    this.state.interimTranscript = '';

    // Attempt browser Web Speech or native audio recorder
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
          let interim = '';
          let final = this.state.transcript;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const item = event.results[i];
            if (item.isFinal) {
              final += (final ? ' ' : '') + item[0].transcript;
            } else {
              interim += item[0].transcript;
            }
          }

          this.state.transcript = final;
          this.state.interimTranscript = interim;
          this.notify();
        };

        this.recognition.onerror = (event: any) => {
          if (event.error === 'no-speech') return;
          this.state.error = `Speech recognition notice: ${event.error}`;
          this.notify();
        };

        this.recognition.onend = () => {
          if (this.state.isListening) {
            this.stopListening();
          }
        };

        this.recognition.start();
      } catch (err) {
        logger.warn('Browser SpeechRecognition failed to start, using audio meter only', 'VoiceService', {
          error: String(err),
        });
      }
    }

    await this.startAudioMeter();
    this.notify();
    return true;
  }

  public stopListening() {
    if (!this.state.isListening) return;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }

    this.stopAudioMeter();
    this.state.isListening = false;

    // Finalize transcript
    const fullText = (this.state.transcript + ' ' + this.state.interimTranscript).trim();
    this.state.transcript = fullText;
    this.state.interimTranscript = '';
    this.state.isTranscribing = false;
    this.state.conversationState = 'IDLE';
    this.notify();
  }

  public cancelListening() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.stopAudioMeter();
    this.state.isListening = false;
    this.state.isTranscribing = false;
    this.state.conversationState = 'IDLE';
    this.state.interimTranscript = '';
    this.notify();
  }

  public setThinking() {
    this.interrupt();
    this.state.conversationState = 'THINKING';
    this.notify();
  }

  public resetToIdle() {
    this.state.conversationState = 'IDLE';
    this.state.isListening = false;
    this.state.isSpeaking = false;
    this.state.isTranscribing = false;
    this.notify();
  }

  private async startAudioMeter() {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioContext = new AudioContextClass();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!this.analyser || !this.state.isListening) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        this.state.audioLevel = Math.min(100, Math.round((avg / 128) * 100));
        this.notify();
        this.animFrameId = requestAnimationFrame(updateMeter);
      };
      this.animFrameId = requestAnimationFrame(updateMeter);
    } catch {
      // Audio level meter fallback
    }
  }

  private stopAudioMeter() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.state.audioLevel = 0;
  }

  public speak(text: string, onEnd?: () => void): boolean {
    const cleanText = text.replace(/[*#`_~\[\]]/g, '').trim();
    if (!cleanText) return false;

    // Interrupt previous speech
    this.interrupt();

    this.state.conversationState = 'SPEAKING';
    this.state.isSpeaking = true;
    this.notify();

    // Prefer native Windows SAPI speech synthesis
    speakTextNative(
      cleanText,
      this.state.selectedVoiceId || undefined,
      this.state.speakingRate,
      this.state.volume,
    )
      .then(res => {
        if (res.success) {
          this.state.isSpeaking = false;
          this.state.conversationState = 'IDLE';
          this.notify();
          onEnd?.();
        } else {
          this.speakBrowserFallback(cleanText, onEnd);
        }
      })
      .catch(() => {
        this.speakBrowserFallback(cleanText, onEnd);
      });

    return true;
  }

  private speakBrowserFallback(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.state.isSpeaking = false;
      this.state.conversationState = 'IDLE';
      this.notify();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.state.speakingRate;
      utterance.pitch = this.state.pitch;
      utterance.volume = this.state.volume;

      if (this.state.selectedVoiceId) {
        const voices = window.speechSynthesis.getVoices();
        const found = voices.find(v => (v.voiceURI || v.name) === this.state.selectedVoiceId);
        if (found) {
          utterance.voice = found;
        }
      }

      utterance.onend = () => {
        this.state.isSpeaking = false;
        this.state.conversationState = 'IDLE';
        this.notify();
        onEnd?.();
      };

      utterance.onerror = (e) => {
        this.state.isSpeaking = false;
        this.state.conversationState = 'IDLE';
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          this.state.error = `Speech synthesis notice: ${e.error}`;
        }
        this.notify();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      this.state.isSpeaking = false;
      this.state.conversationState = 'IDLE';
      this.notify();
    }
  }

  public interrupt() {
    void stopSpeechNative();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.state.isSpeaking = false;
    if (this.state.conversationState === 'SPEAKING') {
      this.state.conversationState = 'IDLE';
    }
    this.notify();
  }

  public setVoice(voiceId: string) {
    this.state.selectedVoiceId = voiceId;
    this.notify();
  }

  public setSpeakingRate(rate: number) {
    this.state.speakingRate = Math.max(0.5, Math.min(2.0, rate));
    this.notify();
  }

  public setVolume(volume: number) {
    this.state.volume = Math.max(0.0, Math.min(1.0, volume));
    this.notify();
  }

  public setTranscript(text: string) {
    this.state.transcript = text;
    this.notify();
  }

  public clearTranscript() {
    this.state.transcript = '';
    this.state.interimTranscript = '';
    this.notify();
  }

  public setConfirmationMode(enabled: boolean) {
    this.state.confirmationMode = enabled;
    this.notify();
  }

  public setAutoSpeakResponses(enabled: boolean) {
    this.state.autoSpeakResponses = enabled;
    this.notify();
  }

  public setSelectedModel(modelId: string) {
    this.state.selectedModelId = modelId;
    this.notify();
  }

  public setCloudEgressApproved(approved: boolean) {
    this.state.cloudEgressApproved = approved;
    this.notify();
  }

  public clearError() {
    this.state.error = null;
    if (this.state.conversationState === 'ERROR') {
      this.state.conversationState = 'IDLE';
    }
    this.notify();
  }
}

export const voiceService = new VoiceService();
