/**
 * @sovereign-stack/core - Receipt Module
 * 
 * Issue and verify execution receipts.
 */

import { v7 as uuidv7 } from 'uuid';
import canonicalize from 'canonicalize';
import type { ExecutionReceipt, ActorId, MandateId, ValidationResult } from '../types.js';
import { InMemoryKeystore } from '../keystore/index.js';

// ============================================================================
// Issue Receipt
// ============================================================================

export interface IssueReceiptParams {
    mandate_id?: MandateId;
    actor: ActorId;
    action: string;
    request_hash: string;
    response_hash?: string;
    provider_metadata?: Record<string, unknown>;
    mirror_ref: string;
}

/**
 * Issue a signed execution receipt
 */
export async function issueReceipt(
    params: IssueReceiptParams,
    keystore: InMemoryKeystore,
    signerKeyId: string
): Promise<ExecutionReceipt> {
    const receipt: ExecutionReceipt = {
        receipt_id: uuidv7(),
        mandate_id: params.mandate_id,
        actor: params.actor,
        action: params.action,
        request_hash: params.request_hash,
        response_hash: params.response_hash,
        provider_metadata: params.provider_metadata,
        timestamp: new Date().toISOString(),
        mirror_ref: params.mirror_ref,
        signature: '',
    };

    // Sign the receipt
    const { signature: _, ...toSign } = receipt;
    const canonical = canonicalize(toSign);
    if (!canonical) {
        throw new Error('Failed to canonicalize receipt');
    }

    const digest = new TextEncoder().encode(canonical);
    receipt.signature = await keystore.sign(digest, signerKeyId);

    return receipt;
}

// ============================================================================
// Verify Receipt
// ============================================================================

/**
 * Verify a receipt's signature
 */
export async function verifyReceipt(
    receipt: ExecutionReceipt,
    keystore: InMemoryKeystore
): Promise<ValidationResult> {
    const errors: string[] = [];

    const { signature, ...toVerify } = receipt;
    const canonical = canonicalize(toVerify);

    if (!canonical) {
        return {
            valid: false,
            errors: ['Failed to canonicalize receipt']
        };
    }

    const digest = new TextEncoder().encode(canonical);
    const keyId = `ed25519:${receipt.actor}`;
    const publicKey = keystore.getPublicKey(keyId);

    if (!publicKey) {
        errors.push(`No public key found for actor: ${receipt.actor}`);
    } else {
        const sigValid = await keystore.verify(signature, digest, publicKey);
        if (!sigValid) {
            errors.push('Invalid signature');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// ============================================================================
// Receipt Chain (simple implementation)
// ============================================================================

export class ReceiptChain {
    private receipts: ExecutionReceipt[] = [];

    add(receipt: ExecutionReceipt): void {
        this.receipts.push(receipt);
    }

    getByMandateId(mandateId: string): ExecutionReceipt[] {
        return this.receipts.filter(r => r.mandate_id === mandateId);
    }

    getByActor(actor: ActorId): ExecutionReceipt[] {
        return this.receipts.filter(r => r.actor === actor);
    }

    getAll(): ExecutionReceipt[] {
        return [...this.receipts];
    }

    get length(): number {
        return this.receipts.length;
    }
}
