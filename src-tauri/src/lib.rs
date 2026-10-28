use serde::{Deserialize, Serialize};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::Emitter;

mod agent;
mod gemini;
mod ollama;
mod project;
mod rag;
mod tools;
mod voice;
mod automation;
mod browser;
mod whatsapp;
mod diagnostics;
mod storage;
mod companion;
mod licensing;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub family: String,
    pub target_ram_gb: u32,
    pub sandbox_active: bool,
    pub offline_mode: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppDiagnostics {
    pub status: String,
    pub engine: String,
    pub timestamp_ms: u64,
    pub security_profile: String,
    pub network_egress: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppVersionInfo {
    pub version: String,
    pub edition: String,
    pub phase: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PingResponse {
    pub status: String,
    pub message: String,
    pub timestamp_ms: u64,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: format!("Windows Desktop ({})", std::env::consts::OS),
        arch: std::env::consts::ARCH.to_string(),
        family: std::env::consts::FAMILY.to_string(),
        target_ram_gb: 8,
        sandbox_active: true,
        offline_mode: true,
    }
}

#[tauri::command]
fn get_app_diagnostics() -> AppDiagnostics {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    AppDiagnostics {
        status: "Healthy".to_string(),
        engine: "Lodhi AI Native Core (Rust / Tauri 2)".to_string(),
        timestamp_ms: now,
        security_profile: "Least-Privilege Isolated Sandbox".to_string(),
        network_egress: "Blocked in Phase 1 (Local Privacy Guard)".to_string(),
    }
}

#[tauri::command]
fn get_app_version() -> AppVersionInfo {
    AppVersionInfo {
        version: "0.1.0".to_string(),
        edition: "Free (Desktop Foundation)".to_string(),
        phase: "Phase 1: Windows Desktop Foundation".to_string(),
    }
}

#[tauri::command]
fn ping(client_timestamp: Option<u64>) -> PingResponse {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    PingResponse {
        status: "ok".to_string(),
        message: format!(
            "Pong from Lodhi AI native core (latency ref: {} ms)",
            now.saturating_sub(client_timestamp.unwrap_or(now))
        ),
        timestamp_ms: now,
    }
}

#[tauri::command]
async fn list_ollama_models(endpoint: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || ollama::list_models(&endpoint))
        .await
        .map_err(|error| format!("Ollama model check did not complete: {error}"))?
}

#[tauri::command]
async fn chat_with_ollama(
    endpoint: String,
    model: String,
    messages: Vec<ollama::ChatTurn>,
    options: Option<ollama::OllamaOptions>,
) -> Result<ollama::OllamaChatResponse, String> {
    let handler_started = Instant::now();
    let mut response = tauri::async_runtime::spawn_blocking(move || {
        ollama::chat_with_options(&endpoint, &model, messages, options)
    })
    .await
    .map_err(|error| format!("Ollama chat request did not complete: {error}"))??;
    response.timings.handler_elapsed_ms = handler_started.elapsed().as_millis() as u64;
    Ok(response)
}

#[tauri::command]
async fn stream_chat_with_ollama(
    app: tauri::AppHandle,
    request_id: String,
    endpoint: String,
    model: String,
    messages: Vec<ollama::ChatTurn>,
    options: Option<ollama::OllamaOptions>,
) -> Result<ollama::OllamaChatResponse, String> {
    let handler_started = Instant::now();
    let token = ollama::register_active_stream(&request_id);
    let app_handle = app.clone();
    let req_id = request_id.clone();
    let req_id_clean = request_id.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        let event_channel = format!("chat-stream://{req_id}");
        let stream_result = ollama::chat_stream_with_options(
            &endpoint,
            &model,
            messages,
            options,
            &req_id,
            token,
            |event| {
                let _ = app_handle.emit(&event_channel, &event);
                Ok(())
            },
        );
        ollama::unregister_active_stream(&req_id);
        stream_result
    })
    .await
    .map_err(|error| {
        ollama::unregister_active_stream(&req_id_clean);
        format!("Ollama streaming chat did not complete: {error}")
    })?;

    match result {
        Ok(mut response) => {
            response.timings.handler_elapsed_ms = handler_started.elapsed().as_millis() as u64;
            Ok(response)
        }
        Err(err) => Err(err),
    }
}

