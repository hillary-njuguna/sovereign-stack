# Sovereign AP2 Reference Schemas v0.2 - Critical Update Package

*Version: 0.2*
*Type: Implementation Specification*
*Status: DRAFT*
*Supersedes: [sovereign_ap2_schemas.md](sovereign_ap2_schemas.md) (v0.1)*

> [!CAUTION]
> **DO NOT IMPLEMENT v0.1 IN PRODUCTION.** The v0.1 schemas have known cryptographic weaknesses. This document provides the hardened v0.2 specification.

---

## 1. Core Cryptographic Fixes

### Fixed DelegationMandate Schema

```typescript
interface DelegationMandate {
  // IMMUTABLE CORE (signed portion)
  mandateId: string; // UUID v7 (time-sorted)
  issuer: string;    // DID or public key fingerprint
  
  intent: {
    budget: {
      currency: string;
      maxAmount: number;   // IMMUTABLE: Maximum ever allowed
    };
    
    allowedVendors?: string[]; // Hashed vendor identifiers
    vendorCategories?: string[];
    validFrom: string;
    validUntil: string;
    maxTransactions?: number;
    allowedJurisdictions?: string[];
    
    // NEW: Cryptographic constraints
    cryptographic: {
      allowedProofTypes: string[]; // e.g., ["zk-snark", "zk-stark", "bbs+"]
      privacyLevel: 'low' | 'medium' | 'high';
      revocable: boolean;
    };
  };
  
  // MUTABLE STATE (tracked separately, NOT signed)
  mutableState: {
    remainingAmount: number;
    transactionCount: number;
    lastUsed: string;
    revocationChain: RevocationChain;
  };
  
  proofs: {
    // Signature over HASH(immutableCore)
    signature: string;
    
    // NEW: Zero-knowledge proof of authority
    zkProof?: ZKProofOfAuthority;
    
    // NEW: Revocation uses hash chain
    revocationChain: {
      currentHash: string;
      previousHash: string;
      depth: number;
      timestamp: string;
    };
  };
}
```

### ZK Proof of Authority Schema

```typescript
interface ZKProofOfAuthority {
  proofType: 'zk-snark' | 'zk-stark' | 'bbs+';
  circuitId: string; // Which circuit/proof system
  
  // Public inputs (revealed)
  publicInputs: {
    mandateIdHash: string;
    budgetRemaining: number; // In range proof format
    validTimeRange: [string, string]; // Start/end timestamps
    vendorCategoryHash?: string;
  };
  
  // Proof itself
  proof: string;
  
  // Verification materials
  verification: {
    verificationKey: string;
    circuitHash: string; // Hash of the circuit used
    trustedSetupHash?: string; // For SNARKs
  };
}
```

---

## 2. Enhanced Privacy Parameters

```typescript
interface PrivacyParameters {
  // Differential privacy settings
  differentialPrivacy: {
    enabled: boolean;
    epsilon: number; // Privacy loss parameter (lower = more private)
    delta: number;   // Probability of failure
    noiseMechanism: 'laplace' | 'gaussian' | 'exponential';
  };
  
  // Data minimization
  dataMinimization: {
    maxRetentionDays: number;
    automaticDeletion: boolean;
    allowAggregatesOnly: boolean;
  };
  
  // Correlation resistance
  antiCorrelation: {
    rotatePseudonyms: boolean;
    rotationFrequency: string; // ISO 8601 duration
    useSalts: boolean;
    saltLifetime: string;
  };
}
```

---

## 3. Machine-Readable Dispute Protocol

```typescript
interface ProtocolDispute {
  disputeId: string;
  
  // Standardized dispute categories (extensible)
  category: 
    | 'merchant-misrepresentation'
    | 'non-delivery'
    | 'defective-goods'
    | 'unauthorized-transaction'
    | 'billing-error'
    | 'quality-mismatch';
  
  evidence: {
    // Standardized evidence types
    required: Array<
      'original-receipt' |
      'communication-log' |
      'delivery-proof' |
      'product-photos' |
      'expert-opinion'
    >;
    
    provided: Array<{
      type: string;
      hash: string;
      timestamp: string;
      signer: string; // DID
    }>;
  };
  
  // Resolution mechanism
  resolution: {
    mechanism: 'arbitration' | 'mediation' | 'automatic' | 'escrow-release';
    
    // For arbitration
    arbitrators?: Array<{
      did: string;
      reputation: string; // e.g., "on-chain-reputation-score"
      stake: number;      // Bonded stake
    }>;
    
    // Timelines
    escalationPath: Array<{
      stage: 'initial' | 'mediation' | 'arbitration' | 'appeal';
      timeout: string; // ISO 8601 duration
      cost: number;    // In dispute token
    }>;
    
    // Automatic resolution triggers
    automaticTriggers?: Array<{
      condition: string; // e.g., "deliveryProof && !deliveredWithin(72h)"
      action: 'refund' | 'partial-refund' | 'release-escrow';
      evidenceRequired: string[];
    }>;
  };
  
  // Outcomes
  possibleOutcomes: Array<{
    id: string;
    description: string;
    conditions: string[]; // Machine-readable conditions
    payout: {
      buyer: number;  // Percentage or amount
      seller: number;
      arbitrator: number;
    };
  }>;
}
```

