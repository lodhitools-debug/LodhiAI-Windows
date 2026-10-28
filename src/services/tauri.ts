import {
  NativeDiagnostics,
  NativeSystemInfo,
  NativeVersionInfo,
  PingResponse,
  AgentTask,
  ToolDefinition,
  ToolCall,
  ToolResult,
  DocumentMeta,
  SearchResult,
  IngestionResult,
  VoiceCapabilities,
  VoiceConfig,
  AudioInputDevice,
  VoiceModelSpec,
  TranscriptionResult,
  SpeechSynthesisResult,
  AutomationCapabilities,
  AutomationActionRequest,
  AutomationActionResult,
  AutomationAuditEntry,
  BrowserCapabilities,
  BrowserHistoryItem,
  BrowserPageInspection,
  BrowserActionRequest,
  BrowserActionResult,
  WhatsAppConfig,
  WhatsAppCapabilities,
  WhatsAppDraft,
  WhatsAppDispatchResult,
  WhatsAppAuditEntry,
  LicenseVerificationResult,
} from '../types';
import { logger } from './logger';

// Check if running inside a Tauri WebView environment
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Wrapper for safe command invocation
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  if (isTauriEnvironment()) {
    const chatStartedAt = (cmd === 'chat_with_ollama' || cmd === 'chat_with_gemini') ? performance.now() : null;
    if (chatStartedAt !== null) {
      logger.debug(`${cmd} invocation started.`, 'ChatLatency', { stage: 'tauri_invoke_start' });
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<T>(cmd, args);
      logger.debug(`Invoked Tauri native command '${cmd}' successfully`, 'TauriBridge');
      if (chatStartedAt !== null) {
        logger.debug(`${cmd} invocation completed.`, 'ChatLatency', {
          stage: 'tauri_invoke_complete',
          elapsed_ms: Math.round(performance.now() - chatStartedAt),
        });
      }
      return res;
    } catch (err) {
      logger.error(`Error invoking native command '${cmd}'`, 'TauriBridge', { error: String(err) });
      if (chatStartedAt !== null) {
        logger.warn(`${cmd} invocation failed.`, 'ChatLatency', {
          stage: 'tauri_invoke_failed',
          elapsed_ms: Math.round(performance.now() - chatStartedAt),
        });
      }
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(typeof err === 'string' ? err : String(err));
    }
  } else {
    logger.debug(`Running '${cmd}' in web sandbox fallback mode`, 'TauriBridge');
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Command '${cmd}' requires Tauri desktop runtime.`);
  }
}

export async function fetchSystemInfo(): Promise<NativeSystemInfo> {
  return safeInvoke<NativeSystemInfo>('get_system_info', undefined, {
    os: 'Windows 10/11 Desktop (Web Evaluation Mode)',
    arch: 'x86_64',
    family: 'windows',
    target_ram_gb: 8,
    sandbox_active: true,
    offline_mode: true,
  });
}

export async function fetchDiagnostics(): Promise<NativeDiagnostics> {
  return safeInvoke<NativeDiagnostics>('get_app_diagnostics', undefined, {
    status: 'Healthy (Web Sandbox)',
    engine: 'Lodhi AI Desktop Foundation (Vite / React / TypeScript)',
    timestamp_ms: Date.now(),
    security_profile: 'Least-Privilege Isolated Sandbox',
    network_egress: 'Zero External Requests in Phase 1',
  });
}

export async function fetchVersionInfo(): Promise<NativeVersionInfo> {
  return safeInvoke<NativeVersionInfo>('get_app_version', undefined, {
    version: '0.1.0',
    edition: 'Free (Desktop Foundation)',
    phase: 'Phase 1: Windows Desktop Foundation',
  });
}

export async function pingNativeBackend(): Promise<PingResponse> {
  const start = Date.now();
  return safeInvoke<PingResponse>('ping', { client_timestamp: start }, {
    status: 'ok',
    message: 'Pong from Lodhi AI simulation engine (Tauri ready)',
    timestamp_ms: Date.now(),
  });
}

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OllamaChatResult {
  model: string;
  content: string;
  timings?: OllamaChatTimings;
}

export interface OllamaChatTimings {
  handler_elapsed_ms: number;
  http_elapsed_ms: number;
  ollama_total_ms: number | null;
  model_load_ms: number | null;
  prompt_eval_ms: number | null;
  generation_ms: number | null;
}

export interface ProjectEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  sizeBytes: number | null;
  selectable: boolean;
  excludedReason: string | null;
}

export interface ProjectTree {
  root: string;
  entries: ProjectEntry[];
  truncated: boolean;
}

export interface ProjectFile {
  path: string;
  content: string;
  sizeBytes: number;
}

export interface ProposedFile {
  path: string;
  originalContent: string | null;
  proposedContent: string;
}

export interface CodeProposal {
  id: string;
  model: string;
  summary: string;
  files: ProposedFile[];
}

export interface ProjectCheck {
  id: 'test' | 'type-check' | 'build';
  command: string;
  scriptBody: string;
  workingDirectory: string;
}

export interface ProjectCheckResult {
  id: string;
  exitCode: number | null;
  success: boolean;
  timedOut: boolean;
  cancelled: boolean;
  output: string;
}

export async function listOllamaModels(endpoint: string): Promise<string[]> {
  return safeInvoke<string[]>('list_ollama_models', { endpoint });
}

export interface OllamaOptions {
  num_predict?: number;
  num_ctx?: number;
  temperature?: number;
  top_p?: number;
  keep_alive?: string;
}

export async function chatWithOllama(
  endpoint: string,
  model: string,
  messages: OllamaMessage[],
  options?: OllamaOptions,
): Promise<OllamaChatResult> {
  return safeInvoke<OllamaChatResult>('chat_with_ollama', { endpoint, model, messages, options });
}

export async function prewarmOllamaModel(
  endpoint: string,
  model: string,
  keepAlive?: string,
): Promise<boolean> {
  return safeInvoke<boolean>('prewarm_ollama_model', { endpoint, model, keepAlive }, false);
}

export interface OllamaStreamEvent {
  request_id: string;
  chunk: string;
  done: boolean;
  model?: string;
  timings?: OllamaChatTimings;
  eval_count?: number;
  eval_duration_ns?: number;
  prompt_eval_count?: number;
  prompt_eval_duration_ns?: number;
  total_duration_ns?: number;
  cancelled?: boolean;
  error?: string;
}

export async function abortChat(requestId: string): Promise<boolean> {
  return safeInvoke<boolean>('abort_chat', { requestId }, false);
}

export async function streamChatWithOllama(
  endpoint: string,
  model: string,
  messages: OllamaMessage[],
  onChunk: (chunk: string, event: OllamaStreamEvent) => void,
  options?: { signal?: AbortSignal; requestId?: string; modelOptions?: OllamaOptions }
): Promise<OllamaChatResult> {
  const requestId = options?.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (isTauriEnvironment()) {
    logger.debug(`Starting real-time Ollama stream for ${requestId}`, 'ChatStream');
    let accumulatedContent = '';
    let finalModel = model;
    let finalTimings: OllamaChatTimings | undefined;
    let unlisten: (() => void) | null = null;
    let isCleanedUp = false;

    const cleanup = () => {
      if (!isCleanedUp && unlisten) {
        try {
          unlisten();
        } catch (_) {}
        unlisten = null;
        isCleanedUp = true;
      }
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        await abortChat(requestId).catch(() => {});
        throw new Error('Chat request was stopped by the user.');
      }
      options.signal.addEventListener('abort', () => {
        abortChat(requestId).catch(() => {});
        cleanup();
      }, { once: true });
    }

    try {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<OllamaStreamEvent>(`chat-stream://${requestId}`, (event) => {
        const payload = event.payload;
        if (!payload || payload.request_id !== requestId) return;

        if (payload.chunk) {
          accumulatedContent += payload.chunk;
        }
        if (payload.model) {
          finalModel = payload.model;
        }
        if (payload.timings) {
          finalTimings = payload.timings;
        }

        onChunk(payload.chunk, payload);

        if (payload.done || payload.cancelled) {
          cleanup();
        }
      });

      const { invoke } = await import('@tauri-apps/api/core');
      const response = await invoke<OllamaChatResult>('stream_chat_with_ollama', {
        requestId,
        endpoint,
        model,
        messages,
        options: options?.modelOptions,
      });

      cleanup();
      return {
        model: response.model || finalModel,
        content: response.content || accumulatedContent,
        timings: response.timings || finalTimings,
      };
    } catch (err) {
      cleanup();
      throw err;
    }
  } else {
    logger.debug('Running streamChatWithOllama in non-Tauri environment fallback', 'ChatStream');
    const result = await chatWithOllama(endpoint, model, messages, options?.modelOptions);
    onChunk(result.content, {
      request_id: requestId,
      chunk: result.content,
      done: true,
      model: result.model,
      timings: result.timings,
    });
    return result;
  }
}

