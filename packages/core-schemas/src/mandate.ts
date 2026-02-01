/**
 * Sovereign AP2 Core Schemas
 * TypeScript interfaces and validation for v0.2 specification
 */

// ============================================================================
// Core Types
// ============================================================================

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

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

export interface RevocationChainData {
    currentHash: string; // Base64url
    previousHash: string; // Base64url
    depth: number;
    timestamp: string;
}

export interface ZKProofOfAuthority {
    proofType: 'zk-snark' | 'zk-stark' | 'bbs+';
    circuitId: string;
    publicInputs: {
        mandateIdHash: string;
        budgetRemaining: number;
        validTimeRange: [string, string];
        vendorCategoryHash?: string;
    };
    proof: string;
    verification: {
        verificationKey: string;
        circuitHash: string;
        trustedSetupHash?: string;
    };
}

export interface MutableState {
    remainingAmount: bigint;
    transactionCount: number;
    lastUsed: string;
}

export interface DelegationMandate {
    // Immutable Core
    mandateId: string;
    issuer: string; // DID format: did:key:z6Mk...

    intent: Intent;

    // Mutable State (stored separately)
    mutableState?: MutableState;

    proofs: {
        signature: string; // JWS compact serialization
        zkProof?: ZKProofOfAuthority;
        revocationChain: RevocationChainData;
    };
}

// ============================================================================
// Validation Functions
// ============================================================================

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const DID_PREFIX = 'did:';

export function validateMandateStructure(mandate: DelegationMandate): ValidationResult {
    const errors: string[] = [];

    // Validate UUID v7
    if (!UUID_V7_REGEX.test(mandate.mandateId)) {
        errors.push('Invalid UUID v7 format for mandateId');
    }

    // Validate DID format
    if (!mandate.issuer.startsWith(DID_PREFIX)) {
        errors.push('Issuer must be a valid DID');
    }

    // Validate dates
    const validFrom = new Date(mandate.intent.validFrom);
    const validUntil = new Date(mandate.intent.validUntil);

    if (isNaN(validFrom.getTime())) {
        errors.push('Invalid validFrom date format');
    }
    if (isNaN(validUntil.getTime())) {
        errors.push('Invalid validUntil date format');
    }
    if (validFrom >= validUntil) {
        errors.push('validFrom must be before validUntil');
    }

    // Validate currency
    if (!CURRENCY_REGEX.test(mandate.intent.budget.currency)) {
        errors.push('Invalid currency code (must be ISO 4217)');
    }

    // Validate budget
    if (mandate.intent.budget.maxAmount <= 0n) {
        errors.push('maxAmount must be positive');
    }

    // Validate cryptographic constraints
    if (mandate.intent.cryptographic.allowedProofTypes.length === 0) {
        errors.push('At least one proof type must be allowed');
    }

    // Validate revocation chain
    if (!mandate.proofs.revocationChain.currentHash) {
        errors.push('Revocation chain must have a current hash');
    }
    if (mandate.proofs.revocationChain.depth < 1) {
        errors.push('Revocation chain depth must be at least 1');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export function isMandateExpired(mandate: DelegationMandate): boolean {
    const now = new Date();
    const validUntil = new Date(mandate.intent.validUntil);
    return now > validUntil;
}

export function isMandateActive(mandate: DelegationMandate): boolean {
    const now = new Date();
    const validFrom = new Date(mandate.intent.validFrom);
    const validUntil = new Date(mandate.intent.validUntil);
    return now >= validFrom && now <= validUntil;
}
