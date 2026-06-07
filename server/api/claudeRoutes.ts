import { Router, Request, Response } from 'express';
import { toolRegistry } from '../registry/ToolRegistry';
import { scanner } from '../registry/Scanner';

const router = Router();

/**
 * Claude-dedicated endpoints.
 * These are optimized for AI consumption — concise, structured, with adapter info.
 */

// Get summary of all tools (for Claude context injection)
router.get('/tools', (_req: Request, res: Response) => {
  const tools = toolRegistry.list({ status: 'active' });

  const summary = tools.map((t) => ({
    id: t.id,
    name: t.name,
    mode: t.mode,
    description: t.manifest.description,
    category: t.manifest.category,
    tags: t.manifest.tags,
    adapter: t.manifest.adapter,
    version: t.manifest.version,
  }));

  res.json({ success: true, data: summary, meta: { total: summary.length } });
});

// Get full docs for a tool
router.get('/tools/:id/docs', (req: Request, res: Response) => {
  const tool = toolRegistry.get(req.params.id);
  if (!tool) {
    res.status(404).json({ success: false, error: 'Tool not found' });
    return;
  }

  const readme = scanner.generateReadme(tool.manifest);

  res.json({
    success: true,
    data: {
      manifest: tool.manifest,
      readme,
      status: tool.status,
      createdAt: tool.createdAt,
      updatedAt: tool.updatedAt,
    },
  });
});

// Get adapter signature for a tool
router.get('/tools/:id/adapter', (req: Request, res: Response) => {
  const tool = toolRegistry.get(req.params.id);
  if (!tool) {
    res.status(404).json({ success: false, error: 'Tool not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      toolId: tool.id,
      toolName: tool.name,
      adapter: tool.manifest.adapter,
      inputs: tool.manifest.inputs.map((i) => ({
        key: i.key,
        label: i.label,
        type: i.type,
        required: i.required,
      })),
      outputs: tool.manifest.outputs,
    },
  });
});

// Search tools semantically (full-text for now)
router.post('/search', (req: Request, res: Response) => {
  const { query } = req.body as { query: string };
  if (!query) {
    res.status(400).json({ success: false, error: 'query is required' });
    return;
  }

  const results = toolRegistry.search(query);
  res.json({
    success: true,
    data: results.map((t) => ({
      id: t.id,
      name: t.name,
      mode: t.mode,
      description: t.manifest.description,
      adapter: t.manifest.adapter,
      tags: t.manifest.tags,
    })),
    meta: { total: results.length },
  });
});

// Find compatible tools for chaining
router.post('/compatible', (req: Request, res: Response) => {
  const { from, to } = req.body as { from?: string; to?: string };

  if (from) {
    // Find tools compatible downstream of 'from'
    const tool = toolRegistry.get(from);
    if (!tool) {
      res.status(404).json({ success: false, error: `Tool not found: ${from}` });
      return;
    }
    const compatible = toolRegistry.findCompatible(
      tool.manifest.adapter.output.format,
      'downstream'
    );
    res.json({
      success: true,
      data: {
        source: { id: tool.id, name: tool.name, adapter: tool.manifest.adapter },
        compatible: compatible.map((t) => ({
          id: t.id,
          name: t.name,
          adapter: t.manifest.adapter,
        })),
      },
    });
    return;
  }

  if (to) {
    // Find tools compatible upstream of 'to'
    const tool = toolRegistry.get(to);
    if (!tool) {
      res.status(404).json({ success: false, error: `Tool not found: ${to}` });
      return;
    }
    const compatible = toolRegistry.findCompatible(
      tool.manifest.adapter.input.format,
      'upstream'
    );
    res.json({
      success: true,
      data: {
        target: { id: tool.id, name: tool.name, adapter: tool.manifest.adapter },
        compatible: compatible.map((t) => ({
          id: t.id,
          name: t.name,
          adapter: t.manifest.adapter,
        })),
      },
    });
    return;
  }

  res.status(400).json({
    success: false,
    error: 'Either "from" or "to" is required',
  });
});

export default router;
