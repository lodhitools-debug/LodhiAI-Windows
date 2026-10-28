# Lodhi AI — Firebase & Cloud Run Cost Analysis & Deployment Strategy

**Document Version:** 1.0.0  
**Phase:** Phase 7 — Costs, Infrastructure & Deployment Readiness  
**Project:** Lodhi AI Windows Desktop & Android Companion  
**Date:** October 25, 2026  
**Auditor:** Antigravity AI Cloud Architecture Team  
**Authorized Project Root:** `E:\LodhiAI-Windows`  

---

## 1. Firebase Plan Comparison: Spark (Free) vs. Blaze (Pay-as-you-go)

| Capability / Resource | Firebase Spark Plan (Free) | Firebase Blaze Plan (Pay-as-you-go) | Lodhi AI Minimum Recommendation |
| :--- | :--- | :--- | :--- |
| **Firebase Authentication** | 50,000 monthly active users (MAU) | Free up to 50k MAU; then $0.0055/MAU | Spark is sufficient for early launch. |
| **Cloud Firestore Storage** | 1 GiB total stored data | 1 GiB free; then $0.18/GiB/month | Spark is sufficient (< 5,000 users). |
| **Firestore Document Reads** | **50,000 reads / day** (Free) | 50k/day free; then $0.06 per 100k reads | Generous free quota covers beta testing. |
| **Firestore Document Writes** | **20,000 writes / day** (Free) | 20k/day free; then $0.18 per 100k writes | Generous free quota. |
| **Cloud Messaging (FCM)** | **100% Free** (Unlimited) | **100% Free** (Unlimited) | Zero cost on both plans. |
| **Firebase App Check** | 10,000 Play Integrity checks/day | 10k/day free; then $0.0001/call | Free tier is sufficient. |
| **Outbound Cloud Networking** | **Blocked** (Google APIs only) | **Enabled** (Required for Stripe/Lemon Squeezy webhooks) | **Blaze required once billing webhooks go live**. |

> [!NOTE]
> On the Blaze plan, the generous free tier quotas from the Spark plan still apply every single month. You only pay if consumption exceeds the monthly free thresholds.

---

## 2. Cloud Relay Architecture: Cloud Run vs. Cloud Functions

A critical requirement of Section 5 is persistent, low-latency, bidirectional WebSocket connectivity between Windows desktop and mobile companion without firewall port-forwarding.

### Why Cloud Functions is NOT Recommended for Persistent WebSockets
- **Execution Timeout Limit:** Cloud Functions (2nd Gen) terminates idle or long-running HTTP connections after at most 9 minutes (540 seconds). Companion sockets would be severed repeatedly, resulting in constant reconnection storms.
- **Instance Concurrency:** Functions are fundamentally optimized for discrete event-driven invocations, not standing duplex streams.

### Why Google Cloud Run is the Recommended Deployment Option
- **Native WebSocket Support:** Cloud Run fully supports persistent WebSockets over HTTPS/WSS with session timeouts up to **60 minutes** (3,600 seconds) and automatic HTTP/2 streaming.
- **Scale to Zero (Cost Efficiency):** When no companion devices are active, Cloud Run can scale to 0 container instances, incurring zero vCPU charges.
- **Generous Google Cloud Free Tier:**
  - 2,000,000 requests per month (Free).
  - 360,000 vCPU-seconds per month (Free).
  - 180,000 GiB-seconds memory per month (Free).
- **Estimated Relay Operational Cost:** For 500 – 1,000 active daily developer pairings, estimated Cloud Run costs are **$0.00 to $4.80 / month**.

---

## 3. Secret Management & Zero-Leakage Architecture

In accordance with Non-Negotiable Rule #8 ("Do not put API keys, passwords, signing keys, private tokens, or production credentials in source code or logs"):

1. **Client Public Identifiers (Web / Windows / Android):**
   - `apiKey`, `projectId`, `appId`: These are public project identifiers embedded into client bundles. They do not grant administrative privileges and are protected by Firestore Security Rules (`firestore.rules`) and Firebase App Check.
2. **Server-Side Privileged Credentials (NEVER in Client Apps):**
   - `GOOGLE_APPLICATION_CREDENTIALS` (Firebase Admin SDK service account JSON).
   - `LODHI_JWT_SECRET` (Cryptographic HMAC-SHA256 signing key).
   - `STRIPE_WEBHOOK_SECRET` & `LEMON_SQUEEZY_WEBHOOK_SECRET`.
   - In production, these are injected as environment variables directly from **Google Secret Manager** into the Cloud Run container instance.

---

## 4. Budget Alerts & Safety Quotas

To prevent runaway billing or denial-of-wallet risks, the following safeguard policies must be configured upon enabling the Blaze plan:

1. **Google Cloud Budget Alert Thresholds:**
   - **Alert 1:** $5.00 (Notification email to founder).
   - **Alert 2:** $25.00 (Warning notification).
   - **Alert 3:** $50.00 (Triggers Cloud Pub/Sub auto-capping action).
2. **Firestore Daily Safety Quota:**
   - Configure a daily maximum spending cap of $2.00 on Cloud Firestore in the Google Cloud Billing console.
