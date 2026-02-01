/**
 * @sovereign-stack/adapter - Mirror Implementation
 * 
 * Captures request/response pairs for audit trail.
 */

import { hashCanonical, MirrorEntry, ActorId } from '@sovereign-stack/core';
import type { ToolCall, ToolResponse, Mirror } from './types.js';

/**
 * In-memory Mirror implementation
 */
export class InMemoryMirror implements Mirror {
    private entries: Map<string, MirrorEntry> = new Map();
    private counter = 0;

    constructor(private defaultAgentId: ActorId = 'agent:unknown') { }

    async captureRequest(call: ToolCall): Promise<MirrorEntry> {
        const id = `mirror_${Date.now()}_${++this.counter}`;

        const entry: MirrorEntry = {
            id,
            agentId: this.defaultAgentId,
            prompt: JSON.stringify(call),
            request_hash: hashCanonical(call),
            timestamp: new Date().toISOString(),
        };

        this.entries.set(id, entry);
        return entry;
    }

    async captureResponse(
        mirrorRef: string,
        response: ToolResponse
    ): Promise<MirrorEntry> {
        const entry = this.entries.get(mirrorRef);
        if (!entry) {
            throw new Error(`Mirror entry not found: ${mirrorRef}`);
        }

        const updated: MirrorEntry = {
            ...entry,
            response: JSON.stringify(response.data),
            response_hash: hashCanonical(response),
            provider_metadata: response.metadata,
        };

        this.entries.set(mirrorRef, updated);
        return updated;
    }

    /**
     * Get a mirror entry by ID
     */
    get(id: string): MirrorEntry | undefined {
        return this.entries.get(id);
    }

    /**
     * Get all entries
     */
    getAll(): MirrorEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Export for persistence
     */
    export(): MirrorEntry[] {
        return this.getAll();
    }

    /**
     * Import from storage
     */
    import(entries: MirrorEntry[]): void {
        for (const entry of entries) {
            this.entries.set(entry.id, entry);
        }
    }
}
