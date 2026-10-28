use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use std::time::{Duration, Instant};

const DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com";
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(45);
pub const VERIFIED_MODELS: &[&str] = &[
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
];

// In-memory runtime override (e.g. for user session or unit testing)
static RUNTIME_KEY_OVERRIDE: RwLock<Option<String>> = RwLock::new(None);
static RUNTIME_BASE_URL_OVERRIDE: RwLock<Option<String>> = RwLock::new(None);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GeminiKeyStatus {
    pub configured: bool,
    pub source: String,
    pub masked: String,
    #[serde(default)]
    pub masked_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GeminiChatResponse {
    pub model: String,
    pub content: String,
    pub timings: GeminiTimings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GeminiTimings {
    pub handler_elapsed_ms: u64,
    pub http_elapsed_ms: u64,
    pub prompt_tokens: Option<u64>,
    pub candidate_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatTurn {
    pub role: String,
    pub content: String,
}

/// Helper to get secrets path in `%APPDATA%\com.lodhiai.desktop\gemini_secret.json`
fn get_secrets_file_path() -> Option<PathBuf> {
    if let Ok(app_data) = std::env::var("APPDATA") {
        let dir = PathBuf::from(app_data).join("com.lodhiai.desktop");
        Some(dir.join("gemini_secret.json"))
    } else {
        None
    }
}

/// Mask key so it is never displayed in plaintext: "AIza...****...1234"
pub fn mask_key(key: &str) -> String {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return "Not configured".to_string();
    }
    if trimmed.len() <= 8 {
        return "****".to_string();
    }
    let prefix = &trimmed[..4.min(trimmed.len())];
    let suffix = &trimmed[trimmed.len().saturating_sub(4)..];
    format!("{prefix}****{suffix}")
}

/// Redact key pattern from string to prevent leaking in errors or logs
pub fn redact_key(text: &str, known_key: Option<&str>) -> String {
    let mut result = text.to_string();
    if let Some(key) = known_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() && trimmed.len() >= 6 {
            result = result.replace(trimmed, "[REDACTED_GEMINI_KEY]");
        }
    }
    // Generic Gemini/Google API key pattern: AIzaSy... (39 chars)
    let re_prefix = "AIza";
    while let Some(idx) = result.find(re_prefix) {
        let end_idx = (idx + 39).min(result.len());
        result.replace_range(idx..end_idx, "[REDACTED_API_KEY]");
    }
    result
}

#[cfg(target_os = "windows")]
pub fn dpapi_encrypt(plaintext: &[u8]) -> Result<Vec<u8>, String> {
    use windows::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };
    unsafe {
        let mut in_blob = CRYPT_INTEGER_BLOB {
            cbData: plaintext.len() as u32,
            pbData: plaintext.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB::default();
        let res = CryptProtectData(
            &mut in_blob,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out_blob,
        );
        if res.is_err() {
            return Err("Windows DPAPI CryptProtectData failed.".to_string());
        }
        let slice = std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize);
        let result = slice.to_vec();
        extern "system" {
            fn LocalFree(hmem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        }
        LocalFree(out_blob.pbData as *mut std::ffi::c_void);
        Ok(result)
    }
}

#[cfg(target_os = "windows")]
pub fn dpapi_decrypt(ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    use windows::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };
    unsafe {
        let mut in_blob = CRYPT_INTEGER_BLOB {
            cbData: ciphertext.len() as u32,
            pbData: ciphertext.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB::default();
        let res = CryptUnprotectData(
            &mut in_blob,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out_blob,
        );
        if res.is_err() {
            return Err("Windows DPAPI CryptUnprotectData failed.".to_string());
        }
        let slice = std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize);
        let result = slice.to_vec();
        extern "system" {
            fn LocalFree(hmem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        }
        LocalFree(out_blob.pbData as *mut std::ffi::c_void);
        Ok(result)
    }
}

#[cfg(not(target_os = "windows"))]
pub fn dpapi_encrypt(plaintext: &[u8]) -> Result<Vec<u8>, String> {
    Ok(plaintext.to_vec())
}

#[cfg(not(target_os = "windows"))]
pub fn dpapi_decrypt(ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    Ok(ciphertext.to_vec())
}

pub fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn hex_to_bytes(hex: &str) -> Option<Vec<u8>> {
    let clean = hex.trim();
    if clean.len() % 2 != 0 {
        return None;
    }
    (0..clean.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&clean[i..i + 2], 16).ok())
        .collect()
}

