import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

import { config } from './config';
import { eventBus } from './events/EventBus';
import { scanner } from './registry/Scanner';

import toolRoutes from './api/toolRoutes';
import executeRoutes from './api/executeRoutes';
import workflowRoutes from './api/workflowRoutes';
import claudeRoutes from './api/claudeRoutes';
import fileRoutes from './api/fileRoutes';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// ========== Middleware ==========
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ========== API Routes ==========
app.use('/api/tools', toolRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/claude', claudeRoutes);
app.use('/api/files', fileRoutes);

// ========== System routes ==========
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/stats', (_req, res) => {
  const stats = {
    tools: serverState.toolCount,
    workflows: serverState.workflowCount,
    executions: serverState.executionTotal,
    successRate: serverState.executionTotal > 0
      ? Math.round((serverState.executionSuccess / serverState.executionTotal) * 100)
      : 100,
  };
  res.json({ success: true, data: stats });
});

app.get('/api/config', (_req, res) => {
  res.json({ success: true, data: config });
});

app.put('/api/config', (req, res) => {
  const { updateConfig } = require('./config');
  const updated = updateConfig(req.body);
  res.json({ success: true, data: updated });
});

// ========== Serve frontend in production ==========
const clientDist = path.join(process.cwd(), 'dist', 'client');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ========== WebSocket for real-time logs ==========
const clients: Map<string, Set<WebSocket>> = new Map();

wss.on('connection', (ws, req) => {
  // Extract executionId from query: /ws?executionId=xxx
  const url = new URL(req.url || '/', 'http://localhost');
  const executionId = url.searchParams.get('executionId');

  if (executionId) {
    if (!clients.has(executionId)) {
      clients.set(executionId, new Set());
    }
    clients.get(executionId)!.add(ws);

    ws.on('close', () => {
      clients.get(executionId)?.delete(ws);
      if (clients.get(executionId)?.size === 0) {
        clients.delete(executionId);
      }
    });
  }
});

// Forward execution log events to WebSocket clients
eventBus.on('execution:log', ({ executionId, line, stream }) => {
  const subs = clients.get(executionId);
  if (subs) {
    const msg = JSON.stringify({ type: 'log', executionId, line, stream });
    subs.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
});

eventBus.on('execution:completed', ({ executionId, status }) => {
  const subs = clients.get(executionId);
  if (subs) {
    const msg = JSON.stringify({ type: 'completed', executionId, status });
    subs.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
});

// ========== Server state (shared with MCP) ==========
export const serverState = {
  toolCount: 0,
  workflowCount: 0,
  executionTotal: 0,
  executionSuccess: 0,
};

// ========== Startup ==========
function start() {
  // Scan for tools on startup
  console.log('[GadgetServer] Scanning tools directory...');
  const scanResult = scanner.scan();
  console.log(`[GadgetServer] Found ${scanResult.found} tools (${scanResult.registered} new, ${scanResult.updated} updated)`);
  if (scanResult.errors.length > 0) {
    console.warn('[GadgetServer] Scan errors:', scanResult.errors);
  }

  // Import modules to get references
  const { toolRegistry } = require('./registry/ToolRegistry');
  const { workflowEngine } = require('./workflow/WorkflowEngine');

  serverState.toolCount = toolRegistry.count();
  serverState.workflowCount = workflowEngine.count();

  // Track execution stats
  eventBus.on('execution:completed', ({ status }) => {
    serverState.executionTotal++;
    if (status === 'success') serverState.executionSuccess++;
  });

  server.listen(config.port, () => {
    console.log(`[GadgetServer] 🚀 Server running at http://localhost:${config.port}`);
    console.log(`[GadgetServer] 📦 ${serverState.toolCount} tools loaded`);
    console.log(`[GadgetServer] 🔧 MCP Server: ${config.mcpEnabled ? 'enabled' : 'disabled'}`);
    console.log(`[GadgetServer] 📁 Tools directory: ${config.toolsDir}`);
  });
}

start();

export { app, server };
