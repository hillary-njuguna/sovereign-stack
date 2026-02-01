# Sovereign AP2 Reference Implementation: Phase 1 - Core Cryptographic Foundation

*Version: 0.2.0-alpha.1*
*Type: Implementation Specification*
*Status: DRAFT*
*Based on: [Sovereign AP2 Schemas v0.2](sovereign_ap2_schemas_v02.md)*

> [!NOTE]
> This is the **Phase 1 implementation** focusing on the P0 cryptographic foundations from the v0.2 specification.

---

## 1. Repository Structure

```
sovereign-ap2-reference/
├── packages/
│   ├── core-schemas/          # TypeScript interfaces and validation
│   ├── crypto-primitives/     # Cryptographic implementations
│   ├── mandate-engine/        # DelegationMandate creation/validation
│   ├── receipt-chain/         # Receipt chaining implementation
│   └── policy-language/       # Verifiable policy engine
├── examples/
│   ├── basic-mandate/         # Simple mandate example
│   ├── receipt-chain-demo/    # Receipt chaining demo
│   └── policy-evaluation/     # Policy evaluation examples
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── adversarial/           # Adversarial test suite
└── tools/
    ├── validator-cli/         # CLI validation tool
    ├── migration-tool/        # v0.1 → v0.2 migration
    └── audit-generator/       # Sovereignty audit reports
```

---

## 2. Core TypeScript SDK - Phase 1

### `packages/core-schemas/src/mandate.ts`

```typescript
import { v7 as uuidv7 } from 'uuid';
import { canonicalize } from 'canonicalize';
import { sha256 } from '@noble/hashes/sha256';
import { ed25519 } from '@noble/curves/ed25519';

// Core immutable types
export interface BudgetConstraint {
  currency: string; // ISO 4217
  maxAmount: bigint; // Using bigint for precise currency handling
}

export interface CryptographicConstraints {
  allowedProofTypes: Array<'zk-snark' | 'zk-stark' | 'bbs+' | 'signature'>;
  privacyLevel: 'low' | 'medium' | 'high';
  revocable: boolean;
  minimumSignatureStrength: 128 | 192 | 256; // Security bits
}

export interface Intent {
  budget: BudgetConstraint;
  allowedVendors?: string[]; // Base64url encoded hashes
  vendorCategories?: string[];
  validFrom: string; // ISO 8601
  validUntil: string; // ISO 8601
  maxTransactions?: number;
  allowedJurisdictions?: string[]; // ISO 3166-2 codes
  cryptographic: CryptographicConstraints;
}

export interface RevocationChain {
  currentHash: string; // Base64url
  previousHash: string; // Base64url
  depth: number;
  timestamp: string;
}

export interface DelegationMandate {
  // Immutable Core
  mandateId: string;
  issuer: string; // DID format: did:key:z6Mk...
  
  intent: Intent;
  
  // Mutable State (stored separately)
  mutableState?: MutableState;
  
  proofs: {
    // Signature over HASH(immutableCore)
    signature: string; // JWS compact serialization
    
    // Optional ZK proof
    zkProof?: ZKProofOfAuthority;
    
    // Revocation chain
    revocationChain: RevocationChain;
  };
}

// Helper functions
export function createImmutableHash(mandate: DelegationMandate): string {
  const immutableCore = {
    mandateId: mandate.mandateId,
    issuer: mandate.issuer,
    intent: mandate.intent
  };
  
  const canonical = canonicalize(immutableCore);
  if (!canonical) {
    throw new Error('Failed to canonicalize immutable core');
  }
  
  const hash = sha256(new TextEncoder().encode(canonical));
  return Buffer.from(hash).toString('base64url');
}

export function validateMandateStructure(mandate: DelegationMandate): ValidationResult {
  const errors: string[] = [];
  
  // Validate UUID v7
  if (!mandate.mandateId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
    errors.push('Invalid UUID v7 format for mandateId');
  }
  
  // Validate DID format
  if (!mandate.issuer.startsWith('did:')) {
    errors.push('Issuer must be a valid DID');
  }
  
  // Validate dates
  const validFrom = new Date(mandate.intent.validFrom);
  const validUntil = new Date(mandate.intent.validUntil);
  if (validFrom >= validUntil) {
    errors.push('validFrom must be before validUntil');
  }
  
  // Validate currency
  if (!mandate.intent.budget.currency.match(/^[A-Z]{3}$/)) {
    errors.push('Invalid currency code');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

### `packages/crypto-primitives/src/signing.ts`

```typescript
import { ed25519 } from '@noble/curves/ed25519';
import { base64url } from 'multiformats/bases/base64';

