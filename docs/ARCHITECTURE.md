# Architecture: Sovereign Stack

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER DOMAIN                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Sovereignty Policy                           │    │
│  │  Budget Limits │ Vendor Constraints │ Time Windows │ Revocation  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SOVEREIGN ADAPTER                               │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  @sovereign-    │  │  @sovereign-    │  │  @sovereign-stack/      │  │
│  │  stack/mandates │  │  stack/crypto   │  │  receipts               │  │
│  │                 │  │                 │  │                         │  │
│  │  • Create       │  │  • Sign (Ed25519)│ │  • Chain receipts       │  │
│  │  • Validate     │  │  • ZK Proofs    │  │  • Verify integrity     │  │
│  │  • Revoke       │  │  • Revocation   │  │  • Export audit trail   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Adapter Interface                             │    │
│  │  wrap(toolCall) → mandate → proof → execute → receipt            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  MCP Tools  │ │  A2A Agents │ │ AP2 Payments│
            └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Package Dependencies

```
@sovereign-stack/core          ← Base types, validation
        ↑
@sovereign-stack/crypto        ← Signing, revocation chains, ZK (future)
        ↑
@sovereign-stack/mandates      ← Mandate lifecycle
        ↑
@sovereign-stack/receipts      ← Receipt chaining
```

---

## Mandate Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MANDATE LIFECYCLE                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐           │
│  │ CREATE  │───▶│  SIGN   │───▶│  USE    │───▶│ REVOKE  │           │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘           │
│       │              │              │              │                 │
│       ▼              ▼              ▼              ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    REVOCATION CHAIN                          │    │
│  │  H₀ ──────▶ H₁ ──────▶ H₂ ──────▶ H₃ (current)              │    │
│  │  (init)     (rev₁)     (rev₂)     (active)                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Revocation is instant**: Publishing a new chain head invalidates all previous heads.

---

## Receipt Chain

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│Receipt #1│───▶│Receipt #2│───▶│Receipt #3│───▶│Receipt #4│
│  H(R₁)   │    │  H(R₂)   │    │  H(R₃)   │    │  H(R₄)   │
│  prev=∅  │    │prev=H(R₁)│    │prev=H(R₂)│    │prev=H(R₃)│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
                                               ┌────────────┐
                                               │ Chain Root │
                                               │  H(all)    │
                                               └────────────┘
```

**Properties**:
- Append-only (no receipt can be removed)
- Tamper-evident (any change breaks the chain)
- User-verifiable (no platform required)

---

## Sovereign Adapter Pattern (Future)

The Sovereign Adapter wraps tool calls with verifiable mandates:

```typescript
// Standard MCP tool call (no sovereignty)
const result = await tool.execute({ action: "buy", item: "groceries" });

// Sovereign-wrapped tool call
const result = await adapter.execute(
  tool,
  { action: "buy", item: "groceries" },
  mandate  // Verifiable authority with budget + scope limits
);
// Returns: { result, receipt }
```

**Adapter responsibilities**:
1. Validate mandate is active and within scope
2. Generate proof of authority (signature or ZK)
3. Execute underlying tool call
4. Chain receipt with mandate binding
5. Return result + verifiable receipt

---

## Security Model

| Layer | Threat | Mitigation |
|-------|--------|------------|
| Mandate | Forgery | Ed25519 signatures |
| Mandate | Replay | Scope binding + transaction limits |
| Mandate | Stolen key | Revocation chain (instant invalidation) |
| Receipt | Tampering | Hash chain |
| Receipt | Deletion | User-controlled storage |
| Identity | Correlation | ZK proofs (Phase 2) |

---

## Directory Structure

```
sovereign-stack/
├── packages/
│   ├── core-schemas/        # @sovereign-stack/core
│   ├── crypto-primitives/   # @sovereign-stack/crypto
│   ├── mandate-engine/      # @sovereign-stack/mandates
│   └── receipt-chain/       # @sovereign-stack/receipts
├── docs/
│   ├── sovereign_ap2_profile.md      # Requirements
│   ├── sovereign_ap2_schemas_v02.md  # Schemas
│   └── sovereign_ap2_gap_analysis.md # Gap analysis
├── examples/
│   └── basic-mandate/       # Demo usage
├── VISION.md                # Why sovereignty matters
├── README.md                # Quick start
└── SECURITY.md              # Security considerations
```
