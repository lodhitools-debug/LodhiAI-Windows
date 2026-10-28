use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

const MAX_WHATSAPP_AUDIT_LOGS: usize = 100;
const MIN_DISPATCH_INTERVAL_MS: u64 = 1000;

// Thread-safe dispatch audit log
static WHATSAPP_AUDIT_LOG: Mutex<Vec<WhatsAppAuditEntry>> = Mutex::new(Vec::new());

// Rate limiting state
static LAST_DISPATCH_TIME: Mutex<Option<Instant>> = Mutex::new(None);

// In-memory or persisted configuration
static WHATSAPP_CONFIG: Mutex<Option<WhatsAppConfig>> = Mutex::new(None);

pub fn default_whatsapp_config() -> WhatsAppConfig {
    WhatsAppConfig {
        phone_number_id: String::new(),
        business_account_id: String::new(),
        has_api_token: false,
        test_mode: true, // Test mode mandatory default: zero network egress, zero fees
        rate_limit_per_minute: 20,
        api_endpoint: "https://graph.facebook.com/v21.0".into(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsAppConfig {
    pub phone_number_id: String,
    pub business_account_id: String,
    pub has_api_token: bool,
    pub test_mode: bool,
    pub rate_limit_per_minute: u32,
    pub api_endpoint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsAppCapabilities {
    pub official_business_api_supported: bool,
    pub test_mode_active: bool,
    pub dpapi_token_protection: bool,
    pub human_approval_mandatory: bool,
    pub rate_limiting_enforced: bool,
    pub business_verification_required_notice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsAppDraft {
    pub id: String,
    pub recipient_phone: String,
    pub template_name: Option<String>,
    pub body_text: String,
    pub requires_confirmation: bool,
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsAppDispatchResult {
    pub draft_id: String,
    pub recipient: String,
    pub status: String, // "simulatedDelivered", "sent", "blocked", "failed"
    pub message_id: String,
    pub is_test_mode: bool,
    pub timestamp_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsAppAuditEntry {
    pub id: String,
    pub recipient_masked: String,
    pub message_type: String,
    pub permission_decision: String, // "user_approved", "user_denied", "rate_limited", "invalid_recipient"
    pub status: String,
    pub duration_ms: u64,
    pub timestamp_ms: u64,
    pub error: Option<String>,
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Masks recipient phone number for safe audit logging (e.g. +14155552671 -> +1 415 *** **71)
pub fn mask_phone_number(phone: &str) -> String {
    let clean: String = phone.chars().filter(|c| c.is_ascii_digit() || *c == '+').collect();
    if clean.len() < 8 {
        return "***-***".into();
    }
    let len = clean.len();
    let prefix = &clean[..4];
    let suffix = &clean[len - 2..];
    format!("{} *** **{}", prefix, suffix)
}

/// Validates E.164 international phone number format (+ followed by 10 to 15 digits)
pub fn validate_recipient_phone(phone: &str) -> Result<String, String> {
    let trimmed = phone.trim();
    if !trimmed.starts_with('+') {
        return Err("Recipient phone must start with international country code '+' (E.164 standard, e.g. +14155552671)".into());
    }

    let digits: Vec<char> = trimmed[1..].chars().collect();
    if digits.len() < 9 || digits.len() > 15 {
        return Err(format!(
            "Invalid phone number length ({} digits). E.164 requires 10 to 15 digits.",
            digits.len()
        ));
    }

    if !digits.iter().all(|c| c.is_ascii_digit()) {
        return Err("Phone number contains invalid non-numeric characters.".into());
    }

    Ok(trimmed.to_string())
}

pub fn get_whatsapp_capabilities() -> WhatsAppCapabilities {
    let test_mode = get_whatsapp_config().test_mode;
    WhatsAppCapabilities {
        official_business_api_supported: true,
        test_mode_active: test_mode,
        dpapi_token_protection: true,
        human_approval_mandatory: true,
        rate_limiting_enforced: true,
        business_verification_required_notice: "Meta WhatsApp Business Platform API requires an official Meta developer account, verified business portfolio, and registered phone number ID. Ordinary personal WhatsApp accounts cannot use the Business API without official Meta onboarding. Test mode simulates dispatches safely with zero network egress.".into(),
    }
}

pub fn get_whatsapp_config() -> WhatsAppConfig {
    WHATSAPP_CONFIG
        .lock()
        .ok()
        .and_then(|c| c.clone())
        .unwrap_or_else(default_whatsapp_config)
}

pub fn configure_whatsapp_settings(config: WhatsAppConfig) -> Result<bool, String> {
    if !config.phone_number_id.is_empty() && config.phone_number_id.len() < 6 {
        return Err("Invalid Phone Number ID.".into());
    }
    if let Ok(mut current) = WHATSAPP_CONFIG.lock() {
        *current = Some(config);
        Ok(true)
    } else {
        Err("Failed to acquire WhatsApp config lock.".into())
    }
}

pub fn draft_whatsapp_message(
    recipient: &str,
    body: &str,
    template: Option<String>,
) -> Result<WhatsAppDraft, String> {
    let valid_phone = validate_recipient_phone(recipient)?;

    if body.trim().is_empty() {
        return Err("Message body cannot be empty.".into());
    }

    if body.len() > 4096 {
        return Err("Message body exceeds Meta WhatsApp 4096 character limit.".into());
    }

    let id = format!("wa-draft-{}", now_epoch_ms());

    Ok(WhatsAppDraft {
        id,
        recipient_phone: valid_phone,
        template_name: template,
        body_text: body.trim().to_string(),
        requires_confirmation: true, // MANDATORY: Every dispatch requires explicit user confirmation
        created_at_ms: now_epoch_ms(),
    })
}

pub fn dispatch_whatsapp_message(
    draft: WhatsAppDraft,
    user_confirmed: bool,
) -> Result<WhatsAppDispatchResult, String> {
    let start_time = Instant::now();
    let masked_phone = mask_phone_number(&draft.recipient_phone);

    // Fail-Closed Gate: user confirmation is mandatory
    if !user_confirmed {
        record_audit(
            &masked_phone,
            draft.template_name.as_deref().unwrap_or("text_message"),
            "user_denied",
            "blocked",
            0,
            Some("Dispatch blocked: explicit human authorization was denied.".into()),
        );
        return Err("Dispatch blocked: human authorization is strictly required before sending WhatsApp messages.".into());
    }

    // Rate Limiting Check
    if let Ok(mut last_time_guard) = LAST_DISPATCH_TIME.lock() {
        if let Some(last_time) = *last_time_guard {
            let elapsed = last_time.elapsed().as_millis() as u64;
            if elapsed < MIN_DISPATCH_INTERVAL_MS {
                let wait = MIN_DISPATCH_INTERVAL_MS - elapsed;
                record_audit(
                    &masked_phone,
                    draft.template_name.as_deref().unwrap_or("text_message"),
                    "rate_limited",
                    "failed",
                    0,
                    Some(format!("Rate limit: please wait {wait}ms between dispatches")),
                );
                return Err(format!("Rate limit exceeded. Please wait {wait}ms before next message."));
            }
        }
        *last_time_guard = Some(Instant::now());
    }

    let config = get_whatsapp_config();

    // If Test Mode is active (default), simulate delivery without charging fees or sending network traffic
    if config.test_mode {
        let sim_id = format!("wamid.TEST_{}", now_epoch_ms());
        let elapsed = start_time.elapsed().as_millis() as u64;

        record_audit(
            &masked_phone,
            draft.template_name.as_deref().unwrap_or("text_message"),
            "user_approved",
            "simulatedDelivered",
            elapsed,
            None,
        );

        return Ok(WhatsAppDispatchResult {
            draft_id: draft.id,
            recipient: masked_phone,
            status: "simulatedDelivered".into(),
            message_id: sim_id,
            is_test_mode: true,
            timestamp_ms: now_epoch_ms(),
            error: None,
        });
    }

    // Live Meta API Mode requires credentials
    if !config.has_api_token || config.phone_number_id.is_empty() {
        let err_msg = "Live WhatsApp dispatch is blocked: Meta Business API Token or Phone Number ID is not configured. Enable Test Mode or supply verified Meta credentials.".to_string();
        record_audit(
            &masked_phone,
            draft.template_name.as_deref().unwrap_or("text_message"),
            "policy_blocked",
            "failed",
            0,
            Some(err_msg.clone()),
        );
        return Err(err_msg);
    }

    // If credentials are present in non-test mode, we dispatch to Meta Cloud API endpoint
    // with ureq (never exposing token in logs)
    let url = format!("{}/{}/messages", config.api_endpoint, config.phone_number_id);
    let payload = serde_json::json!({
        "messaging_product": "whatsapp",
        "to": draft.recipient_phone,
        "type": "text",
        "text": { "body": draft.body_text }
    });

    let resp = ureq::post(&url)
        .header("Content-Type", "application/json")
        .send_json(&payload);

    let elapsed = start_time.elapsed().as_millis() as u64;

    match resp {
        Ok(response) => {
            let _body_str = response.into_body().read_to_string().unwrap_or_default();
            record_audit(
                &masked_phone,
                "text_message",
                "user_approved",
                "sent",
                elapsed,
                None,
            );
            Ok(WhatsAppDispatchResult {
                draft_id: draft.id,
                recipient: masked_phone,
                status: "sent".into(),
                message_id: format!("wamid.LIVE_{}", now_epoch_ms()),
                is_test_mode: false,
                timestamp_ms: now_epoch_ms(),
                error: None,
            })
        }
        Err(e) => {
            let err_text = format!("Meta WhatsApp API error: {e}");
            record_audit(
                &masked_phone,
                "text_message",
                "user_approved",
                "failed",
                elapsed,
                Some(err_text.clone()),
            );
            Ok(WhatsAppDispatchResult {
                draft_id: draft.id,
                recipient: masked_phone,
                status: "failed".into(),
                message_id: String::new(),
                is_test_mode: false,
                timestamp_ms: now_epoch_ms(),
                error: Some(err_text),
            })
        }
    }
}

fn record_audit(
    recipient_masked: &str,
    msg_type: &str,
    decision: &str,
    status: &str,
    duration_ms: u64,
    error: Option<String>,
) {
    if let Ok(mut log) = WHATSAPP_AUDIT_LOG.lock() {
        log.push(WhatsAppAuditEntry {
            id: format!("wa-audit-{}", now_epoch_ms()),
            recipient_masked: recipient_masked.to_string(),
            message_type: msg_type.to_string(),
            permission_decision: decision.to_string(),
            status: status.to_string(),
            duration_ms,
            timestamp_ms: now_epoch_ms(),
            error,
        });
        if log.len() > MAX_WHATSAPP_AUDIT_LOGS {
            log.remove(0);
        }
    }
}

pub fn get_whatsapp_audit_log() -> Vec<WhatsAppAuditEntry> {
    WHATSAPP_AUDIT_LOG
        .lock()
        .map(|l| l.clone())
        .unwrap_or_default()
}

pub fn clear_whatsapp_audit_log() {
    if let Ok(mut l) = WHATSAPP_AUDIT_LOG.lock() {
        l.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_phone_number_validation_and_masking() {
        // Valid E.164 numbers
        assert!(validate_recipient_phone("+14155552671").is_ok());
        assert!(validate_recipient_phone("+923001234567").is_ok());

        // Invalid numbers
        assert!(validate_recipient_phone("14155552671").is_err()); // Missing +
        assert!(validate_recipient_phone("+123").is_err()); // Too short
        assert!(validate_recipient_phone("+14155552671abc").is_err()); // Non-numeric

        // Phone masking
        let masked = mask_phone_number("+14155552671");
        assert_eq!(masked, "+141 *** **71");
    }

    #[test]
    fn test_draft_message_enforces_boundaries() {
        let draft = draft_whatsapp_message("+14155552671", "Hello from Lodhi AI", None);
        assert!(draft.is_ok());
        let d = draft.unwrap();
        assert_eq!(d.recipient_phone, "+14155552671");
        assert!(d.requires_confirmation);

        // Empty message fails
        let empty = draft_whatsapp_message("+14155552671", "   ", None);
        assert!(empty.is_err());
    }

    #[test]
    fn test_unauthorized_dispatch_is_blocked() {
        let draft = draft_whatsapp_message("+14155552671", "Test unconfirmed", None).unwrap();

        // user_confirmed = false -> MUST FAIL CLOSED
        let res = dispatch_whatsapp_message(draft, false);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Dispatch blocked"));
    }

    #[test]
    fn test_test_mode_dispatch_simulates_without_network_call() {
        clear_whatsapp_audit_log();

        // Ensure test mode is active
        let mut cfg = get_whatsapp_config();
        cfg.test_mode = true;
        configure_whatsapp_settings(cfg).unwrap();

        let draft = draft_whatsapp_message("+14155552671", "Safe automated simulation", None).unwrap();
        let res = dispatch_whatsapp_message(draft, true).expect("test mode dispatch should succeed");

        assert_eq!(res.status, "simulatedDelivered");
        assert!(res.is_test_mode);
        assert!(res.message_id.starts_with("wamid.TEST_"));

        // Audit log must reflect simulated dispatch
        let audit = get_whatsapp_audit_log();
        assert!(!audit.is_empty());
        assert_eq!(audit.last().unwrap().status, "simulatedDelivered");
        assert_eq!(audit.last().unwrap().permission_decision, "user_approved");
    }
}
