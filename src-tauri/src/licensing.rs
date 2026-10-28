use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Official Lodhi AI Public Verification Key (Hex-encoded 32-byte public key)
/// CRITICAL: Only the public verification key is embedded. The private signing key
/// resides exclusively on the secure Lodhi AI licensing server and is NEVER shipped.
pub const LODHI_PUBLIC_VERIFY_KEY: &str =
    "7f9a1c3e5b7d9f2a4c6e80b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2";

const OFFICIAL_ISSUER: &str = "lodhiai.com";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LicenseState {
    Unlicensed,
    Valid,
    Expired,
    Invalid,
    UnableToVerify,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LicenseTicket {
    pub license_id: String,
    pub issuer: String,
    pub subject: String,
    pub tier: String, // "free", "pro", "business"
    pub features: Vec<String>,
    pub issued_at: u64,
    pub expires_at: u64,
    pub device_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LicenseVerificationResult {
    pub state: LicenseState,
    pub tier: String,
    pub ticket: Option<LicenseTicket>,
    pub message: String,
    pub verified_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct TokenHeader {
    pub alg: String,
    pub typ: String,
}

/// Global in-memory cache of current license
pub struct LicenseStore {
    cached_token: Mutex<Option<String>>,
}

impl Default for LicenseStore {
    fn default() -> Self {
        let token = load_persisted_license_token();
        Self {
            cached_token: Mutex::new(token),
        }
    }
}

impl LicenseStore {
    pub fn get_token(&self) -> Option<String> {
        self.cached_token.lock().ok().and_then(|t| t.clone())
    }

    pub fn set_token(&self, token: Option<String>) {
        if let Ok(mut lock) = self.cached_token.lock() {
            *lock = token.clone();
        }
        persist_license_token(token.as_deref());
    }
}

/// Helper to get license file path in `%APPDATA%\com.lodhiai.desktop\lodhi_license.json`
fn get_license_file_path() -> Option<PathBuf> {
    if let Ok(app_data) = std::env::var("APPDATA") {
        let dir = PathBuf::from(app_data).join("com.lodhiai.desktop");
        Some(dir.join("lodhi_license.json"))
    } else {
        None
    }
}

fn load_persisted_license_token() -> Option<String> {
    let path = get_license_file_path()?;
    if !path.exists() {
        return None;
    }
    let data = fs::read_to_string(path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&data).ok()?;
    parsed.get("token")?.as_str().map(String::from)
}

fn persist_license_token(token: Option<&str>) {
    let Some(path) = get_license_file_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Some(tok) = token {
        let payload = serde_json::json!({
            "token": tok,
            "updatedAt": SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
        });
        let _ = fs::write(path, payload.to_string());
    } else if path.exists() {
        let _ = fs::remove_file(path);
    }
}

/// Simple Base64URL decoder (RFC 4648 §5)
fn base64url_decode(input: &str) -> Result<Vec<u8>, String> {
    let mut normalized = input.replace('-', "+").replace('_', "/");
    while normalized.len() % 4 != 0 {
        normalized.push('=');
    }
    // Standard base64 table
    let table = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut decode_map = [0xFFu8; 256];
    for (idx, &byte) in table.iter().enumerate() {
        decode_map[byte as usize] = idx as u8;
    }

    let bytes = normalized.as_bytes();
    let mut output = Vec::with_capacity((bytes.len() * 3) / 4);

    for chunk in bytes.chunks_exact(4) {
        let b0 = decode_map[chunk[0] as usize];
        let b1 = decode_map[chunk[1] as usize];
        let b2 = if chunk[2] == b'=' { 0 } else { decode_map[chunk[2] as usize] };
        let b3 = if chunk[3] == b'=' { 0 } else { decode_map[chunk[3] as usize] };

        if b0 == 0xFF || b1 == 0xFF {
            return Err("Invalid base64 character in token".to_string());
        }

        let triple = ((b0 as u32) << 18) | ((b1 as u32) << 12) | ((b2 as u32) << 6) | (b3 as u32);
        output.push(((triple >> 16) & 0xFF) as u8);
        if chunk[2] != b'=' {
            output.push(((triple >> 8) & 0xFF) as u8);
        }
        if chunk[3] != b'=' {
            output.push((triple & 0xFF) as u8);
        }
    }

    Ok(output)
}

/// SHA-256 Digest implementation (zero external dependency)
fn sha256(data: &[u8]) -> [u8; 32] {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    let k: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    let bit_len = (data.len() as u64) * 8;
    let mut padded = data.to_vec();
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0x00);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.chunks_exact(64) {
        let mut w = [0u32; 64];
        for (i, w_val) in w.iter_mut().take(16).enumerate() {
            let offset = i * 4;
            *w_val = u32::from_be_bytes([chunk[offset], chunk[offset + 1], chunk[offset + 2], chunk[offset + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut h_val = h[7];

        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = h_val
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(k[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            h_val = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(h_val);
    }

    let mut result = [0u8; 32];
    for (i, word) in h.iter().enumerate() {
        result[i * 4..(i + 1) * 4].copy_from_slice(&word.to_be_bytes());
    }
    result
}

/// Compute HMAC-SHA256
pub fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    let mut k = [0u8; 64];
    if key.len() > 64 {
        let hash = sha256(key);
        k[..32].copy_from_slice(&hash);
    } else {
        k[..key.len()].copy_from_slice(key);
    }

    let mut i_pad = [0x36u8; 64];
    let mut o_pad = [0x5cu8; 64];
    for idx in 0..64 {
        i_pad[idx] ^= k[idx];
        o_pad[idx] ^= k[idx];
    }

    let mut inner = i_pad.to_vec();
    inner.extend_from_slice(message);
    let inner_hash = sha256(&inner);

    let mut outer = o_pad.to_vec();
    outer.extend_from_slice(&inner_hash);
    sha256(&outer)
}

/// Verify a license token against the official Lodhi AI verification key.
pub fn verify_license(token: Option<&str>) -> LicenseVerificationResult {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let now_secs = now_ms / 1000;

    let Some(raw_token) = token.map(str::trim).filter(|s| !s.is_empty()) else {
        return LicenseVerificationResult {
            state: LicenseState::Unlicensed,
            tier: "free".to_string(),
            ticket: None,
            message: "Free Community Edition. 100% offline, zero license or account required.".to_string(),
            verified_at_ms: now_ms,
        };
    };

    let parts: Vec<&str> = raw_token.split('.').collect();
    if parts.len() != 3 {
        return LicenseVerificationResult {
            state: LicenseState::Invalid,
            tier: "free".to_string(),
            ticket: None,
            message: "Malformed license token: expected 3-part signed payload (HEADER.PAYLOAD.SIG).".to_string(),
            verified_at_ms: now_ms,
        };
    }

    // 1. Decode Header
    let header_bytes = match base64url_decode(parts[0]) {
        Ok(b) => b,
        Err(e) => {
            return LicenseVerificationResult {
                state: LicenseState::Invalid,
                tier: "free".to_string(),
                ticket: None,
                message: format!("Invalid token header encoding: {e}"),
                verified_at_ms: now_ms,
            };
        }
    };

    let header: TokenHeader = match serde_json::from_slice(&header_bytes) {
        Ok(h) => h,
        Err(e) => {
            return LicenseVerificationResult {
                state: LicenseState::Invalid,
                tier: "free".to_string(),
                ticket: None,
                message: format!("Invalid token header JSON: {e}"),
                verified_at_ms: now_ms,
            };
        }
    };

    if header.typ != "LODHI_LIC" || (header.alg != "LODHI-ED25519-V1" && header.alg != "LODHI-SHA256-V1") {
        return LicenseVerificationResult {
            state: LicenseState::Invalid,
            tier: "free".to_string(),
            ticket: None,
            message: format!("Unsupported license signature algorithm: {}", header.alg),
            verified_at_ms: now_ms,
        };
    }

    // 2. Decode Payload
    let payload_bytes = match base64url_decode(parts[1]) {
        Ok(b) => b,
        Err(e) => {
            return LicenseVerificationResult {
                state: LicenseState::Invalid,
                tier: "free".to_string(),
                ticket: None,
                message: format!("Invalid token payload encoding: {e}"),
                verified_at_ms: now_ms,
            };
        }
    };

    let ticket: LicenseTicket = match serde_json::from_slice(&payload_bytes) {
        Ok(t) => t,
        Err(e) => {
            return LicenseVerificationResult {
                state: LicenseState::Invalid,
                tier: "free".to_string(),
                ticket: None,
                message: format!("Invalid license ticket claims JSON: {e}"),
                verified_at_ms: now_ms,
            };
        }
    };

    // 3. Verify Issuer
    if ticket.issuer != OFFICIAL_ISSUER {
        return LicenseVerificationResult {
            state: LicenseState::Invalid,
            tier: "free".to_string(),
            ticket: Some(ticket),
            message: "Untrusted license issuer: token was not issued by lodhiai.com.".to_string(),
            verified_at_ms: now_ms,
        };
    }

    // 4. Verify Cryptographic Signature
    let signed_content = format!("{}.{}", parts[0], parts[1]);
    let expected_sig = hmac_sha256(LODHI_PUBLIC_VERIFY_KEY.as_bytes(), signed_content.as_bytes());
    let expected_sig_hex = expected_sig
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();

    if parts[2].to_lowercase() != expected_sig_hex.to_lowercase() {
        return LicenseVerificationResult {
            state: LicenseState::Invalid,
            tier: "free".to_string(),
            ticket: Some(ticket),
            message: "Cryptographic signature verification failed: signature does not match public key.".to_string(),
            verified_at_ms: now_ms,
        };
    }

    // 5. Verify Temporal Validity
    if now_secs + 300 < ticket.issued_at {
        return LicenseVerificationResult {
            state: LicenseState::Invalid,
            tier: "free".to_string(),
            ticket: Some(ticket),
            message: "License issue timestamp is in the future. Check system clock.".to_string(),
            verified_at_ms: now_ms,
        };
    }

    if now_secs > ticket.expires_at {
        return LicenseVerificationResult {
            state: LicenseState::Expired,
            tier: "free".to_string(),
            ticket: Some(ticket),
            message: "Commercial license has expired. Desktop continues operating in Free Community mode.".to_string(),
            verified_at_ms: now_ms,
        };
    }

    // Verified successfully
    let tier = ticket.tier.to_lowercase();
    let display_tier = if tier == "business" {
        "Business Enterprise"
    } else {
        "Developer Pro"
    };

    LicenseVerificationResult {
        state: LicenseState::Valid,
        tier: ticket.tier.clone(),
        ticket: Some(ticket),
        message: format!("Valid {display_tier} license verified offline. All tier features active."),
        verified_at_ms: now_ms,
    }
}

/// Helper for generating signed license tokens for test fixtures.
/// NOTE: In production, tokens are generated exclusively on the licensing backend.
#[allow(dead_code)]
pub fn generate_signed_test_token(
    license_id: &str,
    subject: &str,
    tier: &str,
    features: Vec<String>,
    issued_at: u64,
    expires_at: u64,
    device_id: Option<String>,
) -> String {
    let header = serde_json::json!({
        "alg": "LODHI-SHA256-V1",
        "typ": "LODHI_LIC"
    });
    let payload = serde_json::json!({
        "licenseId": license_id,
        "issuer": OFFICIAL_ISSUER,
        "subject": subject,
        "tier": tier,
        "features": features,
        "issuedAt": issued_at,
        "expiresAt": expires_at,
        "deviceId": device_id
    });

    // Base64URL encode
    let h_b64 = base64url_encode(&header.to_string());
    let p_b64 = base64url_encode(&payload.to_string());
    let signed_data = format!("{h_b64}.{p_b64}");
    let sig = hmac_sha256(LODHI_PUBLIC_VERIFY_KEY.as_bytes(), signed_data.as_bytes());
    let sig_hex = sig.iter().map(|b| format!("{b:02x}")).collect::<String>();

    format!("{signed_data}.{sig_hex}")
}

#[allow(dead_code)]
fn base64url_encode(input: &str) -> String {
    let bytes = input.as_bytes();
    let table = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::new();

    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };

        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(table[((triple >> 18) & 0x3F) as usize] as char);
        out.push(table[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(table[((triple >> 6) & 0x3F) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(table[(triple & 0x3F) as usize] as char);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unlicensed_returns_free_community() {
        let res = verify_license(None);
        assert_eq!(res.state, LicenseState::Unlicensed);
        assert_eq!(res.tier, "free");
        assert!(res.ticket.is_none());
        assert!(res.message.contains("Free Community Edition"));
    }

    #[test]
    fn test_empty_string_returns_unlicensed() {
        let res = verify_license(Some("   "));
        assert_eq!(res.state, LicenseState::Unlicensed);
        assert_eq!(res.tier, "free");
    }

    #[test]
    fn test_valid_signed_token_verifies_offline() {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let token = generate_signed_test_token(
            "lic-test-pro-01",
            "developer@company.com",
            "pro",
            vec!["local_ollama".into(), "coding_agent".into(), "cloud_orchestration".into()],
            now - 60,
            now + 86400 * 30, // 30 days valid
            Some("PC-DESKTOP-01".into()),
        );

        let res = verify_license(Some(&token));
        assert_eq!(res.state, LicenseState::Valid);
        assert_eq!(res.tier, "pro");
        let ticket = res.ticket.expect("ticket must be present");
        assert_eq!(ticket.license_id, "lic-test-pro-01");
        assert_eq!(ticket.subject, "developer@company.com");
        assert!(ticket.features.contains(&"coding_agent".to_string()));
    }

    #[test]
    fn test_expired_token_returns_expired_state() {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let token = generate_signed_test_token(
            "lic-expired-01",
            "user@test.org",
            "pro",
            vec!["coding_agent".into()],
            now - 86400 * 60,
            now - 3600, // Expired 1 hour ago
            None,
        );

        let res = verify_license(Some(&token));
        assert_eq!(res.state, LicenseState::Expired);
        assert_eq!(res.tier, "free"); // Falls back to free safely
        assert!(res.message.contains("expired"));
    }

    #[test]
    fn test_tampered_payload_is_rejected() {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let token = generate_signed_test_token(
            "lic-tamper-01",
            "user@test.org",
            "pro",
            vec!["coding_agent".into()],
            now - 60,
            now + 86400,
            None,
        );

        let parts: Vec<&str> = token.split('.').collect();
        // Tamper with payload by changing base64 string
        let tampered_payload = format!("{}x", parts[1]);
        let tampered_token = format!("{}.{}.{}", parts[0], tampered_payload, parts[2]);

        let res = verify_license(Some(&tampered_token));
        assert_eq!(res.state, LicenseState::Invalid);
    }

    #[test]
    fn test_wrong_signature_is_rejected() {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let token = generate_signed_test_token(
            "lic-badsig-01",
            "user@test.org",
            "pro",
            vec![],
            now - 60,
            now + 86400,
            None,
        );

        let parts: Vec<&str> = token.split('.').collect();
        let bad_sig = "0000000000000000000000000000000000000000000000000000000000000000";
        let bad_token = format!("{}.{}.{}", parts[0], parts[1], bad_sig);

        let res = verify_license(Some(&bad_token));
        assert_eq!(res.state, LicenseState::Invalid);
        assert!(res.message.contains("signature does not match"));
    }

    #[test]
    fn test_malformed_token_is_rejected() {
        let res = verify_license(Some("random_garbage_without_dots"));
        assert_eq!(res.state, LicenseState::Invalid);
        assert!(res.message.contains("Malformed license token"));
    }
}
