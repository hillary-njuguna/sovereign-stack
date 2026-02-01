/**
 * @sovereign-stack/core - InMemoryKeystore
 * 
 * Ed25519 key management for signing and verification.
 */

import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { KeyId, ActorId } from '../types.js';

export interface KeyPair {
    keyId: KeyId;
    publicKey: Uint8Array;
    /** Only present in-memory, never persisted */
    privateKey?: Uint8Array;
}

export class InMemoryKeystore {
    private keys: Map<KeyId, KeyPair> = new Map();

    /**
     * Generate or retrieve a key for an actor
     */
    async ensureUserKey(actorId: ActorId): Promise<KeyId> {
        const keyId: KeyId = `ed25519:${actorId}`;
        if (!this.keys.has(keyId)) {
            const privateKey = ed25519.utils.randomPrivateKey();
            const publicKey = ed25519.getPublicKey(privateKey);
            this.keys.set(keyId, { keyId, publicKey, privateKey });
        }
        return keyId;
    }

    /**
     * Sign a digest with the specified key
     */
    async sign(digest: Uint8Array, keyId: KeyId): Promise<string> {
        const keyPair = this.keys.get(keyId);
        if (!keyPair?.privateKey) {
            throw new Error(`Key not found or private key unavailable: ${keyId}`);
        }
        const signature = ed25519.sign(digest, keyPair.privateKey);
        return bytesToHex(signature);
    }

    /**
     * Verify a signature against a digest and public key
     */
    async verify(signature: string, digest: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
        try {
            const sigBytes = hexToBytes(signature);
            return ed25519.verify(sigBytes, digest, publicKey);
        } catch {
            return false;
        }
    }

    /**
     * Get public key for a keyId
     */
    getPublicKey(keyId: KeyId): Uint8Array | undefined {
        return this.keys.get(keyId)?.publicKey;
    }

    /**
     * Import an existing key pair
     */
    importKeyPair(keyId: KeyId, publicKey: Uint8Array, privateKey?: Uint8Array): void {
        this.keys.set(keyId, { keyId, publicKey, privateKey });
    }

    /**
     * Export public key as hex
     */
    exportPublicKeyHex(keyId: KeyId): string | undefined {
        const pk = this.getPublicKey(keyId);
        return pk ? bytesToHex(pk) : undefined;
    }
}
