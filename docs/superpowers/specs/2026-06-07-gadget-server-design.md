# GadgetServer — Design Specification

> **Status**: Approved | **Date**: 2026-06-07 | **Author**: Claude + User

## Overview

GadgetServer is a local web application that allows users to register, manage, execute, and compose small tools (scripts, web apps, APIs) generated during Claude usage into a unified platform. It provides automatic UI generation, a workflow/pipeline engine, and Claude integration via Skill commands and MCP Server.

## Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | Node.js + TypeScript + Express | User preference, full-stack TypeScript |
| Frontend | React + TypeScript + Vite | Rich ecosystem, dynamic UI |
| Database | SQLite (better-sqlite3) | Local, zero-config, structured queries |
| Tool Storage | Filesystem (`tools/` directory) | Direct file access, easy backup |
| Claude Integration | Skill (`/gadget`) + MCP Server | Human interaction + programmatic access |
| Process Management | pm2 or node-windows | Windows service, auto-start |
| Real-time | WebSocket (ws) | Live execution logs |

## Architecture: Modular Monolith

Single process with clear internal module boundaries communicating via EventBus:

```
┌─────────────────────────────────────────────────────────┐
│                     gadget-server                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              API Gateway (Express)                 │   │
│  │  /api/*    REST API                               │   │
│  │  /mcp/*    MCP Protocol                           │   │
│  │  /ws       WebSocket                              │   │
│  └──────┬──────────────┬──────────────┬──────────────┘   │
│         │              │              │                   │
│  ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐          │
│  │ Tool        │ │ Workflow   │ │ Claude     │          │
│  │ Registry    │ │ Engine     │ │ Bridge      │          │
│  └──────┬──────┘ └─────┬──────┘ └─────────────┘          │
│         │              │                                   │
│  ┌──────▼──────────────▼──────┐                          │
│  │        Core Services        │                          │
│  │  SQLite | FileSystem | PM   │                          │
│  │  EventBus                   │                          │
│  └────────────────────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
gadget-server/
├── package.json
├── tsconfig.json
├── vite.config.ts
│
├── server/                     # Backend
│   ├── index.ts                # Entry point
│   ├── config.ts               # Configuration
│   ├── registry/               # Tool registry
│   │   ├── ToolRegistry.ts     # CRUD + query
│   │   ├── ToolSchema.ts       # Data models
│   │   ├── UIGenerator.ts      # UI config generation
│   │   └── Scanner.ts          # Filesystem scanner
│   ├── executor/               # Tool execution
│   │   ├── ProcessManager.ts   # Subprocess management
│   │   ├── Sandbox.ts          # Execution isolation
│   │   └── AdapterBase.ts      # Adapter base class
│   ├── workflow/               # Workflow engine
│   │   ├── WorkflowEngine.ts   # DAG parser + topological sort
│   │   ├── Pipeline.ts         # Pipe: output → input
│   │   └── WorkflowSchema.ts   # Workflow data model
│   ├── bridge/                 # Claude bridge
│   │   ├── ClaudeQuery.ts      # Query interface
│   │   ├── ContextInjector.ts  # Context injection
│   │   └── SkillCommand.ts     # /gadget command handler
│   ├── mcp/                    # MCP Server
│   │   ├── McpServer.ts        # Protocol implementation
│   │   ├── tools/              # Exposed MCP Tools
│   │   └── resources/          # Exposed resources
│   ├── api/                    # REST routes
│   │   ├── toolRoutes.ts
│   │   ├── workflowRoutes.ts
│   │   ├── executeRoutes.ts
│   │   └── claudeRoutes.ts
│   ├── db/                     # Data layer
│   │   ├── sqlite.ts           # better-sqlite3 init
│   │   ├── migrations/         # SQL migrations
│   │   └── repositories/       # Data access
│   └── events/                 # EventBus
│       └── EventBus.ts
│
├── client/                     # Frontend React SPA
│   ├── index.html
│   ├── App.tsx
│   ├── main.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx       # Overview
│   │   ├── ToolList.tsx        # Tool grid + search
│   │   ├── ToolDetail.tsx      # Tool detail + dynamic UI
│   │   ├── WorkflowEditor.tsx  # DAG editor
│   │   └── Settings.tsx        # System settings
│   ├── components/
│   │   ├── ToolCard.tsx
│   │   ├── ToolForm.tsx        # Dynamic form generator
│   │   ├── ExecutionLog.tsx    # Real-time log viewer
│   │   └── DAGCanvas.tsx       # DAG visualization
│   ├── hooks/
│   │   ├── useTools.ts
│   │   ├── useExecute.ts
│   │   └── useWorkflow.ts
│   └── lib/
│       ├── api.ts              # API client
│       └── types.ts            # Shared types
│
├── tools/                      # User tools directory
│   └── .registry/              # Auto-generated registry files
│
└── data/
    └── gadget.db               # SQLite database
```

## Data Model

### Tool Manifest (`tools/{name}/manifest.json`)

