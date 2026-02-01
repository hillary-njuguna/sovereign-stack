/**
 * @sovereign-stack/core
 * 
 * Canonical primitives for sovereign mandates, events, and receipts.
 */

// Types
export type {
    KeyId,
    ActorId,
    EventId,
    MandateId,
    MandateScope,
    MandateValidity,
    DelegationMandate,
    CanonicalEvent,
    EventType,
    MirrorEntry,
    ExecutionReceipt,
    ValidationResult,
} from './types.js';

export {
    hashCanonical,
    isValidActorId,
    isValidMandateId,
} from './types.js';

// Keystore
export { InMemoryKeystore } from './keystore/index.js';
export type { KeyPair } from './keystore/index.js';

// Mandate
export {
    createMandate,
    canonicalizeMandate,
    signMandate,
    verifyMandate,
    revokeMandate,
    isActionAllowed,
    isResourceAllowed,
    isWithinBudget,
} from './mandate/index.js';
export type { CreateMandateParams, RevokeResult } from './mandate/index.js';

// Event Log
export { EventLog } from './event-log/index.js';
export type { EventFilter, ChainVerificationResult } from './event-log/index.js';

// Receipt
export {
    issueReceipt,
    verifyReceipt,
    ReceiptChain,
} from './receipt/index.js';
export type { IssueReceiptParams } from './receipt/index.js';
