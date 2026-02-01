# Sovereign AP2 Profile v0.1

**Version**: 0.1
**Type**: Architectural Profile / Evaluation Harness
**Status**: DRAFT

## 1. Overview
This profile defines the requirements for using **AP2 (Agent‑to‑Agent Payment Protocol)** inside an **Agentic Mesh** while preserving **agentic sovereignty**. Sovereignty is defined here as **user‑final authority, auditability, portability, and fail‑closed safety**.

It assumes the broader **UCP (Unified Commerce Protocol)** framing, where commerce becomes protocol‑based (agent‑to‑agent) rather than interface‑based. AP2 is explicitly positioned as an open protocol for agent‑led payments that extends A2A and MCP.

---

## 2. Core Requirements

### A. Delegation and Scope
**A1. Intent‑bound authority tokens (not “card‑on‑file”)**
A payment credential must be bindable to a declared **intent envelope** (budget ceiling, category/vendor constraints, time window, jurisdiction, recurrence limits). Authority is delegated *once* and exercised *many times* without re‑prompting to escape the "Permission Paradox."

**A2. Hard revocation and expiry semantics**
Revocation must be immediate. Tokens must have short‑lived validity with refresh only under policy. "Background autonomy" without hard revocation is unattended risk.

**A3. Least‑privilege by construction**
The default credential should be useless outside its scope, including being useless if exfiltrated, replayed, or presented to a different merchant context.

### B. Verifiable Agency Without PII Leakage
**B1. Proof‑of‑agency separate from proof‑of‑identity**
Merchants must be able to verify “this agent is authorized for this transaction class” without learning the user’s full identity or raw funding instrument. Sovereignty requires privacy‑preserving attestations rather than “log in with the platform.”

**B2. Selective disclosure**
Only disclose the minimum attributes required for the transaction (e.g., country, eligibility flags, shipping region, budget cap proof). Keep stable identifiers optional or pseudonymous.

### C. Conditional Settlement and Proof of Fulfillment
**C1. Conditional settlement hooks**
Payment must be lockable to UCP “order” lifecycle states (placed/confirmed/fulfilled/cancelled/refunded). The system must safely “forget” the agent when appropriate.

**C2. Cryptographic receipts**
Every settlement should produce an auditable receipt bound to:
1.  The delegation scope
2.  The order primitive
3.  The agent identity (pseudonymous allowed)
4.  The merchant identity

### D. Dispute, Liability, and Fraud
**D1. Protocol‑layer dispute semantics**
Disputes must not revert to “call support / platform decides.” Sovereignty collapses into centralized adjudication without protocol‑level dispute handling.

**D2. Liability partitioning**
The protocol must cleanly delineate liability for: user policy error, agent execution error, merchant misrepresentation, PSP failure, or credential provider compromise.

### E. Portability and Anti‑Enclosure Guarantees
*This is where the “Standardized Enclosure” risk lives.*

**E1. Multi‑provider compatibility**
Agents must be able to switch payment providers and credential issuers without re‑architecting the Mesh. Sovereignty depends on exit.

**E2. No mandatory discovery lock‑in**
If the only practical discovery path is “the dominant orchestrator,” UCP/AP2 become a mall directory with open signage. Alternative discovery paths must exist.

**E3. Local policy authoring**
Users must be able to author policy locally (or in their own governance system) and present it through standard interfaces (think “wallet policy”), rather than being forced into a platform UI.

### F. Security Posture (Fail‑Closed)
**F1. Auditable event log**
Canonical event schema required for: delegation created/modified/revoked, payment initiated, merchant attested, order created, fulfillment confirmed, settlement completed, dispute opened/resolved.

**F2. Safe degradation**
On ambiguity (identity mismatch, partial fulfillment, tool uncertainty), the default must be “pause and ask” rather than “complete anyway.”

---

## 3. Mesh Topology Mapping
**UCP × AP2 × A2A × MCP**

The Mesh is readable as four orthogonal layers. "Agentic Sovereignty" is a cross‑cutting constraint system satisfied across all four.

| Layer | Standard | Role |
| :--- | :--- | :--- |
| **1. Transport / Coordination** | **A2A** | Horizontal interoperability. Agents discovering capabilities and coordinating across vendors. |
| **2. Cognitive / Tool Interface** | **MCP** | Standardizing how a model/agent calls tools and gets structured results. |
| **3. Commerce Semantics** | **UCP** | Merchant capability declaration, discovery, negotiation, and transaction primitives. The "shopping journey." |
| **4. Money Semantics** | **AP2** | The payment handshake. Controlled authority extension of A2A/MCP. |

