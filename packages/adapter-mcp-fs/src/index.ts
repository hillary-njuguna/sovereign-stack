/**
 * @sovereign-stack/adapter-mcp-fs - Main Adapter
 * 
 * The brutal enforcer: No mandate, no execution.
 * This adapter proves the sovereignty kernel can govern external systems.
 */

import { v7 as uuidv7 } from 'uuid';
import {
    EventLog,
    InMemoryKeystore,
    verifyMandate,
    issueReceipt,
    hashCanonical,
    type DelegationMandate,
    type MirrorEntry,
    type ActorId
} from '@sovereign-stack/core';
import { MCPFSClient } from './mcp-client.js';
import type {
    SovereignAdapter,
    Proposal,
    ExecutionResult,
    ToolAction,
    AdapterContext
} from './types.js';

// ============================================================================
// Simple in-memory Mirror for Phase 1
// ============================================================================

class SimpleMirror {
    private entries: Map<string, MirrorEntry> = new Map();

    async captureRequest(params: {
        agentId: ActorId;
        prompt: string;
        providerMetadata: Record<string, unknown>;
    }): Promise<{ id: string; request_hash: string }> {
        const id = `mirror_${uuidv7()}`;
        const request_hash = hashCanonical(params);
        const entry: MirrorEntry = {
            id,
            agentId: params.agentId,
            prompt: params.prompt,
            request_hash,
            timestamp: new Date().toISOString(),
            provider_metadata: params.providerMetadata
        };
        this.entries.set(id, entry);
        return { id, request_hash };
    }

    getEntry(id: string): MirrorEntry | undefined {
        return this.entries.get(id);
    }
}

// ============================================================================
// Sovereignty Predicate
// ============================================================================

function isMandateRevoked(mandateId: string, eventLog: EventLog): boolean {
    const events = eventLog.query({ type: 'MANDATE_REVOKE' });
    return events.some(evt =>
        (evt.payload as { mandate_id?: string })?.mandate_id === mandateId
    );
}

// ============================================================================
// Main Adapter Implementation
// ============================================================================

export class MCPFSAdapter implements SovereignAdapter {
    private proposals: Map<string, Proposal> = new Map();
    private mcpClient: MCPFSClient;
    private eventLog: EventLog;
    private mirror: SimpleMirror;
    private keystore: InMemoryKeystore;

    constructor(options?: {
        mcpClient?: MCPFSClient;
        eventLog?: EventLog;
        keystore?: InMemoryKeystore;
    }) {
        this.mcpClient = options?.mcpClient ?? new MCPFSClient();
        this.eventLog = options?.eventLog ?? new EventLog();
        this.keystore = options?.keystore ?? new InMemoryKeystore();
        this.mirror = new SimpleMirror();
    }

