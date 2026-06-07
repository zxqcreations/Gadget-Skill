import { Router, Request, Response } from 'express';
import { workflowEngine } from '../workflow/WorkflowEngine';
import { WorkflowGraph } from '../../shared/types';

const router = Router();

// List workflows
router.get('/', (_req: Request, res: Response) => {
  const workflows = workflowEngine.list();
  res.json({ success: true, data: workflows, meta: { total: workflows.length } });
});

// Get a workflow
router.get('/:id', (req: Request, res: Response) => {
  const wf = workflowEngine.get(req.params.id);
  if (!wf) {
    res.status(404).json({ success: false, error: 'Workflow not found' });
    return;
  }
  res.json({ success: true, data: wf });
});

// Create a workflow
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, graph } = req.body as {
      name: string;
      description: string;
      graph: WorkflowGraph;
    };

    if (!name || !graph || !graph.nodes) {
      res.status(400).json({ success: false, error: 'name and graph are required' });
      return;
    }

    // Validate before creating
    const validation = workflowEngine.validate(graph);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        error: 'Invalid workflow graph',
        data: validation.errors,
      });
      return;
    }

    const wf = workflowEngine.create(name, description, graph);
    res.json({ success: true, data: wf });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Update a workflow
router.put('/:id', (req: Request, res: Response) => {
  const { name, description, graph } = req.body as {
    name?: string;
    description?: string;
    graph?: WorkflowGraph;
  };

  if (graph) {
    const validation = workflowEngine.validate(graph);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        error: 'Invalid workflow graph',
        data: validation.errors,
      });
      return;
    }
  }

  const updated = workflowEngine.update(req.params.id, { name, description, graph });
  if (!updated) {
    res.status(404).json({ success: false, error: 'Workflow not found' });
    return;
  }
  res.json({ success: true, data: updated });
});

// Delete a workflow
router.delete('/:id', (req: Request, res: Response) => {
  const deleted = workflowEngine.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Workflow not found' });
    return;
  }
  res.json({ success: true, data: { id: req.params.id } });
});

// Validate a workflow graph (without creating)
router.post('/validate', (req: Request, res: Response) => {
  const { graph } = req.body as { graph: WorkflowGraph };
  if (!graph) {
    res.status(400).json({ success: false, error: 'graph is required' });
    return;
  }
  const result = workflowEngine.validate(graph);
  res.json({ success: true, data: result });
});

// Execute a workflow
router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const result = await workflowEngine.execute(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
