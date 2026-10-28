# Lodhi AI — Commercial Pricing & Packaging Strategy (Business Proposal)

**Document Version:** 1.0.0  
**Phase:** Phase 14 — Commercial Business Planning (For Executive Review & Approval)  
**Project:** Lodhi AI Desktop for Windows  
**Audit Completion Date:** October 25, 2026  
**Auditor:** Antigravity AI Engineering Team  

---

## 1. Executive Notice

> [!IMPORTANT]
> The pricing, tier configurations, and revenue projections below represent **proposed business models** for leadership approval. No live pricing models or automatic customer billings have been coded into production or activated with payment gateways.

---

## 2. Proposed Commercial Packaging

Lodhi AI follows an offline-first "Freemium + Cloud Add-on" model. Local capability remains forever free and privacy-preserving, while managed cloud compute and team governance generate recurring SaaS revenue.

```
┌─────────────────────────────────┐
│     Free Community Edition      │  $0 / perpetual
│  - 100% Offline Local Inference │
│  - Local Ollama & Qwen Models   │
│  - BYOK (Bring Your Own Gemini) │
│  - 1 Device Activation          │
└────────────────┬────────────────┘
                 │ Upgrade
┌────────────────▼────────────────┐
│          Developer Pro          │  Proposed: $12 - $19 / month (or $120 / year)
│  - Managed Cloud Fast Inference │  (PKR 3,500 - 5,500 / month)
│  - 500,000 Cloud Tokens / month │
│  - 3 Device Activations         │
│  - Priority Support             │
└────────────────┬────────────────┘
                 │ Upgrade
┌────────────────▼────────────────┐
│       Business Enterprise       │  Proposed: $49 - $99 / month (or $500 / year)
│  - 2,500,000 Cloud Tokens/month │  (PKR 14,000 - 28,000 / month)
│  - 10 Device Activations        │
│  - Central Audit Streams        │
│  - Team Workspace Policy Engine │
└─────────────────────────────────┘
```

---

## 3. Merchant of Record & Payment Provider Strategy

### 3.1 Recommended Provider: Lemon Squeezy
- **Target Audience:** International and Pakistan-based customers.
- **Why Lemon Squeezy:** Acts as the Merchant of Record (MoR), handling international sales tax, VAT, EU digital service tax, chargebacks, and invoicing. Accepts Pakistani founder onboarding (CNIC/Passport verification and direct payout to local Pakistani bank accounts via Wise / Payoneer USD routing).
- **Processing Fee:** 5% + $0.50 per transaction.

### 3.2 Secondary Provider: Stripe Billing
- **Target Audience:** Incorporated entities in supported Stripe countries (US, UK, UAE, EU).
- **Processing Fee:** 2.9% + $0.30 per transaction.
- **Recommendation:** Retain Stripe adapter in `webhooks.ts` for future corporate entity expansion.

---

## 4. Gross Margin & Unit Economics (Estimated)

Assuming Developer Pro at $15/month:
- Gateway fee (Lemon Squeezy): ~$1.25 (5% + $0.50)
- Cloud token cost (500k tokens via Gemini Flash / Claude Haiku / Qwen API): ~$0.50 - $1.00
- Hosting & DB amortization per user: ~$0.20
- **Net Gross Margin:** **~$12.55 / user / month (~83.6% gross margin)**
