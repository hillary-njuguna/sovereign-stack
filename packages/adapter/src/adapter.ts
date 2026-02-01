/**
 * @sovereign-stack/adapter - Sovereign Adapter
 * 
 * The main adapter that wraps tool calls with verifiable mandates.
 */

import {
    DelegationMandate,
    InMemoryKeystore,
    EventLog,
    issueReceipt,
    hashCanonical,
    ActorId
} from '@sovereign-stack/core';
import type {
    ToolCall,
    ToolResponse,
    ToolExecutor,
    SovereignResult,
    SovereignAdapterConfig,
    AdapterExecuteOptions,
    TauGate,
    Mirror,
    AdapterEventType,
    AdapterEventHandler
} from './types.js';
import { DefaultTauGate, BudgetAwareTauGate } from './tau-gate.js';
import { InMemoryMirror } from './mirror.js';

/**
 * Sovereign Adapter - wraps any tool executor with mandate verification
 * 
 * Flow:
 * 1. Receive tool call + mandate
 * 2. Mirror: Capture request
 * 3. τ-Gate: Verify mandate allows this action
 * 4. Execute: Call underlying tool
 * 5. Mirror: Capture response
 * 6. Receipt: Issue cryptographic receipt
 * 7. Return: Wrapped result with receipt
 */
export class SovereignAdapter<TInput = unknown, TOutput = unknown> {
    private gate: TauGate;
    private mirror: Mirror;
    private keystore: InMemoryKeystore;
    private eventLog: EventLog;
    private handlers: Map<AdapterEventType, AdapterEventHandler[]> = new Map();

    constructor(
        private executor: ToolExecutor<TInput, TOutput>,
        private config: SovereignAdapterConfig,
        options?: {
            keystore?: InMemoryKeystore;
            eventLog?: EventLog;
            gate?: TauGate;
            mirror?: Mirror;
        }
    ) {
        this.keystore = options?.keystore ?? new InMemoryKeystore();
        this.eventLog = options?.eventLog ?? new EventLog();
        this.gate = options?.gate ?? new DefaultTauGate(this.keystore, this.eventLog);
        this.mirror = options?.mirror ?? new InMemoryMirror(config.actorId);
    }

    /**
     * Execute a tool call with sovereign guarantees
     */
    async execute(
        call: ToolCall<TInput>,
        mandate: DelegationMandate,
        options?: AdapterExecuteOptions
    ): Promise<SovereignResult<TOutput>> {
        const actorId = options?.actorOverride ?? this.config.actorId;

        // 1. Capture request
        this.emit('beforeVerify', { call, mandate });
        const mirrorEntry = await this.mirror.captureRequest(call);

        // 2. Verify mandate (unless skipped for testing)
        if (!options?.skipVerification) {
            const verification = await this.gate.verify(call, mandate);
            this.emit('afterVerify', { call, mandate, verification });

            if (!verification.allowed) {
                // Record verification failure
                await this.recordVerificationFailure(call, mandate, verification.reason!);

                this.emit('verificationFailed', { call, mandate, reason: verification.reason });

                if (this.config.failClosed !== false) {
                    throw new SovereignVerificationError(
                        verification.reason || 'Mandate verification failed',
                        mandate,
                        call
                    );
                }
            }
        }

        // 3. Execute underlying tool
        this.emit('beforeExecute', { call, mandate, mirrorRef: mirrorEntry.id });
        let response: ToolResponse<TOutput>;

        try {
            response = await this.executor.execute(call);
        } catch (error) {
            // Record execution failure
            await this.recordExecutionFailure(call, mandate, error as Error);
            throw error;
        }

        this.emit('afterExecute', { call, mandate, response, mirrorRef: mirrorEntry.id });

        // 4. Capture response
        const finalMirror = await this.mirror.captureResponse(mirrorEntry.id, response);

        // 5. Issue receipt
        const signerKeyId = await this.keystore.ensureUserKey(actorId);
        const receipt = await issueReceipt({
            mandate_id: mandate.mandate_id,
            actor: actorId,
            action: call.name,
            request_hash: hashCanonical(call),
            response_hash: hashCanonical(response),
            provider_metadata: {
                ...response.metadata,
                ...options?.additionalMetadata
            },
            mirror_ref: mirrorEntry.id,
        }, this.keystore, signerKeyId);

        // 6. Record receipt event
        await this.eventLog.append({
            type: 'RECEIPT_ISSUED',
            payload: {
                receipt_id: receipt.receipt_id,
                mandate_id: mandate.mandate_id,
                action: call.name
            },
            signer: actorId,
        }, this.keystore);

        this.emit('receiptIssued', { receipt, mandate, call });

        // 7. If using budget-aware gate, record spending
        if (this.gate instanceof BudgetAwareTauGate) {
            const value = (call.params as Record<string, unknown>)?.value as number | undefined;
            if (value !== undefined) {
                this.gate.recordSpending(mandate.mandate_id, value);
            }
        }

        return {
            response,
            receipt,
            mirror: finalMirror
        };
    }

