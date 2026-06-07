# ⚡ GadgetServer

> A local web application for registering, managing, and composing tools generated during Claude usage.

Turn your Claude-generated scripts, web apps, and APIs into a unified tool ecosystem with automatic UI generation, workflow pipelines, and Claude integration.

## Features

- **📦 Tool Registry** — Register CLI scripts, HTTP services, web apps, and composite tools with a simple JSON manifest
- **🎨 Auto-Generated UI** — Each tool gets a dynamic frontend form based on its input parameters (file pickers, sliders, JSON editors, etc.)
- **🔗 Workflow Engine** — Chain multiple tools into DAG pipelines with adapter compatibility checking
- **🤖 Claude Integration** — Query tools from Claude via `/gadget` commands and MCP Server protocol
- **📡 Real-Time Logs** — WebSocket-based live execution log streaming
- **⚡ Single Command Start** — `npm run dev` starts both backend and frontend

## Quick Start

```bash
# Clone and install
git clone https://github.com/zxqcreations/Gadget-Skill.git
cd Gadget-Skill
npm install

# Start development server (backend + frontend)
npm run dev

# Open the frontend
open http://localhost:5173
```

The backend runs at `http://localhost:3000`, the frontend dev server at `http://localhost:5173` (with API proxy).

## Registering a Tool

### Option 1: From Claude (Recommended)

After Claude generates a script, say `/gadget register` and Claude will analyze the code, create a manifest, and register it.

### Option 2: Manual Registration

Create a directory under `tools/` with a `manifest.json`:

```json
{
  "id": "my-tool",
  "name": "My Tool",
  "version": "1.0.0",
  "description": "What this tool does",
  "mode": "cli",
  "runtime": {
    "type": "python",
    "entry": "main.py",
    "timeout": 30000
  },
  "inputs": [
    { "key": "input_file", "label": "Input File", "type": "file", "required": true }
  ],
  "outputs": [
    { "type": "text", "label": "Result" }
  ],
  "adapter": {
    "input": { "format": "file" },
    "output": { "format": "text" }
  }
}
```

Then run `npm run dev` and the tool will be auto-discovered on startup.

## Creating Workflows

1. Open the frontend → Workflows tab
2. Click "New Workflow"
3. Select tools from the palette and arrange them in order
4. The system automatically validates adapter compatibility
5. Run the workflow to execute all tools in sequence

## Claude Integration

### Skill Commands

| Command | Description |
|---------|-------------|
| `/gadget list` | List all registered tools |
| `/gadget docs <id>` | View tool documentation |
| `/gadget search <kw>` | Search tools |
| `/gadget register` | Register current session code as a tool |
| `/gadget workflow` | Enter workflow building mode |
| `/gadget run <id>` | Execute a tool |
| `/gadget open` | Open frontend in browser |

### MCP Server

Add to your Claude config:

```json
{
  "mcpServers": {
    "gadget-server": {
      "command": "node",
      "args": ["path/to/gadget-server/mcp-entry.js"],
      "env": { "GADGET_API_URL": "http://localhost:3000" }
    }
  }
}
```

MCP Tools exposed:
- `gadget_list_tools` — List all tools with adapter signatures
- `gadget_get_docs` — Get full tool documentation
- `gadget_find_compatible` — Find compatible tools for chaining
- `gadget_create_workflow` — Create a tool workflow

## API Overview

### REST API (Frontend)
```
GET    /api/tools              → List tools
GET    /api/tools/:id          → Tool detail
GET    /api/tools/:id/ui       → Auto-generated UI config
POST   /api/tools              → Register tool
POST   /api/tools/scan         → Scan tools directory
DELETE /api/tools/:id          → Uninstall tool

POST   /api/execute/:toolId    → Execute tool
GET    /api/execute/:execId    → Execution status
GET    /api/execute/:execId/log → Execution log

GET    /api/workflows          → List workflows
POST   /api/workflows          → Create workflow
POST   /api/workflows/:id/run  → Run workflow
```

### Claude API
```
GET    /api/claude/tools              → Tool summaries
GET    /api/claude/tools/:id/docs     → Full documentation
POST   /api/claude/search             → Search tools
POST   /api/claude/compatible         → Find compatible tool chains
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript + Express |
| Frontend | React + TypeScript + Vite |
| Storage | JSON files (data/ directory) |
| Tool Code | Filesystem (tools/ directory) |
| Real-Time | WebSocket (ws) |
| Process Mgmt | Node child_process |

## Project Structure

```
gadget-server/
├── server/           # Backend (Express API)
├── client/           # Frontend (React SPA)
├── shared/           # Shared TypeScript types
├── tools/            # User tools directory
├── skill/            # Claude Skill definition
├── mcp-entry.js      # MCP Server entry point
└── data/             # Runtime data (DB, logs, config)
```

## Windows Service

```bash
# Install as Windows service (requires pm2)
npm install -g pm2
pm2 start server/index.js --name gadget-server
pm2 save
pm2 startup  # Follow the instructions

# Or use node-windows
npm run install-service
```

## License

MIT