```json
{
  "id": "img-compressor",
  "name": "Image Compressor",
  "version": "1.0.0",
  "description": "Batch compress images, supports WebP/PNG/JPG",
  "category": "media",
  "tags": ["image", "compress", "batch"],
  "mode": "cli",
  "runtime": {
    "type": "python",
    "entry": "compress.py",
    "timeout": 30000,
    "env": { "PYTHONUNBUFFERED": "1" }
  },
  "inputs": [
    { "key": "files", "label": "Image Files", "type": "file[]",
      "required": true, "accept": ".png,.jpg,.webp" },
    { "key": "quality", "label": "Quality", "type": "range",
      "default": 80, "min": 1, "max": 100 }
  ],
  "outputs": [
    { "type": "file", "label": "Compressed images", "mime": "image/*" }
  ],
  "ui": {
    "icon": "image",
    "color": "#22c55e",
    "layout": "form",
    "preview": true
  },
  "adapter": {
    "input":  { "format": "file[]" },
    "output": { "format": "file[]" }
  }
}
```

### Input Type → UI Control Mapping

| `inputs[].type` | Rendered UI Control |
|-----------------|---------------------|
| `string` | Text input |
| `text` | Textarea |
| `number` | Number input |
| `range` | Range slider |
| `boolean` | Checkbox / Toggle |
| `select` | Dropdown select |
| `file` | File picker |
| `file[]` | Multi-file upload |
| `folder` | Directory picker |
| `url` | URL input |
| `json` | JSON editor |
| `secret` | Password input |
| `color` | Color picker |

### SQLite Tables

```sql
CREATE TABLE tools (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  mode        TEXT NOT NULL,       -- cli | http | web | composite
  manifest    TEXT NOT NULL,       -- Full manifest JSON
  status      TEXT DEFAULT 'active',
  dir_path    TEXT NOT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workflows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  graph       TEXT NOT NULL,       -- DAG JSON: {nodes, edges}
  created_at  TEXT,
  updated_at  TEXT
);

CREATE TABLE executions (
  id          TEXT PRIMARY KEY,
  tool_id     TEXT NOT NULL,
  workflow_id TEXT,                -- NULL = standalone
  status      TEXT,                -- running | success | failed | timeout
  input_params TEXT,
  output      TEXT,
  log         TEXT,
  started_at  TEXT,
  finished_at TEXT,
  duration_ms INTEGER
);
```

## API Design

### REST API (Frontend)

```
# Tool Management
GET    /api/tools              → Tool list (search, filter, paginate)
GET    /api/tools/:id          → Tool detail with manifest
POST   /api/tools              → Register new tool
POST   /api/tools/scan         → Scan tools/ directory
PUT    /api/tools/:id          → Update tool metadata
DELETE /api/tools/:id          → Uninstall tool
GET    /api/tools/:id/ui       → Auto-generated UI config

# Execution
POST   /api/execute/:toolId    → Execute tool → returns exec ID
GET    /api/execute/:execId    → Execution status + result
GET    /api/execute/:execId/log → SSE real-time log stream
POST   /api/execute/:execId/cancel → Cancel execution

# Workflow
GET    /api/workflows              → Workflow list
POST   /api/workflows              → Create workflow (DAG JSON)
GET    /api/workflows/:id          → Workflow detail
PUT    /api/workflows/:id          → Update workflow
POST   /api/workflows/:id/run      → Execute workflow
GET    /api/workflows/:id/validate → Validate DAG
```

### Claude Query API (`/api/claude`)

```
GET    /api/claude/tools                → All tools summary
GET    /api/claude/tools/:id/docs       → Full tool documentation
GET    /api/claude/tools/:id/adapter    → Adapter signature
POST   /api/claude/search               → Semantic search: {"query":"..."}
POST   /api/claude/compatible           → Find compatible tool chains
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `gadget_list_tools` | List all registered tools |
| `gadget_get_docs` | Get tool documentation |
| `gadget_find_compatible` | Find compatible tools for chaining |
| `gadget_create_workflow` | Create tool workflow |

### MCP Resources

| Resource | Content |
|----------|---------|
| `gadget://tools/{id}/manifest` | Tool manifest.json |
| `gadget://tools/{id}/readme` | Tool README |

## Frontend Pages

1. **Dashboard** — Stats cards (tool count, execution count, workflows, success rate) + recent executions
2. **ToolList** — Search + filter grid of tool cards, each showing name, mode, version, status
3. **ToolDetail** — Tool info + dynamically generated operation form based on manifest.inputs
4. **WorkflowEditor** — DAG canvas with drag-drop from tool palette, connect nodes, save/run workflow
5. **Settings** — Port, tool directory, auto-start toggle, MCP server toggle

## Claude Integration

### Skill Commands

```
/gadget list          → List all registered tools
/gadget docs <name>   → View tool documentation
/gadget run <name>    → Execute a tool
/gadget search <kw>   → Search tools
/gadget workflow      → Open workflow builder mode
/gadget register      → Register generated code as a tool
/gadget open          → Open frontend in browser
```

### Deployment

- **Local**: `node server/index.js` → runs at `http://localhost:3000`
- **Frontend dev**: `npm run dev` → Vite dev server at `http://localhost:5173`
- **Production**: Frontend built to `client/dist/`, served by Express as static files
- **Windows Service**: `pm2 start` + `pm2 startup` or `node-windows`
- **Future**: Docker / cloud deployment supported by design

## Implementation Phases

1. **Phase 1**: Project scaffold + SQLite + Tool Registry API
2. **Phase 2**: Tool Executor + WebSocket logs
3. **Phase 3**: Workflow Engine + Pipeline
4. **Phase 4**: Frontend SPA (all 5 pages)
5. **Phase 5**: Claude Bridge + MCP Server + Skill
6. **Phase 6**: Polish, Windows service, documentation