export async function chooseProjectFolder(): Promise<string | null> {
  return safeInvoke<string | null>('choose_project_folder');
}

export async function getProjectTree(maxFileBytes: number): Promise<ProjectTree> {
  return safeInvoke<ProjectTree>('get_project_tree', { maxFileBytes });
}

export async function readProjectFiles(
  paths: string[],
  maxFileBytes: number,
  maxContextChars: number,
): Promise<ProjectFile[]> {
  return safeInvoke<ProjectFile[]>('read_project_files', { paths, maxFileBytes, maxContextChars });
}

export interface ProjectSearchMatch {
  path: string;
  lineNumber: number;
  lineContent: string;
}

export async function saveProjectFile(path: string, content: string): Promise<string> {
  return safeInvoke<string>('save_project_file', { path, content });
}

export async function searchProjectContent(
  query: string,
  caseSensitive = false,
  maxResults = 50,
): Promise<ProjectSearchMatch[]> {
  return safeInvoke<ProjectSearchMatch[]>('search_project_content', { query, caseSensitive, maxResults }, []);
}

export async function analyzeProjectFiles(args: {
  endpoint: string;
  model: string;
  task: string;
  prompt: string;
  paths: string[];
  maxFileBytes: number;
  maxContextChars: number;
}): Promise<CodeProposal> {
  return safeInvoke<CodeProposal>('analyze_project_files', {
    endpoint: args.endpoint,
    model: args.model,
    task: args.task,
    prompt: args.prompt,
    paths: args.paths,
    maxFileBytes: args.maxFileBytes,
    maxContextChars: args.maxContextChars,
  });
}

