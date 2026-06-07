import { Router, Request, Response } from 'express';
import fs from 'fs';
import { processManager } from '../executor/ProcessManager';
import { toolRegistry } from '../registry/ToolRegistry';

const router = Router();

// Execute a tool
router.post('/:toolId', async (req: Request, res: Response) => {
  const tool = toolRegistry.get(req.params.toolId);
  if (!tool) {
    res.status(404).json({ success: false, error: 'Tool not found' });
    return;
  }

  if (tool.status !== 'active') {
    res.status(400).json({ success: false, error: `Tool is ${tool.status}` });
    return;
  }

  try {
    const result = await processManager.execute(
      tool.id,
      tool.manifest,
      req.body || {}
    );
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Get execution status
router.get('/:execId', (req: Request, res: Response) => {
  const exec = processManager.getStatus(req.params.execId);
  if (!exec) {
    res.status(404).json({ success: false, error: 'Execution not found' });
    return;
  }
  res.json({ success: true, data: exec });
});

// Get execution log (as text)
router.get('/:execId/log', (req: Request, res: Response) => {
  const exec = processManager.getStatus(req.params.execId);
  if (!exec) {
    res.status(404).json({ success: false, error: 'Execution not found' });
    return;
  }

  if (!exec.logPath || !fs.existsSync(exec.logPath)) {
    res.json({ success: true, data: '' });
    return;
  }

  const log = fs.readFileSync(exec.logPath, 'utf-8');
  res.json({ success: true, data: log });
});

// Get execution log as SSE stream (real-time)
router.get('/:execId/log/stream', (req: Request, res: Response) => {
  const exec = processManager.getStatus(req.params.execId);
  if (!exec) {
    res.status(404).json({ success: false, error: 'Execution not found' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send existing log content
  if (exec.logPath && fs.existsSync(exec.logPath)) {
    const existing = fs.readFileSync(exec.logPath, 'utf-8');
    res.write(`data: ${JSON.stringify({ type: 'buffer', content: existing })}\n\n`);
  }

  // Watch for new log entries
  if (exec.logPath) {
    const watcher = fs.watch(exec.logPath, () => {
      if (fs.existsSync(exec.logPath)) {
        const content = fs.readFileSync(exec.logPath, 'utf-8');
        res.write(`data: ${JSON.stringify({ type: 'update', content })}\n\n`);
      }
    });

    req.on('close', () => {
      watcher.close();
    });
  }

  // Send completion event when done
  const checkInterval = setInterval(() => {
    const updated = processManager.getStatus(req.params.execId);
    if (updated && updated.status !== 'running') {
      res.write(`data: ${JSON.stringify({ type: 'complete', status: updated.status })}\n\n`);
      clearInterval(checkInterval);
      res.end();
    }
  }, 500);

  req.on('close', () => {
    clearInterval(checkInterval);
  });
});

// Cancel execution
router.post('/:execId/cancel', (req: Request, res: Response) => {
  const cancelled = processManager.cancel(req.params.execId);
  if (!cancelled) {
    res.status(404).json({ success: false, error: 'Execution not found or already completed' });
    return;
  }
  res.json({ success: true, data: { id: req.params.execId } });
});

// Get recent execution list + stats
router.get('/', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const recent = processManager.listRecent(limit);
  const stats = processManager.getStats();
  res.json({ success: true, data: { recent, stats } });
});

export default router;
