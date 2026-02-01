# Comparison: Standard vs Sovereign Flows

This document contrasts typical agent execution patterns with the Sovereign Stack approach, demonstrating the sovereignty gaps that are closed.

---

## Tool Execution Flow

### Standard MCP/A2A Flow

```
┌───────┐     ┌───────┐     ┌──────────┐
│ Agent │────▸│  MCP  │────▸│ Provider │
│       │     │ Tool  │     │          │
└───────┘     └───────┘     └──────────┘
    │             │              │
    │  API Key    │   Execute    │
    │  (bearer)   │   (trust)    │
    │             │              │
    ▼             ▼              ▼
┌─────────────────────────────────────────┐
│           Platform Logs Only            │
│  (user cannot independently verify)     │
└─────────────────────────────────────────┘
```

**Characteristics:**
- Agent authenticates with API key
- No cryptographic proof of user authorization
- Platform controls the audit trail
- Revocation = delete token (delayed, all-or-nothing)
- Dispute = call support

---

### Sovereign Stack Flow

```
┌───────┐     ┌───────────────┐     ┌──────────┐
│ Agent │────▸│   Sovereign   │────▸│ Provider │
│       │     │    Adapter    │     │          │
└───────┘     └───────────────┘     └──────────┘
    │              │                     │
    │  Mandate     │                     │
    │  (signed,    │                     │
    │   scoped)    │                     │
    │              ▼                     │
    │         ┌─────────┐                │
    │         │ τ-Gate  │ ◀─ Verify      │
    │         └─────────┘                │
    │              │                     │
    │              ▼                     │
    │         ┌─────────┐                │
    │         │ Mirror  │ ◀─ Capture     │
    │         └─────────┘                │
    │              │                     │
    │              ▼                     ▼
    │         ┌─────────────────────────────┐
    │         │       Execute Tool          │
    │         └─────────────────────────────┘
    │              │                     │
    │              ▼                     │
    ▼         ┌─────────┐                │
┌─────────────│ Receipt │◀───────────────┘
│   User      │ (signed)│     Provider signs
│   Audit     └─────────┘     execution proof
│   Trail
└───────────────────────────────────────────┐
│         User-Verifiable Event Log         │
│  (cryptographic chain, portable, tamper-  │
│   evident, independent of platform)       │
└───────────────────────────────────────────┘
```

---

## Comparison Table

| Aspect | Standard (MCP/A2A) | Sovereign Stack |
|--------|-------------------|-----------------|
| **Authorization** | Bearer token (implicit trust) | Signed mandate (explicit scope) |
| **Scope Limits** | None or platform-defined | User-defined per mandate |
| **Budget Control** | Credit limits (platform) | Cryptographic budget cap |
| **Audit Trail** | Platform logs | User-controlled hash chain |
| **Revocation** | Delete token (delayed) | Publish chain head (instant) |
| **Verification** | Trust platform | Independent crypto verification |
| **Dispute Evidence** | Request logs from platform | Cryptographic proof trail |
| **Portability** | Re-onboard everywhere | Take mandates + receipts |
| **Fail Mode** | Execute anyway | Fail-closed |

---

## Code Comparison

### Standard: Direct Tool Call

```typescript
// No sovereignty guarantees
const result = await mcpTool.execute({
  name: 'send_money',
  params: { recipient: 'merchant123', amount: 500 }
});
// 🔴 No proof of authorization
// 🔴 No receipt
// 🔴 No audit trail you control
```

### Sovereign: Wrapped Tool Call

```typescript
import { createSovereignAdapter, createMandate, signMandate } from '@sovereign-stack/core';

// 1. Create scoped mandate
const mandate = await signMandate(createMandate({
  issuer: 'user:me',
  delegate: 'agent:router',
  scope: {
    actions: ['payment:transfer'],
    resources: ['merchant:*'],
    max_value: 1000,
    currency: 'USD'
  },
  validity: { not_after: '2024-12-31T23:59:59Z' }
}), keystore, userKeyId);

// 2. Wrap tool with adapter
const adapter = createSovereignAdapter(mcpTool, 'agent:router', {
  budgetAware: true
});

// 3. Execute with sovereign guarantees
const { response, receipt, mirror } = await adapter.execute(
  { name: 'send_money', params: { recipient: 'merchant123', amount: 500 } },
  mandate
);

// ✅ Mandate verified before execution
// ✅ Receipt issued with cryptographic signature
// ✅ Mirror captured request/response hashes
// ✅ Event log records everything
// ✅ Budget tracked and enforced
```

---

## Sovereignty Gaps Closed

### 1. Implicit vs Explicit Authorization

**Gap:** Standard flows assume the bearer of a token is authorized for anything.

**Fix:** Mandates explicitly define scope, resources, and budget. τ-Gate verifies before execution.

### 2. Platform-Controlled Audit

**Gap:** You can only see what the platform shows you.

**Fix:** Hash-chained event log and receipts you can verify independently.

### 3. Delayed Revocation

**Gap:** Deleting an API key doesn't stop in-flight requests.

**Fix:** Revocation events are checked at verification time. No valid mandate = no execution.

### 4. Trust-Based Disputes

**Gap:** "I didn't authorize that" vs platform logs.

**Fix:** Cryptographic chain: mandate → mirror → receipt. Either the signature is valid or it isn't.

### 5. Vendor Lock-in

**Gap:** Switching providers means re-onboarding, losing history.

**Fix:** Mandates and receipts are portable. The cryptographic trail travels with you.

---

## When to Use Sovereign Stack

| Use Case | Standard OK? | Sovereign Recommended? |
|----------|-------------|----------------------|
| Quick prototyping | ✅ | ⚪ Optional |
| Internal tools | ✅ | ⚪ Optional |
| User-facing agents | ⚠️ | ✅ Recommended |
| Financial actions | 🔴 Risky | ✅ Required |
| Multi-agent orchestration | ⚠️ | ✅ Recommended |
| Regulated industries | 🔴 Risky | ✅ Required |
| Cross-platform agents | ⚠️ | ✅ Recommended |

---

*Sovereignty is not a feature. It's a design constraint.*
