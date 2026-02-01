#!/usr/bin/env node
/**
 * @sovereign-stack/adapter-mcp-fs - CLI
 * 
 * Command-line interface for testing MCP FS Sovereign Adapter.
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { MCPFSAdapter } from '../index.js';
import {
    createMandate,
    signMandate,
    revokeMandate
} from '@sovereign-stack/core';

const program = new Command();

// Persistent adapter instance for CLI session
const adapter = new MCPFSAdapter();

program
    .name('sovereign-mcp-fs')
    .description('CLI for MCP FS Sovereign Adapter')
    .version('0.1.0');

// ============================================================================
// Mandate Commands
// ============================================================================

program
    .command('create-mandate')
    .description('Create and sign a mandate for MCP FS operations')
    .requiredOption('--issuer <actor>', 'Issuer ActorId (e.g., user:me)')
    .requiredOption('--actions <actions>', 'Comma-separated actions (read_file,write_file,list_directory)')
    .option('--expires <hours>', 'Hours until expiration', '24')
    .option('--out <file>', 'Output file', 'mandate.json')
    .action(async (options) => {
        try {
            const keystore = adapter.getKeystore();
            const keyId = await keystore.ensureUserKey(options.issuer);

            const mandate = createMandate({
                issuer: options.issuer,
                delegate: 'adapter:mcp-fs',
                scope: {
                    actions: options.actions.split(',').map((a: string) => a.trim()),
                    resources: ['file:*'], // Allow all files for demo
                },
                validity: {
                    not_before: new Date().toISOString(),
                    not_after: new Date(Date.now() + parseInt(options.expires) * 60 * 60 * 1000).toISOString()
                }
            });

            const signed = await signMandate(mandate, keystore, keyId);
            writeFileSync(options.out, JSON.stringify(signed, null, 2));

            console.log('✅ Mandate created');
            console.log(`   ID: ${signed.mandate_id}`);
            console.log(`   Issuer: ${signed.issuer}`);
            console.log(`   Actions: ${signed.scope.actions.join(', ')}`);
            console.log(`   Expires: ${signed.validity.not_after}`);
            console.log(`   Saved to: ${options.out}`);
        } catch (err) {
            console.error(`❌ Error: ${(err as Error).message}`);
            process.exit(1);
        }
    });

program
    .command('revoke-mandate')
    .description('Revoke a mandate')
    .requiredOption('--id <mandate_id>', 'Mandate ID to revoke')
    .requiredOption('--by <actor>', 'Actor performing revocation')
    .option('--reason <reason>', 'Revocation reason', 'policy_change')
    .action(async (options) => {
        try {
            const keystore = adapter.getKeystore();
            const eventLog = adapter.getEventLog();

            const result = await revokeMandate(
                options.id,
                options.reason,
                options.by,
                keystore,
                eventLog
            );

            console.log('✅ Mandate revoked');
            console.log(`   Mandate ID: ${result.mandateId}`);
            console.log(`   Event ID: ${result.eventId}`);
            console.log(`   Reason: ${options.reason}`);
        } catch (err) {
            console.error(`❌ Error: ${(err as Error).message}`);
            process.exit(1);
        }
    });

// ============================================================================
// Proposal Commands
// ============================================================================

program
    .command('propose')
    .description('Propose a file system action (requires mandate for execution)')
    .requiredOption('--tool <tool>', 'Tool name (read_file, write_file, list_directory)')
    .requiredOption('--path <path>', 'File path')
    .option('--content <content>', 'Content for write_file')
    .option('--agent <agent>', 'Agent ID', 'agent:cli')
    .option('--out <file>', 'Output proposal file', 'proposal.json')
    .action(async (options) => {
        try {
            const action = {
                tool: options.tool,
                arguments: options.tool === 'write_file'
                    ? { path: options.path, content: options.content || '' }
                    : { path: options.path }
            };

            const proposal = await adapter.propose(action, { agentId: options.agent });
            writeFileSync(options.out, JSON.stringify(proposal, null, 2));

            console.log('📝 Proposal created (pending ratification)');
            console.log(`   ID: ${proposal.id}`);
            console.log(`   Action: ${proposal.action.tool}`);
            console.log(`   Path: ${proposal.action.arguments.path}`);
            console.log(`   Status: ${proposal.status}`);
            console.log(`   Event: ${proposal.eventId}`);
            console.log(`   Saved to: ${options.out}`);
            console.log('');
            console.log('⚠️  To execute, run:');
            console.log(`   sovereign-mcp-fs commit --proposal ${proposal.id} --mandate <mandate.json>`);
        } catch (err) {
            console.error(`❌ Error: ${(err as Error).message}`);
            process.exit(1);
        }
    });

program
    .command('commit')
    .description('Commit a proposal with a mandate (executes if all checks pass)')
    .requiredOption('--proposal <id>', 'Proposal ID')
    .requiredOption('--mandate <file>', 'Mandate JSON file')
    .option('--out <file>', 'Output receipt file', 'receipt.json')
    .action(async (options) => {
        try {
            const mandate = JSON.parse(readFileSync(options.mandate, 'utf-8'));

            // Import issuer key if not already present
            await adapter.getKeystore().ensureUserKey(mandate.issuer);

            const result = await adapter.commit(options.proposal, mandate);
            writeFileSync(options.out, JSON.stringify(result.receipt, null, 2));

            console.log('✅ Execution successful');
            console.log(`   Output: ${JSON.stringify(result.output)}`);
            console.log(`   Receipt ID: ${result.receipt.receipt_id}`);
            console.log(`   Action: ${result.receipt.action}`);
            console.log(`   Saved to: ${options.out}`);
        } catch (err) {
            console.error(`❌ Commit failed: ${(err as Error).message}`);
            process.exit(1);
        }
    });

// ============================================================================
// Inspection Commands
// ============================================================================

program
    .command('list-proposals')
    .description('List all proposals')
    .action(() => {
        const proposals = adapter.getProposals();
        if (proposals.length === 0) {
            console.log('No proposals found.');
            return;
        }

        console.log('📋 Proposals:');
        for (const p of proposals) {
            console.log(`   ${p.id}`);
            console.log(`      Action: ${p.action.tool}`);
            console.log(`      Status: ${p.status}`);
            console.log(`      Created: ${p.createdAt}`);
            console.log('');
        }
    });

program
    .command('events')
    .description('Show event log')
    .option('--limit <n>', 'Limit number of events', '10')
    .action((options) => {
        const events = adapter.getEventLog().query({ limit: parseInt(options.limit) });
        if (events.length === 0) {
            console.log('No events found.');
            return;
        }

        console.log('📜 Event Log:');
        for (const evt of events) {
            console.log(`   ${evt.id}`);
            console.log(`      Type: ${evt.type}`);
            console.log(`      Signer: ${evt.signer}`);
            console.log(`      Time: ${evt.timestamp}`);
            console.log('');
        }
    });

program.parse(process.argv);
