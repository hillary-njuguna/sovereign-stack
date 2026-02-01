/**
 * @sovereign-stack/core - Mandate Lifecycle
 * 
 * Create, sign, verify, and revoke delegation mandates.
 */

import { v7 as uuidv7 } from 'uuid';
import canonicalize from 'canonicalize';
import type {
    DelegationMandate,
    MandateScope,
    MandateValidity,
    ActorId,
    ValidationResult
} from '../types.js';
import { InMemoryKeystore } from '../keystore/index.js';
import { EventLog } from '../event-log/index.js';

// ============================================================================
// Create
// ============================================================================

export interface CreateMandateParams {
    issuer: ActorId;
    delegate: ActorId;
    scope: MandateScope;
    validity: MandateValidity;
    constraints?: Record<string, unknown>;
}

/**
 * Create an unsigned mandate
 */
export function createMandate(params: CreateMandateParams): Omit<DelegationMandate, 'signature'> {
    const now = new Date().toISOString();
    return {
        mandate_id: uuidv7(),
        issuer: params.issuer,
        delegate: params.delegate,
        scope: params.scope,
        validity: params.validity,
        constraints: params.constraints,
        created_at: now,
        signature: '',
    };
}

// ============================================================================
// Canonicalize & Sign
// ============================================================================

/**
 * Get canonical form of mandate (for signing/verification)
 */
export function canonicalizeMandate(mandate: DelegationMandate): string {
    const { signature: _, ...toSign } = mandate;
    const canonical = canonicalize(toSign);
    if (!canonical) {
        throw new Error('Failed to canonicalize mandate');
    }
    return canonical;
}

/**
 * Sign a mandate
 */
export async function signMandate(
    mandate: Omit<DelegationMandate, 'signature'>,
    keystore: InMemoryKeystore,
    signerKeyId: string
): Promise<DelegationMandate> {
    const canonical = canonicalizeMandate(mandate as DelegationMandate);
    const digest = new TextEncoder().encode(canonical);
    const signature = await keystore.sign(digest, signerKeyId);
    return { ...mandate, signature };
}

// ============================================================================
// Verify
// ============================================================================

/**
 * Verify a mandate's signature and validity
 */
export async function verifyMandate(
    mandate: DelegationMandate,
    keystore: InMemoryKeystore,
    eventLog?: EventLog
): Promise<ValidationResult> {
    const errors: string[] = [];
    const now = new Date();

    // Check validity window
    if (mandate.validity.not_before) {
        const notBefore = new Date(mandate.validity.not_before);
        if (notBefore > now) {
            errors.push(`Mandate not yet valid (not_before: ${mandate.validity.not_before})`);
        }
    }

    if (mandate.validity.not_after) {
        const notAfter = new Date(mandate.validity.not_after);
        if (notAfter < now) {
            errors.push(`Mandate expired (not_after: ${mandate.validity.not_after})`);
        }
    }

    // Check revocation status
    if (eventLog && eventLog.isMandateRevoked(mandate.mandate_id)) {
        errors.push('Mandate has been revoked');
    }

    // Verify signature
    const keyId = `ed25519:${mandate.issuer}`;
    const publicKey = keystore.getPublicKey(keyId);
    if (!publicKey) {
        errors.push(`No public key found for issuer: ${mandate.issuer}`);
    } else {
        const canonical = canonicalizeMandate(mandate);
        const digest = new TextEncoder().encode(canonical);
        const sigValid = await keystore.verify(mandate.signature, digest, publicKey);
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
// Revoke
// ============================================================================

export interface RevokeResult {
    eventId: string;
    mandateId: string;
    revokedAt: string;
}

/**
 * Revoke a mandate by recording a revocation event
 */
export async function revokeMandate(
    mandateId: string,
    reason: string,
    revokedBy: ActorId,
    keystore: InMemoryKeystore,
    eventLog: EventLog
): Promise<RevokeResult> {
    const revokedAt = new Date().toISOString();

    const eventId = await eventLog.append({
        type: 'MANDATE_REVOKE',
        payload: {
            mandate_id: mandateId,
            reason,
            revoked_by: revokedBy,
            revoked_at: revokedAt
        },
        signer: revokedBy,
    }, keystore);

    return {
        eventId,
        mandateId,
        revokedAt
    };
}

// ============================================================================
// Scope Checking
// ============================================================================

/**
 * Check if an action is allowed by the mandate scope
 */
export function isActionAllowed(mandate: DelegationMandate, action: string): boolean {
    return mandate.scope.actions.some(allowed =>
        allowed === '*' || allowed === action ||
        (allowed.endsWith(':*') && action.startsWith(allowed.slice(0, -1)))
    );
}

/**
 * Check if a resource is allowed by the mandate scope
 */
export function isResourceAllowed(mandate: DelegationMandate, resource: string): boolean {
    return mandate.scope.resources.some(allowed =>
        allowed === '*' || allowed === resource ||
        (allowed.endsWith(':*') && resource.startsWith(allowed.slice(0, -1)))
    );
}

/**
 * Check if a value is within budget
 */
export function isWithinBudget(mandate: DelegationMandate, value: number): boolean {
    if (mandate.scope.max_value === undefined) return true;
    return value <= mandate.scope.max_value;
}
