# Lodhi AI — Cloud Firestore Schema & Security Rules Specification

**Document Version:** 1.0.0  
**Phase:** Phase 3 — Firestore Schema & Privilege Boundary Defense  
**Project:** Lodhi AI Windows Desktop & Android Companion  
**Date:** October 25, 2026  
**Auditor:** Antigravity AI Cloud Security Team  
**Authorized Project Root:** `E:\LodhiAI-Windows`  

---

## 1. Architectural Philosophy: Deny-by-Default

In Lodhi AI's Firebase-First architecture, Cloud Firestore acts as the primary cloud data store for user metadata, connected devices, active pairing handshakes, and subscription entitlements.

The global security policy is strictly **deny-by-default**:
```javascript
match /{document=**} {
  allow read, write: if false;
}
```
Access is granted exclusively through explicitly validated path matches where the authenticated user matches the owner (`request.auth.uid == userId`) or where server-side privileged claims are verified.

---

## 2. Collection Schemas & Data Models

### 2.1 Collection: `users/{uid}`
Stores the core user account profile and plan tier metadata.

| Field Name | Type | Allowed Writers | Description / Validation |
| :--- | :--- | :--- | :--- |
| `uid` | `string` | System on create | Matches `request.auth.uid`. Immutable. |
| `email` | `string` | User | Lowercase email address. |
| `displayName` | `string` | User | User friendly name. Max 50 characters. |
| `role` | `string` | Server / Admin | `'owner' \| 'developer' \| 'viewer'`. Client cannot self-promote. |
| `plan` | `string` | Server / Admin | `'free' \| 'pro' \| 'business'`. **Client cannot modify!** |
| `createdAt` | `timestamp` | System on create | Creation timestamp. Immutable. |
| `updatedAt` | `timestamp` | User / Server | Epoch update timestamp. |

#### Security Constraint:
```javascript
// Owner can update safe profile metadata, but NEVER privileged plan or role
allow update: if isOwner(userId)
              && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['plan', 'role', 'createdAt', 'uid'])
              || isServerAdmin();
```

---

### 2.2 Subcollection: `users/{uid}/devices/{deviceId}`
Tracks authorized Windows workstations and Android companion phones.

| Field Name | Type | Allowed Writers | Description / Validation |
| :--- | :--- | :--- | :--- |
| `deviceId` | `string` | User / Server | Unique device UUID or hardware hash. |
| `deviceType` | `string` | User / Server | Must be `'windows_desktop'` or `'android_companion'`. |
| `deviceName` | `string` | User | Human-readable label (e.g. "Workstation Win11", "Pixel 8 Pro"). |
| `pairedAt` | `timestamp` | System on create | Pairing timestamp. Immutable. |
| `lastActiveAt` | `timestamp` | User | Heartbeat timestamp updated during sessions. |
| `revoked` | `boolean` | User | Set to `true` when user revokes access from Settings. |
| `fcmToken` | `string` | User (Optional) | Firebase Cloud Messaging push token. |

#### Security Constraint:
Clients can create a device only with `revoked: false` and their own `deviceId`. Clients can update `lastActiveAt` or set `revoked: true`, but cannot un-revoke without re-pairing.

---

### 2.3 Subcollection: `users/{uid}/subscriptions/current`
Authoritative billing entitlement record synced from Stripe / Lemon Squeezy webhooks.

| Field Name | Type | Allowed Writers | Description / Validation |
| :--- | :--- | :--- | :--- |
| `tier` | `string` | **Server Only** | `'free' \| 'pro' \| 'business'`. |
| `status` | `string` | **Server Only** | `'active' \| 'past_due' \| 'canceled'`. |
| `gateway` | `string` | **Server Only** | `'stripe' \| 'lemonsqueezy'`. |
| `subscriptionId` | `string` | **Server Only** | Gateway subscription identifier. |
| `customerId` | `string` | **Server Only** | Gateway customer identifier. |
| `currentPeriodEnd` | `timestamp` | **Server Only** | Expiration timestamp of the current billing cycle. |
| `cloudTokensLimit` | `number` | **Server Only** | Monthly token quota (e.g. 100,000 for Free; 5,000,000 for Pro). |
| `devicesLimit` | `number` | **Server Only** | Max concurrent paired companion devices. |

#### Security Constraint:
```javascript
match /subscriptions/{subId} {
  allow read: if isOwner(userId) || isServerAdmin();
  allow write: if isServerAdmin(); // CLIENT WRITES ARE BLOCKED
}
```

