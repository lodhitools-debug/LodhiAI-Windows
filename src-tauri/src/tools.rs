use crate::project::{self, ProjectState};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ToolPermissionLevel {
    ReadOnly,
    RequiresApproval,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub permission_level: ToolPermissionLevel,
    pub parameters_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub name: String,
    pub arguments: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ToolExecutionStatus {
    Success,
    Error,
    AwaitingApproval,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolResult {
    pub tool_name: String,
    pub status: ToolExecutionStatus,
    pub output: Option<Value>,
    pub error: Option<String>,
    pub timestamp_ms: u64,
}

impl ToolResult {
    pub fn success(tool_name: &str, output: Value) -> Self {
        Self {
            tool_name: tool_name.to_string(),
            status: ToolExecutionStatus::Success,
            output: Some(output),
            error: None,
            timestamp_ms: current_time_ms(),
        }
    }

    pub fn error(tool_name: &str, message: &str) -> Self {
        Self {
            tool_name: tool_name.to_string(),
            status: ToolExecutionStatus::Error,
            output: None,
            error: Some(message.to_string()),
            timestamp_ms: current_time_ms(),
        }
    }

    pub fn awaiting_approval(tool_name: &str, preview: Value) -> Self {
        Self {
            tool_name: tool_name.to_string(),
            status: ToolExecutionStatus::AwaitingApproval,
            output: Some(preview),
            error: None,
            timestamp_ms: current_time_ms(),
        }
    }
}

fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn get_available_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "workspace_tree".to_string(),
            description: "Lists all selectable files in the active project directory within safety bounds.".to_string(),
            permission_level: ToolPermissionLevel::ReadOnly,
            parameters_schema: json!({
                "type": "object",
                "properties": {
                    "maxFileBytes": { "type": "number", "description": "Maximum file size to consider (default 256KB)" }
                }
            }),
        },
        ToolDefinition {
            name: "workspace_read".to_string(),
            description: "Reads the content of a permitted source file within the project workspace.".to_string(),
            permission_level: ToolPermissionLevel::ReadOnly,
            parameters_schema: json!({
                "type": "object",
                "required": ["path"],
                "properties": {
                    "path": { "type": "string", "description": "Relative path to file inside project" },
                    "maxBytes": { "type": "number", "description": "Maximum file bytes to read" }
                }
            }),
        },
        ToolDefinition {
            name: "workspace_search".to_string(),
            description: "Searches for a text pattern or symbol across permitted workspace files.".to_string(),
            permission_level: ToolPermissionLevel::ReadOnly,
            parameters_schema: json!({
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": { "type": "string", "description": "Text or symbol to search for" },
                    "maxResults": { "type": "number", "description": "Maximum matching lines to return (default 25)" }
                }
            }),
        },
        ToolDefinition {
            name: "workspace_diagnostics".to_string(),
            description: "Detects the project language, framework, dependencies, entry points, and available check scripts.".to_string(),
            permission_level: ToolPermissionLevel::ReadOnly,
            parameters_schema: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolDefinition {
            name: "workspace_parse_diagnostics".to_string(),
            description: "Parses compiler, linter, or test runner error logs into structured diagnostics with exact file/line and suggested fixes.".to_string(),
            permission_level: ToolPermissionLevel::ReadOnly,
            parameters_schema: json!({
                "type": "object",
                "required": ["rawOutput"],
                "properties": {
                    "rawOutput": { "type": "string", "description": "Raw compiler or test runner console log output" },
                    "toolSource": { "type": "string", "description": "Source tool: tsc, rustc, eslint, pytest, or generic" }
                }
            }),
        },
        ToolDefinition {
            name: "workspace_propose_edit".to_string(),
            description: "Stages a proposed change to a workspace file and generates a diff preview without writing to disk.".to_string(),
            permission_level: ToolPermissionLevel::ReadOnly,
            parameters_schema: json!({
                "type": "object",
                "required": ["path", "proposedContent"],
                "properties": {
                    "path": { "type": "string", "description": "Relative path to the target file" },
                    "proposedContent": { "type": "string", "description": "Complete new content for the file" },
                    "summary": { "type": "string", "description": "Brief explanation of the proposed change" }
                }
            }),
        },
        ToolDefinition {
            name: "workspace_apply_diff".to_string(),
            description: "Applies an approved file proposal to disk, creating a recoverable .backup snapshot first.".to_string(),
            permission_level: ToolPermissionLevel::RequiresApproval,
            parameters_schema: json!({
                "type": "object",
                "required": ["proposalId"],
                "properties": {
                    "proposalId": { "type": "string", "description": "ID of the staged proposal to apply" }
                }
            }),
        },
        ToolDefinition {
            name: "workspace_run_check".to_string(),
            description: "Runs an allowlisted project script (test, type-check, build) with secret redaction and 64KB output cap.".to_string(),
            permission_level: ToolPermissionLevel::RequiresApproval,
            parameters_schema: json!({
                "type": "object",
                "required": ["checkId"],
                "properties": {
                    "checkId": { "type": "string", "description": "Identifier of the check script to run" }
                }
            }),
        },
    ]
}

