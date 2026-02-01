# Sovereign AP2 Reference Implementation

**Version**: 0.2.0-alpha.1
**Status**: Phase 1 - Core Cryptographic Foundation

> Reference implementation for the [Sovereign AP2 Profile v0.2](../docs/sovereign_ap2_profile.md), focusing on user-final authority, auditability, portability, and fail-closed safety.

## Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run demo
npm run demo
```

## Packages

| Package | Description |
|---------|-------------|
| `@sovereign-ap2/core-schemas` | TypeScript interfaces and validation |
| `@sovereign-ap2/crypto-primitives` | Ed25519 signing, revocation chains |
| `@sovereign-ap2/mandate-engine` | Mandate creation and management |
| `@sovereign-ap2/receipt-chain` | Receipt chaining for audit integrity |

## Features (Phase 1)

- ✅ **Secure mandate creation** with immutable cores
- ✅ **Revocation chains** for immediate credential invalidation
- ✅ **Receipt chaining** for audit integrity
- ✅ **DID:key** identity generation
- ✅ **JWS signatures** with Ed25519

## Roadmap

| Phase | Components | Status |
|-------|------------|--------|
| **1** | Core crypto, mandates, receipts | 🟢 Complete |
| **2** | ZK proofs, dispute protocol | ⚪ Planned |
| **3** | Provider portability, consistency proofs | ⚪ Planned |

## Security

> ⚠️ **ALPHA SOFTWARE** - Not for production use without security audit.

See [SECURITY.md](./SECURITY.md) for security considerations.

## License

Apache-2.0