export async function applyCodeProposal(proposalId: string, approved: boolean): Promise<string> {
  return safeInvoke<string>('apply_code_proposal', { proposalId, approved });
}

export async function discardCodeProposal(proposalId: string): Promise<string> {
  return safeInvoke<string>('discard_code_proposal', { proposalId });
}

export async function listProjectChecks(): Promise<ProjectCheck[]> {
  return safeInvoke<ProjectCheck[]>('list_project_checks', undefined, []);
}

export async function runProjectCheck(id: ProjectCheck['id'], approved: boolean): Promise<ProjectCheckResult> {
  return safeInvoke<ProjectCheckResult>('run_project_check', { id, approved });
}

export interface GeminiKeyStatus {
  configured: boolean;
  source: string;
  masked?: string;
  masked_key: string;
}

export interface GeminiChatTimings {
  handler_elapsed_ms: number;
  http_elapsed_ms: number;
  prompt_tokens?: number | null;
  candidates_tokens?: number | null;
  total_tokens?: number | null;
}

export interface GeminiChatResult {
  model: string;
  content: string;
  timings?: GeminiChatTimings;
}

export async function getGeminiStatus(): Promise<GeminiKeyStatus> {
  return safeInvoke<GeminiKeyStatus>('get_gemini_status', undefined, {
    configured: false,
    source: 'web_sandbox',
    masked_key: 'Not configured',
  });
}

export async function saveGeminiApiKey(key: string): Promise<GeminiKeyStatus> {
  return safeInvoke<GeminiKeyStatus>('save_gemini_api_key', { key });
}

export async function clearGeminiApiKey(): Promise<GeminiKeyStatus> {
  return safeInvoke<GeminiKeyStatus>('clear_gemini_api_key');
}

export async function testGeminiConnection(model?: string): Promise<string> {
  return safeInvoke<string>('test_gemini_connection', { model });
}

export async function listGeminiModels(): Promise<string[]> {
  return safeInvoke<string[]>('list_gemini_models', undefined, [
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ]);
}

export async function chatWithGemini(
  model: string,
  messages: OllamaMessage[],
  temperature?: number,
): Promise<GeminiChatResult> {
  return safeInvoke<GeminiChatResult>('chat_with_gemini', { model, messages, temperature });
}

// ---------------------------------------------------------------------------
// Phase 3 — Agent Tools & Bounded Execution Engine
// ---------------------------------------------------------------------------

export async function listAvailableTools(): Promise<ToolDefinition[]> {
  return safeInvoke<ToolDefinition[]>('list_available_tools', undefined, [
    {
      name: 'workspace_tree',
      description: 'Lists all selectable files in the active project directory within safety bounds.',
      permissionLevel: 'readOnly',
      parametersSchema: {},
    },
    {
      name: 'workspace_read',
      description: 'Reads the content of a permitted source file within the project workspace.',
      permissionLevel: 'readOnly',
      parametersSchema: {},
    },
    {
      name: 'workspace_search',
      description: 'Searches for a text pattern or symbol across permitted workspace files.',
      permissionLevel: 'readOnly',
      parametersSchema: {},
    },
    {
      name: 'workspace_diagnostics',
      description: 'Detects the project language, framework, manifest files, and available check scripts.',
      permissionLevel: 'readOnly',
      parametersSchema: {},
    },
    {
      name: 'workspace_propose_edit',
      description: 'Stages a proposed change to a workspace file and generates a diff preview without writing to disk.',
      permissionLevel: 'readOnly',
      parametersSchema: {},
    },
    {
      name: 'workspace_apply_diff',
      description: 'Applies an approved file proposal to disk, creating a recoverable .backup snapshot first.',
      permissionLevel: 'requiresApproval',
      parametersSchema: {},
    },
    {
      name: 'workspace_run_check',
      description: 'Runs an allowlisted project script (test, type-check, build) with secret redaction and 64KB output cap.',
      permissionLevel: 'requiresApproval',
      parametersSchema: {},
    },
  ]);
}

export async function executeAgentTool(
  toolCall: ToolCall,
  permissionGranted = false,
): Promise<ToolResult> {
  return safeInvoke<ToolResult>(
    'execute_agent_tool',
    { toolCall, permissionGranted },
    {
      toolName: toolCall.name,
      status: 'error',
      error: 'Running in non-Tauri web sandbox mode',
      timestampMs: Date.now(),
    },
  );
}