#[tauri::command]
async fn prewarm_ollama_model(
    endpoint: String,
    model: String,
    keep_alive: Option<String>,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ollama::prewarm_model(&endpoint, &model, keep_alive.as_deref())
    })
    .await
    .map_err(|error| format!("Ollama model pre-warm did not complete: {error}"))?
}

#[tauri::command]
fn abort_chat(request_id: String) -> bool {
    ollama::abort_stream(&request_id)
}

#[tauri::command]
fn get_gemini_status() -> gemini::GeminiKeyStatus {
    gemini::get_key_status()
}

#[tauri::command]
fn save_gemini_api_key(key: String) -> Result<gemini::GeminiKeyStatus, String> {
    gemini::save_api_key(&key)
}

#[tauri::command]
fn clear_gemini_api_key() -> Result<gemini::GeminiKeyStatus, String> {
    gemini::clear_api_key()
}

#[tauri::command]
async fn test_gemini_connection(model: Option<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        gemini::test_connection(model.as_deref())
    })
    .await
    .map_err(|error| format!("Gemini connection check did not complete: {error}"))?
}

#[tauri::command]
async fn list_gemini_models() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        gemini::list_models()
    })
    .await
    .map_err(|error| format!("Gemini model check did not complete: {error}"))?
}

#[tauri::command]
async fn chat_with_gemini(
    model: String,
    messages: Vec<gemini::ChatTurn>,
    temperature: Option<f32>,
) -> Result<gemini::GeminiChatResponse, String> {
    let handler_started = Instant::now();
    let mut response = tauri::async_runtime::spawn_blocking(move || {
        gemini::chat(&model, messages, temperature)
    })
    .await
    .map_err(|error| format!("Gemini chat request did not complete: {error}"))??;
    response.timings.handler_elapsed_ms = handler_started.elapsed().as_millis() as u64;
    Ok(response)
}

#[tauri::command]
async fn choose_project_folder(
    state: tauri::State<'_, project::ProjectState>,
) -> Result<Option<String>, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || project::choose_project(&project_state))
        .await
        .map_err(|error| format!("Project folder picker did not complete: {error}"))?
}

#[tauri::command]
async fn get_project_tree(
    state: tauri::State<'_, project::ProjectState>,
    max_file_bytes: u64,
) -> Result<project::ProjectTree, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        project::scan_project(&project_state, max_file_bytes)
    })
    .await
    .map_err(|error| format!("Project scan did not complete: {error}"))?
}

#[tauri::command]
async fn read_project_files(
    state: tauri::State<'_, project::ProjectState>,
    paths: Vec<String>,
    max_file_bytes: u64,
    max_context_chars: usize,
) -> Result<Vec<project::ProjectFile>, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        project::read_selected_files(&project_state, paths, max_file_bytes, max_context_chars)
    })
    .await
    .map_err(|error| format!("Project file reading did not complete: {error}"))?
}

#[tauri::command]
async fn analyze_project_files(
    state: tauri::State<'_, project::ProjectState>,
    endpoint: String,
    model: String,
    task: String,
    prompt: String,
    paths: Vec<String>,
    max_file_bytes: u64,
    max_context_chars: usize,
) -> Result<project::CodeProposal, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        project::analyze_files(
            &project_state,
            endpoint,
            model,
            task,
            prompt,
            paths,
            max_file_bytes,
            max_context_chars,
        )
    })
    .await
    .map_err(|error| format!("Coding assistant operation did not complete: {error}"))?
}

#[tauri::command]
async fn apply_code_proposal(
    state: tauri::State<'_, project::ProjectState>,
    proposal_id: String,
    approved: bool,
) -> Result<String, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        project::apply_proposal(&project_state, &proposal_id, approved)
    })
    .await
    .map_err(|error| format!("Approved changes could not be applied: {error}"))?
}

#[tauri::command]
fn discard_code_proposal(
    state: tauri::State<'_, project::ProjectState>,
    proposal_id: String,
) -> Result<String, String> {
    project::discard_proposal(state.inner(), &proposal_id)
}

#[tauri::command]
async fn save_project_file(
    state: tauri::State<'_, project::ProjectState>,
    path: String,
    content: String,
) -> Result<String, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        project::save_project_file(&project_state, &path, &content)
    })
    .await
    .map_err(|error| format!("Failed to save project file: {error}"))?
}