export class SovereignSigner {
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;
  
  constructor(privateKey?: Uint8Array) {
    if (privateKey) {
      this.privateKey = privateKey;
      this.publicKey = ed25519.getPublicKey(privateKey);
    } else {
      // Generate new key pair
      this.privateKey = ed25519.utils.randomPrivateKey();
      this.publicKey = ed25519.getPublicKey(this.privateKey);
    }
  }
  
  // DID generation according to did:key specification
  getDid(): string {
    const multicodecPubKey = new Uint8Array(this.publicKey.length + 2);
    multicodecPubKey[0] = 0xed; // Ed25519 multicodec code
    multicodecPubKey[1] = 0x01;
    multicodecPubKey.set(this.publicKey, 2);
    
    const encoded = base64url.encode(multicodecPubKey);
    return `did:key:z${encoded}`;
  }
  
  async signImmutableCore(immutableCore: any): Promise<string> {
    // Create canonical hash
    const canonical = canonicalize(immutableCore);
    if (!canonical) {
      throw new Error('Failed to canonicalize');
    }
    
    const hash = sha256(new TextEncoder().encode(canonical));
    const signature = ed25519.sign(hash, this.privateKey);
    
    // Create JWS-like structure
    const header = {
      alg: 'EdDSA',
      typ: 'JWT',
      kid: this.getDid()
    };
    
    const payload = base64url.encode(immutableCore);
    const encodedHeader = base64url.encode(JSON.stringify(header));
    const encodedSignature = base64url.encode(signature);
    
    return `${encodedHeader}.${payload}.${encodedSignature}`;
  }
  
  async verifySignature(jws: string, publicKey: Uint8Array): Promise<boolean> {
    const [headerB64, payloadB64, signatureB64] = jws.split('.');
    
    // Reconstruct signed data
    const data = `${headerB64}.${payloadB64}`;
    const signature = base64url.decode(signatureB64);
    const dataBytes = new TextEncoder().encode(data);
    const hash = sha256(dataBytes);
    
    return ed25519.verify(signature, hash, publicKey);
  }
}
```

---

### `packages/crypto-primitives/src/revocation-chain.ts`

```typescript
import { sha256 } from '@noble/hashes/sha256';
import { base64url } from 'multiformats/bases/base64';

export class RevocationChain {
  private chain: Array<{ hash: string; timestamp: string }> = [];
  
  constructor(initialHash?: string) {
    if (initialHash) {
      this.chain.push({
        hash: initialHash,
        timestamp: new Date().toISOString()
      });
    } else {
      // Start with random seed
      const seed = crypto.getRandomValues(new Uint8Array(32));
      const initial = sha256(seed);
      this.chain.push({
        hash: base64url.encode(initial),
        timestamp: new Date().toISOString()
      });
    }
  }
  
  revoke(): string {
    const previous = this.chain[this.chain.length - 1];
    const revocationData = {
      previousHash: previous.hash,
      timestamp: new Date().toISOString(),
      action: 'revoke'
    };
    
    const canonical = canonicalize(revocationData);
    if (!canonical) {
      throw new Error('Failed to canonicalize revocation data');
    }
    
    const newHash = sha256(new TextEncoder().encode(canonical));
    const encodedHash = base64url.encode(newHash);
    
    this.chain.push({
      hash: encodedHash,
      timestamp: revocationData.timestamp
    });
    
    return encodedHash;
  }
  
  verifyChain(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];
      
      const revocationData = {
        previousHash: previous.hash,
        timestamp: current.timestamp,
        action: 'revoke'
      };
      
      const canonical = canonicalize(revocationData);
      if (!canonical) {
        return false;
      }
      
      const expectedHash = sha256(new TextEncoder().encode(canonical));
      const expectedHashB64 = base64url.encode(expectedHash);
      
      if (expectedHashB64 !== current.hash) {
        return false;
      }
    }
    
    return true;
  }
  
  getCurrentHash(): string {
    return this.chain[this.chain.length - 1].hash;
  }
  
  toJSON(): any {
    return {
      currentHash: this.getCurrentHash(),
      previousHash: this.chain.length > 1 
        ? this.chain[this.chain.length - 2].hash 
        : this.chain[0].hash,
      depth: this.chain.length,
      timestamp: this.chain[this.chain.length - 1].timestamp
    };
  }
}
```

---

### `packages/mandate-engine/src/mandate-builder.ts`

```typescript
import { DelegationMandate, createImmutableHash } from '@sovereign-ap2/core-schemas';
import { SovereignSigner } from '@sovereign-ap2/crypto-primitives';
import { RevocationChain } from '@sovereign-ap2/crypto-primitives';
import { v7 as uuidv7 } from 'uuid';

