# Lodhi AI — Phase 15 Android Companion API Contract

**Document Version:** 1.0.0  
**Phase:** Phase 15 — Mobile REST & WebSocket Specifications  
**Project:** Lodhi AI Desktop for Windows  
**Audit Completion Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Authorized Project Directory:** `E:\LodhiAI-Windows`  
**Forbidden Legacy Project:** `E:\LodhiAI` (Strictly untouched & isolated)  

---

## 1. Local Network Transport Specification

- **Protocol:** HTTPS / TLS 1.3
- **Port:** `8443` (configurable via `CompanionConfig.listen_port`)
- **Headers Required:**
  - `Content-Type: application/json`
  - `X-Lodhi-Device-ID: <device-id>`
  - `X-Lodhi-Device-Sig: <hmac-or-ed25519-signature>`

---

## 2. Endpoints Specification

### 2.1 Device Pairing Handshake
- **Method:** `POST /api/companion/pair`
- **Request Body:**
  ```json
  {
    "pin": "492105",
    "deviceName": "Samsung Galaxy S24 Ultra",
    "deviceModel": "SM-S928B",
    "publicKey": "base64_ed25519_public_key_32bytes",
    "clientTimestamp": 1792945000000
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "deviceId": "device-1792945000-1",
    "deviceToken": "scoped_jwt_token_valid_for_30_days",
    "desktopName": "DESKTOP-UMAR-WIN11",
    "desktopVersion": "0.1.0"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error":"Invalid pairing PIN"}`
  - `410 Gone`: `{"error":"Pairing PIN expired (5-minute limit exceeded)"}`
  - `429 Too Many Requests`: `{"error":"Too many failed attempts. Try again in 5 minutes"}`

---

### 2.2 Companion Heartbeat & Sync Status
- **Method:** `GET /api/companion/sync`
- **Response (200 OK):**
  ```json
  {
    "syncId": "sync-1792945050000",
    "serverTimeMs": 1792945050000,
    "desktopStatus": "idle",
    "activeTask": {
      "id": "task-492",
      "title": "Refactoring Logger Sanitization",
      "progressPercent": 75,
      "pendingApproval": true
    },
    "conversationsCount": 14,
    "offlineQueueCount": 0
  }
  ```

---

### 2.3 Agent Action Approval / Denial
- **Method:** `POST /api/companion/actions/approve`
- **Request Body:**
  ```json
  {
    "taskId": "task-492",
    "actionId": "action-write-file-7",
    "decision": "approved", // "approved" | "rejected"
    "deviceTimestamp": 1792945060000,
    "signature": "base64_signed_hash_of_decision"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "acknowledged",
    "actionId": "action-write-file-7",
    "executedAt": 1792945060500
  }
  ```

---

### 2.4 WebSocket Real-Time Event Stream
- **URL:** `wss://<desktop-ip>:8443/api/companion/events`
- **Events Emitted by Desktop:**
  - `task:progress`: Streaming step completion and percentage.
  - `task:approval_required`: Pops approval modal on phone with haptic feedback.
  - `chat:token`: Chunks of AI text streaming for mobile read-along.
  - `device:revoked`: Desktop revoked phone; phone wipes local session keys immediately.
