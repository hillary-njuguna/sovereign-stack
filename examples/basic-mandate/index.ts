/**
 * Sovereign AP2 v0.2 Demo
 * Basic mandate creation and receipt chaining example
 */

// Note: Run with ts-node after npm install
// npx ts-node examples/basic-mandate/index.ts

import { MandateBuilder } from '@sovereign-ap2/mandate-engine';
import { ReceiptChain } from '@sovereign-ap2/receipt-chain';

async function demo() {
    console.log('=== Sovereign AP2 v0.2 Demo ===\n');

    // 1. Create a mandate
    console.log('1. Creating delegation mandate...');
    const builder = new MandateBuilder();

    const mandate = await builder.createMandate({
        budget: {
            currency: 'USD',
            maxAmount: BigInt(50000) // $500.00 in cents
        },
        validFrom: '2025-04-01T00:00:00Z',
        validUntil: '2025-04-30T23:59:59Z',
        allowedVendors: ['did:web:grocerystore.example.com'],
        vendorCategories: ['groceries'],
        maxTransactions: 20,
        allowedJurisdictions: ['US-CA']
    });

    console.log('Mandate created:', {
        id: mandate.mandateId,
        issuer: mandate.issuer.substring(0, 30) + '...',
        budget: `${mandate.intent.budget.currency} ${Number(mandate.intent.budget.maxAmount) / 100}`,
        validUntil: mandate.intent.validUntil
    });

    // 2. Validate mandate
    console.log('\n2. Validating mandate structure...');
    const validation = builder.validateMandate(mandate);
    console.log(`Mandate valid: ${validation.valid}`);
    if (!validation.valid) {
        console.log('Errors:', validation.errors);
    }

    // 3. Verify signature
    console.log('\n3. Verifying mandate signature...');
    const signatureValid = builder.verifyMandateSignature(mandate);
    console.log(`Signature valid: ${signatureValid}`);

    // 4. Create receipt chain
    console.log('\n4. Creating receipt chain...');
    const receiptChain = new ReceiptChain();

    const receipt1 = {
        transaction: {
            amount: 4250,
            currency: 'USD',
            timestamp: '2025-04-15T14:30:22Z',
            merchantId: 'did:web:grocerystore.example.com',
            orderId: 'ord_abc123'
        }
    };

    const receiptHash1 = receiptChain.addReceipt('receipt_001', receipt1);
    console.log('Receipt 1 added:', receiptHash1.substring(0, 20) + '...');

    const receipt2 = {
        transaction: {
            amount: 1899,
            currency: 'USD',
            timestamp: '2025-04-16T10:15:00Z',
            merchantId: 'did:web:grocerystore.example.com',
            orderId: 'ord_def456'
        }
    };

    const receiptHash2 = receiptChain.addReceipt('receipt_002', receipt2);
    console.log('Receipt 2 added:', receiptHash2.substring(0, 20) + '...');

    // 5. Verify chain integrity
    console.log('\n5. Verifying chain integrity...');
    const receipt1Valid = receiptChain.verifyReceipt('receipt_001', receipt1);
    const receipt2Valid = receiptChain.verifyReceipt('receipt_002', receipt2);
    const chainValid = receiptChain.verifyChain();

    console.log(`Receipt 1 valid: ${receipt1Valid}`);
    console.log(`Receipt 2 valid: ${receipt2Valid}`);
    console.log(`Chain integrity: ${chainValid}`);

    // 6. Get chain proof
    console.log('\n6. Getting chain proof...');
    const proof = receiptChain.getChainProof();
    console.log('Chain proof:', {
        rootHash: proof.rootHash.substring(0, 20) + '...',
        chainLength: proof.chainLength
    });

    // 7. Revoke mandate
    console.log('\n7. Revoking mandate...');
    const revocation = await builder.revokeMandate(mandate);
    console.log('Mandate revoked:', {
        mandateId: revocation.mandateId.substring(0, 20) + '...',
        newHash: revocation.newRevocationHash.substring(0, 20) + '...',
        timestamp: revocation.timestamp
    });

    // 8. Check mandate validity after revocation
    console.log('\n8. Checking mandate validity after revocation...');
    const stillValid = builder.isMandateValid(mandate);
    console.log(`Original mandate still valid: ${stillValid}`);

    console.log('\n=== Demo Complete ===');
}

demo().catch(console.error);
