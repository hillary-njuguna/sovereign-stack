/**
 * @sovereign-stack/adapter-mcp-fs - Zero-Trust Enforcement Tests
 * 
 * These tests prove the sovereignty kernel is actually enforced.
 * Without valid mandate: No execution. Period.
 */

import { MCPFSAdapter } from '../src/index.js';
import {
    createMandate,
    signMandate,
    revokeMandate,
    InMemoryKeystore
} from '@sovereign-stack/core';

describe('MCPFSAdapter: Zero-Trust Enforcement', () => {
    let adapter: MCPFSAdapter;
    let keystore: InMemoryKeystore;

    beforeEach(() => {
        adapter = new MCPFSAdapter();
        keystore = adapter.getKeystore();
    });

    // =========================================================================
    // TEST 1: No mandate = No execution
    // =========================================================================
    test('rejects execution without a valid mandate', async () => {
        // Create proposal
        const action = {
            tool: 'read_file',
            arguments: { path: '/etc/passwd' }
        };
        const proposal = await adapter.propose(action, { agentId: 'agent:attacker' });

        // Create INVALID mandate (wrong signature)
        const invalidMandate = {
            mandate_id: 'mandate_fake',
            issuer: 'user:victim',
            delegate: 'adapter:mcp-fs',
            scope: { actions: ['read_file'], resources: ['file:*'] },
            validity: {},
            created_at: new Date().toISOString(),
            signature: 'invalid_signature_not_cryptographically_valid'
        };

        // Attempt to commit - MUST fail
        await expect(adapter.commit(proposal.id, invalidMandate as any))
            .rejects
            .toThrow('INVALID_MANDATE');

        // Verify proposal was rejected
        expect(adapter.getProposal(proposal.id)?.status).toBe('rejected');
    });

    // =========================================================================
    // TEST 2: Revoked mandate = No execution
    // =========================================================================
    test('rejects execution with revoked mandate', async () => {
        // Create and sign a valid mandate
        const keyId = await keystore.ensureUserKey('user:alice');
        const mandate = createMandate({
            issuer: 'user:alice',
            delegate: 'adapter:mcp-fs',
            scope: {
                actions: ['read_file'],
                resources: ['file:/home']
            },
            validity: {}
        });
        const signedMandate = await signMandate(mandate, keystore, keyId);

        // Create proposal
        const action = {
            tool: 'read_file',
            arguments: { path: '/home/secrets.txt' }
        };
        const proposal = await adapter.propose(action, { agentId: 'agent:compromised' });

        // REVOKE the mandate (immediate effect)
        const eventLog = adapter.getEventLog();
        await revokeMandate(
            signedMandate.mandate_id,
            'Agent compromised',
            'user:alice',
            keystore,
            eventLog
        );

        // Attempt to commit with revoked mandate - MUST fail
        await expect(adapter.commit(proposal.id, signedMandate))
            .rejects
            .toThrow('REVOKED_MANDATE');

        expect(adapter.getProposal(proposal.id)?.status).toBe('rejected');
    });

    // =========================================================================
    // TEST 3: Action outside scope = No execution
    // =========================================================================
    test('rejects execution outside mandate scope', async () => {
        // Create mandate that ONLY allows read_file
        const keyId = await keystore.ensureUserKey('user:bob');
        const mandate = createMandate({
            issuer: 'user:bob',
            delegate: 'adapter:mcp-fs',
            scope: {
                actions: ['read_file'], // ONLY read, NOT write
                resources: ['file:*']
            },
            validity: {}
        });
        const signedMandate = await signMandate(mandate, keystore, keyId);

        // Propose a WRITE action (not in scope)
        const action = {
            tool: 'write_file',
            arguments: {
                path: '/tmp/malicious.sh',
                content: 'rm -rf /'
            }
        };
        const proposal = await adapter.propose(action, { agentId: 'agent:rogue' });

        // Attempt to commit - MUST fail due to scope violation
        await expect(adapter.commit(proposal.id, signedMandate))
            .rejects
            .toThrow('SCOPE_VIOLATION');

        expect(adapter.getProposal(proposal.id)?.status).toBe('rejected');
    });

    // =========================================================================
    // TEST 4: Valid mandate = Execution + Receipt
    // =========================================================================
    test('executes with valid mandate and produces receipt', async () => {
        // Create valid mandate
        const keyId = await keystore.ensureUserKey('user:charlie');
        const mandate = createMandate({
            issuer: 'user:charlie',
            delegate: 'adapter:mcp-fs',
            scope: {
                actions: ['read_file', 'list_directory'],
                resources: ['file:*']
            },
            validity: {}
        });
        const signedMandate = await signMandate(mandate, keystore, keyId);

        // Create proposal
        const action = {
            tool: 'list_directory',
            arguments: { path: '/home/charlie' }
        };
        const proposal = await adapter.propose(action, { agentId: 'agent:assistant' });

        // Commit with valid mandate
        const result = await adapter.commit(proposal.id, signedMandate);

        // ✅ Execution happened
        expect(result.output).toBeDefined();
        expect(Array.isArray(result.output)).toBe(true);

        // ✅ Receipt was issued
        expect(result.receipt).toBeDefined();
        expect(result.receipt.mandate_id).toBe(signedMandate.mandate_id);
        expect(result.receipt.action).toBe('list_directory');
        expect(result.receipt.signature).toBeTruthy();
        expect(result.receipt.signature.length).toBe(128); // Ed25519 sig

        // ✅ Proposal status updated
        expect(adapter.getProposal(proposal.id)?.status).toBe('committed');
    });

    // =========================================================================
    // TEST 5: Proposal not found
    // =========================================================================
    test('rejects commit for non-existent proposal', async () => {
        const keyId = await keystore.ensureUserKey('user:anyone');
        const mandate = createMandate({
            issuer: 'user:anyone',
            delegate: 'adapter:mcp-fs',
            scope: { actions: ['*'], resources: ['*'] },
            validity: {}
        });
        const signedMandate = await signMandate(mandate, keystore, keyId);

        await expect(adapter.commit('proposal_doesnt_exist', signedMandate))
            .rejects
            .toThrow('PROPOSAL_NOT_FOUND');
    });

    // =========================================================================
    // TEST 6: Double commit rejected
    // =========================================================================
    test('rejects double commit on same proposal', async () => {
        const keyId = await keystore.ensureUserKey('user:dana');
        const mandate = createMandate({
            issuer: 'user:dana',
            delegate: 'adapter:mcp-fs',
            scope: { actions: ['read_file'], resources: ['file:*'] },
            validity: {}
        });
        const signedMandate = await signMandate(mandate, keystore, keyId);

        const proposal = await adapter.propose(
            { tool: 'read_file', arguments: { path: '/data.txt' } },
            { agentId: 'agent:test' }
        );

        // First commit succeeds
        await adapter.commit(proposal.id, signedMandate);

        // Second commit fails (already committed)
        await expect(adapter.commit(proposal.id, signedMandate))
            .rejects
            .toThrow('PROPOSAL_COMMITTED');
    });
});
