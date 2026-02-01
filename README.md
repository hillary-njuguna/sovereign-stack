# Sovereign Stack

> **A sovereignty-enhancing layer for agentic ecosystems.**

Agents are gaining the ability to act on your behalf—spending money, calling APIs, coordinating with other agents. But who verifies their authority? Who audits their actions? Who revokes them instantly when needed?

**Sovereign Stack** provides the cryptographic primitives and patterns to wrap any agentic ecosystem (MCP, A2A, UCP, AP2) with verifiable mandates, auditable receipts, and instant revocation.

---

## The Sovereign Adapter Pattern

```
┌─────────────────────────────────────────────────┐
│               Your Agent                        │
├─────────────────────────────────────────────────┤
│            SOVEREIGN ADAPTER                    │
│   Mandates → Proofs → Receipts → Revocation     │
├─────────────────────────────────────────────────┤
│   MCP Tools  │  A2A Agents  │  AP2 Payments     │
└─────────────────────────────────────────────────┘
```

**Read the full vision:** [VISION.md](./VISION.md)

---

## Packages

| Package | Description |
|---------|-------------|
| `@sovereign-stack/core` | TypeScript interfaces and validation |
| `@sovereign-stack/crypto` | Ed25519 signing, hash-chain revocation |
| `@sovereign-stack/mandates` | Mandate creation, signing, revocation |
| `@sovereign-stack/receipts` | Cryptographic receipt chaining |

---

## Quick Start

```bash
npm install
npm run build
npm run demo
```

---

## Roadmap

| Phase | Components | Status |
|-------|------------|--------|
| **1** | Core crypto, mandates, receipts | 🟢 Complete |
| **2** | ZK proofs, dispute protocol | ⚪ In Progress |
| **3** | Sovereign Adapter for MCP/A2A | ⚪ Planned |

---

## Documentation

- [VISION.md](./VISION.md) — Why sovereignty matters
- [docs/sovereign_ap2_profile.md](./docs/sovereign_ap2_profile.md) — Requirements profile
- [docs/sovereign_ap2_schemas_v02.md](./docs/sovereign_ap2_schemas_v02.md) — v0.2 schemas
- [docs/sovereign_ap2_gap_analysis.md](./docs/sovereign_ap2_gap_analysis.md) — Gap analysis

---

## Security

> ⚠️ **ALPHA SOFTWARE** — Not for production use without security audit.

See [SECURITY.md](./SECURITY.md) for considerations.

---

## License

Apache-2.0

---

*Building in public. Receipts available.*
