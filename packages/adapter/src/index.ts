/**
 * @sovereign-stack/adapter
 * 
 * Sovereignty-enhancing adapter for MCP, A2A, and other agentic tool protocols.
 */

// Types
export type {
    ToolCall,
    ToolResponse,
    ToolExecutor,
    SovereignResult,
    SovereignAdapterConfig,
    AdapterExecuteOptions,
    VerificationResult,
    TauGate,
    Mirror,
    AdapterEventType,
    AdapterEvent,
    AdapterEventHandler,
} from './types.js';

// τ-Gate
export { DefaultTauGate, BudgetAwareTauGate } from './tau-gate.js';

// Mirror
export { InMemoryMirror } from './mirror.js';

// Adapter
export {
    SovereignAdapter,
    SovereignVerificationError,
    createSovereignAdapter
} from './adapter.js';
