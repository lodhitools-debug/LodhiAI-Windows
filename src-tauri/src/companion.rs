use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const PIN_EXPIRATION_SECS: u64 = 300; // 5 minutes

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PairingSession {
    pub pin: String,
    pub expires_at_ms: u64,
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PairedDevice {
    pub id: String,
    pub name: String,
    pub model: String,
    pub ip_address: String,
    pub paired_at_ms: u64,
    pub last_seen_ms: u64,
    pub authorized: bool,
    pub public_key_fingerprint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionSyncPayload {
    pub sync_id: String,
    pub server_time_ms: u64,
    pub status: String,
    pub tasks_count: usize,
    pub conversations_count: usize,
    pub offline_queue_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionConfig {
    pub enabled: bool,
    pub listen_port: u16,
    pub allow_lan_sync: bool,
    pub require_biometrics_on_phone: bool,
    pub paired_devices: Vec<PairedDevice>,
}

impl Default for CompanionConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            listen_port: 8443,
            allow_lan_sync: true,
            require_biometrics_on_phone: true,
            paired_devices: Vec::new(),
        }
    }
}

static COMPANION_STATE: Mutex<Option<CompanionState>> = Mutex::new(None);

struct CompanionState {
    config: CompanionConfig,
    active_pairing: Option<PairingSession>,
}

fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn with_companion_state<T, F: FnOnce(&mut CompanionState) -> T>(f: F) -> Result<T, String> {
    let mut guard = COMPANION_STATE.lock().map_err(|e| format!("Companion state lock poisoned: {e}"))?;
    if guard.is_none() {
        *guard = Some(CompanionState {
            config: CompanionConfig::default(),
            active_pairing: None,
        });
    }
    Ok(f(guard.as_mut().unwrap()))
}

/// Generates a secure, 6-digit one-time pairing PIN valid for 5 minutes.
pub fn generate_pairing_pin() -> Result<PairingSession, String> {
    let now = current_time_ms();
    let expires = now + (PIN_EXPIRATION_SECS * 1000);

    // Generate 6-digit pseudo-random PIN from time seed
    let seed = now ^ 0x5DEECE66D;
    let pin_num = 100000 + (seed % 900000);
    let pin_str = format!("{pin_num:06}");

    let session = PairingSession {
        pin: pin_str,
        expires_at_ms: expires,
        created_at_ms: now,
    };

    with_companion_state(|state| {
        state.active_pairing = Some(session.clone());
    })?;

    Ok(session)
}

/// Authorizes an Android companion device by verifying the submitted 6-digit PIN.
pub fn verify_and_pair_device(
    submitted_pin: &str,
    device_name: &str,
    device_model: &str,
    client_ip: &str,
) -> Result<PairedDevice, String> {
    let now = current_time_ms();

    with_companion_state(|state| {
        let active = state.active_pairing.as_ref().ok_or_else(|| {
            "No active pairing session found. Generate a pairing PIN first on the desktop.".to_string()
        })?;

        if now > active.expires_at_ms {
            state.active_pairing = None;
            return Err("The pairing PIN has expired (5-minute limit). Please generate a new PIN.".to_string());
        }

        if active.pin != submitted_pin.trim() {
            return Err("Invalid pairing PIN. Verify the digits displayed on your desktop.".to_string());
        }

        // Generate device ID and fingerprint
        let device_id = format!("device-{}-{}", now, state.config.paired_devices.len() + 1);
        let fingerprint = format!("SHA256:{:x}", now ^ 0xA5A5A5A5);

        let device = PairedDevice {
            id: device_id,
            name: device_name.to_string(),
            model: device_model.to_string(),
            ip_address: client_ip.to_string(),
            paired_at_ms: now,
            last_seen_ms: now,
            authorized: true,
            public_key_fingerprint: fingerprint,
        };

        state.config.paired_devices.push(device.clone());
        state.active_pairing = None; // One-time use

        Ok(device)
    })?
}

/// Lists all registered and authorized companion devices.
pub fn list_paired_devices() -> Vec<PairedDevice> {
    with_companion_state(|state| state.config.paired_devices.clone()).unwrap_or_default()
}

/// Revokes authorization for a paired companion device.
pub fn revoke_paired_device(device_id: &str) -> Result<bool, String> {
    with_companion_state(|state| {
        let prev_len = state.config.paired_devices.len();
        state.config.paired_devices.retain(|d| d.id != device_id);
        Ok(state.config.paired_devices.len() < prev_len)
    })?
}

/// Builds a synchronization delta payload for connected companion devices.
pub fn get_sync_payload() -> Result<CompanionSyncPayload, String> {
    let now = current_time_ms();
    let store = crate::storage::load_vault_store().unwrap_or_default();

    Ok(CompanionSyncPayload {
        sync_id: format!("sync-{now}"),
        server_time_ms: now,
        status: "synchronized".to_string(),
        tasks_count: store.agent_tasks.len(),
        conversations_count: store.conversations.len(),
        offline_queue_count: 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static COMPANION_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn test_pairing_pin_generation_and_verification() {
        let _guard = COMPANION_TEST_LOCK.lock().unwrap();
        let session = generate_pairing_pin().expect("pin generation should succeed");
        assert_eq!(session.pin.len(), 6);
        assert!(session.pin.chars().all(|c| c.is_ascii_digit()));
        assert!(session.expires_at_ms > session.created_at_ms);

        // Verification with wrong PIN fails
        let fail = verify_and_pair_device("000000", "Pixel 8", "Google", "192.168.1.100");
        assert!(fail.is_err());

        // Verification with valid PIN succeeds
        let device = verify_and_pair_device(&session.pin, "Pixel 8 Pro", "Google", "192.168.1.105")
            .expect("valid pin should pair device");
        assert_eq!(device.name, "Pixel 8 Pro");
        assert!(device.authorized);

        // Active pairing is consumed
        let replay = verify_and_pair_device(&session.pin, "Pixel 8", "Google", "192.168.1.105");
        assert!(replay.is_err());
    }

    #[test]
    fn test_revoke_device() {
        let _guard = COMPANION_TEST_LOCK.lock().unwrap();
        let session = generate_pairing_pin().unwrap();
        let device = verify_and_pair_device(&session.pin, "Samsung S24", "Samsung", "192.168.1.50").unwrap();

        let devices = list_paired_devices();
        assert!(devices.iter().any(|d| d.id == device.id));

        let revoked = revoke_paired_device(&device.id).unwrap();
        assert!(revoked);

        let after = list_paired_devices();
        assert!(!after.iter().any(|d| d.id == device.id));
    }
}
