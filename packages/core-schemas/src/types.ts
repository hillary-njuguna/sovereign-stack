/**
 * @sovereign-stack/core - Canonical Types
 * 
 * Core identity, mandate, event, and receipt types for the Sovereign Stack.
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import canonicalize from 'canonicalize';

// ============================================================================
// Identity Types
// ============================================================================

/** Key identifier format: 'ed25519:<hex_public_key>' */
export type KeyId = string;

/** Actor identifier format: 'user:<name>' or 'agent:<name>' or 'provider:<name>' */
export type ActorId = string;

/** Event identifier */
export type EventId = string;

/** Mandate identifier (UUID v7) */
export type MandateId = string;

// ============================================================================
// Mandate Types
// ============================================================================

export interface MandateScope {
    /** Allowed actions (e.g., 'invoke:model', 'payment:transfer') */
    actions: string[];
    /** Allowed resources (e.g., 'agent:1', 'merchant:*') */
    resources: string[];
    /** Optional budget cap in smallest currency unit */
    max_value?: number;
    /** Optional currency code */
    currency?: string;
}

export interface MandateValidity {
    /** ISO 8601 timestamp - mandate not valid before this time */
    not_before?: string;
    /** ISO 8601 timestamp - mandate expires after this time */
    not_after?: string;
}

export interface DelegationMandate {
    mandate_id: MandateId;
    issuer: ActorId;
    delegate: ActorId;
    scope: MandateScope;
    validity: MandateValidity;
    constraints?: Record<string, unknown>;
    created_at: string;
    /** Hex-encoded Ed25519 signature over canonical form */
    signature: string;
}

// ============================================================================
// Event Log Types
// ============================================================================

export interface CanonicalEvent {
    id: EventId;
    type: string;
    timestamp: string;
    payload: unknown;
    signer: ActorId;
    signature: string;
    /** Hash of previous event for chain integrity */
    prev_hash?: string;
}

export type EventType =
    | 'MANDATE_CREATE'
    | 'MANDATE_REVOKE'
    | 'REQUEST_CAPTURED'
    | 'RESPONSE_CAPTURED'
    | 'COMMITTED'
    | 'RECEIPT_ISSUED';

// ============================================================================
// Mirror Types (Request/Response Capture)
// ============================================================================

export interface MirrorEntry {
    id: string;
    agentId: ActorId;
    prompt: string;
    request_hash: string;
    response?: string;
    response_hash?: string;
    provider_metadata?: Record<string, unknown>;
    timestamp: string;
}

// ============================================================================
// Receipt Types
// ============================================================================

export interface ExecutionReceipt {
    receipt_id: string;
    mandate_id?: MandateId;
    actor: ActorId;
    action: string;
    request_hash: string;
    response_hash?: string;
    provider_metadata?: Record<string, unknown>;
    timestamp: string;
    signature: string;
    /** Reference to the MirrorEntry that captured this execution */
    mirror_ref: string;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compute deterministic hash of any JSON-serializable data
 */
export function hashCanonical(data: unknown): string {
    const canonical = canonicalize(data);
    if (!canonical) {
        throw new Error('Failed to canonicalize data for hashing');
    }
    const hash = sha256(new TextEncoder().encode(canonical));
    return bytesToHex(hash);
}

/**
 * Validate ActorId format
 */
export function isValidActorId(actorId: string): boolean {
    return /^(user|agent|provider):[a-zA-Z0-9_-]+$/.test(actorId);
}

/**
 * Validate MandateId format (UUID v7)
 */
export function isValidMandateId(mandateId: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mandateId);
}