/// Safely validates that a relative path stays within the project root,
/// rejecting path traversals (..), absolute paths, and secret files.
#[allow(dead_code)]
pub fn validate_relative_workspace_path(root: &Path, rel_path_str: &str) -> Result<PathBuf, String> {
    let raw = Path::new(rel_path_str);
    if raw.is_absolute() {
        return Err("Absolute paths are not permitted in workspace operations.".to_string());
    }

    for component in raw.components() {
        match component {
            Component::ParentDir => {
                return Err("Parent directory traversal (..) is strictly prohibited.".to_string());
            }
            Component::Prefix(_) | Component::RootDir => {
                return Err("Root or prefix references are not permitted.".to_string());
            }
            Component::Normal(name) => {
                let name_str = name.to_string_lossy().to_lowercase();
                if name_str == ".env" || name_str.starts_with(".env.") || name_str == "id_rsa" || name_str == "id_ed25519" {
                    return Err(format!("Access to sensitive file '{name_str}' is blocked by security policy."));
                }
                if name_str == ".git" || name_str == "node_modules" || name_str == "target" {
                    return Err(format!("Access to internal folder '{name_str}' is blocked."));
                }
            }
            Component::CurDir => {}
        }
    }

    let joined = root.join(raw);
    if !joined.starts_with(root) {
        return Err("Target path resolves outside of the selected project root.".to_string());
    }

    Ok(joined)
}

