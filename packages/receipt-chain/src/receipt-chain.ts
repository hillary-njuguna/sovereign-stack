/**
 * Receipt Chain
 * Cryptographic chaining of settlement receipts for audit integrity
 */

import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';

// Base64url encoding utility
function base64urlEncode(bytes: Uint8Array): string {
    const base64 = Buffer.from(bytes).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface ChainedReceipt {
    receiptHash: string;
    receiptId: string;
    previousHash: string;
    timestamp: string;
    index: number;
}

export interface ReceiptChainProof {
    rootHash: string;
    chainLength: number;
    firstReceiptHash: string;
    lastReceiptHash: string;
}

export class ReceiptChain {
    private chain: ChainedReceipt[] = [];

    /**
     * Add a receipt to the chain
     * @returns The hash of the added receipt
     */
    addReceipt(receiptId: string, receiptData: unknown): string {
        const previousHash = this.chain.length > 0
            ? this.chain[this.chain.length - 1].receiptHash
            : null;

        const receiptDataStr = canonicalize(receiptData);
        if (!receiptDataStr) {
            throw new Error('Failed to canonicalize receipt data');
        }

        const chainData = {
            receiptId,
            receiptDataHash: base64urlEncode(sha256(new TextEncoder().encode(receiptDataStr))),
            previousHash,
            index: this.chain.length,
            timestamp: new Date().toISOString()
        };

        const chainDataStr = canonicalize(chainData);
        if (!chainDataStr) {
            throw new Error('Failed to canonicalize chain data');
        }

        const receiptHash = base64urlEncode(
            sha256(new TextEncoder().encode(chainDataStr))
        );

        this.chain.push({
            receiptHash,
            receiptId,
            previousHash: previousHash ?? receiptHash, // First receipt points to itself
            timestamp: chainData.timestamp,
            index: this.chain.length
        });

        return receiptHash;
    }

    /**
     * Verify a receipt's integrity within the chain
     */
    verifyReceipt(receiptId: string, receiptData: unknown): boolean {
        const receiptIndex = this.chain.findIndex(r => r.receiptId === receiptId);

        if (receiptIndex === -1) {
            return false;
        }

        const receipt = this.chain[receiptIndex];

        const receiptDataStr = canonicalize(receiptData);
        if (!receiptDataStr) {
            return false;
        }

        // Reconstruct chain data
        const chainData = {
            receiptId,
            receiptDataHash: base64urlEncode(sha256(new TextEncoder().encode(receiptDataStr))),
            previousHash: receiptIndex > 0
                ? this.chain[receiptIndex - 1].receiptHash
                : receipt.receiptHash,
            index: receiptIndex,
            timestamp: receipt.timestamp
        };

        const chainDataStr = canonicalize(chainData);
        if (!chainDataStr) {
            return false;
        }

        const expectedHash = base64urlEncode(
            sha256(new TextEncoder().encode(chainDataStr))
        );

        if (expectedHash !== receipt.receiptHash) {
            return false;
        }

        // Verify chain continuity
        if (receiptIndex > 0) {
            if (receipt.previousHash !== this.chain[receiptIndex - 1].receiptHash) {
                return false;
            }
        }

        return true;
    }

    /**
     * Verify the entire chain's integrity
     */
    verifyChain(): boolean {
        for (let i = 1; i < this.chain.length; i++) {
            const current = this.chain[i];
            const previous = this.chain[i - 1];

            if (current.previousHash !== previous.receiptHash) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get proof of the entire chain
     */
    getChainProof(): ReceiptChainProof {
        if (this.chain.length === 0) {
            throw new Error('Chain is empty');
        }

        // Root hash is hash of all receipt hashes concatenated
        const allHashes = this.chain.map(r => r.receiptHash).join('');
        const rootHash = base64urlEncode(
            sha256(new TextEncoder().encode(allHashes))
        );

        return {
            rootHash,
            chainLength: this.chain.length,
            firstReceiptHash: this.chain[0].receiptHash,
            lastReceiptHash: this.chain[this.chain.length - 1].receiptHash
        };
    }

    /**
     * Get receipt hash by ID
     */
    getReceiptHash(receiptId: string): string | undefined {
        return this.chain.find(r => r.receiptId === receiptId)?.receiptHash;
    }

    /**
     * Get chain length
     */
    getLength(): number {
        return this.chain.length;
    }

    /**
     * Export chain for storage
     */
    toJSON(): ChainedReceipt[] {
        return [...this.chain];
    }
}
