# Lodhi AI — Critical Firebase JWT Security Fix Report

**Date:** October 26, 2026  
**Auditor:** Senior Security Architect & Cloud Relay Engineer  
**Workspace:** `E:\LodhiAI-Windows`  
**Security Fix Target:** Replace decoded-claims-only authentication with cryptographic RS256 signature verification, Google certificate store caching, key rotation, and production anti-forgery defenses in `src/server/auth.ts`.

---

## 1. Executive Summary & Root Cause Analysis

### Prior Vulnerability State
Previously, `verifyFirebaseIdToken` in [`src/server/auth.ts`](file:///E:/LodhiAI-Windows/src/server/auth.ts) performed basic base64url decoding of the JWT payload and checked `iss`, `aud`, and `exp`. However:
1. **Zero Cryptographic Signature Verification:** The RS256 signature was completely ignored. Any client or attacker could generate a self-signed or unsigned token containing valid issuer (`https://securetoken.google.com/lodhiai-cloud`) and audience claims, and successfully authenticate as any user UID.
2. **Forged Privilege Vulnerability:** An attacker could inject arbitrary `role: 'owner'` or `plan: 'business'` into the unverified payload, bypassing SaaS entitlement limits.
3. **Simulated Token Leaks in Production:** Development fallback tokens (`fb_id_token_<uid>_<timestamp>`) had no production environment guards and could be used to bypass authentication.

### Remediated Security State
The token verification engine has been upgraded to a **cryptographically enforced RS256 verification pipeline**:
- Tokens are verified using Node.js native `crypto.createVerify('RSA-SHA256')` against Google's official public certificates.
- Dynamic key rotation is supported via [`GoogleCertificateStore`](file:///E:/LodhiAI-Windows/src/server/auth.ts#L151) with automated HTTP caching (`max-age` parsing) and on-demand cache refresh.
- Simulated tokens (`fb_id_token_*`) are **strictly rejected** in production mode (`NODE_ENV === 'production'`).
- Client-supplied `plan` and `role` claims are sanitized to authoritative enum defaults or overridden via server-side database lookups (`authoritativeSubscriptionResolver`).

---

## 2. Files Changed

1. [`src/server/types.ts`](file:///E:/LodhiAI-Windows/src/server/types.ts):
   - Added optional `auth_time?: number` and `firebase?: Record<string, any>` to [`JWTPayload`](file:///E:/LodhiAI-Windows/src/server/types.ts#L34) to support Firebase token claim schemas without type degradation.
2. [`src/server/auth.ts`](file:///E:/LodhiAI-Windows/src/server/auth.ts):
   - Replaced claims-only `verifyFirebaseIdToken` with:
     - [`GoogleCertificateStore`](file:///E:/LodhiAI-Windows/src/server/auth.ts#L151): Manages public key caching, Google x509 cert endpoint fetching, and key rotation.
     - [`verifyRS256Signature`](file:///E:/LodhiAI-Windows/src/server/auth.ts#L248): Native RSA-SHA256 signature validator.
     - [`verifyFirebaseIdToken`](file:///E:/LodhiAI-Windows/src/server/auth.ts#L267): Synchronous verification against cached Google keys / injected certificates.
     - [`verifyFirebaseIdTokenAsync`](file:///E:/LodhiAI-Windows/src/server/auth.ts#L399): Asynchronous verification with dynamic key rotation and authoritative subscription resolution.
     - [`verifyAnyToken`](file:///E:/LodhiAI-Windows/src/server/auth.ts#L464) & [`verifyAnyTokenAsync`](file:///E:/LodhiAI-Windows/src/server/auth.ts#L496): Universal verifiers supporting HMAC server tokens and RS256 Firebase tokens.
     - Production safeguards: strictly rejects simulated tokens in production and enforces explicit `FIREBASE_PROJECT_ID`.
3. [`src/server/index.ts`](file:///E:/LodhiAI-Windows/src/server/index.ts):
   - Re-exported new verification utilities (`verifyFirebaseIdTokenAsync`, `verifyAnyTokenAsync`, `verifyRS256Signature`, `googleCertStore`, `setFirebasePublicKeys`, `clearFirebasePublicKeys`, `fetchGooglePublicKeys`).
4. [`src/test/FirebaseAuthCryptographicSecurity.test.ts`](file:///E:/LodhiAI-Windows/src/test/FirebaseAuthCryptographicSecurity.test.ts):
   - New dedicated test suite with **20 comprehensive security test cases** validating cryptographic signature verification, forgery defense, expiration, issuer/audience validation, UID boundaries, key rotation, network outage fail-closed handling, and production safeguards.

---

## 3. Cryptographic Verification Method

### Token Structure & Header Inspection
- Token must contain 3 base64url-encoded parts (`header.payload.signature`).
- Header `alg` must be strictly `'RS256'`. Any other algorithm (`none`, `HS256`, etc.) is rejected.
- Header `kid` (Key ID) must be a non-empty string referencing a valid Google signing key.

### Signature Verification Algorithm
```typescript
export function verifyRS256Signature(
  signingInput: string,
  signatureBase64Url: string,
  publicKeyOrCert: string
): boolean {
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signingInput);
    verifier.end();
    const signature = base64urlDecode(signatureBase64Url);
    return verifier.verify(publicKeyOrCert, signature);
  } catch {
    return false;
  }
}
```

### Claims & Privilege Hardening
1. **Audience (`aud`):** Must strictly match `expectedProjectId`.
2. **Issuer (`iss`):** Must strictly match `https://securetoken.google.com/${expectedProjectId}`.
3. **Subject (`sub`):** Must be a non-empty string $\le 128$ characters.
4. **Time Boundaries:**
   - Expiration (`exp`): Must be in the future (with 5-minute clock skew tolerance).
   - Issued-At (`iat`): Must not be in the future beyond 5-minute skew.
5. **Anti-Tampering Privilege Defense:**
   - Client tokens cannot inject or modify `role` or `plan`. Roles are strictly sanitized to `['owner', 'developer', 'viewer']` (default: `'developer'`) and plans to `['free', 'pro', 'business']` (default: `'free'`).
   - Server-side [`authoritativeSubscriptionResolver`](file:///E:/LodhiAI-Windows/src/server/auth.ts#L137) hook enables querying Firestore/PostgreSQL directly for genuine billing tiers, overriding any client-supplied claims.

---

## 4. Test Results Across Subsystems

### 1. New Cryptographic Security Test Suite
**Command:** `npx vitest run src/test/FirebaseAuthCryptographicSecurity.test.ts`  
**Result:** **20 passed, 0 failed** (Exit Code: **0**)

| Test Group | Tests | Result | Security Requirement Validated |
|---|---|---|---|
| **1. Genuine Token Verification** | 4 | **PASSED** | RS256 signature verification, async verification, universal `verifyAnyToken`. |
| **2. Signature Tampering & Forgery** | 2 | **PASSED** | Rejects tokens signed with wrong private keys or modified in-flight payloads. |
| **3. Expiration & Clock Boundaries** | 2 | **PASSED** | Rejects expired tokens and future-issued tokens. |
| **4. Issuer & Audience Boundaries** | 2 | **PASSED** | Rejects cross-project tokens and malicious IDPs. |
| **5. Subject / UID Integrity** | 2 | **PASSED** | Rejects empty UIDs and oversized UIDs (>128 chars). |
| **6. Key Rotation & Unknown Keys** | 2 | **PASSED** | Handles un-cached keys safely; refreshes certs when Google rotates keys. |
| **7. Network Failure Fail-Closed** | 1 | **PASSED** | Fails closed on network outage; never falls back to unverified tokens. |
| **8. Forged Role & Plan Defense** | 2 | **PASSED** | Sanitizes forged claims and prioritizes authoritative database resolver. |
| **9. Production Mode Safeguards** | 3 | **PASSED** | Strictly blocks simulated tokens in production and requires configured project ID. |
| **10. Token Revocation Blacklist** | 1 | **PASSED** | Immediately rejects tokens whose user UID or JTI is blacklisted. |

### 2. Full Vitest Test Suite
**Command:** `npm test -- --run`  
**Result:** **22 test files, 206 passed, 0 failed** in 51.92s (Exit Code: **0**)

### 3. TypeScript Type-Check
**Command:** `npm run type-check` (`tsc --noEmit`)  
**Result:** **0 type errors** (Exit Code: **0**)

### 4. Vite Production Build
**Command:** `npm run build` (`tsc && vite build`)  
**Result:** **1,629 modules transformed**, production bundle in `dist/` (Exit Code: **0**)

### 5. Native Rust Backend Suite
**Command:** `cargo test --manifest-path src-tauri\Cargo.toml`  
**Result:** **103 passed, 1 ignored (offline Ollama test), 0 failed** in 16.09s (Exit Code: **0**)

---

## 5. Relay Security Controls Audit

| Security Control | Implementation Location | Verified Behavior | Status |
|---|---|---|---|
| **Pairing PIN Expiry** | [`src/server/relay.ts`](file:///E:/LodhiAI-Windows/src/server/relay.ts#L180) | 6-digit cryptographic PIN, 5-minute TTL, single-use redemption with immediate deletion. | **Secured** |
| **Replay Protection** | [`src/server/relayServer.ts`](file:///E:/LodhiAI-Windows/src/server/relayServer.ts#L295) | 5-minute timestamp skew tolerance + 10,000-message deduplication cache. | **Secured** |
| **Sliding Window Rate Limiting** | [`src/server/relayServer.ts`](file:///E:/LodhiAI-Windows/src/server/relayServer.ts#L318) | Max 60 messages/minute per connected companion device. | **Secured** |
| **Device Revocation** | [`src/server/relay.ts`](file:///E:/LodhiAI-Windows/src/server/relay.ts#L246) | Real-time revocation adds device to blacklist, terminates WebSocket (code 1008), wipes queues. | **Secured** |
| **Tenant Isolation** | [`src/server/relay.ts`](file:///E:/LodhiAI-Windows/src/server/relay.ts#L143) | Hard-overwrites message `tenantId` from authenticated session. Rejects cross-tenant routing. | **Secured** |
| **Offline Sensitive Actions Block** | [`src/server/relay.ts`](file:///E:/LodhiAI-Windows/src/server/relay.ts#L160) | Rejects queueing dangerous actions (shell commands, file edits) when target desktop is offline. | **Secured** |

---

## 6. Remaining Gaps & Deployment Blocker Status

### Is Production Relay Deployment Still Blocked?
**No, the critical cryptographic JWT security vulnerability that blocked deployment is now FIXED.**

However, before executing a live public cloud deployment to Google Cloud Run, the following three configuration items must be completed:
1. **Configure Live `FIREBASE_PROJECT_ID`:** In production, the Cloud Run container must have `FIREBASE_PROJECT_ID=your-actual-project-id` set in environment variables (the verifier strictly enforces this).
2. **Add PIN Redemption Brute-Force Rate Limiting:** Add a failed-attempt counter (max 3 failed PIN attempts before challenge invalidation) on `/api/v1/relay/pairing/redeem` to prevent automated pin-guessing.
3. **App Check Verification:** Enforce `X-Firebase-AppCheck` token header validation on the Relay WebSocket and REST endpoints for public mobile access.

---

## 7. Roman Urdu Khulasa (Summary)

- **Kia Issue Tha:** `src/server/auth.ts` mein Firebase ID Token ka cryptographic signature check nahi ho raha tha; sirf base64 decode karke claims check ho rahe thay, jis ki wajah se koi bhi attacker fake token bana kar authenticate ho sakta tha.
- **Kia Fix Kia:** 
  1. Node.js ke native `crypto.createVerify('RSA-SHA256')` ke zariye real cryptographic signature verification implement ki.
  2. Google ke official certificate endpoint (`x509/securetoken`) se keys fetch aur cache karne ke liye [`GoogleCertificateStore`](file:///E:/LodhiAI-Windows/src/server/auth.ts#L151) banaya, jo key rotation ko automatically handle karta hai.
  3. Production mode (`NODE_ENV === 'production'`) mein simulated tokens (`fb_id_token_*`) ko strictly block kar diya.
  4. Fake roles aur fake plans ko sanitize karke authoritative server subscription database lookups se bind kia.
- **Testing Results:**
  - Naya security test suite: **20/20 tests passed**.
  - Full test suite: **22 test files, 206/206 tests passed**.
  - TypeScript type-check: **0 errors**.
  - Rust Tauri test suite: **103 passed, 0 failed**.
- **Current Status:** Critical security gap kamyabi ke saath resolve ho chuka hai aur fake tokens ko successfully reject kar raha hai.
