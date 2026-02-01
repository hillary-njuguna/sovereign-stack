/**
 * @sovereign-stack/core - Mandate Lifecycle Tests
 */

import { InMemoryKeystore } from '../src/keystore/index.js';
import { EventLog } from '../src/event-log/index.js';
import {
    createMandate,
    signMandate,
    verifyMandate,
    revokeMandate,
    isActionAllowed,
    isResourceAllowed,
    isWithinBudget
} from '../src/mandate/index.js';

describe('Mandate Lifecycle', () => {
    let keystore: InMemoryKeystore;
    let eventLog: EventLog;

    beforeEach(() => {
        keystore = new InMemoryKeystore();
        eventLog = new EventLog();
    });

    test('create → sign → verify → revoke', async () => {
        // Setup
        const keyId = await keystore.ensureUserKey('user:alice');

        // Create
        const mandate = createMandate({
            issuer: 'user:alice',
            delegate: 'agent:router',
            scope: {
                actions: ['invoke:model', 'payment:transfer'],
                resources: ['agent:*']
            },
            validity: {
                not_before: new Date(Date.now() - 1000).toISOString(),
                not_after: new Date(Date.now() + 3600000).toISOString()
            },
        });

        expect(mandate.mandate_id).toBeDefined();
        expect(mandate.issuer).toBe('user:alice');

        // Sign
        const signed = await signMandate(mandate, keystore, keyId);
        expect(signed.signature).toBeTruthy();
        expect(signed.signature.length).toBe(128); // Ed25519 signature is 64 bytes = 128 hex chars

        // Verify (should pass)
        const result1 = await verifyMandate(signed, keystore, eventLog);
        expect(result1.valid).toBe(true);
        expect(result1.errors).toHaveLength(0);

        // Revoke
        const revokeResult = await revokeMandate(
            signed.mandate_id,
            'policy-change',
            'user:alice',
            keystore,
            eventLog
        );
        expect(revokeResult.eventId).toBeDefined();

        // Verify after revocation (should fail)
        const result2 = await verifyMandate(signed, keystore, eventLog);
        expect(result2.valid).toBe(false);
        expect(result2.errors).toContain('Mandate has been revoked');
    });

    test('expired mandate fails verification', async () => {
        const keyId = await keystore.ensureUserKey('user:bob');

        const mandate = createMandate({
            issuer: 'user:bob',
            delegate: 'agent:worker',
            scope: { actions: ['read'], resources: ['data:*'] },
            validity: {
                not_after: new Date(Date.now() - 1000).toISOString() // Already expired
            },
        });

        const signed = await signMandate(mandate, keystore, keyId);
        const result = await verifyMandate(signed, keystore);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('expired'))).toBe(true);
    });

    test('future mandate fails verification', async () => {
        const keyId = await keystore.ensureUserKey('user:charlie');

        const mandate = createMandate({
            issuer: 'user:charlie',
            delegate: 'agent:scheduler',
            scope: { actions: ['schedule'], resources: ['task:*'] },
            validity: {
                not_before: new Date(Date.now() + 3600000).toISOString() // 1 hour in future
            },
        });

        const signed = await signMandate(mandate, keystore, keyId);
        const result = await verifyMandate(signed, keystore);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('not yet valid'))).toBe(true);
    });
});

describe('Scope Checking', () => {
    const mandate = {
        mandate_id: 'test-id',
        issuer: 'user:test',
        delegate: 'agent:test',
        scope: {
            actions: ['invoke:model', 'payment:*'],
            resources: ['agent:1', 'merchant:*'],
            max_value: 10000,
            currency: 'MYR'
        },
        validity: {},
        created_at: new Date().toISOString(),
        signature: ''
    };

    test('exact action match', () => {
        expect(isActionAllowed(mandate, 'invoke:model')).toBe(true);
        expect(isActionAllowed(mandate, 'invoke:other')).toBe(false);
    });

    test('wildcard action match', () => {
        expect(isActionAllowed(mandate, 'payment:transfer')).toBe(true);
        expect(isActionAllowed(mandate, 'payment:refund')).toBe(true);
    });

    test('exact resource match', () => {
        expect(isResourceAllowed(mandate, 'agent:1')).toBe(true);
        expect(isResourceAllowed(mandate, 'agent:2')).toBe(false);
    });

    test('wildcard resource match', () => {
        expect(isResourceAllowed(mandate, 'merchant:123')).toBe(true);
        expect(isResourceAllowed(mandate, 'merchant:abc')).toBe(true);
    });

    test('budget check', () => {
        expect(isWithinBudget(mandate, 5000)).toBe(true);
        expect(isWithinBudget(mandate, 10000)).toBe(true);
        expect(isWithinBudget(mandate, 10001)).toBe(false);
    });
});
