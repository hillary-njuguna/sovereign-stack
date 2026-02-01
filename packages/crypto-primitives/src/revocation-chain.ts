/**
 * Revocation Chain
 * Hash-chain based revocation for immediate credential invalidation
 */

import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';

// Base64url encoding utilities
function base64urlEncode(bytes: Uint8Array): string {
    const base64 = Buffer.from(bytes).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface ChainLink {
    hash: string;
    timestamp: string;
}

export interface RevocationChainData {
    currentHash: string;
    previousHash: string;
    depth: number;
    timestamp: string;
}

export class RevocationChain {
    private chain: ChainLink[] = [];

    constructor(initialHash?: string) {
        if (initialHash) {
            this.chain.push({
                hash: initialHash,
                timestamp: new Date().toISOString()
            });
        } else {
            // Start with random seed
            const seed = crypto.getRandomValues(new Uint8Array(32));
            const initial = sha256(seed);
            this.chain.push({
                hash: base64urlEncode(initial),
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Revoke the current chain state, producing a new hash
     */
    revoke(): string {
        const previous = this.chain[this.chain.length - 1];
        const revocationData = {
            previousHash: previous.hash,
            timestamp: new Date().toISOString(),
            action: 'revoke'
        };

        const canonical = canonicalize(revocationData);
        if (!canonical) {
            throw new Error('Failed to canonicalize revocation data');
        }

        const newHash = sha256(new TextEncoder().encode(canonical));
        const encodedHash = base64urlEncode(newHash);

        this.chain.push({
            hash: encodedHash,
            timestamp: revocationData.timestamp
        });

        return encodedHash;
    }

    /**
     * Verify the integrity of the entire chain
     */
    verifyChain(): boolean {
        for (let i = 1; i < this.chain.length; i++) {
            const current = this.chain[i];
            const previous = this.chain[i - 1];

            const revocationData = {
                previousHash: previous.hash,
                timestamp: current.timestamp,
                action: 'revoke'
            };

            const canonical = canonicalize(revocationData);
            if (!canonical) {
                return false;
            }

            const expectedHash = sha256(new TextEncoder().encode(canonical));
            const expectedHashB64 = base64urlEncode(expectedHash);

            if (expectedHashB64 !== current.hash) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get the current (latest) hash in the chain
     */
    getCurrentHash(): string {
        return this.chain[this.chain.length - 1].hash;
    }

    /**
     * Get chain depth (number of revocations + 1)
     */
    getDepth(): number {
        return this.chain.length;
    }

    /**
     * Check if a hash is currently valid (matches current head)
     */
    isValid(hash: string): boolean {
        return hash === this.getCurrentHash();
    }

    /**
     * Check if a hash was ever in the chain (now revoked)
     */
    wasRevoked(hash: string): boolean {
        const index = this.chain.findIndex(link => link.hash === hash);
        if (index === -1) return false;
        return index < this.chain.length - 1;
    }

    /**
     * Export chain state for storage/transmission
     */
    toJSON(): RevocationChainData {
        return {
            currentHash: this.getCurrentHash(),
            previousHash: this.chain.length > 1
                ? this.chain[this.chain.length - 2].hash
                : this.chain[0].hash,
            depth: this.chain.length,
            timestamp: this.chain[this.chain.length - 1].timestamp
        };
    }

    /**
     * Create from stored state (partial reconstruction)
     */
    static fromJSON(data: RevocationChainData): RevocationChain {
        const chain = new RevocationChain(data.previousHash);
        if (data.currentHash !== data.previousHash) {
            // There was at least one revocation
            chain.chain.push({
                hash: data.currentHash,
                timestamp: data.timestamp
            });
        }
        return chain;
    }
}
