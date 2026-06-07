# GadgetServer Skill

Manage and use your personal library of tools generated during Claude sessions.

## Setup

This skill assumes GadgetServer is running at `http://localhost:3000`. Start it with:
```bash
cd /path/to/gadget-server && npm run dev
```

## Commands

### /gadget list
List all registered tools. Shows each tool's id, name, mode, description, and adapter signature.

Implementation: Call `GET /api/claude/tools` and display results in a table.

### /gadget docs <tool-id>
View full documentation for a specific tool, including inputs, outputs, usage examples.

Implementation: Call `GET /api/claude/tools/{toolId}/docs` and display the manifest and README.

### /gadget search <query>
Search for tools by name, description, or tags.

Implementation: Call `POST /api/claude/search` with `{"query": "<query>"}` and display matching tools.

### /gadget run <tool-id>
Execute a tool. First fetch the tool's UI config to see what inputs are needed, then ask the user for the required inputs, then execute.

Implementation:
1. Call `GET /api/claude/tools/{toolId}/adapter` to get input schema
2. Ask user for required inputs
3. Call `POST /api/execute/{toolId}` with params
4. Display result

### /gadget workflow
Enter workflow building mode. In this mode:
1. List available tools and their adapter signatures
2. Help user identify compatible tool chains
3. Create workflows using `POST /api/workflows`

Implementation:
1. Call `GET /api/claude/tools` to get all tools
2. For each tool, show its adapter (input/output format)
3. Use `POST /api/claude/compatible` to find chains
4. When ready, call `POST /api/workflows` to save

### /gadget register <description>
Register the code we just generated as a new tool. Claude will:
1. Analyze the generated code
2. Generate a manifest.json with appropriate inputs/outputs
3. Call `POST /api/tools` to register
4. Report the result

Implementation: Analyze the code in the current conversation, determine its mode (cli/http), infer inputs from CLI arguments or function parameters, generate manifest, and POST to /api/tools.

### /gadget open
Open the GadgetServer frontend in the browser.

Implementation: Open `http://localhost:3000` in the default browser.