---

## 4. Provider Portability Framework

```typescript
interface PaymentProvider {
  providerId: string;
  
  // Capabilities matrix
  capabilities: {
    paymentMethods: string[]; // e.g., ["card", "bank", "crypto"]
    currencies: string[];
    maxTransaction: number;
    minTransaction: number;
    settlementTime: string; // Average
  };
  
  // Sovereignty compliance
  sovereignty: {
    supportsZkProofs: boolean;
    supportsRevocationChains: boolean;
    supportsReceiptChaining: boolean;
    apiStandard: 'ap2' | 'custom';
  };
  
  // Migration protocol
  migration: {
    exportFormat: {
      mandates: 'json' | 'cbor' | 'protobuf';
      receipts: 'json' | 'cbor' | 'protobuf';
      events: 'json' | 'cbor' | 'protobuf';
      signaturesPreserved: boolean;
    };
    
    importFormat: {
      accepts: string[];
      validationRequired: boolean;
      conversionService?: string; // URL
    };
    
    // Switching cost estimation
    switching: {
      timeEstimate: string;
      costEstimate: number;
      dataLoss: 'none' | 'partial' | 'full';
    };
  };
  
  // Discovery and connection
  endpoints: {
    baseUrl: string;
    mandateApi: string;
    receiptApi: string;
    disputeApi: string;
    migrationApi: string;
  };
}
```

---

## 5. Cross-Layer Consistency Proof

```typescript
interface ConsistencyProof {
  proofId: string;
  
  // Layer commitments
  layers: {
    ucp: {
      orderHash: string;
      state: string;
      transitions: Array<{from: string, to: string, timestamp: string}>;
      finalityProof: string;
    };
    
    ap2: {
      paymentHash: string;
      status: string;
      settlementProof: string;
      receiptChainHash: string;
    };
    
    mcp: {
      toolCallHash: string;
      resultHash: string;
      executionProof: string;
    };
    
    a2a?: {
      coordinationHash: string;
      agentConsensus: string;
    };
  };
  
  // Merkle tree for efficient verification
  merkleProof: {
    root: string;
    leaves: Array<{
      layer: 'ucp' | 'ap2' | 'mcp' | 'a2a';
      hash: string;
      index: number;
    }>;
    proof: string[]; // Sibling hashes
  };
  
  // Temporal consistency
  temporal: {
    allowedSkew: string; // ISO 8601 duration
    sequenced: boolean; // Events in correct order
    timestamp: string;
  };
  
  signatures: Array<{
    signer: string;
    signature: string;
    signedHash: string; // Which part they signed
  }>;
}
```

---

## 6. Enhanced Settlement Receipt with Chaining

```typescript
interface SettlementReceipt {
  receiptId: string;
  
  // Chain linking
  chain: {
    previousReceiptHash?: string; // For backward chaining
    nextReceiptHash?: string;     // For forward chaining (if known)
    chainIndex: number;           // Position in chain
    chainRoot?: string;           // Merkle root of receipt batch
  };
  
  // Transaction with deterministic timing
  transaction: {
    amount: number;
    currency: string;
    timestamp: string;
    
    // Deterministic dispute window
    disputeWindow: {
      startsAt: string;                // = timestamp
      endsAt: string;                  // = timestamp + P90D (deterministic)
      extensionConditions: string[];   // When can be extended
    };
    
    // Non-malleable references
    merchantId: string;   // DID
    orderId: string;      // Hash of UCP order
  };
  
  // Enhanced fulfillment proof
  fulfillment: {
    status: 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
    confirmedAt: string;
    
    proofs: Array<{
      type: 'tracking' | 'signature' | 'photo' | 'blockchain';
      hash: string;
      timestamp: string;
      provider?: string;
    }>;
  };
  
  // NEW: Privacy-preserving attestations
  attestations: {
    // Zero-knowledge proof that transaction matches mandate
    zkComplianceProof?: string;
    
    // Selective disclosure proofs
    selectiveDisclosures: Array<{
      claim: string;      // e.g., "age > 18"
      proof: string;
      verifier: string;   // Who requested this
    }>;
  };
}
```

