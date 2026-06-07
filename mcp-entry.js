#!/usr/bin/env node
/**
 * MCP Server entry point for GadgetServer.
 *
 * Registered as an MCP Server in Claude Desktop / Claude Code config:
 * {
 *   "mcpServers": {
 *     "gadget-server": {
 *       "command": "node",
 *       "args": ["<path>/gadget-server/mcp-entry.js"],
 *       "env": { "GADGET_API_URL": "http://localhost:3000" }
 *     }
 *   }
 * }
 */

const GADGET_API = process.env.GADGET_API_URL || 'http://localhost:3000';

// Helper to call the GadgetServer API
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${GADGET_API}${endpoint}`, options);
  return response.json();
}

// MCP Server using stdio transport (JSON-RPC)
process.stdin.setEncoding('utf-8');

let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;

  // Process complete JSON-RPC messages (newline-delimited)
  while (buffer.includes('\n')) {
    const newlineIdx = buffer.indexOf('\n');
    const line = buffer.slice(0, newlineIdx).trim();
    buffer = buffer.slice(newlineIdx + 1);

    if (!line) continue;

    try {
      const request = JSON.parse(line);
      await handleRequest(request);
    } catch (err) {
      sendError(null, -32700, 'Parse error');
    }
  }
});

async function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'gadget-server', version: '1.0.0' },
        capabilities: { tools: {}, resources: {} },
      });
      break;

    case 'tools/list':
      sendResponse(id, {
        tools: [
          {
            name: 'gadget_list_tools',
            description: 'List all registered tools in GadgetServer. Returns each tool\'s id, name, description, mode, category, tags, and adapter signature.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'gadget_get_docs',
            description: 'Get full documentation for a specific tool, including its manifest, inputs, outputs, and generated README.',
            inputSchema: {
              type: 'object',
              properties: {
                tool_id: { type: 'string', description: 'The tool ID (e.g., "img-compressor")' },
              },
              required: ['tool_id'],
            },
          },
          {
            name: 'gadget_find_compatible',
            description: 'Find tools that can be chained with a given tool. Use direction="downstream" to find tools that can consume this tool\'s output, or "upstream" to find tools whose output this tool can consume.',
            inputSchema: {
              type: 'object',
              properties: {
                tool_id: { type: 'string', description: 'The tool ID to find compatibles for' },
                direction: {
                  type: 'string',
                  enum: ['upstream', 'downstream'],
                  description: 'Direction: upstream (tools whose output feeds into this tool) or downstream (tools that can consume this tool\'s output)',
                },
              },
              required: ['tool_id', 'direction'],
            },
          },
          {
            name: 'gadget_create_workflow',
            description: 'Create a new workflow by specifying tool IDs and their connections. The system will validate adapter compatibility.',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Workflow name' },
                description: { type: 'string', description: 'Workflow description' },
                tools: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Ordered list of tool IDs to chain',
                },
              },
              required: ['name', 'tools'],
            },
          },
        ],
      });
      break;

    case 'resources/list':
      sendResponse(id, {
        resources: [
          {
            uri: 'gadget://tools',
            name: 'All tool manifests',
            description: 'List of all registered tool manifests',
            mimeType: 'application/json',
          },
        ],
      });
      break;

    case 'tools/call': {
      const { name, arguments: args } = params;
      try {
        const result = await handleToolCall(name, args);
        sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (err) {
        sendResponse(id, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true });
      }
      break;
    }

    case 'resources/read': {
      const { uri } = params;
      if (uri === 'gadget://tools') {
        const result = await apiCall('/api/claude/tools');
        sendResponse(id, {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(result, null, 2) }],
        });
      } else {
        sendError(id, -32602, `Unknown resource: ${uri}`);
      }
      break;
    }

    case 'notifications/initialized':
      // No response needed
      break;

    case 'ping':
      sendResponse(id, {});
      break;

    default:
      sendError(id, -32601, `Method not found: ${method}`);
  }
}

async function handleToolCall(name, args) {
  switch (name) {
    case 'gadget_list_tools': {
      const result = await apiCall('/api/claude/tools');
      return result.data || result;
    }

    case 'gadget_get_docs': {
      if (!args.tool_id) throw new Error('tool_id is required');
      const result = await apiCall(`/api/claude/tools/${args.tool_id}/docs`);
      return result.data || result;
    }

    case 'gadget_find_compatible': {
      if (!args.tool_id || !args.direction) throw new Error('tool_id and direction are required');
      const tool = await apiCall(`/api/claude/tools/${args.tool_id}/adapter`);
      const toolData = tool.data;

      if (args.direction === 'downstream') {
        const result = await apiCall('/api/claude/compatible', 'POST', { from: args.tool_id });
        return result.data || result;
      } else {
        const result = await apiCall('/api/claude/compatible', 'POST', { to: args.tool_id });
        return result.data || result;
      }
    }

    case 'gadget_create_workflow': {
      if (!args.name || !args.tools) throw new Error('name and tools are required');

      // Create nodes and edges from ordered tool list
      const nodes = args.tools.map((toolId, i) => ({
        id: `node_${i}`,
        toolId,
        label: toolId,
      }));

      const edges = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge_${i}_${i + 1}`,
          source: nodes[i].id,
          target: nodes[i + 1].id,
        });
      }

      const graph = { nodes, edges };
      const result = await apiCall('/api/workflows', 'POST', {
        name: args.name,
        description: args.description || '',
        graph,
      });

      return result.data || result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function sendResponse(id, result) {
  const response = { jsonrpc: '2.0', id, result };
  process.stdout.write(JSON.stringify(response) + '\n');
}

function sendError(id, code, message) {
  const response = { jsonrpc: '2.0', id, error: { code, message } };
  process.stdout.write(JSON.stringify(response) + '\n');
}
