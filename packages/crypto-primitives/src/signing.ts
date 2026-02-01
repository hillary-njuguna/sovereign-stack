/**
 * Sovereign Signer
 * Ed25519 signing with DID:key generation
 */

import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import canonicalize from 'canonicalize';

// Base64url encoding/decoding utilities
function base64urlEncode(bytes: Uint8Array): string {
    const base64 = Buffer.from(bytes).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    return new Uint8Array(Buffer.from(padded, 'base64'));
}

export class SovereignSigner {
    private privateKey: Uint8Array;
    private publicKey: Uint8Array;

    constructor(privateKey?: Uint8Array) {
        if (privateKey) {
            this.privateKey = privateKey;
            this.publicKey = ed25519.getPublicKey(privateKey);
        } else {
            // Generate new key pair
            this.privateKey = ed25519.utils.randomPrivateKey();
            this.publicKey = ed25519.getPublicKey(this.privateKey);
        }
    }

    /**
     * Generate DID:key according to did:key specification
     * @see https://w3c-ccg.github.io/did-method-key/
     */
    getDid(): string {
        // Multicodec prefix for Ed25519 public key: 0xed01
        const multicodecPubKey = new Uint8Array(this.publicKey.length + 2);
        multicodecPubKey[0] = 0xed;
        multicodecPubKey[1] = 0x01;
        multicodecPubKey.set(this.publicKey, 2);

        // Base58btc encoding (simplified - using base64url for now)
        const encoded = base64urlEncode(multicodecPubKey);
        return `did:key:z${encoded}`;
    }

    /**
     * Get public key as hex string
     */
    getPublicKeyHex(): string {
        return bytesToHex(this.publicKey);
    }

    /**
     * Get public key as Uint8Array
     */
    getPublicKey(): Uint8Array {
        return this.publicKey;
    }

    /**
     * Sign an object using JWS-like compact serialization
     */
    async sign(payload: unknown): Promise<string> {
        const canonical = canonicalize(payload);
        if (!canonical) {
            throw new Error('Failed to canonicalize payload');
        }

        const payloadBytes = new TextEncoder().encode(canonical);
        const payloadHash = sha256(payloadBytes);
        const signature = ed25519.sign(payloadHash, this.privateKey);

        // JWS header
        const header = {
            alg: 'EdDSA',
            typ: 'JWT',
            kid: this.getDid()
        };

        const encodedHeader = base64urlEncode(
            new TextEncoder().encode(JSON.stringify(header))
        );
        const encodedPayload = base64urlEncode(payloadBytes);
        const encodedSignature = base64urlEncode(signature);

        return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    }

    /**
     * Verify a JWS signature
     */
    static verify(jws: string, publicKey: Uint8Array): boolean {
        try {
            const [headerB64, payloadB64, signatureB64] = jws.split('.');

            if (!headerB64 || !payloadB64 || !signatureB64) {
                return false;
            }

            const payloadBytes = base64urlDecode(payloadB64);
            const payloadHash = sha256(payloadBytes);
            const signature = base64urlDecode(signatureB64);

            return ed25519.verify(signature, payloadHash, publicKey);
        } catch {
            return false;
        }
    }

    /**
     * Extract payload from JWS without verification
     */
    static extractPayload<T = unknown>(jws: string): T {
        const [, payloadB64] = jws.split('.');
        if (!payloadB64) {
            throw new Error('Invalid JWS format');
        }

        const payloadBytes = base64urlDecode(payloadB64);
        const payloadStr = new TextDecoder().decode(payloadBytes);
        return JSON.parse(payloadStr) as T;
    }

    /**
     * Extract public key from DID:key
     */
    static publicKeyFromDid(did: string): Uint8Array {
        if (!did.startsWith('did:key:z')) {
            throw new Error('Invalid did:key format');
        }

        const encoded = did.replace('did:key:z', '');
        const multicodecKey = base64urlDecode(encoded);

        // Remove multicodec prefix (2 bytes)
        return multicodecKey.slice(2);
    }
}