export async function createAgentTask(
  prompt: string,
  maxSteps?: number,
): Promise<AgentTask> {
  return safeInvoke<AgentTask>(
    'create_agent_task',
    { prompt, maxSteps },
    {
      id: `task-sim-${Date.now()}`,
      prompt,
      status: 'planning',
      plan: [
        'Analyze prompt and inspect workspace files',
        'Formulate code fix or architecture proposal',
        'Stage changes and request user approval before applying',
        'Run allowlisted verification checks and summarize',
      ],
      steps: [],
      maxSteps: maxSteps || 10,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    },
  );
}

export async function stepAgentTask(
  taskId: string,
  thought?: string,
  toolCall?: ToolCall,
  approvalGranted = false,
): Promise<AgentTask> {
  return safeInvoke<AgentTask>(
    'step_agent_task',
    { taskId, thought, toolCall, approvalGranted },
    {
      id: taskId,
      prompt: 'Simulation task',
      status: 'completed',
      plan: [],
      steps: [
        {
          stepIndex: 1,
          thought: thought || 'Executed simulation step',
          toolCall,
          timestampMs: Date.now(),
        },
      ],
      maxSteps: 10,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    },
  );
}

export async function abortAgentTask(taskId: string): Promise<boolean> {
  return safeInvoke<boolean>('abort_agent_task', { taskId }, true);
}

export async function getAgentTask(taskId: string): Promise<AgentTask | null> {
  return safeInvoke<AgentTask | null>('get_agent_task', { taskId }, null);
}

export async function listAgentTasks(): Promise<AgentTask[]> {
  return safeInvoke<AgentTask[]>('list_agent_tasks', undefined, []);
}

export async function ingestDocument(
  filePath: string,
  collectionId?: string,
): Promise<IngestionResult> {
  return safeInvoke<IngestionResult>(
    'ingest_document',
    { filePath, collectionId },
    {
      document: {
        id: `mock-${Date.now()}`,
        name: filePath.split(/[/\\]/).pop() || 'document',
        path: filePath,
        size_bytes: 1024,
        content_hash: 'mock-hash',
        chunk_count: 5,
        mime_type: 'text/plain',
        collection_id: collectionId || 'default',
        indexed_at_ms: Date.now(),
      },
      is_duplicate: false,
      chunks_created: 5,
      message: 'Document successfully indexed (web fallback mode).',
    },
  );
}

export async function removeDocument(docId: string): Promise<boolean> {
  return safeInvoke<boolean>('remove_document', { docId }, true);
}

export async function reindexDocument(docId: string): Promise<IngestionResult> {
  return safeInvoke<IngestionResult>(
    'reindex_document',
    { docId },
    {
      document: {
        id: docId,
        name: 'reindexed_document',
        path: docId,
        size_bytes: 1024,
        content_hash: 'reindex-hash',
        chunk_count: 5,
        mime_type: 'text/plain',
        collection_id: 'default',
        indexed_at_ms: Date.now(),
      },
      is_duplicate: false,
      chunks_created: 5,
      message: 'Document re-indexed successfully.',
    },
  );
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  return safeInvoke<DocumentMeta[]>('list_documents', undefined, []);
}

export async function searchKnowledgeBase(
  query: string,
  topK = 5,
): Promise<SearchResult[]> {
  return safeInvoke<SearchResult[]>('search_knowledge_base', { query, topK }, []);
}

export async function getRagContext(
  query: string,
  maxTokens = 400,
): Promise<string | null> {
  return safeInvoke<string | null>('get_rag_context', { query, maxTokens }, null);
}

export async function getVoiceCapabilities(): Promise<VoiceCapabilities> {
  return safeInvoke<VoiceCapabilities>(
    'get_voice_capabilities',
    undefined,
    {
      microphone_available: true,
      microphone_permission: 'prompt',
      stt_engine: 'Web Speech API (Local Offline)',
      tts_engine: 'Web Speech Synthesis (Windows Local)',
      supported_languages: ['en-US', 'en-GB', 'ur-PK', 'es-ES'],
      local_isolation_enforced: true,
      background_listening_allowed: false,
      active_profile: 'Windows 8 GB RAM Low-Latency Voice Profile',
    },
  );
}

export async function configureVoice(config: VoiceConfig): Promise<boolean> {
  return safeInvoke<boolean>('configure_voice', { config }, true);
}

export async function getCurrentVoiceConfig(): Promise<VoiceConfig> {
  return safeInvoke<VoiceConfig>(
    'get_current_voice_config',
    undefined,
    {
      speaking_rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      auto_speak_responses: true,
      continuous_mode: false,
    },
  );
}

export async function speakTextNative(
  text: string,
  voiceName?: string,
  rate?: number,
  volume?: number,
): Promise<SpeechSynthesisResult> {
  return safeInvoke<SpeechSynthesisResult>(
    'speak_text_native',
    { text, voiceName, rate, volume },
    {
      success: true,
      duration_ms: 120,
      spoken_characters: text.length,
      voice_used: voiceName || 'Fallback Synthesizer',
    },
  );
}