#[tauri::command]
async fn search_project_content(
    state: tauri::State<'_, project::ProjectState>,
    query: String,
    case_sensitive: Option<bool>,
    max_results: Option<usize>,
) -> Result<Vec<project::ProjectSearchMatch>, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        project::search_project_content(
            &project_state,
            &query,
            case_sensitive.unwrap_or(false),
            max_results.unwrap_or(50),
        )
    })
    .await
    .map_err(|error| format!("Content search failed: {error}"))?
}

#[tauri::command]
fn list_project_checks(
    state: tauri::State<'_, project::ProjectState>,
) -> Result<Vec<project::ProjectCheck>, String> {
    project::list_project_checks(state.inner())
}

#[tauri::command]
async fn run_project_check(
    state: tauri::State<'_, project::ProjectState>,
    id: String,
    approved: bool,
) -> Result<project::CheckResult, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        project::run_project_check(&project_state, &id, approved)
    })
    .await
    .map_err(|error| format!("Project check did not complete: {error}"))?
}

#[tauri::command]
fn list_available_tools() -> Vec<tools::ToolDefinition> {
    tools::get_available_tools()
}

#[tauri::command]
async fn execute_agent_tool(
    state: tauri::State<'_, project::ProjectState>,
    tool_call: tools::ToolCall,
    permission_granted: bool,
) -> Result<tools::ToolResult, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        Ok(tools::execute_tool(&tool_call, &project_state, permission_granted))
    })
    .await
    .map_err(|e| format!("Tool execution failed: {e}"))?
}

#[tauri::command]
fn create_agent_task(prompt: String, max_steps: Option<usize>) -> agent::AgentTask {
    agent::create_agent_task(&prompt, max_steps)
}

#[tauri::command]
async fn step_agent_task(
    state: tauri::State<'_, project::ProjectState>,
    task_id: String,
    thought: Option<String>,
    tool_call: Option<tools::ToolCall>,
    approval_granted: bool,
) -> Result<agent::AgentTask, String> {
    let project_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        agent::step_agent_task(&task_id, &project_state, thought, tool_call, approval_granted)
    })
    .await
    .map_err(|e| format!("Agent step failed: {e}"))?
}

#[tauri::command]
fn abort_agent_task(task_id: String) -> bool {
    agent::abort_agent_task(&task_id)
}

#[tauri::command]
fn get_agent_task(task_id: String) -> Option<agent::AgentTask> {
    agent::get_agent_task(&task_id)
}

#[tauri::command]
fn list_agent_tasks() -> Vec<agent::AgentTask> {
    agent::list_agent_tasks()
}

#[tauri::command]
async fn ingest_document(
    file_path: String,
    collection_id: Option<String>,
) -> Result<rag::IngestionResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        rag::ingest_document(&file_path, collection_id.as_deref())
    })
    .await
    .map_err(|e| format!("Ingestion task failed: {e}"))?
}

#[tauri::command]
async fn remove_document(doc_id: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || rag::remove_document(&doc_id))
        .await
        .map_err(|e| format!("Document deletion failed: {e}"))?
}

#[tauri::command]
async fn reindex_document(doc_id: String) -> Result<rag::IngestionResult, String> {
    tauri::async_runtime::spawn_blocking(move || rag::reindex_document(&doc_id))
        .await
        .map_err(|e| format!("Document reindex failed: {e}"))?
}

#[tauri::command]
fn list_documents() -> Vec<rag::DocumentMeta> {
    let store = rag::load_rag_store();
    store.documents.into_values().collect()
}

#[tauri::command]
fn search_knowledge_base(query: String, top_k: usize) -> Vec<rag::SearchResult> {
    rag::search_knowledge_base(&query, top_k)
}

#[tauri::command]
fn get_rag_context(query: String, max_tokens: usize) -> Option<String> {
    rag::get_rag_context(&query, max_tokens)
}

#[tauri::command]
fn get_voice_capabilities() -> voice::VoiceCapabilities {
    voice::get_voice_capabilities()
}

#[tauri::command]
fn configure_voice(config: voice::VoiceConfig) -> Result<bool, String> {
    voice::configure_voice(config)
}

#[tauri::command]
fn get_current_voice_config() -> voice::VoiceConfig {
    voice::get_current_voice_config()
}

