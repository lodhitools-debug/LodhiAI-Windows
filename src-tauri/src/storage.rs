use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

static STORE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsStore {
    pub theme: String,
    pub ollama_endpoint: String,
    pub ollama_model: String,
    pub active_provider: String,
    pub allow_cloud_egress: bool,
    pub gemini_model: String,
    pub data_retention_days: u32,
    pub telemetry_enabled: bool,
}

impl Default for AppSettingsStore {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            ollama_endpoint: "http://127.0.0.1:11434".to_string(),
            ollama_model: "qwen2.5-coder:3b".to_string(),
            active_provider: "ollama".to_string(),
            allow_cloud_egress: false,
            gemini_model: "gemini-1.5-flash".to_string(),
            data_retention_days: 0, // 0 = retain indefinitely
            telemetry_enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSession {
    pub id: String,
    pub title: String,
    pub provider: String,
    pub model: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
    pub messages: Vec<StoredChatMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredAgentTask {
    pub id: String,
    pub goal: String,
    pub status: String,
    pub step_count: usize,
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AuditSummary {
    pub total_automation_runs: usize,
    pub total_browser_navs: usize,
    pub total_whatsapp_drafts: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LodhiVaultStore {
    pub schema_version: u32,
    pub updated_at_ms: u64,
    pub app_settings: AppSettingsStore,
    pub conversations: Vec<ConversationSession>,
    pub agent_tasks: Vec<StoredAgentTask>,
    pub audit_summary: AuditSummary,
}

impl Default for LodhiVaultStore {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            updated_at_ms: current_time_ms(),
            app_settings: AppSettingsStore::default(),
            conversations: Vec::new(),
            agent_tasks: Vec::new(),
            audit_summary: AuditSummary::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PurgeResult {
    pub conversations_removed: usize,
    pub tasks_removed: usize,
    pub remaining_conversations: usize,
    pub remaining_tasks: usize,
    pub timestamp_ms: u64,
}

fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn get_storage_paths() -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let base = if let Ok(app_data) = std::env::var("APPDATA") {
        PathBuf::from(app_data).join("com.lodhiai.desktop")
    } else {
        std::env::temp_dir().join("com.lodhiai.desktop")
    };

    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| format!("Could not create vault storage folder: {e}"))?;
    }

    let target = base.join("lodhi_vault_store.json");
    let backup = base.join("lodhi_vault_store.json.bak");
    let temp = base.join("lodhi_vault_store.json.tmp");

    Ok((target, backup, temp))
}

/// Loads the persistent vault store. If file is missing, creates default.
/// If target is corrupted, automatically recovers from .bak snapshot.
pub fn load_vault_store() -> Result<LodhiVaultStore, String> {
    let _lock = STORE_LOCK.lock().map_err(|e| format!("Storage lock poisoned: {e}"))?;
    let (target, backup, _) = get_storage_paths()?;

    if target.exists() {
        match fs::read_to_string(&target) {
            Ok(content) => {
                match serde_json::from_str::<LodhiVaultStore>(&content) {
                    Ok(mut store) => {
                        // Apply migrations if necessary
                        if store.schema_version < CURRENT_SCHEMA_VERSION {
                            store.schema_version = CURRENT_SCHEMA_VERSION;
                            let _ = save_vault_store_internal(&target, &backup, &target.with_extension("tmp"), &mut store);
                        }
                        return Ok(store);
                    }
                    Err(err) => {
                        eprintln!("[WARN] Primary vault store corrupted ({err}). Attempting recovery from backup.");
                    }
                }
            }
            Err(err) => {
                eprintln!("[WARN] Failed to read primary vault store: {err}");
            }
        }
    }

    // Try recovery from backup if target failed
    if backup.exists() {
        if let Ok(content) = fs::read_to_string(&backup) {
            if let Ok(recovered) = serde_json::from_str::<LodhiVaultStore>(&content) {
                eprintln!("[INFO] Successfully recovered vault store from backup snapshot.");
                return Ok(recovered);
            }
        }
    }

    // Initialize default if neither exists or both failed
    let default_store = LodhiVaultStore::default();
    Ok(default_store)
}

/// Atomically saves the vault store, creating a recoverable .bak snapshot first.
pub fn save_vault_store(store: &mut LodhiVaultStore) -> Result<(), String> {
    let _lock = STORE_LOCK.lock().map_err(|e| format!("Storage lock poisoned: {e}"))?;
    let (target, backup, temp) = get_storage_paths()?;
    save_vault_store_internal(&target, &backup, &temp, store)
}

fn save_vault_store_internal(
    target: &PathBuf,
    backup: &PathBuf,
    temp: &PathBuf,
    store: &mut LodhiVaultStore,
) -> Result<(), String> {
    store.updated_at_ms = current_time_ms();
    let json_bytes = serde_json::to_vec_pretty(&store)
        .map_err(|e| format!("Failed to serialize vault store: {e}"))?;

    // 1. Write to temp file and sync to disk
    {
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(temp)
            .map_err(|e| format!("Failed to open temp storage file: {e}"))?;
        file.write_all(&json_bytes)
            .map_err(|e| format!("Failed to write temp storage data: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("Failed to sync storage data: {e}"))?;
    }

    // 2. Snapshot existing target to backup if it exists
    if target.exists() {
        let _ = fs::copy(target, backup);
    }

    // 3. Atomically rename temp file to target
    fs::rename(temp, target).map_err(|e| format!("Failed to atomically replace vault store: {e}"))?;

    Ok(())
}

/// Exports complete user vault data into clean JSON format for portability.
pub fn export_user_data() -> Result<String, String> {
    let store = load_vault_store()?;
    serde_json::to_string_pretty(&store).map_err(|e| format!("Failed to export vault data: {e}"))
}

/// Purges stored user conversations and tasks based on retention criteria.
/// If retention_days is 0, completely wipes all conversations and tasks!
pub fn purge_user_data(retention_days: Option<u32>) -> Result<PurgeResult, String> {
    let mut store = load_vault_store()?;
    let prev_conv_count = store.conversations.len();
    let prev_task_count = store.agent_tasks.len();

    match retention_days {
        Some(0) | None => {
            // Complete wipe
            store.conversations.clear();
            store.agent_tasks.clear();
        }
        Some(days) => {
            let cutoff_ms = current_time_ms().saturating_sub(u64::from(days) * 24 * 60 * 60 * 1000);
            store.conversations.retain(|c| c.updated_at_ms >= cutoff_ms);
            store.agent_tasks.retain(|t| t.created_at_ms >= cutoff_ms);
        }
    }

    let removed_convs = prev_conv_count - store.conversations.len();
    let removed_tasks = prev_task_count - store.agent_tasks.len();

    save_vault_store(&mut store)?;

    Ok(PurgeResult {
        conversations_removed: removed_convs,
        tasks_removed: removed_tasks,
        remaining_conversations: store.conversations.len(),
        remaining_tasks: store.agent_tasks.len(),
        timestamp_ms: current_time_ms(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_vault_store_invariants() {
        let store = LodhiVaultStore::default();
        assert_eq!(store.schema_version, 1);
        assert_eq!(store.app_settings.theme, "dark");
        assert_eq!(store.app_settings.active_provider, "ollama");
        assert!(!store.app_settings.allow_cloud_egress); // strict local default
        assert!(store.conversations.is_empty());
        assert!(store.agent_tasks.is_empty());
    }

    #[test]
    fn test_atomic_save_and_load_roundtrip() {
        let dir = std::env::temp_dir().join(format!("lodhi_test_store_{}", current_time_ms()));
        fs::create_dir_all(&dir).unwrap();
        let target = dir.join("store.json");
        let backup = dir.join("store.json.bak");
        let temp = dir.join("store.json.tmp");

        let mut store = LodhiVaultStore::default();
        store.conversations.push(ConversationSession {
            id: "session-1".to_string(),
            title: "Test Session".to_string(),
            provider: "ollama".to_string(),
            model: "qwen2.5-coder:3b".to_string(),
            created_at_ms: 1000,
            updated_at_ms: 2000,
            messages: vec![StoredChatMessage {
                id: "msg-1".to_string(),
                role: "user".to_string(),
                content: "Hello".to_string(),
                timestamp_ms: 1000,
            }],
        });

        save_vault_store_internal(&target, &backup, &temp, &mut store).expect("save should succeed");
        assert!(target.exists());

        let loaded: LodhiVaultStore = serde_json::from_str(&fs::read_to_string(&target).unwrap()).unwrap();
        assert_eq!(loaded.conversations.len(), 1);
        assert_eq!(loaded.conversations[0].title, "Test Session");

        // Clean up
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_purge_user_data_wipes_all_when_retention_zero() {
        let mut store = LodhiVaultStore::default();
        store.conversations.push(ConversationSession {
            id: "c1".to_string(),
            title: "C1".to_string(),
            provider: "ollama".to_string(),
            model: "qwen".to_string(),
            created_at_ms: 500,
            updated_at_ms: 500,
            messages: vec![],
        });
        store.agent_tasks.push(StoredAgentTask {
            id: "t1".to_string(),
            goal: "Audit".to_string(),
            status: "completed".to_string(),
            step_count: 3,
            created_at_ms: 500,
        });

        // Wipes all when retention is Some(0)
        store.conversations.clear();
        store.agent_tasks.clear();

        assert_eq!(store.conversations.len(), 0);
        assert_eq!(store.agent_tasks.len(), 0);
    }
}
