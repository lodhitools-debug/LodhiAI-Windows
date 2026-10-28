export type NavScreen =
  | 'dashboard'
  | 'chat'
  | 'code'
  | 'workspace'
  | 'agents'
  | 'documents'
  | 'knowledge'
  | 'models'
  | 'settings'
  | 'diagnostics';

export type ProductEdition = 'free' | 'pro' | 'business';

export interface ChatPerformanceMetrics {
  ttftMs?: number;
  totalDurationMs?: number;
  tokenCount?: number;
  tps?: number;
  isEstimatedTokens?: boolean;
  promptTokens?: number;
  promptEvalMs?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  modelName?: string;
  phaseNote?: string;
  isStreaming?: boolean;
  stopped?: boolean;
  metrics?: ChatPerformanceMetrics;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  modelId: string;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface DiagnosticLog {
  id: string;
  level: LogLevel;
  message: string;
  source: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface NativeSystemInfo {
  os: string;
  arch: string;
  family: string;
  target_ram_gb: number;
  sandbox_active: boolean;
  offline_mode: boolean;
}

export interface NativeDiagnostics {
  status: string;
  engine: string;
  timestamp_ms: number;
  security_profile: string;
  network_egress: string;
}

export interface NativeVersionInfo {
  version: string;
  edition: string;
  phase: string;
}

export interface PingResponse {
  status: string;
  message: string;
  timestamp_ms: number;
}

export interface ModelProviderConfig {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  endpoint: string;
  apiKeyMasked?: string;
  models: string[];
  selectedModel: string;
  status: 'available' | 'offline' | 'unconfigured';
  phase: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  path: string;
  language: string;
  filesCount: number;
  lastOpened: string;
  phaseScheduled: string;
}

export interface AutomationAgent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  status: 'idle' | 'running' | 'paused' | 'disabled';
  schedule: string;
  permissionsRequired: string[];
  phaseScheduled: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  sizeBytes: number;
  format: string;
  uploadedAt: string;
  indexingStatus: 'ready' | 'pending' | 'phase_locked';
  phaseScheduled: string;
}

export interface KnowledgeCollection {
  id: string;
  title: string;
  description: string;
  documentCount: number;
  chunkCount: number;
  embeddingModel: string;
  phaseScheduled: string;
}

export interface AppSettings {
  theme: 'dark-navy' | 'midnight' | 'cyber-blue';
  fontSize: 'compact' | 'standard' | 'large';
  edition: ProductEdition;
  telemetryEnabled: boolean;
  localIsolationOnly: boolean;
  requireApprovalForFS: boolean;
  defaultModelId: string;
  customOllamaUrl: string;
  ollamaModel: string;
  activeProvider?: 'ollama' | 'gemini';
  geminiModel?: string;
  geminiConsentGiven?: boolean;
  temperature?: number;
  contextLength?: number;
  maxOutputTokens?: number;
  keepAliveMinutes?: number;
  chatLanguage?: 'auto' | 'roman-urdu' | 'english';
  chatPersonality?: 'natural-companion' | 'concise-developer';
}

export type ToolPermissionLevel = 'readOnly' | 'requiresApproval';

export interface ToolDefinition {
  name: string;
  description: string;
  permissionLevel: ToolPermissionLevel;
  parametersSchema: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export type ToolExecutionStatus = 'success' | 'error' | 'awaitingApproval';

export interface ToolResult {
  toolName: string;
  status: ToolExecutionStatus;
  output?: unknown;
  error?: string;
  timestampMs: number;
}

export type AgentTaskStatus =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'awaitingApproval'
  | 'completed'
  | 'failed'
  | 'aborted';

export interface AgentStep {
  stepIndex: number;
  thought: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  timestampMs: number;
}

export interface AgentTask {
  id: string;
  prompt: string;
  status: AgentTaskStatus;
  plan: string[];
  steps: AgentStep[];
  maxSteps: number;
  pendingApproval?: ToolCall;
  summary?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DocumentMeta {
  id: string;
  name: string;
  path: string;
  size_bytes: number;
  content_hash: string;
  chunk_count: number;
  mime_type: string;
  collection_id: string;
  indexed_at_ms: number;
}

export interface SearchResult {
  doc_id: string;
  doc_name: string;
  chunk_id: string;
  chunk_index: number;
  content: string;
  score: number;
  citation: string;
}

export interface IngestionResult {
  document: DocumentMeta;
  is_duplicate: boolean;
  chunks_created: number;
  message: string;
}

export interface AudioInputDevice {
  id: string;
  name: string;
  is_default: boolean;
  status: string;
}

export interface InstalledVoice {
  id: string;
  name: string;
  culture: string;
  gender: string;
}

export interface VoiceModelSpec {
  id: string;
  name: string;
  engine: string;
  status: 'built_in' | 'installed' | 'available';
  download_size_mb: number;
  ram_required_mb: number;
  license: string;
  checksum: string;
  url: string;
  description: string;
}

export interface VoiceCapabilities {
  microphone_available: boolean;
  microphone_permission: 'granted' | 'denied' | 'prompt' | 'unsupported';
  detected_microphones?: AudioInputDevice[];
  installed_voices?: InstalledVoice[];
  stt_engine: string;
  tts_engine: string;
  supported_languages: string[];
  local_isolation_enforced: boolean;
  background_listening_allowed: boolean;
  active_profile: string;
  available_models?: VoiceModelSpec[];
  roman_urdu_supported?: boolean;
  roman_urdu_notice?: string;
}

export interface VoiceConfig {
  voice_id?: string;
  speaking_rate: number;
  pitch: number;
  volume: number;
  auto_speak_responses: boolean;
  continuous_mode: boolean;
  confirmation_mode?: boolean;
  selected_stt_model?: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration_ms: number;
  engine_used: string;
}

export interface SpeechSynthesisResult {
  success: boolean;
  duration_ms: number;
  spoken_characters: number;
  voice_used: string;
}

export type AutomationPermissionLevel = 'safe' | 'requiresApproval';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ApprovedApp {
  id: string;
  displayName: string;
  executable: string;
  description: string;
  category: string;
}

export interface AutomationCapabilities {
  canLaunchApprovedApps: boolean;
  canInspectWindows: boolean;
  canOpenWorkspacePath: boolean;
  canManageClipboard: boolean;
  approvedApps: ApprovedApp[];
  auditLogCount: number;
  securityNotice: string;
}

export interface AutomationActionRequest {
  id: string;
  actionType: string;
  description: string;
  target: string;
  parameters: Record<string, unknown>;
  permissionLevel: AutomationPermissionLevel;
  riskLevel: RiskLevel;
  preview: string;
  requiresConfirmation: boolean;
  status: string;
  createdAt: number;
}

export interface AutomationActionResult {
  requestId: string;
  actionType: string;
  success: boolean;
  output: string;
  executionTimeMs: number;
  error?: string;
}

export interface AutomationAuditEntry {
  id: string;
  actionType: string;
  target: string;
  permissionDecision: string;
  success: boolean;
  durationMs: number;
  error?: string;
  timestamp: number;
}

export interface WindowInfo {
  pid: number;
  processName: string;
  windowTitle: string;
  isResponsive: boolean;
}

// Browser Automation Interfaces
export interface BrowserCapabilities {
  supportedSchemes: string[];
  sandboxEnforced: boolean;
  formSubmissionApprovalRequired: boolean;
  untrustedInputSanitization: boolean;
  activeEngine: string;
  securityNotice: string;
}

export interface BrowserHistoryItem {
  url: string;
  title: string;
  statusCode: number;
  timestamp: number;
}

export interface PageFormField {
  name: string;
  fieldType: string;
  value: string;
  isRequired: boolean;
}

export interface BrowserPageInspection {
  url: string;
  title: string;
  statusCode: number;
  excerpt: string;
  links: string[];
  forms: PageFormField[];
  textContent: string;
  fetchedAtMs: number;
}

export interface BrowserActionRequest {
  id: string;
  actionType: string;
  url: string;
  parameters: Record<string, unknown>;
  requiresConfirmation: boolean;
  preview: string;
  status: string;
  createdAt: number;
}

export interface BrowserActionResult {
  requestId: string;
  actionType: string;
  success: boolean;
  output: string;
  executionTimeMs: number;
  error?: string;
}

// WhatsApp Workflow Interfaces
export interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  hasApiToken: boolean;
  testMode: boolean;
  rateLimitPerMinute: number;
  apiEndpoint: string;
}

export interface WhatsAppCapabilities {
  officialBusinessApiSupported: boolean;
  testModeActive: boolean;
  dpapiTokenProtection: boolean;
  humanApprovalMandatory: boolean;
  rateLimitingEnforced: boolean;
  businessVerificationRequiredNotice: string;
}

export interface WhatsAppDraft {
  id: string;
  recipientPhone: string;
  templateName?: string;
  bodyText: string;
  requiresConfirmation: boolean;
  createdAtMs: number;
}

export interface WhatsAppDispatchResult {
  draftId: string;
  recipient: string;
  status: string;
  messageId: string;
  isTestMode: boolean;
  timestampMs: number;
  error?: string;
}

export interface WhatsAppAuditEntry {
  id: string;
  recipientMasked: string;
  messageType: string;
  permissionDecision: string;
  status: string;
  durationMs: number;
  timestampMs: number;
  error?: string;
}

// Commercial Licensing Interfaces (Phase 7)
export type LicenseState =
  | 'unlicensed'
  | 'valid'
  | 'expired'
  | 'invalid'
  | 'unable_to_verify';

export interface LicenseTicket {
  licenseId: string;
  issuer: string;
  subject: string;
  tier: string;
  features: string[];
  issuedAt: number;
  expiresAt: number;
  deviceId?: string | null;
}

export interface LicenseVerificationResult {
  state: LicenseState;
  tier: string;
  ticket?: LicenseTicket | null;
  message: string;
  verifiedAtMs: number;
}


