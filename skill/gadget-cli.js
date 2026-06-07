#!/usr/bin/env node
/**
 * CLI helper for /gadget commands.
 * Delegates to the GadgetServer API.
 */

const GADGET_API = process.env.GADGET_API_URL || 'http://localhost:3000';

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${GADGET_API}${endpoint}`, options);
  return response.json();
}

const command = process.argv[2];
const arg = process.argv[3];

async function main() {
  switch (command) {
    case 'list': {
      const result = await apiCall('/api/claude/tools');
      if (result.success && result.data) {
        console.log(`\n📦 ${result.meta.total} tools registered:\n`);
        for (const tool of result.data) {
          console.log(`  ${tool.id}`);
          console.log(`    Name: ${tool.name}`);
          console.log(`    Mode: ${tool.mode} | ${tool.category || 'uncategorized'}`);
          console.log(`    ${tool.description}`);
          console.log(`    Adapter: ${tool.adapter.input.format} → ${tool.adapter.output.format}`);
          console.log('');
        }
      }
      break;
    }

    case 'docs': {
      if (!arg) {
        console.log('Usage: gadget docs <tool-id>');
        break;
      }
      const result = await apiCall(`/api/claude/tools/${arg}/docs`);
      if (result.success && result.data) {
        console.log(result.data.readme);
      } else {
        console.log(`Tool not found: ${arg}`);
      }
      break;
    }

    case 'search': {
      if (!arg) {
        console.log('Usage: gadget search <query>');
        break;
      }
      const result = await apiCall('/api/claude/search', 'POST', { query: arg });
      if (result.success) {
        console.log(`Found ${result.meta.total} matching tools:`);
        for (const tool of result.data) {
          console.log(`  ${tool.id} — ${tool.name}: ${tool.description}`);
        }
      }
      break;
    }

    case 'open': {
      const { exec } = require('child_process');
      const url = GADGET_API;
      const platform = process.platform;
      if (platform === 'win32') {
        exec(`start ${url}`);
      } else if (platform === 'darwin') {
        exec(`open ${url}`);
      } else {
        exec(`xdg-open ${url}`);
      }
      console.log(`Opening ${url}...`);
      break;
    }

    default:
      console.log(`
GadgetServer CLI

Usage: node gadget-cli.js <command> [args]

Commands:
  list              List all registered tools
  docs <tool-id>    View tool documentation
  search <query>    Search tools
  open              Open frontend in browser
`);
  }
}

main().catch(console.error);