/// Read API key from:
/// 1. Explicitly cleared sentinel in session -> returns None
/// 2. Secure Windows DPAPI-encrypted vault in user APPDATA (highest priority for user configured key)
/// 3. In-memory runtime override (e.g. user session or test override)
/// 4. Process environment variables (`GEMINI_API_KEY` or `GOOGLE_API_KEY`)
pub fn resolve_api_key() -> Option<(String, String)> {
    if let Ok(guard) = RUNTIME_KEY_OVERRIDE.read() {
        if let Some(ref key) = *guard {
            if key == "__CLEARED__" {
                return None;
            }
        }
    }

    if let Some(path) = get_secrets_file_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(val) = serde_json::from_str::<Value>(&content) {
                    // 1. Check for DPAPI encrypted key
                    if let Some(enc_hex) = val.get("encrypted_gemini_api_key").and_then(|k| k.as_str()) {
                        if let Some(bytes) = hex_to_bytes(enc_hex) {
                            if let Ok(decrypted_bytes) = dpapi_decrypt(&bytes) {
                                if let Ok(key_str) = String::from_utf8(decrypted_bytes) {
                                    let trimmed = key_str.trim().to_string();
                                    if !trimmed.is_empty() {
                                        return Some((trimmed, "Windows DPAPI Encrypted Vault (%APPDATA%)".to_string()));
                                    }
                                }
                            }
                        }
                    }

                    // 2. Backward compatibility: check for unencrypted plaintext key and auto-migrate it
                    if let Some(key) = val.get("gemini_api_key").and_then(|k| k.as_str()) {
                        let trimmed = key.trim();
                        if !trimmed.is_empty() {
                            let migrated_key = trimmed.to_string();
                            let _ = save_api_key(&migrated_key);
                            return Some((migrated_key, "Windows DPAPI Encrypted Vault (Migrated)".to_string()));
                        }
                    }
                }
            }
        }
    }

    if let Ok(guard) = RUNTIME_KEY_OVERRIDE.read() {
        if let Some(ref key) = *guard {
            let trimmed = key.trim();
            if !trimmed.is_empty() && trimmed != "__CLEARED__" {
                return Some((trimmed.to_string(), "In-Memory Session".to_string()));
            }
        }
    }

    if let Ok(key) = std::env::var("GEMINI_API_KEY") {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return Some((trimmed.to_string(), "Environment variable (GEMINI_API_KEY)".to_string()));
        }
    }

    if let Ok(key) = std::env::var("GOOGLE_API_KEY") {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return Some((trimmed.to_string(), "Environment variable (GOOGLE_API_KEY)".to_string()));
        }
    }

    None
}

/// Set in-memory runtime key override
pub fn set_runtime_key_override(key: Option<String>) {
    if let Ok(mut guard) = RUNTIME_KEY_OVERRIDE.write() {
        *guard = key;
    }
}

/// Set base URL override (for tests)
#[allow(dead_code)]
pub fn set_base_url_override(url: Option<String>) {
    if let Ok(mut guard) = RUNTIME_BASE_URL_OVERRIDE.write() {
        *guard = url;
    }
}

pub fn get_base_url() -> String {
    if let Ok(guard) = RUNTIME_BASE_URL_OVERRIDE.read() {
        if let Some(ref url) = *guard {
            return url.clone();
        }
    }
    DEFAULT_BASE_URL.to_string()
}

