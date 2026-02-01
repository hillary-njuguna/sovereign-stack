/**
 * @sovereign-stack/adapter-mcp-fs - Types
 * 
 * Adapter-specific interfaces for MCP FS sovereignty enforcement.
 */

import type { ActorId, DelegationMandate, ExecutionReceipt } from '@sovereign-stack/core';

export interface ToolAction {
    tool: string;
    arguments: Record<string, unknown>;
}

export interface AdapterContext {
    agentId: ActorId;
}

export interface Proposal {
    id: string;
    action: ToolAction;
    mirrorRef: string;
    eventId: string;
    status: 'pending' | 'committed' | 'rejected';
    createdAt: string;
}

export interface ExecutionResult {
    output: unknown;
    receipt: ExecutionReceipt;
}

export interface SovereignAdapter {
    propose(action: ToolAction, context: AdapterContext): Promise<Proposal>;
    commit(proposalId: string, mandate: DelegationMandate): Promise<ExecutionResult>;
    getProposal(proposalId: string): Proposal | null;
}
