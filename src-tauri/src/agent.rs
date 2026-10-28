use crate::project::ProjectState;
use crate::tools::{self, ToolCall, ToolExecutionStatus, ToolResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_MAX_STEPS: usize = 10;
const MAX_ALLOWED_STEPS: usize = 20;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AgentTaskStatus {
    Idle,
    Planning,
    Executing,
    AwaitingApproval,
    Completed,
    Failed,
    Aborted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentStep {
    pub step_index: usize,
    pub thought: String,
    pub tool_call: Option<ToolCall>,
    pub tool_result: Option<ToolResult>,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentTask {
    pub id: String,
    pub prompt: String,
    pub status: AgentTaskStatus,
    pub plan: Vec<String>,
    pub steps: Vec<AgentStep>,
    pub max_steps: usize,
    pub pending_approval: Option<ToolCall>,
    pub summary: Option<String>,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

static NEXT_TASK_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

static ACTIVE_TASKS: LazyLock<Mutex<HashMap<String, AgentTask>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

static TASK_ABORT_FLAGS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Initializes a new bounded agent task with a structured plan.
pub fn create_agent_task(prompt: &str, max_steps: Option<usize>) -> AgentTask {
    let now = current_time_ms();
    let seq = NEXT_TASK_ID.fetch_add(1, Ordering::SeqCst);
    let id = format!("task-{now}-{seq}");
    let bounded_steps = max_steps.unwrap_or(DEFAULT_MAX_STEPS).min(MAX_ALLOWED_STEPS);

    // Initial plan based on the user prompt
    let plan = vec![
        "Analyze prompt and inspect workspace files".to_string(),
        "Formulate code fix or architecture proposal".to_string(),
        "Stage changes and request user approval before applying".to_string(),
        "Run allowlisted verification checks and summarize".to_string(),
    ];

    let task = AgentTask {
        id: id.clone(),
        prompt: prompt.to_string(),
        status: AgentTaskStatus::Planning,
        plan,
        steps: Vec::new(),
        max_steps: bounded_steps,
        pending_approval: None,
        summary: None,
        created_at_ms: now,
        updated_at_ms: now,
    };

    let abort_flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut tasks) = ACTIVE_TASKS.lock() {
        tasks.insert(id.clone(), task.clone());
    }
    if let Ok(mut aborts) = TASK_ABORT_FLAGS.lock() {
        aborts.insert(id, abort_flag);
    }

    task
}

/// Executes the next step in an agent task.
/// Enforces step limits, loop detection, and human-in-the-loop approval.
pub fn step_agent_task(
    task_id: &str,
    project_state: &ProjectState,
    suggested_thought: Option<String>,
    next_tool_call: Option<ToolCall>,
    approval_granted: bool,
) -> Result<AgentTask, String> {
    // Check if task was aborted
    if is_task_aborted(task_id) {
        return update_task_status(task_id, AgentTaskStatus::Aborted, Some("Task was aborted by user."));
    }

    let mut task = get_agent_task(task_id)
        .ok_or_else(|| format!("Agent task '{task_id}' not found."))?;

    if task.status == AgentTaskStatus::Completed || task.status == AgentTaskStatus::Failed || task.status == AgentTaskStatus::Aborted {
        return Ok(task);
    }

    // Enforce step boundary limit
    if task.steps.len() >= task.max_steps {
        task.status = AgentTaskStatus::Failed;
        task.summary = Some(format!(
            "Task reached maximum allowed step bound ({} steps) without completion. Halting safely to prevent resource exhaustion.",
            task.max_steps
        ));
        task.updated_at_ms = current_time_ms();
        save_agent_task(&task);
        return Ok(task);
    }

    // Loop detection: Check if identical tool call was executed in last 2 steps
    if let Some(ref call) = next_tool_call {
        let repeat_count = task
            .steps
            .iter()
            .rev()
            .take(2)
            .filter(|s| s.tool_call.as_ref().map(|c| c == call).unwrap_or(false))
            .count();

        if repeat_count >= 2 {
            task.status = AgentTaskStatus::Failed;
            task.summary = Some(format!(
                "Loop detected: tool '{}' was invoked repeatedly with identical parameters without state advancement. Halting task safely.",
                call.name
            ));
            task.updated_at_ms = current_time_ms();
            save_agent_task(&task);
            return Ok(task);
        }
    }

    // Execute tool if provided
    let mut tool_result = None;
    if let Some(ref call) = next_tool_call {
        task.status = AgentTaskStatus::Executing;
        let res = tools::execute_tool(call, project_state, approval_granted);

        if res.status == ToolExecutionStatus::AwaitingApproval {
            task.status = AgentTaskStatus::AwaitingApproval;
            task.pending_approval = Some(call.clone());
        } else {
            task.pending_approval = None;
        }

        tool_result = Some(res);
    } else {
        // No more tools to execute -> mark completed
        task.status = AgentTaskStatus::Completed;
        task.summary = Some("Agent task completed successfully. All planned actions verified.".to_string());
    }

    let step = AgentStep {
        step_index: task.steps.len() + 1,
        thought: suggested_thought.unwrap_or_else(|| "Executing next planned action".to_string()),
        tool_call: next_tool_call,
        tool_result,
        timestamp_ms: current_time_ms(),
    };

    task.steps.push(step);
    task.updated_at_ms = current_time_ms();

    save_agent_task(&task);
    Ok(task)
}

/// Aborts a running agent task immediately.
pub fn abort_agent_task(task_id: &str) -> bool {
    if let Ok(aborts) = TASK_ABORT_FLAGS.lock() {
        if let Some(flag) = aborts.get(task_id) {
            flag.store(true, Ordering::SeqCst);
        }
    }

    let _ = update_task_status(task_id, AgentTaskStatus::Aborted, Some("Task cancelled by user."));
    true
}

pub fn get_agent_task(task_id: &str) -> Option<AgentTask> {
    ACTIVE_TASKS.lock().ok()?.get(task_id).cloned()
}

pub fn list_agent_tasks() -> Vec<AgentTask> {
    ACTIVE_TASKS
        .lock()
        .map(|tasks| tasks.values().cloned().collect())
        .unwrap_or_default()
}

fn is_task_aborted(task_id: &str) -> bool {
    TASK_ABORT_FLAGS
        .lock()
        .ok()
        .and_then(|aborts| aborts.get(task_id).map(|f| f.load(Ordering::SeqCst)))
        .unwrap_or(false)
}

fn save_agent_task(task: &AgentTask) {
    if let Ok(mut tasks) = ACTIVE_TASKS.lock() {
        tasks.insert(task.id.clone(), task.clone());
    }
}

fn update_task_status(task_id: &str, status: AgentTaskStatus, summary: Option<&str>) -> Result<AgentTask, String> {
    if let Ok(mut tasks) = ACTIVE_TASKS.lock() {
        if let Some(task) = tasks.get_mut(task_id) {
            task.status = status;
            if let Some(sum) = summary {
                task.summary = Some(sum.to_string());
            }
            task.updated_at_ms = current_time_ms();
            return Ok(task.clone());
        }
    }
    Err(format!("Task '{task_id}' not found."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::ToolCall;
    use serde_json::json;

    #[test]
    fn test_agent_task_creation_and_plan() {
        let task = create_agent_task("Fix bug in user authentication", Some(5));
        assert_eq!(task.status, AgentTaskStatus::Planning);
        assert_eq!(task.max_steps, 5);
        assert!(!task.plan.is_empty());
        assert_eq!(task.steps.len(), 0);
    }

    #[test]
    fn test_agent_step_execution_and_tool_call() {
        let project_state = ProjectState::default();
        let task = create_agent_task("List files", Some(5));

        let call = ToolCall {
            name: "workspace_tree".to_string(),
            arguments: json!({}),
        };

        let updated = step_agent_task(
            &task.id,
            &project_state,
            Some("Need to scan files".to_string()),
            Some(call),
            false,
        )
        .unwrap();

        assert_eq!(updated.steps.len(), 1);
        assert_eq!(updated.steps[0].thought, "Need to scan files");
        assert!(updated.steps[0].tool_result.is_some());
    }

    #[test]
    fn test_agent_loop_detection_terminates_gracefully() {
        let project_state = ProjectState::default();
        let task = create_agent_task("Repeated action test", Some(10));

        let call = ToolCall {
            name: "workspace_search".to_string(),
            arguments: json!({ "query": "never_found" }),
        };

        // Step 1
        let _ = step_agent_task(&task.id, &project_state, None, Some(call.clone()), false).unwrap();
        // Step 2
        let _ = step_agent_task(&task.id, &project_state, None, Some(call.clone()), false).unwrap();
        // Step 3 with identical call -> must trigger loop detection
        let loop_result = step_agent_task(&task.id, &project_state, None, Some(call.clone()), false).unwrap();

        assert_eq!(loop_result.status, AgentTaskStatus::Failed);
        assert!(loop_result.summary.unwrap().contains("Loop detected"));
    }

    #[test]
    fn test_agent_enforces_max_steps_boundary() {
        let project_state = ProjectState::default();
        let task = create_agent_task("Max steps boundary test", Some(3));

        for i in 1..=3 {
            let call = ToolCall {
                name: "workspace_search".to_string(),
                arguments: json!({ "query": format!("unique_query_{i}") }),
            };
            let _ = step_agent_task(&task.id, &project_state, None, Some(call), false).unwrap();
        }

        // 4th step exceeds max_steps (3)
        let call = ToolCall {
            name: "workspace_search".to_string(),
            arguments: json!({ "query": "exceed_query" }),
        };
        let exceeded = step_agent_task(&task.id, &project_state, None, Some(call), false).unwrap();

        assert_eq!(exceeded.status, AgentTaskStatus::Failed);
        assert!(exceeded.summary.unwrap().contains("maximum allowed step bound"));
    }

    #[test]
    fn test_agent_cancellation_aborts_immediately() {
        let project_state = ProjectState::default();
        let task = create_agent_task("Cancellation test", Some(5));

        assert!(abort_agent_task(&task.id));

        let call = ToolCall {
            name: "workspace_tree".to_string(),
            arguments: json!({}),
        };

        let result = step_agent_task(&task.id, &project_state, None, Some(call), false).unwrap();
        assert_eq!(result.status, AgentTaskStatus::Aborted);
    }

    #[test]
    fn test_agent_requires_approval_for_write_actions() {
        let project_state = ProjectState::default();
        let task = create_agent_task("Write action approval test", Some(5));

        let call = ToolCall {
            name: "workspace_apply_diff".to_string(),
            arguments: json!({ "proposalId": "prop-456" }),
        };

        let updated = step_agent_task(&task.id, &project_state, None, Some(call), false).unwrap();
        assert_eq!(updated.status, AgentTaskStatus::AwaitingApproval);
        assert!(updated.pending_approval.is_some());
    }
}