/// Save API key into local user AppData vault with Windows DPAPI encryption at rest
pub fn save_api_key(key: &str) -> Result<GeminiKeyStatus, String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("Cannot save an empty Gemini API key.".to_string());
    }
    if trimmed.len() < 8 {
        return Err("The provided Gemini API key is too short. Please verify your Google AI Studio API key.".to_string());
    }

    // Also set in runtime memory so it takes effect immediately
    set_runtime_key_override(Some(trimmed.to_string()));

    if let Some(path) = get_secrets_file_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let encrypted_hex = match dpapi_encrypt(trimmed.as_bytes()) {
            Ok(ciphertext) => Some(bytes_to_hex(&ciphertext)),
            Err(_) => None,
        };

        let data = if let Some(hex) = encrypted_hex {
            json!({
                "encrypted_gemini_api_key": hex,
                "encryption": "Windows_DPAPI_CurrentUser",
                "updated_at": chrono_like_now_ms(),
            })
        } else {
            // Non-Windows fallback
            json!({
                "gemini_api_key": trimmed,
                "encryption": "None_OS_Profile_ACL",
                "updated_at": chrono_like_now_ms(),
            })
        };

        fs::write(&path, serde_json::to_string_pretty(&data).unwrap_or_default())
            .map_err(|e| format!("Failed to write secrets file: {e}"))?;
    }

    Ok(get_key_status())
}

/// Clear API key from local user AppData vault and runtime memory
pub fn clear_api_key() -> Result<GeminiKeyStatus, String> {
    set_runtime_key_override(Some("__CLEARED__".to_string()));

    if let Some(path) = get_secrets_file_path() {
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }

    Ok(get_key_status())
}

/// Get current Gemini key status without ever returning plaintext key
pub fn get_key_status() -> GeminiKeyStatus {
    if let Some((key, source)) = resolve_api_key() {
        let masked_val = mask_key(&key);
        GeminiKeyStatus {
            configured: true,
            source,
            masked: masked_val.clone(),
            masked_key: masked_val,
        }
    } else {
        GeminiKeyStatus {
            configured: false,
            source: "None".to_string(),
            masked: "Not configured".to_string(),
            masked_key: "Not configured".to_string(),
        }
    }
}

fn chrono_like_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Separates system instruction turns from dialog turns for Gemini API
pub fn extract_system_prompt(messages: &[ChatTurn]) -> (Option<String>, Vec<ChatTurn>) {
    let mut system_lines = Vec::new();
    let mut dialog = Vec::new();
    for turn in messages {
        if turn.role.eq_ignore_ascii_case("system") {
            let trimmed = turn.content.trim();
            if !trimmed.is_empty() {
                system_lines.push(trimmed.to_string());
            }
        } else {
            dialog.push(turn.clone());
        }
    }
    let system = if system_lines.is_empty() {
        None
    } else {
        Some(system_lines.join("\n\n"))
    };
    (system, dialog)
}

/// Prepare messages for Gemini API
pub fn format_gemini_contents(messages: &[ChatTurn]) -> Vec<Value> {
    let mut contents: Vec<Value> = Vec::new();
    for turn in messages {
        let text = turn.content.trim();
        if text.is_empty() {
            continue;
        }
        let role = if turn.role.eq_ignore_ascii_case("assistant") || turn.role.eq_ignore_ascii_case("model") {
            "model"
        } else {
            "user"
        };

        // Gemini API requires alternating roles. If same role repeats, merge parts:
        if let Some(last) = contents.last_mut() {
            if last.get("role").and_then(|r| r.as_str()) == Some(role) {
                if let Some(parts) = last.get_mut("parts").and_then(|p| p.as_array_mut()) {
                    parts.push(json!({ "text": text }));
                    continue;
                }
            }
        }

        contents.push(json!({
            "role": role,
            "parts": [{ "text": text }]
        }));
    }

    // Ensure the conversation begins with a user turn as required by Gemini
    if let Some(first) = contents.first() {
        if first.get("role").and_then(|r| r.as_str()) == Some("model") {
            contents.insert(0, json!({
                "role": "user",
                "parts": [{ "text": "Hello." }]
            }));
        }
    }

    contents
}