export class MandateBuilder {
  private signer: SovereignSigner;
  private revocationChain: RevocationChain;
  
  constructor(privateKey?: Uint8Array) {
    this.signer = new SovereignSigner(privateKey);
    this.revocationChain = new RevocationChain();
  }
  
  async createMandate(params: {
    budget: { currency: string; maxAmount: bigint };
    validFrom: string;
    validUntil: string;
    allowedVendors?: string[];
    vendorCategories?: string[];
    maxTransactions?: number;
    allowedJurisdictions?: string[];
    privacyLevel?: 'low' | 'medium' | 'high';
  }): Promise<DelegationMandate> {
    
    const mandateId = uuidv7();
    
    const intent = {
      budget: params.budget,
      allowedVendors: params.allowedVendors?.map(v => 
        base64url.encode(sha256(new TextEncoder().encode(v)))
      ),
      vendorCategories: params.vendorCategories,
      validFrom: params.validFrom,
      validUntil: params.validUntil,
      maxTransactions: params.maxTransactions,
      allowedJurisdictions: params.allowedJurisdictions,
      cryptographic: {
        allowedProofTypes: ['signature'], // Start with basic signatures
        privacyLevel: params.privacyLevel || 'medium',
        revocable: true,
        minimumSignatureStrength: 128
      }
    };
    
    const immutableCore = {
      mandateId,
      issuer: this.signer.getDid(),
      intent
    };
    
    const signature = await this.signer.signImmutableCore(immutableCore);
    
    const mandate: DelegationMandate = {
      ...immutableCore,
      proofs: {
        signature,
        revocationChain: this.revocationChain.toJSON()
      }
    };
    
    return mandate;
  }
  
  async revokeMandate(mandate: DelegationMandate): Promise<string> {
    const newHash = this.revocationChain.revoke();
    
    // Return the new revocation proof that needs to be distributed
    return JSON.stringify({
      mandateId: mandate.mandateId,
      newRevocationHash: newHash,
      timestamp: new Date().toISOString(),
      proof: await this.signer.signImmutableCore({
        action: 'revoke',
        mandateId: mandate.mandateId,
        newHash
      })
    });
  }
}
```

---

### `packages/receipt-chain/src/receipt-chain.ts`

```typescript
import { sha256 } from '@noble/hashes/sha256';
import { base64url } from 'multiformats/bases/base64';

export class ReceiptChain {
  private chain: Array<{
    receiptHash: string;
    receiptId: string;
    previousHash: string;
    timestamp: string;
  }> = [];
  
  addReceipt(receiptId: string, receiptData: any): string {
    const previousHash = this.chain.length > 0 
      ? this.chain[this.chain.length - 1].receiptHash 
      : null;
    
    const chainData = {
      receiptId,
      receiptDataHash: base64url.encode(sha256(canonicalize(receiptData))),
      previousHash,
      index: this.chain.length,
      timestamp: new Date().toISOString()
    };
    
    const receiptHash = base64url.encode(
      sha256(canonicalize(chainData))
    );
    
    this.chain.push({
      receiptHash,
      receiptId,
      previousHash: previousHash || receiptHash, // First receipt points to itself
      timestamp: chainData.timestamp
    });
    
    return receiptHash;
  }
  
  verifyReceipt(receiptId: string, receiptData: any): boolean {
    const receiptIndex = this.chain.findIndex(r => r.receiptId === receiptId);
    
    if (receiptIndex === -1) {
      return false;
    }
    
    const receipt = this.chain[receiptIndex];
    
    // Verify hash
    const chainData = {
      receiptId,
      receiptDataHash: base64url.encode(sha256(canonicalize(receiptData))),
      previousHash: receiptIndex > 0 
        ? this.chain[receiptIndex - 1].receiptHash 
        : receipt.receiptHash,
      index: receiptIndex,
      timestamp: receipt.timestamp
    };
    
    const expectedHash = base64url.encode(
      sha256(canonicalize(chainData))
    );
    
    if (expectedHash !== receipt.receiptHash) {
      return false;
    }
    
    // Verify chain continuity
    if (receiptIndex > 0) {
      if (receipt.previousHash !== this.chain[receiptIndex - 1].receiptHash) {
        return false;
      }
    }
    
    return true;
  }
  
