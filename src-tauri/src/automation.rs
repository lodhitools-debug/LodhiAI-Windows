use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

const MAX_CLIPBOARD_CHARS: usize = 100_000;
const MAX_AUDIT_LOG_ENTRIES: usize = 200;

static NEXT_REQ_ID: AtomicU64 = AtomicU64::new(1);

// Thread-safe in-memory audit log
static AUDIT_LOG: Mutex<Vec<AutomationAuditEntry>> = Mutex::new(Vec::new());

// In-memory clipboard fallback for tests/headless environments
static MEMORY_CLIPBOARD: Mutex<String> = Mutex::new(String::new());

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AutomationPermissionLevel {
    Safe,
    RequiresApproval,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovedApp {
    pub id: String,
    pub display_name: String,
    pub executable: String,
    pub description: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationActionRequest {
    pub id: String,
    pub action_type: String,
    pub description: String,
    pub target: String,
    pub parameters: serde_json::Value,
    pub permission_level: AutomationPermissionLevel,
    pub risk_level: RiskLevel,
    pub preview: String,
    pub requires_confirmation: bool,
    pub status: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationActionResult {
    pub request_id: String,
    pub action_type: String,
    pub success: bool,
    pub output: String,
    pub execution_time_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationAuditEntry {
    pub id: String,
    pub action_type: String,
    pub target: String,
    pub permission_decision: String,
    pub success: bool,
    pub duration_ms: u64,
    pub error: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationCapabilities {
    pub can_launch_approved_apps: bool,
    pub can_inspect_windows: bool,
    pub can_open_workspace_path: bool,
    pub can_manage_clipboard: bool,
    pub approved_apps: Vec<ApprovedApp>,
    pub audit_log_count: usize,
    pub security_notice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub pid: u32,
    pub process_name: String,
    pub window_title: String,
    pub is_responsive: bool,
}

/// Official Allowlisted Windows Applications
pub fn get_approved_apps() -> Vec<ApprovedApp> {
    vec![
        ApprovedApp {
            id: "notepad".into(),
            display_name: "Notepad".into(),
            executable: "notepad.exe".into(),
            description: "Windows text editor for viewing and editing approved workspace documents.".into(),
            category: "Editor".into(),
        },
        ApprovedApp {
            id: "calc".into(),
            display_name: "Calculator".into(),
            executable: "calc.exe".into(),
            description: "Standard Windows calculator for utility arithmetic and validation.".into(),
            category: "Utility".into(),
        },
        ApprovedApp {
            id: "paint".into(),
            display_name: "Paint".into(),
            executable: "mspaint.exe".into(),
            description: "Windows image viewer and bitmap editor for inspecting visual assets.".into(),
            category: "Graphics".into(),
        },
        ApprovedApp {
            id: "explorer".into(),
            display_name: "File Explorer".into(),
            executable: "explorer.exe".into(),
            description: "Windows File Explorer strictly scoped to approved workspace paths.".into(),
            category: "System".into(),
        },
    ]
}

pub fn is_app_approved(app_id_or_exe: &str) -> bool {
    let lower = app_id_or_exe.to_ascii_lowercase();
    get_approved_apps().iter().any(|app| {
        app.id.eq_ignore_ascii_case(&lower)
            || app.executable.eq_ignore_ascii_case(&lower)
            || lower.ends_with(&app.executable.to_ascii_lowercase())
    })
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn record_audit(
    action_type: &str,
    target: &str,
    decision: &str,
    success: bool,
    duration_ms: u64,
    error: Option<String>,
) {
    if let Ok(mut log) = AUDIT_LOG.lock() {
        let entry = AutomationAuditEntry {
            id: format!("audit-{}", now_epoch_ms()),
            action_type: action_type.to_string(),
            target: target.to_string(),
            permission_decision: decision.to_string(),
            success,
            duration_ms,
            error,
            timestamp: now_epoch_ms(),
        };
        log.push(entry);
        if log.len() > MAX_AUDIT_LOG_ENTRIES {
            log.remove(0);
        }
    }
}

pub fn get_automation_audit_log() -> Vec<AutomationAuditEntry> {
    AUDIT_LOG
        .lock()
        .map(|log| log.clone())
        .unwrap_or_default()
}

pub fn clear_automation_audit_log() {
    if let Ok(mut log) = AUDIT_LOG.lock() {
        log.clear();
    }
}

pub fn get_automation_capabilities() -> AutomationCapabilities {
    let count = AUDIT_LOG.lock().map(|l| l.len()).unwrap_or(0);
    AutomationCapabilities {
        can_launch_approved_apps: true,
        can_inspect_windows: true,
        can_open_workspace_path: true,
        can_manage_clipboard: true,
        approved_apps: get_approved_apps(),
        audit_log_count: count,
        security_notice: "All automated Windows actions are bounded by strict human-in-the-loop authorization, allowlisted applications, workspace path isolation, and audit logging.".into(),
    }
}

/// Redact sensitive terms (passwords, tokens, keys) from window titles
pub fn sanitize_window_title(title: &str) -> String {
    let lower = title.to_ascii_lowercase();
    let sensitive_keywords = ["password", "token", "secret", "private_key", "credential", "id_rsa", "bearer"];
    for kw in &sensitive_keywords {
        if lower.contains(kw) {
            return "[REDACTED_SENSITIVE_WINDOW_TITLE]".to_string();
        }
    }
    title.to_string()
}

/// Validates that a requested path stays strictly within the approved workspace root
pub fn validate_workspace_path(path_str: &str, workspace_root: &Path) -> Result<PathBuf, String> {
    let path = Path::new(path_str);
    
    // Check for traversal components
    for comp in path.components() {
        if let Component::ParentDir = comp {
            return Err("Path traversal (..) is strictly prohibited.".into());
        }
    }

    let resolved = if path.is_absolute() {
        path.to_path_buf()
    } else {
        workspace_root.join(path)
    };

    let canonical_root = workspace_root
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {e}"))?;

    // If file exists, canonicalize it; otherwise canonicalize its parent
    let canonical_target = if resolved.exists() {
        resolved.canonicalize().map_err(|e| format!("Failed to canonicalize path: {e}"))?
    } else {
        let parent = resolved
            .parent()
            .ok_or_else(|| "Target path has no valid parent directory.".to_string())?;
        if parent.exists() {
            let canon_parent = parent.canonicalize().map_err(|e| format!("Invalid parent directory: {e}"))?;
            if !canon_parent.starts_with(&canonical_root) {
                return Err("Target path parent resides outside approved workspace root.".into());
            }
            resolved
        } else {
            return Err("Target directory does not exist in workspace.".into());
        }
    };

    if !canonical_target.starts_with(&canonical_root) {
        return Err("Path escapes approved workspace boundaries.".into());
    }

    // Exclude sensitive files
    if let Some(file_name) = canonical_target.file_name().and_then(|n| n.to_str()) {
        let lower = file_name.to_ascii_lowercase();
        if lower.starts_with(".env") || lower == "id_rsa" || lower.ends_with(".key") || lower.ends_with(".pem") {
            return Err(format!("Access to sensitive security file '{file_name}' is blocked."));
        }
    }

    Ok(canonical_target)
}

/// Preview an intended automation action and produce an authorization request
pub fn preview_automation_action(
    action_type: &str,
    parameters: serde_json::Value,
    workspace_root: Option<&Path>,
) -> Result<AutomationActionRequest, String> {
    let req_num = NEXT_REQ_ID.fetch_add(1, Ordering::SeqCst);
    let id = format!("auto-req-{}", req_num);

    match action_type {
        "launch_app" => {
            let app_id = parameters["app"]
                .as_str()
                .ok_or_else(|| "Missing required parameter: 'app'".to_string())?
                .to_string();

            if !is_app_approved(&app_id) {
                return Err(format!(
                    "Application '{}' is not in the approved allowlist. Allowed apps: {:?}",
                    app_id,
                    get_approved_apps().iter().map(|a| &a.id).collect::<Vec<_>>()
                ));
            }

            let file_arg = parameters["file"].as_str().map(|s| s.to_string());
            let preview = if let Some(ref file) = file_arg {
                if let Some(root) = workspace_root {
                    let _ = validate_workspace_path(file, root)?;
                }
                format!("Launch allowlisted application '{}' with workspace file '{}'", app_id, file)
            } else {
                format!("Launch allowlisted application '{}'", app_id)
            };

            Ok(AutomationActionRequest {
                id,
                action_type: "launch_app".into(),
                description: format!("Launch approved application '{}'", app_id),
                target: app_id,
                parameters,
                permission_level: AutomationPermissionLevel::RequiresApproval,
                risk_level: RiskLevel::Medium,
                preview,
                requires_confirmation: true,
                status: "pending".into(),
                created_at: now_epoch_ms(),
            })
        }
        "open_workspace_path" => {
            let target_path = parameters["path"]
                .as_str()
                .ok_or_else(|| "Missing required parameter: 'path'".to_string())?
                .to_string();

            let root = workspace_root.ok_or_else(|| "Workspace root is required to open paths.".to_string())?;
            let valid_path = validate_workspace_path(&target_path, root)?;

            Ok(AutomationActionRequest {
                id,
                action_type: "open_workspace_path".into(),
                description: format!("Open workspace path in Windows Explorer: {}", target_path),
                target: valid_path.to_string_lossy().to_string(),
                parameters,
                permission_level: AutomationPermissionLevel::RequiresApproval,
                risk_level: RiskLevel::Low,
                preview: format!("Reveal '{}' in Windows File Explorer", target_path),
                requires_confirmation: true,
                status: "pending".into(),
                created_at: now_epoch_ms(),
            })
        }
        "inspect_windows" => Ok(AutomationActionRequest {
            id,
            action_type: "inspect_windows".into(),
            description: "Inspect running application window titles and responsiveness".into(),
            target: "active_desktop_windows".into(),
            parameters,
            permission_level: AutomationPermissionLevel::Safe,
            risk_level: RiskLevel::Low,
            preview: "Inspect active desktop windows and filter non-sensitive application state".into(),
            requires_confirmation: false,
            status: "pending".into(),
            created_at: now_epoch_ms(),
        }),
        "set_clipboard" => {
            let text = parameters["text"]
                .as_str()
                .ok_or_else(|| "Missing required parameter: 'text'".to_string())?
                .to_string();
            if text.len() > MAX_CLIPBOARD_CHARS {
                return Err(format!(
                    "Clipboard payload exceeds maximum safety limit of {} characters.",
                    MAX_CLIPBOARD_CHARS
                ));
            }

            let preview_snippet = if text.chars().count() > 60 {
                format!("{}...", text.chars().take(60).collect::<String>())
            } else {
                text.clone()
            };

            Ok(AutomationActionRequest {
                id,
                action_type: "set_clipboard".into(),
                description: "Copy text to Windows clipboard".into(),
                target: "system_clipboard".into(),
                parameters,
                permission_level: AutomationPermissionLevel::RequiresApproval,
                risk_level: RiskLevel::Medium,
                preview: format!("Set Windows clipboard to: \"{}\"", preview_snippet),
                requires_confirmation: true,
                status: "pending".into(),
                created_at: now_epoch_ms(),
            })
        }
        "get_clipboard" => Ok(AutomationActionRequest {
            id,
            action_type: "get_clipboard".into(),
            description: "Read current text from Windows clipboard".into(),
            target: "system_clipboard".into(),
            parameters,
            permission_level: AutomationPermissionLevel::Safe,
            risk_level: RiskLevel::Low,
            preview: "Read text from the active Windows clipboard".into(),
            requires_confirmation: false,
            status: "pending".into(),
            created_at: now_epoch_ms(),
        }),
        _ => Err(format!("Unsupported or unrecognized automation action type: '{}'", action_type)),
    }
}

/// Execute an automation action strictly enforcing approval gates and workspace boundaries
pub fn execute_automation_action(
    request: AutomationActionRequest,
    user_confirmed: bool,
    workspace_root: Option<&Path>,
) -> Result<AutomationActionResult, String> {
    let start_time = Instant::now();

    // Strict Fail-Closed Approval Gate
    if request.requires_confirmation && !user_confirmed {
        record_audit(
            &request.action_type,
            &request.target,
            "user_denied",
            false,
            0,
            Some("Action blocked: explicit user approval was not provided.".into()),
        );
        return Err("Action blocked: explicit human authorization is required before executing sensitive Windows actions.".into());
    }

    let decision = if request.requires_confirmation {
        "user_approved"
    } else {
        "auto_permitted"
    };

    let result = match request.action_type.as_str() {
        "launch_app" => {
            let app_id = request.parameters["app"]
                .as_str()
                .ok_or_else(|| "Missing required parameter: 'app'".to_string())?;

            if !is_app_approved(app_id) {
                return Err(format!("Application '{}' is not approved.", app_id));
            }

            let file_arg = request.parameters["file"].as_str();
            let validated_file = if let Some(file) = file_arg {
                let root = workspace_root.ok_or_else(|| "Workspace root is required when passing file argument.".to_string())?;
                Some(validate_workspace_path(file, root)?)
            } else {
                None
            };

            launch_app_internal(app_id, validated_file.as_deref())
        }
        "open_workspace_path" => {
            let target_str = request.parameters["path"]
                .as_str()
                .ok_or_else(|| "Missing required parameter: 'path'".to_string())?;
            let root = workspace_root.ok_or_else(|| "Workspace root is required.".to_string())?;
            let valid_path = validate_workspace_path(target_str, root)?;
            open_explorer_internal(&valid_path)
        }
        "inspect_windows" => {
            let windows = inspect_windows_internal()?;
            serde_json::to_string_pretty(&windows).map_err(|e| e.to_string())
        }
        "set_clipboard" => {
            let text = request.parameters["text"]
                .as_str()
                .ok_or_else(|| "Missing parameter 'text'".to_string())?;
            set_clipboard_internal(text)?;
            Ok(format!("Successfully copied {} characters to Windows clipboard.", text.len()))
        }
        "get_clipboard" => get_clipboard_internal(),
        _ => Err(format!("Unknown action type: {}", request.action_type)),
    };

    let elapsed = start_time.elapsed().as_millis() as u64;

    match result {
        Ok(output) => {
            record_audit(&request.action_type, &request.target, decision, true, elapsed, None);
            Ok(AutomationActionResult {
                request_id: request.id,
                action_type: request.action_type,
                success: true,
                output,
                execution_time_ms: elapsed,
                error: None,
            })
        }
        Err(err) => {
            record_audit(&request.action_type, &request.target, decision, false, elapsed, Some(err.clone()));
            Ok(AutomationActionResult {
                request_id: request.id,
                action_type: request.action_type,
                success: false,
                output: String::new(),
                execution_time_ms: elapsed,
                error: Some(err),
            })
        }
    }
}

fn launch_app_internal(app_id: &str, file_arg: Option<&Path>) -> Result<String, String> {
    let lower = app_id.to_ascii_lowercase();
    let exe = if lower.contains("notepad") {
        "notepad.exe"
    } else if lower.contains("calc") {
        "calc.exe"
    } else if lower.contains("paint") {
        "mspaint.exe"
    } else if lower.contains("explorer") {
        "explorer.exe"
    } else {
        return Err(format!("Unauthorized application: {}", app_id));
    };

    let mut cmd = Command::new(exe);
    if let Some(file) = file_arg {
        cmd.arg(file.to_string_lossy().to_string());
    }

    #[cfg(target_os = "windows")]
    {
        cmd.spawn()
            .map_err(|e| format!("Failed to launch '{}': {e}", exe))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Headless / mock platform
        let _ = cmd;
    }

    Ok(format!("Approved application '{}' launched successfully.", exe))
}

fn open_explorer_internal(target_path: &Path) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("explorer.exe");
        if target_path.is_file() {
            cmd.arg(format!("/select,{}", target_path.to_string_lossy()));
        } else {
            cmd.arg(target_path.to_string_lossy().to_string());
        }
        cmd.spawn()
            .map_err(|e| format!("Failed to open Explorer at '{:?}': {e}", target_path))?;
    }

    Ok(format!("Opened Explorer at: {}", target_path.to_string_lossy()))
}

fn set_clipboard_internal(text: &str) -> Result<(), String> {
    if text.len() > MAX_CLIPBOARD_CHARS {
        return Err(format!("Payload exceeds maximum clipboard size of {} bytes.", MAX_CLIPBOARD_CHARS));
    }

    // Update in-memory copy
    if let Ok(mut mem) = MEMORY_CLIPBOARD.lock() {
        *mem = text.to_string();
    }

    #[cfg(target_os = "windows")]
    {
        use std::io::Write;
        let mut child = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", "$Input | Set-Clipboard"])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn clipboard process: {e}"))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }

        let status = child.wait().map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("PowerShell Set-Clipboard exited with non-zero status.".into());
        }
    }

    Ok(())
}

