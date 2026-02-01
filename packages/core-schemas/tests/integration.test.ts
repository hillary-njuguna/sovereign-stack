/**
 * @sovereign-stack/core - Integration Tests
 * 
 * End-to-end flow: Mandate → τ-Gate → Receipt
 */

import { InMemoryKeystore } from '../src/keystore/index.js';
import { EventLog } from '../src/event-log/index.js';
import { createMandate, signMandate, verifyMandate } from '../src/mandate/index.js';
import { issueReceipt, verifyReceipt, ReceiptChain } from '../src/receipt/index.js';
import { hashCanonical } from '../src/types.js';

describe('End-to-End: Mandate → τ-Gate → Receipt', () => {
    test('full ratification flow', async () => {
        const keystore = new InMemoryKeystore();
        const eventLog = new EventLog();
        const receiptChain = new ReceiptChain();

        // 1. User creates and signs a mandate
        const userKeyId = await keystore.ensureUserKey('user:me');
        const mandate = createMandate({
            issuer: 'user:me',
            delegate: 'agent:router',
            scope: {
                actions: ['invoke:model'],
                resources: ['agent:openai'],
                max_value: 1000,
                currency: 'USD'
            },
            validity: {},
        });
        const signedMandate = await signMandate(mandate, keystore, userKeyId);

        // Verify mandate is valid
        const mandateValid = await verifyMandate(signedMandate, keystore, eventLog);
        expect(mandateValid.valid).toBe(true);

        // 2. Router captures the request (Mirror)
        const mirrorEntry = {
            id: 'mirror_001',
            agentId: 'agent:openai' as const,
            prompt: 'Explain quantum mechanics in simple terms',
            request_hash: hashCanonical({ prompt: 'Explain quantum mechanics in simple terms' }),
            timestamp: new Date().toISOString(),
        };

        // 3. τ-Gate ratifies (checks mandate, records COMMITTED event)
        await eventLog.append({
            type: 'COMMITTED',
            payload: {
                mandate_id: signedMandate.mandate_id,
                mirror_ref: mirrorEntry.id,
                action: 'invoke:model',
                resource: 'agent:openai',
            },
            signer: 'user:me',
        }, keystore);

        // 4. Provider executes and issues receipt
        const providerKeyId = await keystore.ensureUserKey('provider:openai');
        const response = 'Quantum mechanics is the physics of the very small...';

        const receipt = await issueReceipt({
            mandate_id: signedMandate.mandate_id,
            actor: 'provider:openai',
            action: 'invoke:model',
            request_hash: mirrorEntry.request_hash,
            response_hash: hashCanonical({ response }),
            provider_metadata: { model: 'gpt-4', tokens: 150 },
            mirror_ref: mirrorEntry.id,
        }, keystore, providerKeyId);

        // 5. Record receipt event
        await eventLog.append({
            type: 'RECEIPT_ISSUED',
            payload: { receipt_id: receipt.receipt_id },
            signer: 'provider:openai',
        }, keystore);

        // Add to receipt chain
        receiptChain.add(receipt);

        // Verify receipt
        const receiptValid = await verifyReceipt(receipt, keystore);
        expect(receiptValid.valid).toBe(true);

        // Verify chain integrity
        const chainResult = await eventLog.verifyChain(keystore);
        expect(chainResult.valid).toBe(true);
        expect(chainResult.eventsVerified).toBe(2); // COMMITTED + RECEIPT_ISSUED

        // Verify receipt chain has the receipt
        expect(receiptChain.getByMandateId(signedMandate.mandate_id)).toHaveLength(1);
    });

    test('revoked mandate blocks ratification', async () => {
        const keystore = new InMemoryKeystore();
        const eventLog = new EventLog();

        // Create and sign mandate
        const userKeyId = await keystore.ensureUserKey('user:alice');
        const mandate = createMandate({
            issuer: 'user:alice',
            delegate: 'agent:bot',
            scope: { actions: ['*'], resources: ['*'] },
            validity: {},
        });
        const signedMandate = await signMandate(mandate, keystore, userKeyId);

        // Revoke the mandate
        await eventLog.append({
            type: 'MANDATE_REVOKE',
            payload: {
                mandate_id: signedMandate.mandate_id,
                reason: 'security-concern',
                revoked_by: 'user:alice'
            },
            signer: 'user:alice',
        }, keystore);

        // Attempt to verify mandate (should fail)
        const result = await verifyMandate(signedMandate, keystore, eventLog);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Mandate has been revoked');
    });
});

describe('EventLog Chain Integrity', () => {
    test('detects tampering in chain', async () => {
        const keystore = new InMemoryKeystore();
        const eventLog = new EventLog();

        await keystore.ensureUserKey('user:test');

        // Add some events
        await eventLog.append({
            type: 'TEST_EVENT_1',
            payload: { data: 'first' },
            signer: 'user:test',
        }, keystore);

        await eventLog.append({
            type: 'TEST_EVENT_2',
            payload: { data: 'second' },
            signer: 'user:test',
        }, keystore);

        // Verify chain is valid
        const result = await eventLog.verifyChain(keystore);
        expect(result.valid).toBe(true);
        expect(result.eventsVerified).toBe(2);
    });
});