    /**
     * Propose an action for ratification.
     * Creates a SUGGESTION event - execution is NOT permitted until commit().
     */
    async propose(action: ToolAction, context: AdapterContext): Promise<Proposal> {
        // Ensure agent has a key for signing
        await this.keystore.ensureUserKey(context.agentId);

        // 1. Capture in mirror (immutable record)
        const mirrorEntry = await this.mirror.captureRequest({
            agentId: context.agentId,
            prompt: JSON.stringify(action),
            providerMetadata: {
                adapter: 'mcp-fs',
                version: '0.1.0',
                tool: action.tool
            }
        });

        // 2. Create SUGGESTION event (pending user approval)
        const suggestionEventId = await this.eventLog.append({
            type: 'SUGGESTION',
            payload: {
                mirrorRef: mirrorEntry.id,
                agentId: context.agentId,
                proposedAction: action,
                estimatedCost: 0 // No cost for FS operations
            },
            signer: context.agentId
        }, this.keystore);

        // 3. Create proposal
        const proposal: Proposal = {
            id: `proposal_${uuidv7()}`,
            action,
            mirrorRef: mirrorEntry.id,
            eventId: suggestionEventId,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        this.proposals.set(proposal.id, proposal);
        return proposal;
    }

    /**
     * Commit a proposal with a valid mandate.
     * 
     * === SOVEREIGNTY ENFORCEMENT CHECKPOINT ===
     * 
     * Execution ONLY proceeds if:
     * 1. Mandate signature is cryptographically valid
     * 2. Mandate is NOT revoked
     * 3. Action is within mandate scope
     * 
     * Otherwise: rejection. No exceptions.
     */
    async commit(proposalId: string, mandate: DelegationMandate): Promise<ExecutionResult> {
        // 1. Retrieve proposal
        const proposal = this.proposals.get(proposalId);
        if (!proposal) {
            throw new Error('PROPOSAL_NOT_FOUND');
        }

        if (proposal.status !== 'pending') {
            throw new Error(`PROPOSAL_${proposal.status.toUpperCase()}: Cannot commit`);
        }

        // === ENFORCEMENT CHECKPOINT 1: Verify mandate signature ===
        const mandateValid = await verifyMandate(mandate, this.keystore, this.eventLog);
        if (!mandateValid.valid) {
            proposal.status = 'rejected';
            await this.recordRejection(proposal, 'INVALID_MANDATE', mandateValid.errors);
            throw new Error(`INVALID_MANDATE: ${mandateValid.errors.join(', ')}`);
        }

        // === ENFORCEMENT CHECKPOINT 2: Check revocation status ===
        const revoked = isMandateRevoked(mandate.mandate_id, this.eventLog);
        if (revoked) {
            proposal.status = 'rejected';
            await this.recordRejection(proposal, 'REVOKED_MANDATE', ['Authority no longer valid']);
            throw new Error('REVOKED_MANDATE: Authority no longer valid');
        }

        // === ENFORCEMENT CHECKPOINT 3: Validate scope ===
        if (!this.isActionInScope(proposal.action.tool, mandate)) {
            proposal.status = 'rejected';
            await this.recordRejection(proposal, 'SCOPE_VIOLATION',
                [`Action '${proposal.action.tool}' not permitted by mandate`]);
            throw new Error('SCOPE_VIOLATION: Action not permitted by mandate');
        }

        // === ALL CHECKS PASSED - EXECUTE ===

        // 4. Record COMMITTED event before execution
        await this.eventLog.append({
            type: 'COMMITTED',
            payload: {
                proposalId: proposal.id,
                mandateId: mandate.mandate_id,
                action: proposal.action.tool
            },
            signer: mandate.delegate
        }, this.keystore);

        // 5. Execute the tool
        const output = await this.mcpClient.callTool(
            proposal.action.tool,
            proposal.action.arguments
        );

        // 6. Create verifiable receipt
        const signerKeyId = await this.keystore.ensureUserKey(mandate.issuer);
        const receipt = await issueReceipt({
            mandate_id: mandate.mandate_id,
            actor: 'adapter:mcp-fs',
            action: proposal.action.tool,
            request_hash: proposal.mirrorRef,
            response_hash: hashCanonical(output),
            mirror_ref: proposal.mirrorRef,
            provider_metadata: {
                attested_by: mandate.issuer,
                adapter_version: '0.1.0'
            }
        }, this.keystore, signerKeyId);

        // 7. Record RECEIPT_ISSUED event
        await this.eventLog.append({
            type: 'RECEIPT_ISSUED',
            payload: {
                receiptId: receipt.receipt_id,
                mandateId: mandate.mandate_id,
                proposalId: proposal.id
            },
            signer: mandate.issuer
        }, this.keystore);

        // 8. Update proposal status
        proposal.status = 'committed';

        return { output, receipt };
    }

    /**
     * Get a proposal by ID
     */
    getProposal(proposalId: string): Proposal | null {
        return this.proposals.get(proposalId) || null;
    }

    /**
     * Get all proposals
     */
    getProposals(): Proposal[] {
        return Array.from(this.proposals.values());
    }

    /**
     * Expose event log for testing/inspection
     */
    getEventLog(): EventLog {
        return this.eventLog;
    }

    /**
     * Expose keystore for testing/key management
     */
    getKeystore(): InMemoryKeystore {
        return this.keystore;
    }

    // ============================================================================
    // Private Helpers
    // ============================================================================

    private isActionInScope(action: string, mandate: DelegationMandate): boolean {
        return mandate.scope.actions.some(allowed =>
            allowed === '*' ||
            allowed === action ||
            (allowed.endsWith(':*') && action.startsWith(allowed.slice(0, -1)))
        );
    }

    private async recordRejection(
        proposal: Proposal,
        reason: string,
        details: string[]
    ): Promise<void> {
        await this.eventLog.append({
            type: 'PROPOSAL_REJECTED',
            payload: {
                proposalId: proposal.id,
                reason,
                details
            },
            signer: 'adapter:mcp-fs'
        }, this.keystore);
    }
}

// ============================================================================
// Exports
// ============================================================================

export { MCPFSClient } from './mcp-client.js';
export type { MCPTool } from './mcp-client.js';
export type {
    ToolAction,
    AdapterContext,
    Proposal,
    ExecutionResult,
    SovereignAdapter
} from './types.js';
