/**
 * @sovereign-stack/adapter - Types
 * 
 * Type definitions for the Sovereign Adapter pattern.
 */

import type {
    DelegationMandate,
    ExecutionReceipt,
    ActorId,
    MirrorEntry
} from '@sovereign-stack/core';

// ============================================================================
// Tool Protocol Abstraction
// ============================================================================

/**
 * Generic tool call interface (abstracts MCP, A2A, etc.)
 */
export interface ToolCall<T = unknown> {
    /** Tool/function identifier */
    name: string;
    /** Input parameters */
    params: T;
    /** Optional resource being accessed */
    resource?: string;
}

/**
 * Generic tool response
 */
export interface ToolResponse<T = unknown> {
    /** Response data */
    data: T;
    /** Provider metadata (tokens, latency, model, etc.) */
    metadata?: Record<string, unknown>;
}

/**
 * A tool executor (the underlying tool being wrapped)
 */
export interface ToolExecutor<TInput = unknown, TOutput = unknown> {
    /**
     * Execute the tool
     */
    execute(call: ToolCall<TInput>): Promise<ToolResponse<TOutput>>;
}

// ============================================================================
// Sovereign Adapter Interface
// ============================================================================

/**
 * Result of a sovereign-wrapped tool execution
 */
export interface SovereignResult<T = unknown> {
    /** The tool's response */
    response: ToolResponse<T>;
    /** Cryptographic receipt for the execution */
    receipt: ExecutionReceipt;
    /** Mirror entry that captured the request/response */
    mirror: MirrorEntry;
}

/**
 * Options for adapter execution
 */
export interface AdapterExecuteOptions {
    /** Override actor ID for receipt signing */
    actorOverride?: ActorId;
    /** Skip mandate verification (dangerous - for testing only) */
    skipVerification?: boolean;
    /** Additional metadata to include in receipt */
    additionalMetadata?: Record<string, unknown>;
}

/**
 * Adapter configuration
 */
export interface SovereignAdapterConfig {
    /** Actor ID for this adapter instance */
    actorId: ActorId;
    /** Whether to fail-closed on verification errors (default: true) */
    failClosed?: boolean;
    /** Log level */
    logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
}

// ============================================================================
// τ-Gate Types
// ============================================================================

/**
 * Result of τ-Gate verification
 */
export interface VerificationResult {
    allowed: boolean;
    reason?: string;
    mandate?: DelegationMandate;
    constraints?: Record<string, unknown>;
}

/**
 * τ-Gate interface - the verification checkpoint
 */
export interface TauGate {
    /**
     * Verify that a tool call is allowed under the given mandate
     */
    verify(
        call: ToolCall,
        mandate: DelegationMandate
    ): Promise<VerificationResult>;
}

// ============================================================================
// Mirror Types
// ============================================================================

/**
 * Mirror interface - captures request/response for audit
 */
export interface Mirror {
    /**
     * Capture a request before execution
     */
    captureRequest(call: ToolCall): Promise<MirrorEntry>;

    /**
     * Capture a response after execution
     */
    captureResponse(
        mirrorRef: string,
        response: ToolResponse
    ): Promise<MirrorEntry>;
}

// ============================================================================
// Adapter Events
// ============================================================================

export type AdapterEventType =
    | 'beforeVerify'
    | 'afterVerify'
    | 'beforeExecute'
    | 'afterExecute'
    | 'receiptIssued'
    | 'verificationFailed';

export interface AdapterEvent<T = unknown> {
    type: AdapterEventType;
    timestamp: string;
    data: T;
}

export type AdapterEventHandler<T = unknown> = (event: AdapterEvent<T>) => void;