---

## 7. Formal Policy Language (Verifiable Subset)

```typescript
interface VerifiablePolicy {
  policyId: string;
  
  // Formal logic foundation
  logicSystem: 'datalog' | 'temporal-logic' | 'linear-logic';
  version: string;
  
  // Verifiable constraints
  constraints: {
    // Safety properties (must never happen)
    safety: Array<{
      id: string;
      formula: string;    // In chosen logic system
      description: string;
      severity: 'critical' | 'high' | 'medium';
    }>;
    
    // Liveness properties (must eventually happen)
    liveness: Array<{
      id: string;
      formula: string;
      timeout: string;    // ISO 8601 duration
    }>;
  };
  
  // Composition rules
  composition: {
    allowsMergeWith: string[]; // Other policy IDs
    mergeOperator: 'conjunction' | 'disjunction' | 'priority-union';
    conflictResolution: 'strict' | 'permissive' | 'escalate';
  };
  
  // Verification materials
  verification: {
    model: string;         // Formal model in TLA+, Alloy, etc.
    invariants: string[];  // Formal invariants
    testedWith: string[];  // Verification tools used
  };
  
  // Runtime monitoring
  monitoring: {
    metrics: string[];     // What to measure
    alerts: Array<{
      condition: string;
      action: 'pause' | 'notify' | 'escalate';
    }>;
  };
}
```

---

## 8. Sovereignty Metrics Schema

```typescript
interface SovereigntyMetrics {
  // Quantitative scores (0-100)
  scores: {
    portability: {
      providerSwitchCost: number;     // Lower is better
      dataExportCompleteness: number; // Higher is better
      apiStandardization: number;
    };
    
    privacy: {
      correlationResistance: number;
      dataMinimization: number;
      disclosureControl: number;
    };
    
    control: {
      revocationSpeed: number;        // Seconds to revoke
      policyEnforcement: number;      // % of policies enforced
      auditCompleteness: number;
    };
    
    security: {
      cryptographicStrength: number;  // Based on algorithms
      keyControl: number;             // Who controls keys
      recoveryOptions: number;
    };
  };
  
  // Verification evidence
  evidence: {
    lastAudit: string;
    auditor: string;                  // DID of auditor
    auditReportHash: string;
    
    // Technical proofs
    proofs: {
      keyControl: string;             // Proof user controls keys
      dataExport: string;             // Proof of export capability
      zkCapabilities: string;         // Proof of ZK support
    };
  };
  
  // Historical trends
  history: Array<{
    timestamp: string;
    scores: { /* same structure as above */ };
    changes: string[]; // What changed
  }>;
}
```

---

## 9. Implementation Priority Matrix

| Priority | Component | Est. Effort | Dependencies | Risk if Missing |
|----------|-----------|-------------|--------------|-----------------|
| **P0** | DelegationMandate fixes | 2 weeks | None | Sovereignty collapse |
| **P0** | ZK Proof primitives | 4 weeks | Crypto libraries | Privacy breaches |
| **P1** | Receipt chaining | 3 weeks | DelegationMandate | Audit failures |
| **P1** | Dispute protocol | 6 weeks | Receipt schema | Centralized arbitration |
| **P2** | Provider portability | 4 weeks | All schemas | Vendor lock-in |
| **P2** | Consistency proofs | 5 weeks | Multi-protocol integration | Cross-layer attacks |
| **P3** | Formal policy verification | 8 weeks | Policy language | Rule conflicts |

---

## 10. Migration Path from v0.1 to v0.2

### Phase 1 (Backward Compatible)
- Add optional new fields to existing schemas
- Support both old and new revocation mechanisms
- Create adapters for old receipts

### Phase 2 (Transition)
- Deprecate old fields with warnings
- Automatic conversion of old mandates
- Dual support for 90 days

### Phase 3 (v0.2 Only)
- Remove deprecated fields
- Require new cryptographic proofs
- Enable advanced sovereignty features

---

## Critical Security Advisory

> [!CAUTION]
> **v0.1 Known Vulnerabilities:**
> 1. Malleable revocation mechanisms
> 2. No receipt chaining allows audit gaps
> 3. Missing ZK proofs enable correlation attacks
>
> **Recommended Action**: Implement v0.2 directly or use v0.1 only in test environments with clear upgrade path.

---

*Next Step: Create reference implementation of v0.2 with formal verification of cryptographic properties.*