/// Executes a tool call against the active project state with permission enforcement.
pub fn execute_tool(
    call: &ToolCall,
    state: &ProjectState,
    permission_granted: bool,
) -> ToolResult {
    match call.name.as_str() {
        "workspace_tree" => {
            let max_bytes = call.arguments.get("maxFileBytes").and_then(Value::as_u64).unwrap_or(project::DEFAULT_FILE_LIMIT);
            match project::scan_project(state, max_bytes) {
                Ok(tree) => ToolResult::success("workspace_tree", json!(tree)),
                Err(err) => ToolResult::error("workspace_tree", &err),
            }
        }
        "workspace_read" => {
            let path_val = match call.arguments.get("path").and_then(Value::as_str) {
                Some(p) => p,
                None => return ToolResult::error("workspace_read", "Missing required argument 'path'"),
            };
            let max_bytes = call.arguments.get("maxBytes").and_then(Value::as_u64).unwrap_or(project::DEFAULT_FILE_LIMIT);
            match project::read_selected_files(state, vec![path_val.to_string()], max_bytes, project::DEFAULT_CONTEXT_LIMIT) {
                Ok(mut files) => {
                    if let Some(file) = files.pop() {
                        ToolResult::success("workspace_read", json!({
                            "path": file.path,
                            "content": file.content,
                            "sizeBytes": file.size_bytes
                        }))
                    } else {
                        ToolResult::error("workspace_read", "File could not be read or was empty.")
                    }
                }
                Err(err) => ToolResult::error("workspace_read", &err),
            }
        }
        "workspace_search" => {
            let query = match call.arguments.get("query").and_then(Value::as_str) {
                Some(q) if !q.trim().is_empty() => q.to_lowercase(),
                _ => return ToolResult::error("workspace_search", "Missing or empty required argument 'query'"),
            };
            let max_results = call.arguments.get("maxResults").and_then(Value::as_u64).unwrap_or(25) as usize;

            let root = match project::scan_project(state, project::DEFAULT_FILE_LIMIT) {
                Ok(tree) => tree,
                Err(err) => return ToolResult::error("workspace_search", &err),
            };

            let mut matches = Vec::new();
            for entry in root.entries {
                if !entry.is_directory && entry.selectable {
                    if let Ok(files) = project::read_selected_files(state, vec![entry.path.clone()], project::DEFAULT_FILE_LIMIT, project::DEFAULT_CONTEXT_LIMIT) {
                        if let Some(file) = files.first() {
                            for (line_idx, line) in file.content.lines().enumerate() {
                                if line.to_lowercase().contains(&query) {
                                    matches.push(json!({
                                        "file": entry.path.clone(),
                                        "line": line_idx + 1,
                                        "text": line.trim()
                                    }));
                                    if matches.len() >= max_results {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                if matches.len() >= max_results {
                    break;
                }
            }

            ToolResult::success("workspace_search", json!({
                "query": query,
                "matches": matches,
                "totalMatches": matches.len()
            }))
        }
        "workspace_diagnostics" => {
            let root_opt = state.get_root();
            match root_opt {
                Some(root) => {
                    match crate::diagnostics::analyze_project_intelligence(&root) {
                        Ok(intel) => ToolResult::success("workspace_diagnostics", serde_json::to_value(&intel).unwrap_or(json!({}))),
                        Err(err) => ToolResult::error("workspace_diagnostics", &err),
                    }
                }
                None => ToolResult::error("workspace_diagnostics", "No workspace directory is currently selected."),
            }
        }
        "workspace_parse_diagnostics" => {
            let raw_output = match call.arguments.get("rawOutput").and_then(Value::as_str) {
                Some(r) => r,
                None => return ToolResult::error("workspace_parse_diagnostics", "Missing required argument 'rawOutput'"),
            };
            let tool_source = call.arguments.get("toolSource").and_then(Value::as_str).unwrap_or("generic");
            let parsed = crate::diagnostics::parse_compiler_output(raw_output, tool_source);
            let total_errors = parsed.iter().filter(|d| d.severity == "error").count();
            let total_warnings = parsed.iter().filter(|d| d.severity == "warning").count();

            ToolResult::success("workspace_parse_diagnostics", json!({
                "diagnostics": parsed,
                "totalErrors": total_errors,
                "totalWarnings": total_warnings,
                "toolSource": tool_source,
            }))
        }
        "workspace_propose_edit" => {
            let path_val = match call.arguments.get("path").and_then(Value::as_str) {
                Some(p) => p.to_string(),
                None => return ToolResult::error("workspace_propose_edit", "Missing required argument 'path'"),
            };
            let proposed_content = match call.arguments.get("proposedContent").and_then(Value::as_str) {
                Some(c) => c.to_string(),
                None => return ToolResult::error("workspace_propose_edit", "Missing required argument 'proposedContent'"),
            };
            let summary = call.arguments.get("summary").and_then(Value::as_str).unwrap_or("Proposed change").to_string();

            let proposal_id = format!("prop-{}", current_time_ms());
            match project::stage_single_file_proposal(
                state,
                &proposal_id,
                &path_val,
                &proposed_content,
                &summary,
            ) {
                Ok(proposal) => {
                    let has_original = proposal.files.first().and_then(|f| f.original_content.as_ref()).is_some();
                    ToolResult::success("workspace_propose_edit", json!({
                        "proposalId": proposal.id,
                        "path": path_val,
                        "summary": summary,
                        "hasOriginal": has_original,
                        "proposedLength": proposed_content.len(),
                        "previewNotice": "Diff staged. Use workspace_apply_diff with explicit user approval to write to disk."
                    }))
                }
                Err(err) => ToolResult::error("workspace_propose_edit", &err),
            }
        }
        "workspace_apply_diff" => {
            let proposal_id = match call.arguments.get("proposalId").and_then(Value::as_str) {
                Some(id) => id,
                None => return ToolResult::error("workspace_apply_diff", "Missing required argument 'proposalId'"),
            };

            if !permission_granted {
                return ToolResult::awaiting_approval("workspace_apply_diff", json!({
                    "proposalId": proposal_id,
                    "action": "write_to_disk",
                    "notice": "Applying changes to disk requires explicit user confirmation. Original file will be backed up as .backup."
                }));
            }

            match project::apply_proposal(state, proposal_id, true) {
                Ok(msg) => ToolResult::success("workspace_apply_diff", json!({ "status": "applied", "message": msg })),
                Err(err) => ToolResult::error("workspace_apply_diff", &err),
            }
        }
        "workspace_run_check" => {
            let check_id = match call.arguments.get("checkId").and_then(Value::as_str) {
                Some(id) => id,
                None => return ToolResult::error("workspace_run_check", "Missing required argument 'checkId'"),
            };

            if !permission_granted {
                return ToolResult::awaiting_approval("workspace_run_check", json!({
                    "checkId": check_id,
                    "action": "execute_command",
                    "notice": "Running project check commands requires explicit user confirmation."
                }));
            }

            match project::run_project_check(state, check_id, true) {
                Ok(result) => ToolResult::success("workspace_run_check", json!(result)),
                Err(err) => ToolResult::error("workspace_run_check", &err),
            }
        }
        unknown => ToolResult::error(unknown, &format!("Unknown tool '{unknown}'. See available tools via list_available_tools.")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_tool_registry_definitions() {
        let tools = get_available_tools();
        assert!(tools.len() >= 7);
        assert!(tools.iter().any(|t| t.name == "workspace_tree"));
        assert!(tools.iter().any(|t| t.name == "workspace_read"));
        assert!(tools.iter().any(|t| t.name == "workspace_search"));
        assert!(tools.iter().any(|t| t.name == "workspace_diagnostics"));
        assert!(tools.iter().any(|t| t.name == "workspace_propose_edit"));
        assert!(tools.iter().any(|t| t.name == "workspace_apply_diff"));
        assert!(tools.iter().any(|t| t.name == "workspace_run_check"));
    }

    #[test]
    fn test_workspace_read_blocks_path_traversal() {
        let root = PathBuf::from("E:\\LodhiAI-Windows");
        let traversal = "../Windows/System32";
        let res = validate_relative_workspace_path(&root, traversal);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("traversal"));
    }

    #[test]
    fn test_workspace_read_blocks_secret_files() {
        let root = PathBuf::from("E:\\LodhiAI-Windows");
        assert!(validate_relative_workspace_path(&root, ".env").is_err());
        assert!(validate_relative_workspace_path(&root, "config/.env.local").is_err());
        assert!(validate_relative_workspace_path(&root, ".git/HEAD").is_err());
        assert!(validate_relative_workspace_path(&root, "id_rsa").is_err());
    }

    #[test]
    fn test_workspace_apply_diff_requires_explicit_approval() {
        let state = ProjectState::default();
        let call = ToolCall {
            name: "workspace_apply_diff".to_string(),
            arguments: json!({ "proposalId": "prop-123" }),
        };

        // When permission_granted = false, must return AwaitingApproval
        let res = execute_tool(&call, &state, false);
        assert_eq!(res.status, ToolExecutionStatus::AwaitingApproval);
        assert!(res.output.is_some());
    }

    #[test]
    fn test_workspace_unknown_tool() {
        let state = ProjectState::default();
        let call = ToolCall {
            name: "arbitrary_cmd_exec".to_string(),
            arguments: json!({}),
        };

        let res = execute_tool(&call, &state, true);
        assert_eq!(res.status, ToolExecutionStatus::Error);
        assert!(res.error.unwrap().contains("Unknown tool"));
    }
}