export async function stopSpeechNative(): Promise<boolean> {
  return safeInvoke<boolean>('stop_speech_native', undefined, true);
}

export async function transcribeAudioNative(
  audioPathOrText: string,
  modelId?: string,
  language?: string,
): Promise<TranscriptionResult> {
  return safeInvoke<TranscriptionResult>(
    'transcribe_audio_native',
    { audioPathOrText, modelId, language },
    {
      text: audioPathOrText,
      confidence: 0.95,
      language: language || 'en-US',
      duration_ms: 80,
      engine_used: modelId || 'windows-sapi-built-in',
    },
  );
}

export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  return safeInvoke<AudioInputDevice[]>('list_audio_input_devices', undefined, []);
}

export async function getVoiceModels(): Promise<VoiceModelSpec[]> {
  return safeInvoke<VoiceModelSpec[]>('get_voice_models', undefined, [
    {
      id: 'windows-sapi-built-in',
      name: 'Windows Built-in SAPI Engine (Zero Install)',
      engine: 'windows_sapi',
      status: 'built_in',
      download_size_mb: 0.0,
      ram_required_mb: 25,
      license: 'Microsoft Windows System License',
      checksum: 'OS_INTERNAL',
      url: 'https://learn.microsoft.com/en-us/dotnet/api/system.speech',
      description: 'Built-in Windows offline voice engine.',
    },
    {
      id: 'whisper-tiny',
      name: 'Whisper.cpp Tiny (Multilingual + Urdu)',
      engine: 'whisper.cpp',
      status: 'available',
      download_size_mb: 75.0,
      ram_required_mb: 350,
      license: 'MIT License (OpenAI / Georgi Gerganov)',
      checksum: 'bd577a113a864445863405046e14d66abb05912323581f22bd3a0f6db789369d',
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
      description: 'Fastest multilingual speech recognition model.',
    },
    {
      id: 'piper-ur-pk',
      name: 'Piper TTS Urdu (ur_PK-medium)',
      engine: 'piper',
      status: 'available',
      download_size_mb: 38.0,
      ram_required_mb: 150,
      license: 'MIT License (Rhasspy Piper)',
      checksum: 'e88390b7931aa49da2ef84a8607fa689032598374249a5b3a62854992955f284',
      url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/ur/ur_PK/medium/ur_PK-medium.onnx',
      description: 'Neural voice for natural Urdu pronunciation.',
    },
  ]);
}

export async function getAutomationCapabilities(): Promise<AutomationCapabilities> {
  return safeInvoke<AutomationCapabilities>(
    'get_automation_capabilities',
    undefined,
    {
      canLaunchApprovedApps: true,
      canInspectWindows: true,
      canOpenWorkspacePath: true,
      canManageClipboard: true,
      approvedApps: [
        {
          id: 'notepad',
          displayName: 'Notepad',
          executable: 'notepad.exe',
          description: 'Windows text editor for viewing and editing approved workspace documents.',
          category: 'Editor',
        },
        {
          id: 'calc',
          displayName: 'Calculator',
          executable: 'calc.exe',
          description: 'Standard Windows calculator for utility arithmetic and validation.',
          category: 'Utility',
        },
        {
          id: 'paint',
          displayName: 'Paint',
          executable: 'mspaint.exe',
          description: 'Windows image viewer and bitmap editor for inspecting visual assets.',
          category: 'Graphics',
        },
        {
          id: 'explorer',
          displayName: 'File Explorer',
          executable: 'explorer.exe',
          description: 'Windows File Explorer strictly scoped to approved workspace paths.',
          category: 'System',
        },
      ],
      auditLogCount: 0,
      securityNotice: 'All automated Windows actions are bounded by strict human-in-the-loop authorization, allowlisted applications, workspace path isolation, and audit logging.',
    },
  );
}

export async function previewAutomationAction(
  actionType: string,
  parameters: Record<string, unknown>,
): Promise<AutomationActionRequest> {
  return safeInvoke<AutomationActionRequest>(
    'preview_automation_action',
    { actionType, parameters },
    {
      id: `mock-auto-req-${Date.now()}`,
      actionType,
      description: `Preview: ${actionType}`,
      target: String(parameters['app'] || parameters['path'] || 'target'),
      parameters,
      permissionLevel: actionType === 'inspect_windows' || actionType === 'get_clipboard' ? 'safe' : 'requiresApproval',
      riskLevel: actionType === 'inspect_windows' || actionType === 'get_clipboard' ? 'low' : 'medium',
      preview: `Execute action ${actionType} on target`,
      requiresConfirmation: actionType !== 'inspect_windows' && actionType !== 'get_clipboard',
      status: 'pending',
      createdAt: Date.now(),
    },
  );
}

