/**
 * @sovereign-stack/core - EventLog
 * 
 * Append-only event log with hash chaining for integrity verification.
 */

import canonicalize from 'canonicalize';
import type { CanonicalEvent, EventId, ActorId } from '../types.js';
import { hashCanonical } from '../types.js';
import { InMemoryKeystore } from '../keystore/index.js';

export interface EventFilter {
    type?: string;
    signer?: ActorId;
    limit?: number;
    since?: string;
}

export interface ChainVerificationResult {
    valid: boolean;
    errors: string[];
    eventsVerified: number;
}

export class EventLog {
    private events: CanonicalEvent[] = [];

    /**
     * Append a new event to the log
     */
    async append(
        event: Omit<CanonicalEvent, 'id' | 'timestamp' | 'signature' | 'prev_hash'> & { type: string; payload: unknown; signer: ActorId },
        keystore: InMemoryKeystore
    ): Promise<EventId> {
        const prev_hash = this.events.length > 0
            ? hashCanonical(this.events[this.events.length - 1])
            : undefined;

        const fullEvent: CanonicalEvent = {
            ...event,
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            timestamp: new Date().toISOString(),
            prev_hash,
            signature: '',
        };

        // Sign the event (excluding signature field)
        const { signature: _, ...toSign } = fullEvent;
        const canonical = canonicalize(toSign);
        if (!canonical) {
            throw new Error('Failed to canonicalize event');
        }

        const digest = new TextEncoder().encode(canonical);
        const keyId = `ed25519:${event.signer}`;
        fullEvent.signature = await keystore.sign(digest, keyId);

        this.events.push(fullEvent);
        return fullEvent.id;
    }

    /**
     * Query events by filter
     */
    query(filter: EventFilter = {}): CanonicalEvent[] {
        let result = [...this.events];

        if (filter.type) {
            result = result.filter(evt => evt.type === filter.type);
        }
        if (filter.signer) {
            result = result.filter(evt => evt.signer === filter.signer);
        }
        if (filter.since) {
            const sinceDate = new Date(filter.since);
            result = result.filter(evt => new Date(evt.timestamp) >= sinceDate);
        }
        if (filter.limit) {
            result = result.slice(0, filter.limit);
        }

        return result;
    }

    /**
     * Get the latest event
     */
    getLatest(): CanonicalEvent | undefined {
        return this.events[this.events.length - 1];
    }

    /**
     * Get event by ID
     */
    getById(eventId: EventId): CanonicalEvent | undefined {
        return this.events.find(evt => evt.id === eventId);
    }

    /**
     * Verify the integrity of the entire chain
     */
    async verifyChain(keystore: InMemoryKeystore): Promise<ChainVerificationResult> {
        const errors: string[] = [];

        for (let i = 0; i < this.events.length; i++) {
            const evt = this.events[i];

            // Verify hash chain continuity
            if (i > 0) {
                const expectedPrevHash = hashCanonical(this.events[i - 1]);
                if (evt.prev_hash !== expectedPrevHash) {
                    errors.push(`Event ${evt.id}: Hash chain broken at index ${i}`);
                }
            }

            // Verify signature
            const { signature, ...toVerify } = evt;
            const canonical = canonicalize(toVerify);
            if (!canonical) {
                errors.push(`Event ${evt.id}: Failed to canonicalize`);
                continue;
            }

            const digest = new TextEncoder().encode(canonical);
            const keyId = `ed25519:${evt.signer}`;
            const publicKey = keystore.getPublicKey(keyId);

            if (!publicKey) {
                errors.push(`Event ${evt.id}: No public key for signer ${evt.signer}`);
                continue;
            }

            const sigValid = await keystore.verify(signature, digest, publicKey);
            if (!sigValid) {
                errors.push(`Event ${evt.id}: Invalid signature`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            eventsVerified: this.events.length
        };
    }

    /**
     * Check if a mandate has been revoked
     */
    isMandateRevoked(mandateId: string): boolean {
        return this.events.some(
            evt => evt.type === 'MANDATE_REVOKE' &&
                (evt.payload as { mandate_id?: string })?.mandate_id === mandateId
        );
    }

    /**
     * Get chain length
     */
    get length(): number {
        return this.events.length;
    }

    /**
     * Export all events (for persistence)
     */
    export(): CanonicalEvent[] {
        return [...this.events];
    }

    /**
     * Import events (for hydration from storage)
     */
    import(events: CanonicalEvent[]): void {
        this.events = [...events];
    }
}
