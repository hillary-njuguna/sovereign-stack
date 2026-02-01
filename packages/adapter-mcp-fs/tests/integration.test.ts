/**
 * @sovereign-stack/adapter-mcp-fs - Integration Tests
 * 
 * Full flow: propose → mandate check → commit → verify receipt
 */

import { MCPFSAdapter } from '../src/index.js';
import {
    createMandate,
    signMandate,
    verifyReceipt
} from '@sovereign-stack/core';

describe('MCPFSAdapter: Full Integration Flow', () => {
    let adapter: MCPFSAdapter;

    beforeEach(() => {
        adapter = new MCPFSAdapter();
    });

    test('complete flow: propose → mandate check → commit → verify receipt', async () => {
        const keystore = adapter.getKeystore();

        // 1. Setup: Create user and mandate
        const userKeyId = await keystore.ensureUserKey('user:alice');
        const mandate = createMandate({
            issuer: 'user:alice',
            delegate: 'adapter:mcp-fs',
            scope: {
                actions: ['read_file', 'list_directory'],
                resources: ['file:/home/alice']
            },
            validity: {
                not_before: new Date(Date.now() - 1000).toISOString(),
                not_after: new Date(Date.now() + 3600000).toISOString() // 1 hour
            }
        });
        const signedMandate = await signMandate(mandate, keystore, userKeyId);

        // 2. Propose an action
        const action = {
            tool: 'list_directory',
            arguments: { path: '/home/alice' }
        };
        const proposal = await adapter.propose(action, { agentId: 'agent:assistant' });

        expect(proposal.status).toBe('pending');
        expect(proposal.action.tool).toBe('list_directory');
        expect(proposal.eventId).toBeDefined();
        expect(proposal.mirrorRef).toBeDefined();

        // 3. Commit the proposal
        const result = await adapter.commit(proposal.id, signedMandate);

        // 4. Verify the receipt is cryptographically valid
        const receiptValid = await verifyReceipt(result.receipt, keystore);
        expect(receiptValid.valid).toBe(true);

        // 5. Verify output
        expect(Array.isArray(result.output)).toBe(true);
        expect((result.output as string[]).length).toBeGreaterThan(0);

        // 6. Verify proposal state
        const finalProposal = adapter.getProposal(proposal.id);
        expect(finalProposal?.status).toBe('committed');

        // 7. Verify event log has correct events
        const events = adapter.getEventLog().query({});
        const eventTypes = events.map(e => e.type);

        expect(eventTypes).toContain('SUGGESTION');
        expect(eventTypes).toContain('COMMITTED');
        expect(eventTypes).toContain('RECEIPT_ISSUED');
    });

    test('parallel proposals with same mandate', async () => {
        const keystore = adapter.getKeystore();

        const userKeyId = await keystore.ensureUserKey('user:bob');
        const mandate = createMandate({
            issuer: 'user:bob',
            delegate: 'adapter:mcp-fs',
            scope: { actions: ['read_file'], resources: ['file:*'] },
            validity: {}
        });
        const signedMandate = await signMandate(mandate, keystore, userKeyId);

        // Create multiple proposals
        const proposal1 = await adapter.propose(
            { tool: 'read_file', arguments: { path: '/file1.txt' } },
            { agentId: 'agent:test' }
        );
        const proposal2 = await adapter.propose(
            { tool: 'read_file', arguments: { path: '/file2.txt' } },
            { agentId: 'agent:test' }
        );

        expect(proposal1.id).not.toBe(proposal2.id);

        // Execute both
        const result1 = await adapter.commit(proposal1.id, signedMandate);
        const result2 = await adapter.commit(proposal2.id, signedMandate);

        // Different receipts for different executions
        expect(result1.receipt.receipt_id).not.toBe(result2.receipt.receipt_id);
        expect(result1.output).not.toBe(result2.output);
        expect(result1.receipt.mirror_ref).not.toBe(result2.receipt.mirror_ref);
    });

    test('event log captures complete audit trail', async () => {
        const keystore = adapter.getKeystore();

        const userKeyId = await keystore.ensureUserKey('user:carol');
        const mandate = createMandate({
            issuer: 'user:carol',
            delegate: 'adapter:mcp-fs',
            scope: { actions: ['read_file'], resources: ['file:*'] },
            validity: {}
        });
        const signedMandate = await signMandate(mandate, keystore, userKeyId);

        // Execute a successful action
        const proposal = await adapter.propose(
            { tool: 'read_file', arguments: { path: '/data.txt' } },
            { agentId: 'agent:worker' }
        );
        await adapter.commit(proposal.id, signedMandate);

        // Verify chain integrity
        const chainResult = await adapter.getEventLog().verifyChain(keystore);
        expect(chainResult.valid).toBe(true);
        expect(chainResult.eventsVerified).toBeGreaterThanOrEqual(3);
    });
});