/// Test connection to Google Gemini API
pub fn test_connection(model: Option<&str>) -> Result<String, String> {
    let (key, source) = resolve_api_key().ok_or_else(|| {
        "Gemini API key is not configured. Add your key in Model Providers or set the GEMINI_API_KEY environment variable.".to_string()
    })?;

    let target_model = model.unwrap_or("gemini-3.6-flash");
    let base_url = get_base_url();
    let url = format!("{base_url}/v1beta/models/{target_model}:generateContent");

    let payload = json!({
        "contents": [{
            "role": "user",
            "parts": [{ "text": "Respond with: LODHI GEMINI CONNECTION OK" }]
        }],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 30
        }
    });

    let config = ureq::config::Config::builder()
        .timeout_global(Some(DEFAULT_TIMEOUT))
        .http_status_as_error(false)
        .build();
    let client = config.new_agent();

    let start = Instant::now();
    let mut res = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("x-goog-api-key", &key)
        .send_json(payload)
        .map_err(|e| redact_key(&format!("Network error contacting Gemini API: {e}"), Some(&key)))?;

    let elapsed_ms = start.elapsed().as_millis();
    let status = res.status().as_u16();
    let body = res
        .body_mut()
        .read_to_string()
        .map_err(|e| format!("Failed to read Gemini response: {e}"))?;

    if status == 200 {
        let val: Value = serde_json::from_str(&body)
            .map_err(|e| format!("Malformed JSON from Gemini: {e}"))?;
        let text = extract_response_text(&val).unwrap_or_else(|| "Connection successful.".to_string());
        Ok(format!("Connected to Google Gemini ({target_model}) via {source} ({elapsed_ms} ms). Verification: {}", text.trim()))
    } else {
        Err(format_api_error(status, &body, Some(&key)))
    }
}

/// Fetch available models from Gemini API
pub fn list_models() -> Result<Vec<String>, String> {
    let (key, _) = resolve_api_key().ok_or_else(|| {
        "Gemini API key is not configured. Configure your key in Model Providers to list models.".to_string()
    })?;

    let base_url = get_base_url();
    let url = format!("{base_url}/v1beta/models");

    let config = ureq::config::Config::builder()
        .timeout_global(Some(DEFAULT_TIMEOUT))
        .http_status_as_error(false)
        .build();
    let client = config.new_agent();

    let mut res = client
        .get(&url)
        .header("x-goog-api-key", &key)
        .call()
        .map_err(|e| redact_key(&format!("Network error contacting Gemini API: {e}"), Some(&key)))?;

    let status = res.status().as_u16();
    let body = res
        .body_mut()
        .read_to_string()
        .map_err(|e| format!("Failed to read Gemini models response: {e}"))?;

    if status == 200 {
        let val: Value = serde_json::from_str(&body)
            .map_err(|e| format!("Malformed JSON from Gemini models API: {e}"))?;
        let mut list = Vec::new();
        if let Some(models) = val.get("models").and_then(|m| m.as_array()) {
            for m in models {
                let name = m.get("name").and_then(|n| n.as_str()).unwrap_or_default();
                let clean_name = name.strip_prefix("models/").unwrap_or(name);
                let supported_methods = m.get("supportedGenerationMethods").and_then(|s| s.as_array());
                let can_generate = supported_methods
                    .map(|methods| methods.iter().any(|v| v.as_str() == Some("generateContent")))
                    .unwrap_or(true);

                if can_generate && clean_name.starts_with("gemini-") {
                    list.push(clean_name.to_string());
                }
            }
        }
        if list.is_empty() {
            Ok(VERIFIED_MODELS.iter().map(|s| s.to_string()).collect())
        } else {
            list.sort_by(|a, b| {
                fn score(name: &str) -> i32 {
                    if name == "gemini-3.6-flash" { 0 }
                    else if name == "gemini-3.8-flash" { 1 }
                    else if name == "gemini-flash-latest" { 2 }
                    else if name.contains("3.") && name.contains("flash") { 3 }
                    else if name.contains("flash") { 4 }
                    else { 5 }
                }
                score(a).cmp(&score(b)).then_with(|| a.cmp(b))
            });
            list.dedup();
            Ok(list)
        }
    } else {
        Err(format_api_error(status, &body, Some(&key)))
    }
}