---

## 4. Enclosure Pressure Map
Even with open standards, power centralizes in three places. The **Standardized Enclosure Test**:

1.  **Discovery Engines:** Who routes intent to which merchants?
    *   *Test:* Can you use UCP/AP2 with non‑dominant discovery?
2.  **Credential Providers / Identity:** Who issues delegation tokens/attests authority?
    *   *Test:* Can you choose (and swap) credential providers?
3.  **Risk/Reputation Registries:** Who decides "trusted" actors?
    *   *Test:* Can you run your own policy engine and still interoperate?

If any answer is “no,” sovereignty is cosmetic.

---

## 5. Compliance Checklist
Use this harness to audit AP2/UCP implementations (Google/Shopify/Wallets) against sovereignty requirements.

**Instructions:**
1.  **Evaluate** the target implementation against public specs/docs.
2.  **Mark Status**: ✅ Supported, ⚠️ Partial/Unclear, ❌ Missing.
3.  **Cite Evidence**.
4.  **Note Mitigation** for missing items.

| ID | Requirement | Status | Evidence / Spec Pointer | Sovereignty Impact | Mitigation (if missing) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | **Delegation and Scope** | | | | |
| A1 | **Intent‑bound authority tokens.** Bindable to intent envelope (budget, category, time) without re‑prompting. | | | **High** | Local policy engine generates signed mandates. |
| A2 | **Hard revocation/expiry.** Immediate revocation; short‑lived tokens refreshable only under policy. | | | **High** | Short‑lived JWTs with online revocation lists. |
| A3 | **Least‑privilege.** Default credential useless outside scope/context (anti‑replay/exfiltration). | | | **High** | Channel‑binding; merchant‑specific constraints. |
| **B** | **Verifiable Agency** | | | | |
| B1 | **Proof‑of‑agency ≠ Proof‑of‑identity.** Verify authorization without full identity/funding exposure. | | | **High** | Verifiable Credentials (VCs); ZK proofs. |
| B2 | **Selective disclosure.** Minimal attributes only (e.g., region, flags). Stable IDs optional. | | | **Medium** | Attribute‑based credentials; privacy proxies. |
| **C** | **Settlement & fulfillment** | | | | |
| C1 | **Conditional settlement hooks.** Lock payment to UCP order states (fulfilled/confirmed). | | | **High** | Smart‑contract logic; payment channel conditions. |
| C2 | **Cryptographic receipts.** Auditable receipt bound to delegation, order, agent, and merchant. | | | **Medium** | Signed receipts logged in user ledger. |
| **D** | **Dispute & Liability** | | | | |
| D1 | **Protocol‑layer disputes.** Machine‑addressable dispute resolution, not just support tickets. | | | **High** | On‑chain resolution; arbitration oracles. |
| D2 | **Liability partitioning.** Clean delineation of user/agent/merchant/PSP fault. | | | **High** | Explicit liability clauses; insurance bonding. |
| **E** | **Portability & Anti‑Enclosure** | | | | |
| E1 | **Multi‑provider compatibility.** Switch providers/issuers without re‑architecting. | | | **High** | Standard APIs; abstraction layers. |
| E2 | **No mandatory discovery lock‑in.** Usable with non‑dominant discovery engines. | | | **High** | Decentralized discovery (DHT, etc.). |
| E3 | **Local policy authoring.** Author policy locally/governance integration; standard interfaces. | | | **High** | OPA/CEDAR support; signed policy VCs. |
| **F** | **Security Posture** | | | | |
| F1 | **Auditable event log.** Standard schema for full lifecycle (delegation → dispute). | | | **Medium** | Activity Streams format; user‑storage logging. |
| F2 | **Safe degradation.** Ambiguity = Pause (not complete). | | | **High** | strict circuit‑breakers; human‑in‑the‑loop default. |

---

### **6. Usage**
This artifact is designed to be **reused and updated**.
-   **Drafting Policies**: Use Section 2 to define your own agent's operating constraints.
-   **Evaluating Vendors**: Use Section 5 to score potential partners or platforms.
-   **Architecture Audit**: Use Section 3 & 4 to check if your own mesh is prone to enclosure.