export async function executeAutomationAction(
  request: AutomationActionRequest,
  userConfirmed: boolean,
): Promise<AutomationActionResult> {
  return safeInvoke<AutomationActionResult>(
    'execute_automation_action',
    { request, userConfirmed },
    {
      requestId: request.id,
      actionType: request.actionType,
      success: userConfirmed || !request.requiresConfirmation,
      output: userConfirmed || !request.requiresConfirmation
        ? 'Action simulated successfully in web fallback environment.'
        : '',
      executionTimeMs: 15,
      error: !userConfirmed && request.requiresConfirmation
        ? 'Action blocked: human authorization was denied.'
        : undefined,
    },
  );
}

export async function getAutomationAuditLog(): Promise<AutomationAuditEntry[]> {
  return safeInvoke<AutomationAuditEntry[]>('get_automation_audit_log', undefined, []);
}

export async function clearAutomationAuditLog(): Promise<void> {
  return safeInvoke<void>('clear_automation_audit_log', undefined, undefined);
}

// Browser Automation Client
export async function getBrowserCapabilities(): Promise<BrowserCapabilities> {
  return safeInvoke<BrowserCapabilities>(
    'get_browser_capabilities',
    undefined,
    {
      supportedSchemes: ['http', 'https'],
      sandboxEnforced: true,
      formSubmissionApprovalRequired: true,
      untrustedInputSanitization: true,
      activeEngine: 'Lodhi Sandboxed Native HTTP / DOM Parser (Zero-Extension)',
      securityNotice: 'Web pages are treated as untrusted content. Form submission, credentials, or state modifications require explicit human authorization.',
    },
  );
}

export async function navigateAndInspectUrl(url: string): Promise<BrowserPageInspection> {
  return safeInvoke<BrowserPageInspection>(
    'navigate_and_inspect_url',
    { url },
    {
      url,
      title: 'Web Document (Sandbox Preview)',
      statusCode: 200,
      excerpt: `Simulated excerpt for ${url}. HTML script tags, style sheets, and tracking cookies were stripped.`,
      links: [`${url}/about`, `${url}/docs`],
      forms: [{ name: 'query', fieldType: 'text', value: '', isRequired: false }],
      textContent: `This is a sandbox preview for ${url}.`,
      fetchedAtMs: Date.now(),
    },
  );
}

export async function previewBrowserAction(
  actionType: string,
  url: string,
  parameters: Record<string, unknown>,
): Promise<BrowserActionRequest> {
  return safeInvoke<BrowserActionRequest>(
    'preview_browser_action',
    { actionType, url, parameters },
    {
      id: `browser-req-${Date.now()}`,
      actionType,
      url,
      parameters,
      requiresConfirmation: actionType === 'submit_form',
      preview: `${actionType} on ${url}`,
      status: 'pending',
      createdAt: Date.now(),
    },
  );
}

export async function executeBrowserAction(
  request: BrowserActionRequest,
  userConfirmed: boolean,
): Promise<BrowserActionResult> {
  return safeInvoke<BrowserActionResult>(
    'execute_browser_action',
    { request, userConfirmed },
    {
      requestId: request.id,
      actionType: request.actionType,
      success: userConfirmed || !request.requiresConfirmation,
      output: userConfirmed || !request.requiresConfirmation
        ? `Browser action '${request.actionType}' completed successfully.`
        : '',
      executionTimeMs: 25,
      error: !userConfirmed && request.requiresConfirmation
        ? 'Action blocked: human authorization was denied.'
        : undefined,
    },
  );
}

export async function getBrowserHistory(): Promise<BrowserHistoryItem[]> {
  return safeInvoke<BrowserHistoryItem[]>('get_browser_history', undefined, []);
}

export async function clearBrowserHistory(): Promise<void> {
  return safeInvoke<void>('clear_browser_history', undefined, undefined);
}

// WhatsApp Workflow Client
export async function getWhatsAppCapabilities(): Promise<WhatsAppCapabilities> {
  return safeInvoke<WhatsAppCapabilities>(
    'get_whatsapp_capabilities',
    undefined,
    {
      officialBusinessApiSupported: true,
      testModeActive: true,
      dpapiTokenProtection: true,
      humanApprovalMandatory: true,
      rateLimitingEnforced: true,
      businessVerificationRequiredNotice: 'Meta WhatsApp Business Platform API requires an official Meta developer account, verified business portfolio, and registered phone number ID. Test mode simulates dispatches safely with zero network egress.',
    },
  );
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  return safeInvoke<WhatsAppConfig>(
    'get_whatsapp_config',
    undefined,
    {
      phoneNumberId: '',
      businessAccountId: '',
      hasApiToken: false,
      testMode: true,
      rateLimitPerMinute: 20,
      apiEndpoint: 'https://graph.facebook.com/v21.0',
    },
  );
}

export async function configureWhatsAppSettings(config: WhatsAppConfig): Promise<boolean> {
  return safeInvoke<boolean>('configure_whatsapp_settings', { config }, true);
}

