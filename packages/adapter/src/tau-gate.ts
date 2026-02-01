/**
 * @sovereign-stack/adapter - τ-Gate Implementation
 * 
 * The verification checkpoint that validates mandates before tool execution.
 */

import {
    verifyMandate,
    isActionAllowed,
    isResourceAllowed,
    isWithinBudget,
    InMemoryKeystore,
    EventLog,
    DelegationMandate
} from '@sovereign-stack/core';
import type { ToolCall, TauGate, VerificationResult } from './types.js';

/**
 * Default τ-Gate implementation
 * 
 * Verifies:
 * 1. Mandate signature is valid
 * 2. Mandate is not revoked
 * 3. Mandate is within validity window
 * 4. Tool call action is within mandate scope
 * 5. Tool call resource is within mandate scope
 */
export class DefaultTauGate implements TauGate {
    constructor(
        private keystore: InMemoryKeystore,
        private eventLog: EventLog
    ) { }

    async verify(
        call: ToolCall,
        mandate: DelegationMandate
    ): Promise<VerificationResult> {
        const errors: string[] = [];

        // 1. Verify mandate signature and validity
        const mandateResult = await verifyMandate(mandate, this.keystore, this.eventLog);
        if (!mandateResult.valid) {
            return {
                allowed: false,
                reason: `Mandate verification failed: ${mandateResult.errors.join(', ')}`,
                mandate
            };
        }

        // 2. Check action scope
        const action = this.extractAction(call);
        if (!isActionAllowed(mandate, action)) {
            errors.push(`Action '${action}' not allowed by mandate scope`);
        }

        // 3. Check resource scope
        const resource = call.resource || this.extractResource(call);
        if (resource && !isResourceAllowed(mandate, resource)) {
            errors.push(`Resource '${resource}' not allowed by mandate scope`);
        }

        // 4. If there are constraint failures, return not allowed
        if (errors.length > 0) {
            return {
                allowed: false,
                reason: errors.join('; '),
                mandate,
                constraints: mandate.constraints
            };
        }

        return {
            allowed: true,
            mandate,
            constraints: mandate.constraints
        };
    }

    /**
     * Extract action from tool call
     * Default: use tool name prefixed with 'invoke:'
     */
    private extractAction(call: ToolCall): string {
        // Try to extract from tool name patterns
        if (call.name.includes(':')) {
            return call.name;
        }
        return `invoke:${call.name}`;
    }

    /**
     * Extract resource from tool call
     * Default: try to find in params
     */
    private extractResource(call: ToolCall): string | undefined {
        const params = call.params as Record<string, unknown>;
        return params?.resource as string | undefined;
    }
}

/**
 * Budget-aware τ-Gate that tracks spending
 */
export class BudgetAwareTauGate extends DefaultTauGate {
    private spentByMandate: Map<string, number> = new Map();

    async verify(
        call: ToolCall,
        mandate: DelegationMandate
    ): Promise<VerificationResult> {
        // First run standard verification
        const baseResult = await super.verify(call, mandate);
        if (!baseResult.allowed) {
            return baseResult;
        }

        // Check budget if value is specified
        const value = this.extractValue(call);
        if (value !== undefined && mandate.scope.max_value !== undefined) {
            const currentSpent = this.spentByMandate.get(mandate.mandate_id) || 0;
            const newTotal = currentSpent + value;

            if (!isWithinBudget(mandate, newTotal)) {
                return {
                    allowed: false,
                    reason: `Budget exceeded: would be ${newTotal} of ${mandate.scope.max_value} limit`,
                    mandate,
                    constraints: {
                        budgetLimit: mandate.scope.max_value,
                        currentSpent,
                        requestedValue: value
                    }
                };
            }
        }

        return baseResult;
    }

    /**
     * Record spending after successful execution
     */
    recordSpending(mandateId: string, value: number): void {
        const current = this.spentByMandate.get(mandateId) || 0;
        this.spentByMandate.set(mandateId, current + value);
    }

    /**
     * Get current spending for a mandate
     */
    getSpending(mandateId: string): number {
        return this.spentByMandate.get(mandateId) || 0;
    }

    /**
     * Reset spending (for testing)
     */
    resetSpending(mandateId?: string): void {
        if (mandateId) {
            this.spentByMandate.delete(mandateId);
        } else {
            this.spentByMandate.clear();
        }
    }

    private extractValue(call: ToolCall): number | undefined {
        const params = call.params as Record<string, unknown>;
        const value = params?.value ?? params?.amount ?? params?.cost;
        return typeof value === 'number' ? value : undefined;
    }
}