  getChainProof(): {
    rootHash: string;
    chainLength: number;
    merkleProof?: any;
  } {
    if (this.chain.length === 0) {
      throw new Error('Chain is empty');
    }
    
    // Simple approach: root hash is hash of all receipt hashes
    const allHashes = this.chain.map(r => r.receiptHash).join('');
    const rootHash = base64url.encode(
      sha256(new TextEncoder().encode(allHashes))
    );
    
    return {
      rootHash,
      chainLength: this.chain.length
    };
  }
}
```

---

## 3. Example Usage

### `examples/basic-mandate/index.ts`

```typescript
import { MandateBuilder } from '@sovereign-ap2/mandate-engine';
import { ReceiptChain } from '@sovereign-ap2/receipt-chain';

async function demo() {
  console.log('=== Sovereign AP2 v0.2 Demo ===\n');
  
  // 1. Create a mandate
  console.log('1. Creating delegation mandate...');
  const builder = new MandateBuilder();
  
  const mandate = await builder.createMandate({
    budget: {
      currency: 'USD',
      maxAmount: BigInt(50000) // $500.00 in cents
    },
    validFrom: '2025-04-01T00:00:00Z',
    validUntil: '2025-04-30T23:59:59Z',
    allowedVendors: ['did:web:grocerystore.example.com'],
    vendorCategories: ['groceries'],
    maxTransactions: 20,
    allowedJurisdictions: ['US-CA']
  });
  
  console.log('Mandate created:', {
    id: mandate.mandateId,
    issuer: mandate.issuer,
    budget: `${mandate.intent.budget.currency} ${Number(mandate.intent.budget.maxAmount) / 100}`,
    validUntil: mandate.intent.validUntil
  });
  
  // 2. Create receipt chain
  console.log('\n2. Creating receipt chain...');
  const receiptChain = new ReceiptChain();
  
  const receipt1 = {
    transaction: {
      amount: 4250,
      currency: 'USD',
      timestamp: '2025-04-15T14:30:22Z',
      merchantId: 'did:web:grocerystore.example.com',
      orderId: 'ord_abc123'
    }
  };
  
  const receiptHash1 = receiptChain.addReceipt('receipt_001', receipt1);
  console.log('Receipt 1 added:', receiptHash1);
  
  const receipt2 = {
    transaction: {
      amount: 1899,
      currency: 'USD',
      timestamp: '2025-04-16T10:15:00Z',
      merchantId: 'did:web:grocerystore.example.com',
      orderId: 'ord_def456'
    }
  };
  
  const receiptHash2 = receiptChain.addReceipt('receipt_002', receipt2);
  console.log('Receipt 2 added:', receiptHash2);
  
  // 3. Verify chain integrity
  console.log('\n3. Verifying chain integrity...');
  const receipt1Valid = receiptChain.verifyReceipt('receipt_001', receipt1);
  const receipt2Valid = receiptChain.verifyReceipt('receipt_002', receipt2);
  
  console.log(`Receipt 1 valid: ${receipt1Valid}`);
  console.log(`Receipt 2 valid: ${receipt2Valid}`);
  
  // 4. Revoke mandate
  console.log('\n4. Revoking mandate...');
  const revocationProof = await builder.revokeMandate(mandate);
  console.log('Mandate revoked. Proof:', revocationProof.substring(0, 100) + '...');
  
  console.log('\n=== Demo Complete ===');
}

demo().catch(console.error);
```

---

## 4. Package Configuration

### `package.json`

```json
{
  "name": "@sovereign-ap2/core",
  "version": "0.2.0-alpha.1",
  "description": "Sovereign AP2 v0.2 Core Implementation",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "prepublishOnly": "npm run build && npm test"
  },
  "dependencies": {
    "@noble/curves": "^1.3.0",
    "@noble/hashes": "^1.3.3",
    "canonicalize": "^1.0.8",
    "multiformats": "^12.1.3",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "@types/jest": "^29.5.11",
    "typescript": "^5.3.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "eslint": "^8.55.0"
  },
  "keywords": [
    "sovereignty",
    "ap2",
    "agent",
    "payments",
    "cryptography",
    "zero-knowledge"
  ],
  "author": "Sovereign AP2 Working Group",
  "license": "Apache-2.0"
}
```

---

## 5. Test Suite - Phase 1

### `tests/unit/mandate.test.ts`

```typescript
import { MandateBuilder } from '@sovereign-ap2/mandate-engine';
import { SovereignSigner } from '@sovereign-ap2/crypto-primitives';

