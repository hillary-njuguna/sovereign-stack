# @sovereign-stack/adapter-mcp-fs

A **sovereignty-enforcing adapter** for MCP file system tools. This adapter proves that external systems can be governed by cryptographic user authority.

## 🎯 Purpose

Prove that the Sovereign Stack can **enforce user sovereignty** on external systems that don't care about our principles. This adapter:

1. **Intercepts** MCP file system tool calls
2. **Requires** valid, unrevoked mandates for execution
3. **Produces** verifiable receipts for all actions
4. **Refuses** execution without τ-Gate ratification

## 📦 Installation

```bash
cd packages/adapter-mcp-fs
npm install
npm run build
```

## 🚀 Usage

### Programmatic

```typescript
import { MCPFSAdapter } from '@sovereign-stack/adapter-mcp-fs';
import { createMandate, signMandate } from '@sovereign-stack/core';

const adapter = new MCPFSAdapter();
const keystore = adapter.getKeystore();

// 1. Create and sign a mandate
const keyId = await keystore.ensureUserKey('user:me');
const mandate = createMandate({
  issuer: 'user:me',
  delegate: 'adapter:mcp-fs',
  scope: { actions: ['read_file'], resources: ['file:*'] },
  validity: {}
});
const signedMandate = await signMandate(mandate, keystore, keyId);

// 2. Propose an action (pending ratification)
const proposal = await adapter.propose(
  { tool: 'read_file', arguments: { path: '/tmp/test.txt' } },
  { agentId: 'agent:assistant' }
);

// 3. Commit with the mandate (executes only if all checks pass)
const result = await adapter.commit(proposal.id, signedMandate);

// 4. Get verifiable receipt
console.log(result.receipt);
```

### CLI

```bash
# Create a mandate
sovereign-mcp-fs create-mandate \
  --issuer user:me \
  --actions read_file,list_directory

# Propose an action
sovereign-mcp-fs propose \
  --tool read_file \
  --path /tmp/hello.txt

# Commit the proposal
sovereign-mcp-fs commit \
  --proposal proposal_... \
  --mandate mandate.json

# Revoke a mandate
sovereign-mcp-fs revoke-mandate \
  --id mandate_... \
  --by user:me \
  --reason "policy_change"
```

## 🧪 Testing

```bash
npm test
```

Tests validate:
- ❌ No execution without valid mandate  
- ❌ No execution with revoked mandate  
- ❌ No execution outside scope  
- ✅ Valid mandate → execution + receipt  

## 🔧 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP FS Tool   │    │  MCPFSAdapter   │    │   @sovereign-   │
│     Call        │───▶│                 │───▶│   stack/core    │
│  (read_file)    │    │  1. Propose     │    │                 │
└─────────────────┘    │  2. Verify      │    │ Mandate/Receipt │
                       │  3. Execute     │    │    Primitives   │
                       │  4. Receipt     │    └─────────────────┘
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Event Log     │
                       │ (hash-chained)  │
                       └─────────────────┘
```

## 🛡️ Security Guarantees

| Guarantee | Enforcement |
|-----------|-------------|
| **No Mandate = No Execution** | `INVALID_MANDATE` error |
| **Revoked = Rejected** | `REVOKED_MANDATE` error |
| **Scope Violation = Blocked** | `SCOPE_VIOLATION` error |
| **Every Action = Receipt** | Cryptographic proof |
| **Complete Audit** | Hash-chained event log |

## 📋 API

### `MCPFSAdapter`

```typescript
class MCPFSAdapter {
  propose(action: ToolAction, context: AdapterContext): Promise<Proposal>;
  commit(proposalId: string, mandate: DelegationMandate): Promise<ExecutionResult>;
  getProposal(proposalId: string): Proposal | null;
  getEventLog(): EventLog;
  getKeystore(): InMemoryKeystore;
}
```

### Supported Tools

| Tool | Arguments |
|------|-----------|
| `read_file` | `{ path: string }` |
| `write_file` | `{ path: string, content: string }` |
| `list_directory` | `{ path: string }` |

## 📄 License

Apache 2.0