---

### 2.4 Subcollection: `users/{uid}/usage/{recordId}`
Tracks monthly metered resource consumption.

| Field Name | Type | Allowed Writers | Description / Validation |
| :--- | :--- | :--- | :--- |
| `periodMonth` | `string` | **Server Only** | Month identifier (e.g. `"2026-10"`). |
| `cloudTokensUsed` | `number` | **Server Only** | Cumulative cloud LLM tokens consumed. |
| `agentRunsCount` | `number` | **Server Only** | Autonomous coding agent tasks run. |
| `storageBytesUsed` | `number` | **Server Only** | RAG document storage size in bytes. |
| `updatedAt` | `timestamp` | **Server Only** | Timestamp of last recorded consumption. |

#### Security Constraint:
Clients can **never write, overwrite, or decrement** usage counters. Writes are permitted strictly via Cloud Functions or trusted backend Admin SDK.

---

### 2.5 Root Collection: `pairingSessions/{sessionId}`
Short-lived, high-entropy handshake record for desktop-to-mobile pairing.

| Field Name | Type | Allowed Writers | Description / Validation |
| :--- | :--- | :--- | :--- |
| `sessionId` | `string` | Desktop Owner | Random 16-byte hex session identifier. |
| `pinHash` | `string` | Desktop Owner | Cryptographic SHA-256 hash of the 6-digit PIN (plaintext PIN is NEVER stored). |
| `windowsUid` | `string` | Desktop Owner | Must equal `request.auth.uid`. |
| `windowsDeviceId` | `string` | Desktop Owner | Initiating workstation device ID. |
| `expiresAt` | `timestamp` | Desktop Owner | Exact expiry (must be `<= request.time + 300s`). |
| `status` | `string` | Desktop / Mobile | `'pending' \| 'paired' \| 'expired'`. |
| `pairedAndroidDeviceId`| `string` | Mobile Companion | Set upon successful redemption. |
| `createdAt` | `timestamp` | Desktop Owner | Handshake initiation timestamp. |

#### Security Constraint:
```javascript
match /pairingSessions/{sessionId} {
  allow read: if isAuthenticated() && (resource == null || resource.data.expiresAt > request.time);

  allow create: if isAuthenticated()
                && request.resource.data.windowsUid == request.auth.uid
                && request.resource.data.status == 'pending'
                && request.resource.data.expiresAt > request.time
                && request.resource.data.expiresAt <= request.time + duration.value(360, 's');

  allow update: if isAuthenticated()
                && resource.data.status == 'pending'
                && resource.data.expiresAt > request.time
                && request.resource.data.status == 'paired'
                && request.resource.data.pairedAndroidDeviceId is string;

  allow delete: if isAuthenticated() && (resource.data.windowsUid == request.auth.uid || isServerAdmin());
}
```

---

### 2.6 Subcollection: `users/{uid}/workspaces/{workspaceId}`
Registers approved project directories for remote coding agent tasks.

| Field Name | Type | Allowed Writers | Description / Validation |
| :--- | :--- | :--- | :--- |
| `workspaceId` | `string` | User | Unique workspace UUID. |
| `name` | `string` | User | Project name (e.g. "Lodhi AI Frontend"). |
| `pathAlias` | `string` | User | Virtual path alias (e.g. `~/projects/lodhi`). **Raw host OS path is redacted**. |
| `isApprovedForRemote`| `boolean` | User | Explicit consent flag allowing mobile task submission. |
| `addedAt` | `timestamp` | User | Registration timestamp. |

---

## 3. Threat Model & Privilege Escalation Defenses

1. **Cross-Tenant / Cross-User Leakage:**
   - User Alice (`uid: usr_alice`) cannot read or query any documents under `users/usr_bob/**`.
   - Verified by automated tests in `src/test/FirebaseFirestoreArchitecture.test.ts`.
2. **Self-Promotion to Pro / Business Tier:**
   - If an authenticated free user attempts to update their profile with `{"plan": "business"}`, Firestore security rules check `!affectedKeys().hasAny(['plan', 'role'])` and reject the write at Google's edge.
3. **Usage Counter Tampering:**
   - A compromised client cannot reset their monthly token counter to zero because writes to `/usage/{recordId}` require server admin claims.
4. **Replay Attack Defense on Pairing:**
   - Once a pairing session's status transitions from `'pending'` to `'paired'`, further updates are forbidden. Sessions older than 5 minutes fail the `expiresAt > request.time` constraint.