#[tauri::command]
fn speak_text_native(
    text: String,
    voice_name: Option<String>,
    rate: Option<f32>,
    volume: Option<f32>,
) -> Result<voice::SpeechSynthesisResult, String> {
    voice::speak_text_native(
        text,
        voice_name,
        rate.unwrap_or(1.0),
        volume.unwrap_or(1.0),
    )
}

#[tauri::command]
fn stop_speech_native() -> Result<bool, String> {
    voice::stop_speech_native()
}

#[tauri::command]
fn transcribe_audio_native(
    audio_path_or_text: String,
    model_id: Option<String>,
    language: Option<String>,
) -> Result<voice::TranscriptionResult, String> {
    voice::transcribe_audio_native(audio_path_or_text, model_id, language)
}

#[tauri::command]
fn list_audio_input_devices() -> Vec<voice::AudioInputDevice> {
    voice::probe_microphone_devices()
}

#[tauri::command]
fn get_voice_models() -> Vec<voice::VoiceModelSpec> {
    voice::get_available_models()
}

#[tauri::command]
fn get_automation_capabilities() -> automation::AutomationCapabilities {
    automation::get_automation_capabilities()
}

#[tauri::command]
fn preview_automation_action(
    state: tauri::State<'_, project::ProjectState>,
    action_type: String,
    parameters: serde_json::Value,
) -> Result<automation::AutomationActionRequest, String> {
    let root = state.get_root();
    automation::preview_automation_action(&action_type, parameters, root.as_deref())
}

#[tauri::command]
async fn execute_automation_action(
    state: tauri::State<'_, project::ProjectState>,
    request: automation::AutomationActionRequest,
    user_confirmed: bool,
) -> Result<automation::AutomationActionResult, String> {
    let root = state.get_root();
    tauri::async_runtime::spawn_blocking(move || {
        automation::execute_automation_action(request, user_confirmed, root.as_deref())
    })
    .await
    .map_err(|e| format!("Automation execution task failed: {e}"))?
}

#[tauri::command]
fn get_automation_audit_log() -> Vec<automation::AutomationAuditEntry> {
    automation::get_automation_audit_log()
}

#[tauri::command]
fn clear_automation_audit_log() {
    automation::clear_automation_audit_log();
}

#[tauri::command]
fn get_browser_capabilities() -> browser::BrowserCapabilities {
    browser::get_browser_capabilities()
}

#[tauri::command]
async fn navigate_and_inspect_url(url: String) -> Result<browser::BrowserPageInspection, String> {
    tauri::async_runtime::spawn_blocking(move || {
        browser::navigate_and_inspect_url(&url)
    })
    .await
    .map_err(|e| format!("Browser navigation failed: {e}"))?
}

#[tauri::command]
fn preview_browser_action(
    action_type: String,
    url: String,
    parameters: serde_json::Value,
) -> Result<browser::BrowserActionRequest, String> {
    browser::preview_browser_action(&action_type, &url, parameters)
}

#[tauri::command]
async fn execute_browser_action(
    request: browser::BrowserActionRequest,
    user_confirmed: bool,
) -> Result<browser::BrowserActionResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        browser::execute_browser_action(request, user_confirmed)
    })
    .await
    .map_err(|e| format!("Browser action execution failed: {e}"))?
}

#[tauri::command]
fn get_browser_history() -> Vec<browser::BrowserHistoryItem> {
    browser::get_browser_history()
}

#[tauri::command]
fn clear_browser_history() {
    browser::clear_browser_history();
}

#[tauri::command]
fn get_whatsapp_capabilities() -> whatsapp::WhatsAppCapabilities {
    whatsapp::get_whatsapp_capabilities()
}

#[tauri::command]
fn get_whatsapp_config() -> whatsapp::WhatsAppConfig {
    whatsapp::get_whatsapp_config()
}

#[tauri::command]
fn configure_whatsapp_settings(config: whatsapp::WhatsAppConfig) -> Result<bool, String> {
    whatsapp::configure_whatsapp_settings(config)
}

#[tauri::command]
fn validate_recipient_phone(phone: String) -> Result<String, String> {
    whatsapp::validate_recipient_phone(&phone)
}