/// Execute chat request with Gemini API with optional base_url and custom_key (for thread-safe mock tests)
pub fn chat_with_base_url_and_key(
    base_url: Option<&str>,
    custom_key: Option<&str>,
    model: &str,
    messages: Vec<ChatTurn>,
    temperature: Option<f32>,
) -> Result<GeminiChatResponse, String> {
    let handler_start = Instant::now();
    let key = if let Some(k) = custom_key {
        k.to_string()
    } else {
        let (k, _) = resolve_api_key().ok_or_else(|| {
            "Gemini API key is missing. Set your key in Model Providers or export GEMINI_API_KEY.".to_string()
        })?;
        k
    };

    let (system_prompt, dialog_messages) = extract_system_prompt(&messages);
    let contents = format_gemini_contents(&dialog_messages);
    if contents.is_empty() {
        return Err("Enter a message before sending to Gemini.".to_string());
    }

    let target_model = if model.trim().is_empty() {
        "gemini-3.6-flash"
    } else {
        model.trim()
    };

    let base = base_url.unwrap_or(DEFAULT_BASE_URL);
    let url = format!("{base}/v1beta/models/{target_model}:generateContent");

    let mut payload = json!({
        "contents": contents,
    });
    if let Some(ref sys) = system_prompt {
        payload["systemInstruction"] = json!({
            "parts": [{ "text": sys }]
        });
    }
    if let Some(temp) = temperature {
        payload["generationConfig"] = json!({ "temperature": temp });
    }

    let config = ureq::config::Config::builder()
        .timeout_global(Some(DEFAULT_TIMEOUT))
        .http_status_as_error(false)
        .build();
    let client = config.new_agent();

    let http_start = Instant::now();
    let mut res = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("x-goog-api-key", &key)
        .send_json(payload)
        .map_err(|e| redact_key(&format!("Network error calling Gemini: {e}"), Some(&key)))?;
    let http_elapsed_ms = http_start.elapsed().as_millis() as u64;

    let status = res.status().as_u16();
    let body = res
        .body_mut()
        .read_to_string()
        .map_err(|e| format!("Failed to read Gemini response: {e}"))?;

    if status == 200 {
        let val: Value = serde_json::from_str(&body)
            .map_err(|e| format!("Malformed JSON response from Gemini API: {e}"))?;

        let content = extract_response_text(&val).ok_or_else(|| {
            if let Some(reason) = val.get("candidates").and_then(|c| c.as_array()).and_then(|c| c.first()).and_then(|f| f.get("finishReason")).and_then(|r| r.as_str()) {
                format!("Gemini produced no text (finish reason: {reason}).")
            } else {
                "Gemini returned an empty response candidate.".to_string()
            }
        })?;

        let prompt_tokens = val.get("usageMetadata").and_then(|u| u.get("promptTokenCount")).and_then(|n| n.as_u64());
        let candidate_tokens = val.get("usageMetadata").and_then(|u| u.get("candidatesTokenCount")).and_then(|n| n.as_u64());
        let total_tokens = val.get("usageMetadata").and_then(|u| u.get("totalTokenCount")).and_then(|n| n.as_u64());

        let handler_elapsed_ms = handler_start.elapsed().as_millis() as u64;

        Ok(GeminiChatResponse {
            model: target_model.to_string(),
            content,
            timings: GeminiTimings {
                handler_elapsed_ms,
                http_elapsed_ms,
                prompt_tokens,
                candidate_tokens,
                total_tokens,
            },
        })
    } else {
        Err(format_api_error(status, &body, Some(&key)))
    }
}

#[allow(dead_code)]
pub fn chat_with_base_url(
    base_url: Option<&str>,
    model: &str,
    messages: Vec<ChatTurn>,
    temperature: Option<f32>,
) -> Result<GeminiChatResponse, String> {
    chat_with_base_url_and_key(base_url, None, model, messages, temperature)
}

/// Execute chat request with default production Gemini API endpoint
pub fn chat(
    model: &str,
    messages: Vec<ChatTurn>,
    temperature: Option<f32>,
) -> Result<GeminiChatResponse, String> {
    chat_with_base_url_and_key(None, None, model, messages, temperature)
}

fn extract_response_text(val: &Value) -> Option<String> {
    let candidate = val.get("candidates")?.as_array()?.first()?;
    let parts = candidate.get("content")?.get("parts")?.as_array()?;
    let mut combined = String::new();
    for part in parts {
        if let Some(t) = part.get("text").and_then(|t| t.as_str()) {
            combined.push_str(t);
        }
    }
    if combined.trim().is_empty() {
        None
    } else {
        Some(combined)
    }
}