export async function validateRecipientPhone(phone: string): Promise<string> {
  return safeInvoke<string>('validate_recipient_phone', { phone }, phone);
}

export async function draftWhatsAppMessage(
  recipient: string,
  body: string,
  template?: string,
): Promise<WhatsAppDraft> {
  return safeInvoke<WhatsAppDraft>(
    'draft_whatsapp_message',
    { recipient, body, template },
    {
      id: `draft-${Date.now()}`,
      recipientPhone: recipient,
      templateName: template,
      bodyText: body,
      requiresConfirmation: true,
      createdAtMs: Date.now(),
    },
  );
}

export async function dispatchWhatsAppMessage(
  draft: WhatsAppDraft,
  userConfirmed: boolean,
): Promise<WhatsAppDispatchResult> {
  return safeInvoke<WhatsAppDispatchResult>(
    'dispatch_whatsapp_message',
    { draft, userConfirmed },
    {
      draftId: draft.id,
      recipient: draft.recipientPhone,
      status: userConfirmed ? 'simulatedDelivered' : 'blocked',
      messageId: `wamid.TEST_${Date.now()}`,
      isTestMode: true,
      timestampMs: Date.now(),
      error: !userConfirmed ? 'Dispatch blocked: human authorization was denied.' : undefined,
    },
  );
}

export async function getWhatsAppAuditLog(): Promise<WhatsAppAuditEntry[]> {
  return safeInvoke<WhatsAppAuditEntry[]>('get_whatsapp_audit_log', undefined, []);
}

export async function clearWhatsAppAuditLog(): Promise<void> {
  return safeInvoke<void>('clear_whatsapp_audit_log', undefined, undefined);
}

export interface ProjectIntelligence {
  rootPath: string;
  primaryLanguage: string;
  detectedLanguages: string[];
  frameworks: string[];
  packageManager: string;
  entryPoints: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  availableChecks: string[];
  timestampMs: number;
}

export interface DiagnosticItem {
  file: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  message: string;
  source: string;
  suggestedFix?: string;
}

export interface ProjectDiagnosticsReport {
  toolId: string;
  success: boolean;
  exitCode?: number;
  rawOutput: string;
  diagnostics: DiagnosticItem[];
  totalErrors: number;
  totalWarnings: number;
  timestampMs: number;
}

export async function getProjectIntelligence(): Promise<ProjectIntelligence> {
  return safeInvoke<ProjectIntelligence>(
    'get_project_intelligence',
    undefined,
    {
      rootPath: 'E:/LodhiAI-Windows',
      primaryLanguage: 'TypeScript',
      detectedLanguages: ['TypeScript', 'Rust'],
      frameworks: ['React', 'Vite', 'Tauri'],
      packageManager: 'npm',
      entryPoints: ['src/main.tsx', 'src-tauri/src/main.rs'],
      dependencies: { react: '^18.3.1', '@tauri-apps/api': '^2.0.0' },
      devDependencies: { vite: '^5.4.0', vitest: '^2.0.0' },
      availableChecks: ['type-check', 'test', 'build', 'cargo-check'],
      timestampMs: Date.now(),
    },
  );
}

export async function runProjectDiagnostics(
  toolId: string,
  userConfirmed: boolean,
): Promise<ProjectDiagnosticsReport> {
  return safeInvoke<ProjectDiagnosticsReport>(
    'run_project_diagnostics',
    { toolId, userConfirmed },
    {
      toolId,
      success: true,
      exitCode: 0,
      rawOutput: `[Simulated ${toolId} completed with 0 errors]`,
      diagnostics: [],
      totalErrors: 0,
      totalWarnings: 0,
      timestampMs: Date.now(),
    },
  );
}

export async function parseDiagnosticsText(
  rawText: string,
  toolSource: string,
): Promise<DiagnosticItem[]> {
  return safeInvoke<DiagnosticItem[]>(
    'parse_diagnostics_text',
    { rawText, toolSource },
    [],
  );
}

export interface AppSettingsStore {
  theme: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  activeProvider: string;
  allowCloudEgress: boolean;
  geminiModel: string;
  dataRetentionDays: number;
  telemetryEnabled: boolean;
}

export interface StoredChatMessage {
  id: string;
  role: string;
  content: string;
  timestampMs: number;
}

export interface ConversationSession {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAtMs: number;
  updatedAtMs: number;
  messages: StoredChatMessage[];
}

export interface StoredAgentTask {
  id: string;
  goal: string;
  status: string;
  stepCount: number;
  createdAtMs: number;
}

export interface AuditSummary {
  totalAutomationRuns: number;
  totalBrowserNavs: number;
  totalWhatsappDrafts: number;
}

export interface LodhiVaultStore {
  schemaVersion: number;
  updatedAtMs: number;
  appSettings: AppSettingsStore;
  conversations: ConversationSession[];
  agentTasks: StoredAgentTask[];
  auditSummary: AuditSummary;
}