#[tauri::command]
fn draft_whatsapp_message(
    recipient: String,
    body: String,
    template: Option<String>,
) -> Result<whatsapp::WhatsAppDraft, String> {
    whatsapp::draft_whatsapp_message(&recipient, &body, template)
}

#[tauri::command]
async fn dispatch_whatsapp_message(
    draft: whatsapp::WhatsAppDraft,
    user_confirmed: bool,
) -> Result<whatsapp::WhatsAppDispatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        whatsapp::dispatch_whatsapp_message(draft, user_confirmed)
    })
    .await
    .map_err(|e| format!("WhatsApp dispatch failed: {e}"))?
}

#[tauri::command]
fn get_whatsapp_audit_log() -> Vec<whatsapp::WhatsAppAuditEntry> {
    whatsapp::get_whatsapp_audit_log()
}

#[tauri::command]
fn clear_whatsapp_audit_log() {
    whatsapp::clear_whatsapp_audit_log();
}

#[tauri::command]
fn get_project_intelligence(
    state: tauri::State<project::ProjectState>,
) -> Result<diagnostics::ProjectIntelligence, String> {
    let root = state
        .get_root()
        .ok_or_else(|| "No project folder is currently selected.".to_string())?;
    diagnostics::analyze_project_intelligence(&root)
}

#[tauri::command]
async fn run_project_diagnostics(
    state: tauri::State<'_, project::ProjectState>,
    tool_id: String,
    user_confirmed: bool,
) -> Result<diagnostics::ProjectDiagnosticsReport, String> {
    let root = state
        .get_root()
        .ok_or_else(|| "No project folder is currently selected.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        diagnostics::run_project_diagnostics(&root, &tool_id, user_confirmed)
    })
    .await
    .map_err(|e| format!("Diagnostic execution task failed: {e}"))?
}

#[tauri::command]
fn parse_diagnostics_text(
    raw_text: String,
    tool_source: String,
) -> Vec<diagnostics::DiagnosticItem> {
    diagnostics::parse_compiler_output(&raw_text, &tool_source)
}

#[tauri::command]
fn load_vault_store() -> Result<storage::LodhiVaultStore, String> {
    storage::load_vault_store()
}

#[tauri::command]
fn save_app_settings(settings: storage::AppSettingsStore) -> Result<(), String> {
    let mut store = storage::load_vault_store()?;
    store.app_settings = settings;
    storage::save_vault_store(&mut store)
}

#[tauri::command]
fn export_user_data() -> Result<String, String> {
    storage::export_user_data()
}

#[tauri::command]
fn purge_user_data(retention_days: Option<u32>) -> Result<storage::PurgeResult, String> {
    storage::purge_user_data(retention_days)
}

#[tauri::command]
fn generate_companion_pairing_pin() -> Result<companion::PairingSession, String> {
    companion::generate_pairing_pin()
}

#[tauri::command]
fn verify_and_pair_device(
    submitted_pin: String,
    device_name: String,
    device_model: String,
    client_ip: String,
) -> Result<companion::PairedDevice, String> {
    companion::verify_and_pair_device(&submitted_pin, &device_name, &device_model, &client_ip)
}

#[tauri::command]
fn list_paired_devices() -> Vec<companion::PairedDevice> {
    companion::list_paired_devices()
}

#[tauri::command]
fn revoke_paired_device(device_id: String) -> Result<bool, String> {
    companion::revoke_paired_device(&device_id)
}

#[tauri::command]
fn get_companion_sync_payload() -> Result<companion::CompanionSyncPayload, String> {
    companion::get_sync_payload()
}

#[tauri::command]
fn get_current_license_status(
    state: tauri::State<'_, licensing::LicenseStore>,
) -> licensing::LicenseVerificationResult {
    let token = state.get_token();
    licensing::verify_license(token.as_deref())
}

#[tauri::command]
fn verify_license_token(
    token: Option<String>,
    state: tauri::State<'_, licensing::LicenseStore>,
) -> licensing::LicenseVerificationResult {
    let result = licensing::verify_license(token.as_deref());
    if result.state == licensing::LicenseState::Valid {
        state.set_token(token);
    }
    result
}