fn format_api_error(status: u16, body: &str, key: Option<&str>) -> String {
    let parsed: Option<Value> = serde_json::from_str(body).ok();
    let server_msg = parsed
        .as_ref()
        .and_then(|v| v.get("error"))
        .and_then(|e| e.get("message"))
        .and_then(|m| m.as_str())
        .unwrap_or("");

    let redacted_server_msg = redact_key(server_msg, key);

    match status {
        400 => {
            if redacted_server_msg.contains("API key not valid") || redacted_server_msg.contains("API_KEY_INVALID") {
                "Invalid Google Gemini API key. Verify your key in Model Providers.".to_string()
            } else if !redacted_server_msg.is_empty() {
                format!("Gemini request rejected (400 Bad Request): {redacted_server_msg}")
            } else {
                "Gemini request rejected (400 Bad Request). Check model name and parameters.".to_string()
            }
        }
        401 | 403 => {
            if redacted_server_msg.contains("quota") || redacted_server_msg.contains("RESOURCE_EXHAUSTED") {
                "Gemini API quota exceeded or billing not enabled for this project. Check your Google AI Studio plan.".to_string()
            } else if !redacted_server_msg.is_empty() {
                format!("Gemini authorization failed ({status}): {redacted_server_msg}")
            } else {
                "Gemini authorization failed. The API key is invalid, inactive, or unauthorized.".to_string()
            }
        }
        404 => {
            if !redacted_server_msg.is_empty() {
                format!("Gemini model not found or retired (404): {redacted_server_msg}. Select 'gemini-3.6-flash' in Model Providers.")
            } else {
                "Selected Gemini model was not found (404). Select 'gemini-3.6-flash' in Model Providers.".to_string()
            }
        }
        429 => {
            if !redacted_server_msg.is_empty() {
                format!("Gemini rate limit exceeded (429): {redacted_server_msg}")
            } else {
                "Gemini rate limit or free-tier quota exceeded. Please wait a moment before trying again.".to_string()
            }
        }
        503 => {
            if !redacted_server_msg.is_empty() {
                format!("Google Gemini service is temporarily overloaded (503): {redacted_server_msg}. Please retry in a moment.")
            } else {
                "Google Gemini service is temporarily overloaded (503). Please retry in a moment.".to_string()
            }
        }
        500 | 502 | 504 => {
            format!("Google Gemini service temporarily unavailable ({status}). Please retry or switch to Local Ollama.")
        }
        _ => {
            if !redacted_server_msg.is_empty() {
                format!("Gemini API error ({status}): {redacted_server_msg}")
            } else {
                format!("Gemini API returned HTTP status {status}.")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    fn mock_http_server(status_line: &str, body: &str) -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let status = status_line.to_string();
        let body = body.to_string();

        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            let mut buffer = [0u8; 1024];
            loop {
                let count = stream.read(&mut buffer).unwrap_or(0);
                if count == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..count]);
                if let Some(header_end) = request.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..header_end]);
                    let content_length = headers
                        .lines()
                        .find_map(|line| {
                            let (name, value) = line.split_once(':')?;
                            name.eq_ignore_ascii_case("content-length")
                                .then(|| value.trim().parse::<usize>().ok())?
                        })
                        .unwrap_or(0);
                    if request.len() >= header_end + 4 + content_length {
                        break;
                    }
                }
            }
            let request_str = String::from_utf8_lossy(&request).to_string();

            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).unwrap();
            stream.flush().unwrap();
            request_str
        });

        (format!("http://127.0.0.1:{port}"), handle)
    }

    #[test]
    fn test_mask_key() {
        assert_eq!(mask_key(""), "Not configured");
        assert_eq!(mask_key("short"), "****");
        assert_eq!(mask_key("AIzaSyD-1234567890abcdef"), "AIza****cdef");
    }

    #[test]
    fn test_redact_key() {
        let key = "AIzaSyD-9999999999abcdef1234567890xyz";
        let text = format!("Error calling api with key {key} failed");
        let redacted = redact_key(&text, Some(key));
        assert!(!redacted.contains(key));
        assert!(redacted.contains("[REDACTED_GEMINI_KEY]"));
    }

    #[test]
    fn test_format_gemini_contents_alternating_roles() {
        let turns = vec![
            ChatTurn { role: "user".into(), content: "Prompt 1".into() },
            ChatTurn { role: "user".into(), content: "Prompt 2".into() },
            ChatTurn { role: "assistant".into(), content: "Answer 1".into() },
            ChatTurn { role: "user".into(), content: "Prompt 3".into() },
        ];
        let contents = format_gemini_contents(&turns);
        assert_eq!(contents.len(), 3);
        assert_eq!(contents[0]["role"], "user");
        assert_eq!(contents[0]["parts"].as_array().unwrap().len(), 2);
        assert_eq!(contents[1]["role"], "model");
        assert_eq!(contents[2]["role"], "user");
    }

    #[test]
    fn test_chat_success_mock() {
        let mock_resp = json!({
            "candidates": [{
                "content": {
                    "role": "model",
                    "parts": [{ "text": "Hello from mock Gemini!" }]
                },
                "finishReason": "STOP"
            }],
            "usageMetadata": {
                "promptTokenCount": 5,
                "candidatesTokenCount": 8,
                "totalTokenCount": 13
            }
        }).to_string();

        let (base_url, server) = mock_http_server("200 OK", &mock_resp);

        let res = chat_with_base_url_and_key(
            Some(&base_url),
            Some("test-key-123456"),
            "gemini-3.6-flash",
            vec![ChatTurn { role: "user".into(), content: "Hi".into() }],
            Some(0.7),
        ).unwrap();

        let req = server.join().unwrap();
        assert!(req.contains("x-goog-api-key: test-key-123456"));
        assert!(req.contains("gemini-3.6-flash"));
        assert_eq!(res.content, "Hello from mock Gemini!");
        assert_eq!(res.timings.total_tokens, Some(13));
    }

    #[test]
    fn test_chat_auth_failure_mock() {
        let mock_err = json!({
            "error": {
                "code": 400,
                "message": "API key not valid. Please pass a valid API key.",
                "status": "INVALID_ARGUMENT"
            }
        }).to_string();

        let (base_url, server) = mock_http_server("400 Bad Request", &mock_err);

        let err = chat_with_base_url_and_key(
            Some(&base_url),
            Some("invalid-key-xyz"),
            "gemini-3.6-flash",
            vec![ChatTurn { role: "user".into(), content: "Hi".into() }],
            None,
        ).unwrap_err();

        server.join().unwrap();
        assert!(err.contains("Invalid Google Gemini API key"));
        assert!(!err.contains("invalid-key-xyz"));
    }

    #[test]
    fn test_chat_rate_limit_mock() {
        let mock_err = json!({
            "error": {
                "code": 429,
                "message": "Resource has been exhausted (e.g. check quota).",
                "status": "RESOURCE_EXHAUSTED"
            }
        }).to_string();

        let (base_url, server) = mock_http_server("429 Too Many Requests", &mock_err);

        let err = chat_with_base_url_and_key(
            Some(&base_url),
            Some("test-key-rate-limit"),
            "gemini-3.6-flash",
            vec![ChatTurn { role: "user".into(), content: "Hi".into() }],
            None,
        ).unwrap_err();

        server.join().unwrap();
        assert!(err.contains("rate limit"));
    }

    #[test]
    fn test_chat_not_found_404_mock() {
        let mock_err = json!({
            "error": {
                "code": 404,
                "message": "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.",
                "status": "NOT_FOUND"
            }
        }).to_string();

        let (base_url, server) = mock_http_server("404 Not Found", &mock_err);

        let err = chat_with_base_url_and_key(
            Some(&base_url),
            Some("test-key-404"),
            "gemini-2.5-flash",
            vec![ChatTurn { role: "user".into(), content: "Hi".into() }],
            None,
        ).unwrap_err();

        server.join().unwrap();
        assert!(err.contains("not found or retired (404)"));
        assert!(err.contains("gemini-3.6-flash"));
    }

    #[test]
    fn test_chat_service_unavailable_503_mock() {
        let mock_err = json!({
            "error": {
                "code": 503,
                "message": "The model is overloaded. Please try again later.",
                "status": "UNAVAILABLE"
            }
        }).to_string();

        let (base_url, server) = mock_http_server("503 Service Unavailable", &mock_err);

        let err = chat_with_base_url_and_key(
            Some(&base_url),
            Some("test-key-503"),
            "gemini-3.8-flash",
            vec![ChatTurn { role: "user".into(), content: "Hi".into() }],
            None,
        ).unwrap_err();

        server.join().unwrap();
        assert!(err.contains("temporarily overloaded (503)"));
    }

    #[test]
    fn test_gemini_key_status_serialization() {
        let status = GeminiKeyStatus {
            configured: true,
            source: "Windows DPAPI Encrypted Vault (%APPDATA%)".to_string(),
            masked: "AIza****1234".to_string(),
            masked_key: "AIza****1234".to_string(),
        };
        let serialized = serde_json::to_string(&status).unwrap();
        assert!(serialized.contains("\"masked\":\"AIza****1234\""));
        assert!(serialized.contains("\"masked_key\":\"AIza****1234\""));

        let deserialized: GeminiKeyStatus = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.masked, "AIza****1234");
        assert_eq!(deserialized.masked_key, "AIza****1234");
    }

    #[test]
    fn test_live_gemini_connection_smoke() {
        if std::env::var("GEMINI_API_KEY").is_ok() || std::env::var("GOOGLE_API_KEY").is_ok() {
            let res = test_connection(Some("gemini-3.6-flash"));
            println!("LIVE_GEMINI_SMOKE_RESULT: {:?}", res);
            assert!(res.is_ok(), "Live Gemini connection should succeed with valid key: {:?}", res);
        }
    }


    #[test]
    fn test_missing_key_error() {
        set_runtime_key_override(None);
        // Temporarily clear env
        let old_env = std::env::var("GEMINI_API_KEY").ok();
        let old_google_env = std::env::var("GOOGLE_API_KEY").ok();
        std::env::remove_var("GEMINI_API_KEY");
        std::env::remove_var("GOOGLE_API_KEY");

        // Clear file if present
        let status = get_key_status();
        if !status.configured {
            let err = chat("gemini-2.0-flash", vec![ChatTurn { role: "user".into(), content: "Hi".into() }], None).unwrap_err();
            assert!(err.contains("missing") || err.contains("not configured"));
        }

        if let Some(val) = old_env { std::env::set_var("GEMINI_API_KEY", val); }
        if let Some(val) = old_google_env { std::env::set_var("GOOGLE_API_KEY", val); }
    }

    #[test]
    fn test_hex_conversion_roundtrip() {
        let sample = b"hello_lodhi_ai_secure_vault_12345";
        let hex = bytes_to_hex(sample);
        let recovered = hex_to_bytes(&hex).expect("valid hex");
        assert_eq!(recovered, sample);
        assert_eq!(hex_to_bytes("invalid_odd_length"), None);
    }

    #[test]
    fn test_dpapi_encrypt_decrypt_roundtrip() {
        let secret = b"AIzaSyDemoSecretKeyForTestingWindowsDPAPI";
        let encrypted = dpapi_encrypt(secret).expect("DPAPI encryption must succeed");
        #[cfg(target_os = "windows")]
        assert_ne!(encrypted, secret, "Ciphertext must not match plaintext");
        let decrypted = dpapi_decrypt(&encrypted).expect("DPAPI decryption must succeed");
        assert_eq!(decrypted, secret, "Decrypted data must match original secret");
    }

    #[test]
    fn test_extract_system_prompt_and_system_instruction() {
        let turns = vec![
            ChatTurn { role: "system".into(), content: "You are Lodhi AI. Speak natural Roman Urdu.".into() },
            ChatTurn { role: "user".into(), content: "Salam, kya haal hai?".into() },
        ];
        let (sys, dialog) = extract_system_prompt(&turns);
        assert_eq!(sys, Some("You are Lodhi AI. Speak natural Roman Urdu.".into()));
        assert_eq!(dialog.len(), 1);
        assert_eq!(dialog[0].role, "user");

        let mock_resp = json!({
            "candidates": [{
                "content": {
                    "role": "model",
                    "parts": [{ "text": "Walaikum Assalam! Main theek hoon." }]
                },
                "finishReason": "STOP"
            }]
        }).to_string();

        let (base_url, server) = mock_http_server("200 OK", &mock_resp);

        let res = chat_with_base_url_and_key(
            Some(&base_url),
            Some("test-key-sys"),
            "gemini-2.0-flash",
            turns,
            None,
        ).unwrap();

        let req = server.join().unwrap();
        assert!(req.contains("systemInstruction"));
        assert!(req.contains("Speak natural Roman Urdu"));
        assert_eq!(res.content, "Walaikum Assalam! Main theek hoon.");
    }
}