export interface PurgeResult {
  conversationsRemoved: number;
  tasksRemoved: number;
  remainingConversations: number;
  remainingTasks: number;
  timestampMs: number;
}

export interface PairingSession {
  pin: string;
  expiresAtMs: number;
  createdAtMs: number;
}

export interface PairedDevice {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  pairedAtMs: number;
  lastSeenMs: number;
  authorized: boolean;
  publicKeyFingerprint: string;
}

export interface CompanionSyncPayload {
  syncId: string;
  serverTimeMs: number;
  status: string;
  tasksCount: number;
  conversationsCount: number;
  offlineQueueCount: number;
}

export async function loadVaultStore(): Promise<LodhiVaultStore> {
  return safeInvoke<LodhiVaultStore>(
    'load_vault_store',
    undefined,
    {
      schemaVersion: 1,
      updatedAtMs: Date.now(),
      appSettings: {
        theme: 'dark',
        ollamaEndpoint: 'http://127.0.0.1:11434',
        ollamaModel: 'qwen2.5-coder:3b',
        activeProvider: 'ollama',
        allowCloudEgress: false,
        geminiModel: 'gemini-1.5-flash',
        dataRetentionDays: 0,
        telemetryEnabled: false,
      },
      conversations: [],
      agentTasks: [],
      auditSummary: {
        totalAutomationRuns: 0,
        totalBrowserNavs: 0,
        totalWhatsappDrafts: 0,
      },
    },
  );
}

export async function saveAppSettings(settings: AppSettingsStore): Promise<void> {
  return safeInvoke<void>('save_app_settings', { settings }, undefined);
}

export async function exportUserData(): Promise<string> {
  return safeInvoke<string>('export_user_data', undefined, JSON.stringify({ version: 1, exported: true }, null, 2));
}

export async function purgeUserData(retentionDays?: number): Promise<PurgeResult> {
  return safeInvoke<PurgeResult>(
    'purge_user_data',
    { retentionDays },
    {
      conversationsRemoved: 0,
      tasksRemoved: 0,
      remainingConversations: 0,
      remainingTasks: 0,
      timestampMs: Date.now(),
    },
  );
}

export async function generateCompanionPairingPin(): Promise<PairingSession> {
  return safeInvoke<PairingSession>(
    'generate_companion_pairing_pin',
    undefined,
    {
      pin: '582914',
      expiresAtMs: Date.now() + 300000,
      createdAtMs: Date.now(),
    },
  );
}

export async function verifyAndPairDevice(
  submittedPin: string,
  deviceName: string,
  deviceModel: string,
  clientIp: string,
): Promise<PairedDevice> {
  return safeInvoke<PairedDevice>(
    'verify_and_pair_device',
    { submittedPin, deviceName, deviceModel, clientIp },
    {
      id: `dev-${Date.now()}`,
      name: deviceName,
      model: deviceModel,
      ipAddress: clientIp,
      pairedAtMs: Date.now(),
      lastSeenMs: Date.now(),
      authorized: true,
      publicKeyFingerprint: 'SHA256:mock-fingerprint',
    },
  );
}

export async function listPairedDevices(): Promise<PairedDevice[]> {
  return safeInvoke<PairedDevice[]>('list_paired_devices', undefined, []);
}

export async function revokePairedDevice(deviceId: string): Promise<boolean> {
  return safeInvoke<boolean>('revoke_paired_device', { deviceId }, true);
}

export async function getCompanionSyncPayload(): Promise<CompanionSyncPayload> {
  return safeInvoke<CompanionSyncPayload>(
    'get_companion_sync_payload',
    undefined,
    {
      syncId: `sync-${Date.now()}`,
      serverTimeMs: Date.now(),
      status: 'synchronized',
      tasksCount: 0,
      conversationsCount: 0,
      offlineQueueCount: 0,
    },
  );
}

// Commercial Licensing Services (Phase 7)
export async function getCurrentLicenseStatus(): Promise<LicenseVerificationResult> {
  return safeInvoke<LicenseVerificationResult>(
    'get_current_license_status',
    undefined,
    {
      state: 'unlicensed',
      tier: 'free',
      ticket: null,
      message: 'Free Community Edition. 100% offline, zero license or account required.',
      verifiedAtMs: Date.now(),
    },
  );
}

export async function verifyLicenseToken(token?: string): Promise<LicenseVerificationResult> {
  return safeInvoke<LicenseVerificationResult>(
    'verify_license_token',
    { token },
    {
      state: 'unlicensed',
      tier: 'free',
      ticket: null,
      message: 'Free Community Edition. 100% offline, zero license or account required.',
      verifiedAtMs: Date.now(),
    },
  );
}

export async function clearLicense(): Promise<LicenseVerificationResult> {
  return safeInvoke<LicenseVerificationResult>(
    'clear_license',
    undefined,
    {
      state: 'unlicensed',
      tier: 'free',
      ticket: null,
      message: 'Free Community Edition. 100% offline, zero license or account required.',
      verifiedAtMs: Date.now(),
    },
  );
}




