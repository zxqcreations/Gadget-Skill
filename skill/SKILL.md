# GadgetServer Skill

When the user invokes `/gadget <action>`, follow the instructions below to interact with the GadgetServer running at `http://localhost:3000`.

**Pre-check:** Before any command, verify the server is running:
```
curl -s http://localhost:3000/api/health
```
If it returns an error, tell the user to start the server: `cd <gadget-server-dir> && npm run dev`

---

## /gadget list

List all registered tools.

**Steps:**
1. Call: `curl -s http://localhost:3000/api/claude/tools`
2. Display results as a table:

| ID | Name | Mode | Adapter (in→out) | Description |
|----|------|------|-------------------|-------------|
| ... | ... | ... | ... | ... |

---

## /gadget docs `<tool-id>`

View full documentation for a tool.

**Steps:**
1. Call: `curl -s http://localhost:3000/api/claude/tools/<tool-id>/docs`
2. Display the `readme` field as markdown
3. Also show the adapter signature and input/output list

---

## /gadget search `<query>`

Search tools by name, description, or tags.

**Steps:**
1. Call: `curl -s -X POST http://localhost:3000/api/claude/search -H "Content-Type: application/json" -d '{"query":"<query>"}'`
2. Display matching tools

---

## /gadget run `<tool-id>`

Execute a tool.

**Steps:**
1. Get the tool's input schema: `curl -s http://localhost:3000/api/claude/tools/<tool-id>/adapter`
2. Show the user what inputs are required
3. Ask the user for values (or infer from context)
4. Execute: `curl -s -X POST http://localhost:3000/api/execute/<tool-id> -H "Content-Type: application/json" -d '<params-json>'`
5. Display the result — show stdout on success, stderr on failure

---

## /gadget workflow

Help the user build a tool pipeline.

**Steps:**
1. Call `curl -s http://localhost:3000/api/claude/tools` to see all tools
2. Show each tool's adapter signature (input → output format)
3. Identify compatible chains where one tool's output format matches another's input format
4. To check compatibility automatically: `curl -s -X POST http://localhost:3000/api/claude/compatible -H "Content-Type: application/json" -d '{"from":"<tool-id>"}'`
5. When the user picks a chain, create the workflow:
```
curl -s -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<name>",
    "description": "<description>",
    "graph": {
      "nodes": [{"id":"node_0","toolId":"<tool1>"},{"id":"node_1","toolId":"<tool2>"}],
      "edges": [{"id":"e0","source":"node_0","target":"node_1"}]
    }
  }'
```
6. Tell the user they can view and run it at http://localhost:3000/workflows

---

## /gadget register

**This is the most important command.** It registers code just generated in the current conversation as a GadgetServer tool.

**Steps:**

### Step 1: Identify the code to register
Look at the most recent code block in the conversation. Determine:
- **Language/Runtime**: Is it Python, Node.js, Shell, or a compiled binary?
- **Mode**: 
  - `cli` — a command-line script with arguments/options
  - `http` — an HTTP server / API endpoint
  - `web` — a frontend page or full web app
  - `composite` — multiple files
- **What does it do?** Write a one-line description.
- **Inputs**: What arguments/parameters does it take? For each input, note the key name, a user-friendly label, the type (`string`, `file`, `number`, `boolean`, etc.), whether it's required, and default values.
- **Outputs**: What does it produce? (`text`, `file`, `json`, etc.)
- **Adapter format**: What data format goes in and comes out? Common formats: `text`, `file`, `file[]`, `json`, `url`, `binary`.

### Step 2: Generate the manifest
Create a manifest.json following this exact template:

```json
{
  "id": "<kebab-case-unique-id>",
  "name": "<Human-Readable Name>",
  "version": "1.0.0",
  "description": "<One-line description>",
  "category": "<media|data|text|network|ai|dev|system>",
  "tags": ["<tag1>", "<tag2>"],
  "mode": "<cli|http|web|composite>",
  "runtime": {
    "type": "<python|node|shell|binary|custom>",
    "entry": "<main-filename>",
    "timeout": 30000
  },
  "inputs": [
    {
      "key": "<param-name>",
      "label": "<Human Label>",
      "type": "<string|text|number|range|boolean|select|file|file[]|folder|url|json|secret|color>",
      "required": true,
      "placeholder": "<placeholder>",
      "help": "<help text>"
    }
  ],
  "outputs": [
    { "type": "<text|file|json|html|url|binary>", "label": "<description>" }
  ],
  "ui": {
    "icon": "<terminal|globe|layout|git-merge|tool>",
    "color": "#6366f1",
    "layout": "form"
  },
  "adapter": {
    "input": { "format": "<text|file|file[]|json|url|binary>" },
    "output": { "format": "<text|file|file[]|json|url|binary>" }
  }
}
```

Key guidelines for input types:
- `string` → text input (names, URLs, IDs)
- `text` → multi-line textarea (descriptions, content)
- `number` → number input
- `range` → slider (quality, level, scale)
- `boolean` → checkbox/toggle (flags, on/off)
- `select` → dropdown (choose from options — provide `options` array)
- `file` → single file picker
- `file[]` → multi-file picker
- `folder` → directory path input
- `url` → URL input
- `json` → JSON code editor
- `secret` → password/masked input (API keys, tokens)
- `color` → color picker

### Step 3: Create the tool directory and files
Use the `POST /api/tools` endpoint to register the tool with its manifest and source files:

```bash
curl -s -X POST http://localhost:3000/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": <manifest-json>,
    "files": [
      {"name": "<filename>", "content": "<file-content>"}
    ]
  }'
```

**IMPORTANT:** When passing file content as JSON, escape newlines (`\n`), quotes (`\"`), and backslashes (`\\`). For multi-line scripts, use a tool call (Write) to write the files directly to `tools/<tool-id>/` directory, then call `POST /api/tools/scan` to pick them up.

### Step 4: Report success
Tell the user:
- ✅ Tool registered: `<name>` (`<id>`)
- Mode: `<mode>`, Runtime: `<runtime-type>`
- Frontend UI generated with N inputs
- Open it: `/gadget open` or http://localhost:3000/tools/<id>

---

## /gadget open

Open the GadgetServer frontend in the browser.

**Steps:**
1. Tell the user to open: http://localhost:3000
2. If on the same machine, offer to open it automatically (but don't actually try to execute a browser command — just show the URL).

---

## Quick Reference: Adapter Formats

When choosing adapter formats, use these conventions:
- **text** — plain text, stdout output
- **file** — single file path
- **file[]** — multiple file paths
- **json** — structured JSON data
- **url** — a URL string
- **binary** — raw binary data

Two tools can be chained when tool A's output format matches tool B's input format.
