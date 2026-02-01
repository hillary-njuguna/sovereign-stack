# Critical Gap Analysis: Sovereign AP2 Reference Schemas v0.1

*Type: Audit / Roadmap*
*Target Software: Sovereign AP2 Reference Schemas v0.1*
*Date: 2026-02-02*

## 1. Executive Summary
The v0.1 reference schemas provide a structural foundation but lack the cryptographic rigor and protocol bindings necessary to guarantee sovereignty in adversarial environments. Specifically, **privacy mechanisms (ZKP)** and **dispute resolution** are under-specified, and the **delegation mandate structure** contains malleability risks.

**Recommendation:** Proceed immediately to v0.2 specifications addressing these gaps before any reference implementation code is written.

---

## 2. Critical Missing Elements

### A. Privacy-Preserving Mechanisms (Profiles B1, B2)
Current schemas rely on pseudonyms, which are insufficient for robust privacy against correlation attacks.
*   **Gap:** No Zero-Knowledge Proof (ZKP) structures for proving authority without revealing identity.
*   **Gap:** No differential privacy parameters for aggregate data reporting.
*   **Fix:** Introduce `ZKProofOfAuthority` interface and `PrivacyParameters`.

### B. Dispute Resolution Protocols (Profile D1)
Dispute handling is currently a placeholder, risking reversion to platform-centrism.
*   **Gap:** Lack of machine-readable dispute schema.
*   **Fix:** Define `ProtocolDispute` schema with standardized reason codes and evidence requirements.

### C. Multi-Provider Switching (Profile E1)
No standard format for exporting/importing mandates across providers.
*   **Gap:** Missing `Provider` abstraction and data migration formats.
*   **Fix:** Define `PaymentProvider` interface and migration capabilities.

---

## 3. Security Vulnerabilities

### A. DelegationMandate Malleability
*   **Issue:** The `remaining` budget field is mutable but currently resides within the mandate structure, complicating signature verification.
*   **Fix:** Separate mutable state from the immutable signed intent.
*   **Issue:** `revocationNonce` is valid but enables pre-computation attacks if not handled carefully.
*   **Fix:** Implement hash-chain revocation (`revocationChain`).

### B. SettlementReceipt Integrity
*   **Issue:** Receipts are isolated, allowing for selective omission (receipt withholding) or reordering.
*   **Fix:** functionality for **Receipt Chaining** (`previousReceiptHash`).
*   **Issue:** Malleable dispute windows controlled by merchant timestamps.
*   **Fix:** Derive rules deterministically from transaction finality timestamps, not merchant claims.

---

## 4. Implementation & Interoperability Gaps

### A. Policy Language Weaknesses
*   **Gap:** No formal verification model to detect conflicting rules.
*   **Gap:** No safe composition guarantees for merging policies.
*   **Fix:** Adopt a verifiable subset of logic (e.g., Datalog-based) for the policy DSL.

### B. Cross-Layer Bindings
*   **Gap:** No cryptographic link between **UCP** (Order), **AP2** (Payment), and **MCP** (Tool Execution). An agent could pay for an order it didn't verify, or execute a tool prohibited by payment policy.
*   **Fix:** Introduce `ConsistencyProof` schema to link protocol layer hashes.

### C. Sovereignty Verification
*   **Gap:** No standardized way to measure if a specific implementation is complying with sovereignty rules.
*   **Fix:** Define `SovereigntyMetrics` schema for scoring portability, privacy, and control.

---

## 5. Roadmap to v0.2

### Phase 1: Cryptographic Hardening (Immediate)
*   [ ] Refactor `DelegationMandate` to separate mutable/immutable state.
*   [ ] Add `ZKProofOfAuthority` primitives.
*   [ ] Implement `revocationChain` logic.

### Phase 2: Protocol Completeness (Short-term)
*   [ ] Define `ProtocolDispute` schema.
*   [ ] Create `ConsistencyProof` structures for UCP/AP2/MCP binding.
*   [ ] Specify `PaymentProvider` interfaces for portability.

### Phase 3: Validation & Testing (Medium-term)
*   [ ] Develop "Adversarial Compliance" test suite.
*   [ ] Create formal verification tools for Policy DSL.

---

## 6. Conclusion
The v0.1 schemas are **architecturally sound** but **cryptographically incomplete**. They successfully map the domain objects but do not yet provide the mathematical guarantees required for true sovereignty without trust. v0.2 must replace trust-based fields with proof-based fields.