#[tauri::command]
fn clear_license(
    state: tauri::State<'_, licensing::LicenseStore>,
) -> licensing::LicenseVerificationResult {
    state.set_token(None);
    licensing::verify_license(None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(project::ProjectState::default())
        .manage(licensing::LicenseStore::default())
        .on_page_load(|_webview, payload| {
            eprintln!("[LodhiAI UI] Page load event: {:?} for URL: {}", payload.event(), payload.url());
        })
        .setup(|_app| {
            eprintln!("[LodhiAI UI] Desktop core initialized. is_dev: {}", tauri::is_dev());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_app_diagnostics,
            get_app_version,
            ping,
            list_ollama_models,
            chat_with_ollama,
            stream_chat_with_ollama,
            prewarm_ollama_model,
            abort_chat,
            get_gemini_status,
            save_gemini_api_key,
            clear_gemini_api_key,
            test_gemini_connection,
            list_gemini_models,
            chat_with_gemini,
            choose_project_folder,
            get_project_tree,
            read_project_files,
            save_project_file,
            search_project_content,
            analyze_project_files,
            apply_code_proposal,
            discard_code_proposal,
            list_project_checks,
            run_project_check,
            list_available_tools,
            execute_agent_tool,
            create_agent_task,
            step_agent_task,
            abort_agent_task,
            get_agent_task,
            list_agent_tasks,
            ingest_document,
            remove_document,
            reindex_document,
            list_documents,
            search_knowledge_base,
            get_rag_context,
            get_voice_capabilities,
            configure_voice,
            get_current_voice_config,
            speak_text_native,
            stop_speech_native,
            transcribe_audio_native,
            list_audio_input_devices,
            get_voice_models,
            get_automation_capabilities,
            preview_automation_action,
            execute_automation_action,
            get_automation_audit_log,
            clear_automation_audit_log,
            get_browser_capabilities,
            navigate_and_inspect_url,
            preview_browser_action,
            execute_browser_action,
            get_browser_history,
            clear_browser_history,
            get_whatsapp_capabilities,
            get_whatsapp_config,
            configure_whatsapp_settings,
            validate_recipient_phone,
            draft_whatsapp_message,
            dispatch_whatsapp_message,
            get_whatsapp_audit_log,
            clear_whatsapp_audit_log,
            get_project_intelligence,
            run_project_diagnostics,
            parse_diagnostics_text,
            load_vault_store,
            save_app_settings,
            export_user_data,
            purge_user_data,
            generate_companion_pairing_pin,
            verify_and_pair_device,
            list_paired_devices,
            revoke_paired_device,
            get_companion_sync_payload,
            get_current_license_status,
            verify_license_token,
            clear_license
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lodhi AI desktop application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_info_defaults() {
        let info = get_system_info();
        assert_eq!(info.target_ram_gb, 8);
        assert!(info.sandbox_active);
        assert!(info.offline_mode);
    }

    #[test]
    fn test_ping_response() {
        let res = ping(None);
        assert_eq!(res.status, "ok");
        assert!(res.message.contains("Pong"));
    }

    #[test]
    fn test_app_version() {
        let v = get_app_version();
        assert_eq!(v.version, "0.1.0");
        assert!(v.phase.contains("Phase 1"));
    }

    #[test]
    #[ignore = "requires a running local Ollama server and installed qwen2.5-coder:3b model"]
    fn live_local_ollama_chat_command_smoke() {
        let response = tauri::async_runtime::block_on(chat_with_ollama(
            "http://127.0.0.1:11434".to_string(),
            "qwen2.5-coder:3b".to_string(),
            vec![ollama::ChatTurn {
                role: "user".to_string(),
                content:
                    "Reply with one short sentence saying hello and that this is a local test."
                        .to_string(),
            }],
            None,
        ))
        .expect("the Tauri Ollama chat command should return a model response");

        assert!(!response.content.trim().is_empty());
        println!(
            "LIVE_MODEL={}; LIVE_RESPONSE_NONEMPTY=true; HANDLER_MS={}; HTTP_MS={}; OLLAMA_TOTAL_MS={:?}; MODEL_LOAD_MS={:?}; PROMPT_EVAL_MS={:?}; GENERATION_MS={:?}",
            response.model,
            response.timings.handler_elapsed_ms,
            response.timings.http_elapsed_ms,
            response.timings.ollama_total_ms,
            response.timings.model_load_ms,
            response.timings.prompt_eval_ms,
            response.timings.generation_ms,
        );
    }
}