fn get_clipboard_internal() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", "Get-Clipboard"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output();

        if let Ok(out) = output {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout).trim_end().to_string();
                if !text.is_empty() {
                    return Ok(text);
                }
            }
        }
    }

    // Fallback to in-memory clipboard
    if let Ok(mem) = MEMORY_CLIPBOARD.lock() {
        return Ok(mem.clone());
    }

    Ok(String::new())
}

fn inspect_windows_internal() -> Result<Vec<WindowInfo>, String> {
    let mut windows = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("tasklist.exe")
            .args(["/V", "/FO", "CSV"])
            .output()
            .map_err(|e| format!("Failed to execute tasklist: {e}"))?;

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines().skip(1) {
                // Parse CSV fields: Image Name, PID, Session Name, Session#, Mem Usage, Status, User Name, CPU Time, Window Title
                let parts: Vec<&str> = line.split("\",\"").collect();
                if parts.len() >= 9 {
                    let image = parts[0].trim_matches('"');
                    let pid_str = parts[1].trim_matches('"');
                    let raw_title = parts[8].trim_matches('"').trim_matches('\r');

                    if raw_title != "N/A" && !raw_title.is_empty() {
                        let pid = pid_str.parse::<u32>().unwrap_or(0);
                        let clean_title = sanitize_window_title(raw_title);
                        windows.push(WindowInfo {
                            pid,
                            process_name: image.to_string(),
                            window_title: clean_title,
                            is_responsive: true,
                        });
                    }
                }
            }
        }
    }

    if windows.is_empty() {
        // Fallback representation for headless or test environments
        windows.push(WindowInfo {
            pid: std::process::id(),
            process_name: "lodhi-ai.exe".into(),
            window_title: "Lodhi AI Windows Desktop".into(),
            is_responsive: true,
        });
    }

    Ok(windows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_approved_apps_allowlist() {
        assert!(is_app_approved("notepad"));
        assert!(is_app_approved("notepad.exe"));
        assert!(is_app_approved("calc"));
        assert!(is_app_approved("calc.exe"));
        assert!(is_app_approved("mspaint.exe"));
        assert!(is_app_approved("explorer.exe"));

        // Reject dangerous executables
        assert!(!is_app_approved("cmd.exe"));
        assert!(!is_app_approved("powershell.exe"));
        assert!(!is_app_approved("malware.exe"));
        assert!(!is_app_approved("format.com"));
    }

    #[test]
    fn test_preview_action_and_risk() {
        let params = serde_json::json!({
            "app": "notepad.exe"
        });
        let preview = preview_automation_action("launch_app", params, None).expect("preview should succeed");
        assert_eq!(preview.permission_level, AutomationPermissionLevel::RequiresApproval);
        assert_eq!(preview.risk_level, RiskLevel::Medium);
        assert!(preview.requires_confirmation);
        assert!(preview.preview.contains("Notepad") || preview.preview.contains("notepad.exe"));
    }

    #[test]
    fn test_unauthorized_app_preview_fails() {
        let params = serde_json::json!({
            "app": "cmd.exe"
        });
        let result = preview_automation_action("launch_app", params, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not in the approved allowlist"));
    }

    #[test]
    fn test_unconfirmed_sensitive_action_is_blocked() {
        let req = AutomationActionRequest {
            id: "test-req-1".into(),
            action_type: "launch_app".into(),
            description: "Launch Notepad".into(),
            target: "notepad.exe".into(),
            parameters: serde_json::json!({ "app": "notepad.exe" }),
            permission_level: AutomationPermissionLevel::RequiresApproval,
            risk_level: RiskLevel::Medium,
            preview: "Launch Notepad".into(),
            requires_confirmation: true,
            status: "pending".into(),
            created_at: 1000,
        };

        // user_confirmed = false -> MUST FAIL CLOSED
        let res = execute_automation_action(req, false, None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Action blocked"));
    }

    #[test]
    fn test_workspace_boundary_enforcement() {
        let temp_dir = std::env::temp_dir().join(format!("lodhi_auto_test_{}", now_epoch_ms()));
        fs::create_dir_all(&temp_dir).unwrap();
        let sub_file = temp_dir.join("test.txt");
        fs::write(&sub_file, "hello").unwrap();

        // Valid file inside workspace
        let valid = validate_workspace_path("test.txt", &temp_dir);
        assert!(valid.is_ok());

        // Path traversal must fail
        let traversal = validate_workspace_path("../outside.txt", &temp_dir);
        assert!(traversal.is_err());

        // Sensitive file must fail
        let env_file = temp_dir.join(".env");
        fs::write(&env_file, "SECRET=123").unwrap();
        let sensitive = validate_workspace_path(".env", &temp_dir);
        assert!(sensitive.is_err());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_window_title_sanitization() {
        let normal = sanitize_window_title("Visual Studio Code - LodhiAI");
        assert_eq!(normal, "Visual Studio Code - LodhiAI");

        let sensitive = sanitize_window_title("Enter your database password here");
        assert_eq!(sensitive, "[REDACTED_SENSITIVE_WINDOW_TITLE]");

        let token_title = sanitize_window_title("GitHub Personal Access Token Settings");
        assert_eq!(token_title, "[REDACTED_SENSITIVE_WINDOW_TITLE]");
    }

    #[test]
    fn test_clipboard_operations_and_audit() {
        clear_automation_audit_log();

        // Safe action get_clipboard does not require approval
        let get_req = preview_automation_action("get_clipboard", serde_json::json!({}), None).unwrap();
        assert!(!get_req.requires_confirmation);

        let set_req = preview_automation_action(
            "set_clipboard",
            serde_json::json!({ "text": "Lodhi Unit Test String" }),
            None,
        )
        .unwrap();
        assert!(set_req.requires_confirmation);

        // Execute set with approval
        let set_res = execute_automation_action(set_req, true, None).unwrap();
        assert!(set_res.success);

        // Check audit log
        let audit = get_automation_audit_log();
        assert!(!audit.is_empty());
        assert_eq!(audit.last().unwrap().permission_decision, "user_approved");
    }
}
