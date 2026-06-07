// ============================================================
// Shared types between frontend and backend
// ============================================================

// --- Tool Manifest ---

export type ToolMode = 'cli' | 'http' | 'web' | 'composite';

export type InputType =
  | 'string' | 'text' | 'number' | 'range' | 'boolean'
  | 'select' | 'file' | 'file[]' | 'folder'
  | 'url' | 'json' | 'secret' | 'color';

export type RuntimeType = 'python' | 'node' | 'shell' | 'binary' | 'custom';

export interface InputParam {
  key: string;
  label: string;
  type: InputType;
  required?: boolean;
  default?: string | number | boolean;
  placeholder?: string;
  help?: string;
  // For 'select' type
  options?: { label: string; value: string }[];
  // For 'range' type
  min?: number;
  max?: number;
  step?: number;
  // For 'file' / 'file[]' type
  accept?: string;
  // For conditional display
  showIf?: { key: string; value: unknown };
}

export interface OutputDef {
  type: 'file' | 'text' | 'json' | 'html' | 'url' | 'binary';
  label: string;
  mime?: string;
}

export interface ToolManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category?: string;
  tags?: string[];
  mode: ToolMode;
  runtime: {
    type: RuntimeType;
    entry: string;
    timeout?: number;         // ms, default 30000
    env?: Record<string, string>;
    args?: string[];           // extra CLI args
    port?: number;             // for 'http' mode
  };
  inputs: InputParam[];
  outputs: OutputDef[];
  ui?: {
    icon?: string;
    color?: string;
    layout?: 'form' | 'inline' | 'wizard';
    preview?: boolean;
  };
  adapter: {
    input: { format: string };
    output: { format: string };
  };
  // Extended fields set by the system
  readme?: string;
  generatedBy?: string;        // "claude-session-<date>"
}

// --- Tool Record (stored in DB) ---

export type ToolStatus = 'active' | 'broken' | 'disabled';

export interface ToolRecord {
  id: string;
  name: string;
  mode: ToolMode;
  manifest: ToolManifest;
  status: ToolStatus;
  dirPath: string;            // Absolute path to tool directory
  createdAt: string;
  updatedAt: string;
}

// --- Executions ---

export type ExecutionStatus = 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';

export interface ExecutionRecord {
  id: string;
  toolId: string;
  workflowId: string | null;
  status: ExecutionStatus;
  inputParams: Record<string, unknown>;
  output: string | null;
  logPath: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

// --- Workflows ---

export interface WorkflowNode {
  id: string;            // node id within the graph
  toolId: string;        // which tool to execute
  label?: string;
  config?: Record<string, unknown>;  // override default params
}

export interface WorkflowEdge {
  id: string;
  source: string;        // source node id
  target: string;        // target node id
  sourceHandle?: string; // which output of source
  targetHandle?: string; // which input of target
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowRecord {
  id: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
  createdAt: string;
  updatedAt: string;
}

// --- API Response Envelope ---

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// --- UI Generation ---

export interface UIFieldConfig {
  key: string;
  label: string;
  type: InputType;
  required: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  help?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  showIf?: { key: string; value: unknown };
}

export interface UIConfig {
  toolId: string;
  toolName: string;
  description: string;
  icon: string;
  color: string;
  layout: 'form' | 'inline' | 'wizard';
  fields: UIFieldConfig[];
  previewEnabled: boolean;
}

// --- Event Bus Events ---

export interface EventMap {
  'tool:registered': { toolId: string };
  'tool:unregistered': { toolId: string };
  'tool:updated': { toolId: string };
  'execution:started': { executionId: string; toolId: string };
  'execution:log': { executionId: string; line: string; stream: 'stdout' | 'stderr' };
  'execution:completed': { executionId: string; status: ExecutionStatus };
}
