#!/usr/bin/env node
/**
 * @sovereign-stack/core - CLI
 * 
 * Command-line interface for Sovereign Stack primitives.
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { InMemoryKeystore } from '../keystore/index.js';
import {
    createMandate,
    signMandate,
    verifyMandate,
    revokeMandate
} from '../mandate/index.js';
import { EventLog } from '../event-log/index.js';
import { issueReceipt, verifyReceipt } from '../receipt/index.js';

const program = new Command();
const keystore = new InMemoryKeystore();
const eventLog = new EventLog();

program
    .name('sovereign')
    .description('CLI for @sovereign-stack/core primitives')
    .version('0.2.0');

// ============================================================================
// Mandate Commands
// ============================================================================

program
    .command('create-mandate')
    .description('Create and sign a new delegation mandate')
    .requiredOption('--issuer <actor>', 'Issuer ActorId (e.g., user:alice)')
    .requiredOption('--delegate <actor>', 'Delegate ActorId (e.g., agent:router)')
    .requiredOption('--actions <actions>', 'Comma-separated actions (e.g., invoke:model,payment:transfer)')
    .requiredOption('--resources <resources>', 'Comma-separated resources (e.g., agent:*,merchant:123)')
    .option('--max-value <number>', 'Budget cap in smallest currency unit')
    .option('--currency <code>', 'Currency code (e.g., USD, MYR)')
    .option('--not-before <iso>', 'Validity start time (ISO 8601)')
    .option('--not-after <iso>', 'Validity end time (ISO 8601)')
    .option('--out <file>', 'Output file', 'mandate.json')
    .action(async (options) => {
        try {
            const keyId = await keystore.ensureUserKey(options.issuer);

            const mandate = createMandate({
                issuer: options.issuer,
                delegate: options.delegate,
                scope: {
                    actions: options.actions.split(',').map((a: string) => a.trim()),
                    resources: options.resources.split(',').map((r: string) => r.trim()),
                    max_value: options.maxValue ? parseInt(options.maxValue) : undefined,
                    currency: options.currency,
                },
                validity: {
                    not_before: options.notBefore,
                    not_after: options.notAfter,
                },
            });

            const signed = await signMandate(mandate, keystore, keyId);
            writeFileSync(options.out, JSON.stringify(signed, null, 2));
            console.log(`✓ Mandate created: ${signed.mandate_id}`);
            console.log(`  Saved to: ${options.out}`);
        } catch (err) {
            console.error(`✗ Error: ${(err as Error).message}`);
            process.exit(1);
        }
    });

program
    .command('verify-mandate')
    .description('Verify a mandate signature and validity')
    .requiredOption('--file <file>', 'Mandate JSON file')
    .action(async (options) => {
        try {
            if (!existsSync(options.file)) {
                throw new Error(`File not found: ${options.file}`);
            }
            const mandate = JSON.parse(readFileSync(options.file, 'utf-8'));

            // Need to have the issuer's key to verify - for demo, generate it
            await keystore.ensureUserKey(mandate.issuer);

            const result = await verifyMandate(mandate, keystore, eventLog);

            if (result.valid) {
                console.log('✓ Mandate is valid');
                console.log(`  ID: ${mandate.mandate_id}`);
                console.log(`  Issuer: ${mandate.issuer}`);
                console.log(`  Delegate: ${mandate.delegate}`);
            } else {
                console.log('✗ Mandate is invalid');
                result.errors.forEach(err => console.log(`  - ${err}`));
                process.exit(1);
            }
        } catch (err) {
            console.error(`✗ Error: ${(err as Error).message}`);
            process.exit(1);
        }
    });

program
    .command('revoke-mandate')
    .description('Revoke a mandate')
    .requiredOption('--id <mandateId>', 'Mandate ID to revoke')
    .requiredOption('--reason <reason>', 'Revocation reason')
    .requiredOption('--by <actor>', 'Actor performing revocation')
    .action(async (options) => {
        try {
            await keystore.ensureUserKey(options.by);

            const result = await revokeMandate(
                options.id,
                options.reason,
                options.by,
                keystore,
                eventLog
            );

            console.log(`✓ Mandate revoked`);
            console.log(`  Mandate ID: ${result.mandateId}`);
            console.log(`  Event ID: ${result.eventId}`);
            console.log(`  Revoked at: ${result.revokedAt}`);
        } catch (err) {
            console.error(`✗ Error: ${(err as Error).message}`);
            process.exit(1);
        }
    });

// ============================================================================
// Receipt Commands
// ============================================================================

program
    .command('verify-receipt')
    .description('Verify a receipt signature')
    .requiredOption('--file <file>', 'Receipt JSON file')
    .action(async (options) => {
        try {
            if (!existsSync(options.file)) {
                throw new Error(`File not found: ${options.file}`);
            }
            const receipt = JSON.parse(readFileSync(options.file, 'utf-8'));

            // Need the actor's key to verify
            await keystore.ensureUserKey(receipt.actor);

            const result = await verifyReceipt(receipt, keystore);

            if (result.valid) {
                console.log('✓ Receipt is valid');
                console.log(`  ID: ${receipt.receipt_id}`);
                console.log(`  Actor: ${receipt.actor}`);
                console.log(`  Action: ${receipt.action}`);
            } else {
                console.log('✗ Receipt is invalid');
                result.errors.forEach(err => console.log(`  - ${err}`));
                process.exit(1);
            }
        } catch (err) {
            console.error(`✗ Error: ${(err as Error).message}`);
            process.exit(1);
        }
    });

// ============================================================================
// Event Log Commands
// ============================================================================

program
    .command('verify-chain')
    .description('Verify the integrity of the event log chain')
    .action(async () => {
        const result = await eventLog.verifyChain(keystore);
        if (result.valid) {
            console.log(`✓ Event chain is valid (${result.eventsVerified} events)`);
        } else {
            console.log('✗ Event chain has errors:');
            result.errors.forEach(err => console.log(`  - ${err}`));
            process.exit(1);
        }
    });

program.parse(process.argv);
