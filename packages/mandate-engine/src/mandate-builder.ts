/**
 * Mandate Builder
 * Creates and manages DelegationMandates with cryptographic proofs
 */

import { v7 as uuidv7 } from 'uuid';
import { sha256 } from '@noble/hashes/sha256';
import type {
    DelegationMandate,
    Intent,
    CryptographicConstraints,
    ValidationResult
} from '@sovereign-stack/core';
import { validateMandateStructure } from '@sovereign-stack/core';
import { SovereignSigner, RevocationChain } from '@sovereign-stack/crypto';

// Base64url encoding utility
function base64urlEncode(bytes: Uint8Array): string {
    const base64 = Buffer.from(bytes).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface CreateMandateParams {
    budget: { currency: string; maxAmount: bigint };
    validFrom: string;
    validUntil: string;
    allowedVendors?: string[];
    vendorCategories?: string[];
    maxTransactions?: number;
    allowedJurisdictions?: string[];
    privacyLevel?: 'low' | 'medium' | 'high';
}

export class MandateBuilder {
    private signer: SovereignSigner;
    private revocationChain: RevocationChain;

    constructor(privateKey?: Uint8Array) {
        this.signer = new SovereignSigner(privateKey);
        this.revocationChain = new RevocationChain();
    }

    /**
     * Get the DID of the issuer
     */
    getIssuerDid(): string {
        return this.signer.getDid();
    }

    /**
     * Create a new delegation mandate
     */
    async createMandate(params: CreateMandateParams): Promise<DelegationMandate> {
        const mandateId = uuidv7();

        // Hash vendor identifiers for privacy
        const hashedVendors = params.allowedVendors?.map(v => {
            const vendorBytes = new TextEncoder().encode(v);
            return base64urlEncode(sha256(vendorBytes));
        });

        const cryptographic: CryptographicConstraints = {
            allowedProofTypes: ['signature'],
            privacyLevel: params.privacyLevel ?? 'medium',
            revocable: true,
            minimumSignatureStrength: 128
        };

        const intent: Intent = {
            budget: params.budget,
            allowedVendors: hashedVendors,
            vendorCategories: params.vendorCategories,
            validFrom: params.validFrom,
            validUntil: params.validUntil,
            maxTransactions: params.maxTransactions,
            allowedJurisdictions: params.allowedJurisdictions,
            cryptographic
        };

        const immutableCore = {
            mandateId,
            issuer: this.signer.getDid(),
            intent
        };

        const signature = await this.signer.sign(immutableCore);

        const mandate: DelegationMandate = {
            ...immutableCore,
            proofs: {
                signature,
                revocationChain: this.revocationChain.toJSON()
            }
        };

        return mandate;
    }

    /**
     * Revoke a mandate
     */
    async revokeMandate(mandate: DelegationMandate): Promise<{
        mandateId: string;
        newRevocationHash: string;
        timestamp: string;
        proof: string;
    }> {
        const newHash = this.revocationChain.revoke();
        const timestamp = new Date().toISOString();

        const revocationProof = await this.signer.sign({
            action: 'revoke',
            mandateId: mandate.mandateId,
            newHash,
            timestamp
        });

        return {
            mandateId: mandate.mandateId,
            newRevocationHash: newHash,
            timestamp,
            proof: revocationProof
        };
    }

    /**
     * Check if a mandate's revocation hash is still valid
     */
    isMandateValid(mandate: DelegationMandate): boolean {
        return this.revocationChain.isValid(
            mandate.proofs.revocationChain.currentHash
        );
    }

    /**
     * Validate mandate structure
     */
    validateMandate(mandate: DelegationMandate): ValidationResult {
        return validateMandateStructure(mandate);
    }

    /**
     * Verify mandate signature
     */
    verifyMandateSignature(mandate: DelegationMandate): boolean {
        const publicKey = SovereignSigner.publicKeyFromDid(mandate.issuer);
        return SovereignSigner.verify(mandate.proofs.signature, publicKey);
    }
}
