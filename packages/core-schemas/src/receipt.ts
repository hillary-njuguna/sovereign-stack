/**
 * Sovereign AP2 Core Schemas - Receipt Types
 */

export interface ReceiptTransaction {
    amount: number;
    currency: string;
    timestamp: string;
    merchantId: string;
    orderId: string;
}

export interface ReceiptFulfillment {
    status: 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
    confirmedAt: string;
    proofs?: Array<{
        type: 'tracking' | 'signature' | 'photo' | 'blockchain';
        hash: string;
        timestamp: string;
        provider?: string;
    }>;
}

export interface ReceiptParties {
    user: string;
    agent: string;
    merchant: string;
    processor?: string;
}

export interface ReceiptChainLink {
    previousReceiptHash?: string;
    nextReceiptHash?: string;
    chainIndex: number;
    chainRoot?: string;
}

export interface ReceiptDisputeWindow {
    startsAt: string;
    endsAt: string;
    extensionConditions?: string[];
}

export interface ReceiptAttestations {
    zkComplianceProof?: string;
    selectiveDisclosures?: Array<{
        claim: string;
        proof: string;
        verifier: string;
    }>;
}

export interface SettlementReceipt {
    receiptId: string;
    mandateId: string;

    chain: ReceiptChainLink;
    transaction: ReceiptTransaction & {
        disputeWindow: ReceiptDisputeWindow;
    };
    fulfillment: ReceiptFulfillment;
    parties: ReceiptParties;

    auditTrail: {
        delegationHash: string;
        orderStateTransition: string;
        settlementProof: string;
    };

    signatures: {
        merchant: string;
        agent?: string;
        processor?: string;
    };

    attestations?: ReceiptAttestations;
}