    /**
     * Create a wrapper function for a specific mandate
     */
    withMandate(mandate: DelegationMandate): (call: ToolCall<TInput>) => Promise<SovereignResult<TOutput>> {
        return (call) => this.execute(call, mandate);
    }

    /**
     * Register event handler
     */
    on(event: AdapterEventType, handler: AdapterEventHandler): void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event)!.push(handler);
    }

    /**
     * Remove event handler
     */
    off(event: AdapterEventType, handler: AdapterEventHandler): void {
        const handlers = this.handlers.get(event);
        if (handlers) {
            const idx = handlers.indexOf(handler);
            if (idx >= 0) handlers.splice(idx, 1);
        }
    }

    /**
     * Get the underlying keystore (for key management)
     */
    getKeystore(): InMemoryKeystore {
        return this.keystore;
    }

    /**
     * Get the event log (for audit)
     */
    getEventLog(): EventLog {
        return this.eventLog;
    }

    private emit(type: AdapterEventType, data: unknown): void {
        const handlers = this.handlers.get(type) || [];
        const event = { type, timestamp: new Date().toISOString(), data };
        for (const handler of handlers) {
            try {
                handler(event);
            } catch {
                // Silently ignore handler errors
            }
        }
    }

    private async recordVerificationFailure(
        call: ToolCall,
        mandate: DelegationMandate,
        reason: string
    ): Promise<void> {
        await this.eventLog.append({
            type: 'VERIFICATION_FAILED',
            payload: {
                mandate_id: mandate.mandate_id,
                action: call.name,
                reason
            },
            signer: this.config.actorId,
        }, this.keystore);
    }

    private async recordExecutionFailure(
        call: ToolCall,
        mandate: DelegationMandate,
        error: Error
    ): Promise<void> {
        await this.eventLog.append({
            type: 'EXECUTION_FAILED',
            payload: {
                mandate_id: mandate.mandate_id,
                action: call.name,
                error: error.message
            },
            signer: this.config.actorId,
        }, this.keystore);
    }
}

/**
 * Error thrown when mandate verification fails
 */
export class SovereignVerificationError extends Error {
    constructor(
        message: string,
        public mandate: DelegationMandate,
        public call: ToolCall
    ) {
        super(message);
        this.name = 'SovereignVerificationError';
    }
}

/**
 * Create a sovereign adapter with default configuration
 */
export function createSovereignAdapter<TInput = unknown, TOutput = unknown>(
    executor: ToolExecutor<TInput, TOutput>,
    actorId: ActorId,
    options?: {
        keystore?: InMemoryKeystore;
        eventLog?: EventLog;
        budgetAware?: boolean;
    }
): SovereignAdapter<TInput, TOutput> {
    const keystore = options?.keystore ?? new InMemoryKeystore();
    const eventLog = options?.eventLog ?? new EventLog();

    const gate = options?.budgetAware
        ? new BudgetAwareTauGate(keystore, eventLog)
        : new DefaultTauGate(keystore, eventLog);

    return new SovereignAdapter(executor, { actorId }, {
        keystore,
        eventLog,
        gate
    });
}
