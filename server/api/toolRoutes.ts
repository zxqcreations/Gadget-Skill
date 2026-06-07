import { Router, Request, Response } from 'express';
import { toolRegistry } from '../registry/ToolRegistry';
import { scanner } from '../registry/Scanner';
import { generateUIConfig } from '../registry/UIGenerator';
import { ToolManifest } from '../../shared/types';

const router = Router();

// List all tools
router.get('/', (req: Request, res: Response) => {
  const { category, mode, status, search } = req.query;
  const tools = toolRegistry.list({
    category: category as string | undefined,
    mode: mode as string | undefined,
    status: status as 'active' | 'broken' | 'disabled' | undefined,
    search: search as string | undefined,
  });

  res.json({
    success: true,
    data: tools,
    meta: { total: tools.length },
  });
});

// Get categories
router.get('/categories', (_req: Request, res: Response) => {
  const categories = toolRegistry.getCategories();
  res.json({ success: true, data: categories });
});

// Get single tool
router.get('/:id', (req: Request, res: Response) => {
  const tool = toolRegistry.get(req.params.id);
  if (!tool) {
    res.status(404).json({ success: false, error: 'Tool not found' });
    return;
  }
  res.json({ success: true, data: tool });
});

// Get tool UI config
router.get('/:id/ui', (req: Request, res: Response) => {
  const tool = toolRegistry.get(req.params.id);
  if (!tool) {
    res.status(404).json({ success: false, error: 'Tool not found' });
    return;
  }
  const uiConfig = generateUIConfig(tool.manifest);
  res.json({ success: true, data: uiConfig });
});

// Register a new tool
router.post('/', (req: Request, res: Response) => {
  try {
    const { manifest, files } = req.body as {
      manifest: ToolManifest;
      files?: { name: string; content: string }[];
    };

    if (!manifest || !manifest.id || !manifest.name) {
      res.status(400).json({ success: false, error: 'Invalid manifest: id and name are required' });
      return;
    }

    const toolDir = scanner.createTool(manifest, files);
    const record = toolRegistry.register(manifest, toolDir);

    res.json({ success: true, data: record });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Scan tools directory
router.post('/scan', (_req: Request, res: Response) => {
  const result = scanner.scan();
  res.json({ success: true, data: result });
});

// Update a tool
router.put('/:id', (req: Request, res: Response) => {
  const { manifest, status } = req.body as {
    manifest?: Partial<ToolManifest>;
    status?: 'active' | 'broken' | 'disabled';
  };

  const updated = toolRegistry.update(req.params.id, { manifest, status });
  if (!updated) {
    res.status(404).json({ success: false, error: 'Tool not found' });
    return;
  }

  res.json({ success: true, data: updated });
});

// Uninstall a tool
router.delete('/:id', (req: Request, res: Response) => {
  const removeFiles = req.query.removeFiles === 'true';
  const deleted = toolRegistry.uninstall(req.params.id, removeFiles);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Tool not found' });
    return;
  }
  res.json({ success: true, data: { id: req.params.id } });
});

export default router;