describe('DelegationMandate', () => {
  test('creates valid mandate structure', async () => {
    const builder = new MandateBuilder();
    const mandate = await builder.createMandate({
      budget: { currency: 'USD', maxAmount: BigInt(10000) },
      validFrom: '2025-01-01T00:00:00Z',
      validUntil: '2025-12-31T23:59:59Z'
    });
    
    expect(mandate.mandateId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(mandate.issuer).toMatch(/^did:key:z/);
    expect(mandate.intent.budget.currency).toBe('USD');
    expect(mandate.proofs.signature).toBeDefined();
  });
  
  test('signature verification', async () => {
    const signer = new SovereignSigner();
    const builder = new MandateBuilder();
    const mandate = await builder.createMandate({
      budget: { currency: 'EUR', maxAmount: BigInt(5000) },
      validFrom: '2025-01-01T00:00:00Z',
      validUntil: '2025-01-31T23:59:59Z'
    });
    
    // Extract public key from DID
    const did = mandate.issuer;
    const encodedKey = did.replace('did:key:z', '');
    const multicodecKey = base64url.decode(encodedKey);
    const publicKey = multicodecKey.slice(2); // Remove multicodec bytes
    
    const isValid = await signer.verifySignature(
      mandate.proofs.signature,
      publicKey
    );
    
    expect(isValid).toBe(true);
  });
  
  test('revocation chain works', async () => {
    const builder = new MandateBuilder();
    const mandate = await builder.createMandate({
      budget: { currency: 'USD', maxAmount: BigInt(10000) },
      validFrom: '2025-01-01T00:00:00Z',
      validUntil: '2025-01-31T23:59:59Z'
    });
    
    const initialHash = mandate.proofs.revocationChain.currentHash;
    const revocationProof = await builder.revokeMandate(mandate);
    
    // Parse revocation proof
    const revocation = JSON.parse(revocationProof);
    expect(revocation.mandateId).toBe(mandate.mandateId);
    expect(revocation.newRevocationHash).not.toBe(initialHash);
    expect(revocation.proof).toBeDefined();
  });
});
```

---

## 6. Implementation Roadmap

### Phase 1.5 (Week 1-2)
- [ ] Complete core cryptographic implementation
- [ ] Add comprehensive test coverage (>90%)
- [ ] Create CLI validation tool
- [ ] Document security assumptions and threats

### Phase 2 (Week 3-4)
- [ ] Implement ZK proof primitives (basic Schnorr proofs first)
- [ ] Add receipt validation against mandates
- [ ] Create basic dispute protocol skeleton

### Phase 3 (Week 5-6)
- [ ] Implement provider portability interfaces
- [ ] Add consistency proof generation
- [ ] Create migration tools from v0.1

### Security Audit Points
1. **Cryptographic review** - External audit of signatures and hash chains
2. **Side-channel analysis** - Timing attacks, memory safety
3. **Formal verification** - TLA+ models of core protocols

---

## 7. Security Considerations

```typescript
// Critical security notes for implementers
export const SECURITY_NOTES = {
  keyManagement: [
    'Private keys should never leave secure enclaves',
    'Use hardware security modules (HSM) for production',
    'Implement key rotation policies'
  ],
  revocation: [
    'Revocation proofs must be broadcast to all verifiers',
    'Consider using a revocation registry for offline verification',
    'Monitor for revocation chain forks'
  ],
  privacy: [
    'Use different pseudonyms per vendor category',
    'Implement mandatory data deletion policies',
    'Consider differential privacy for aggregate statistics'
  ],
  implementation: [
    'Use constant-time cryptographic operations',
    'Validate all inputs before processing',
    'Implement rate limiting and DoS protection'
  ]
};
```

---

## Getting Started

```bash
# Clone repository
git clone https://github.com/sovereign-ap2/reference-implementation.git
cd sovereign-ap2-reference-implementation

# Install dependencies
npm install

# Build packages
npm run build

# Run tests
npm test

# Run demo
npm run demo
```

---

## Status

| Component | Status |
|---|---|
| Secure mandate creation with immutable cores | ✅ |
| Revocation chains for immediate revocation | ✅ |
| Receipt chaining for audit integrity | ✅ |
| Basic signature verification | ✅ |
| ZK proofs | ❌ Phase 2 |
| Dispute protocol | ❌ Phase 2 |
| Provider portability | ❌ Phase 3 |

**Next**: Begin implementation of ZK proof primitives using circom/snarkjs for basic range proofs of budget constraints.
