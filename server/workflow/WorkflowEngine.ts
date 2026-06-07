import { v4 as uuid } from 'uuid';
import { WorkflowGraph, WorkflowNode, WorkflowRecord, WorkflowEdge } from '../../shared/types';
import { store } from '../db/store';
import { toolRegistry } from '../registry/ToolRegistry';
import { processManager } from '../executor/ProcessManager';

const COLLECTION = 'workflows';

export class WorkflowEngine {
  /**
   * Create a new workflow
   */
  create(name: string, description: string, graph: WorkflowGraph): WorkflowRecord {
    const now = new Date().toISOString();
    const record: WorkflowRecord = {
      id: uuid(),
      name,
      description,
      graph,
      createdAt: now,
      updatedAt: now,
    };
    store.insert(COLLECTION, record);
    return record;
  }

  /**
   * Get a workflow by ID
   */
  get(id: string): WorkflowRecord | undefined {
    return store.findById<WorkflowRecord>(COLLECTION, id);
  }

  /**
   * List all workflows
   */
  list(): WorkflowRecord[] {
    return store.findAll<WorkflowRecord>(COLLECTION);
  }

  /**
   * Update a workflow
   */
  update(id: string, updates: Partial<Pick<WorkflowRecord, 'name' | 'description' | 'graph'>>): WorkflowRecord | null {
    return store.update<WorkflowRecord>(COLLECTION, id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Delete a workflow
   */
  delete(id: string): boolean {
    return store.delete(COLLECTION, id);
  }

  /**
   * Validate a workflow graph
   */
  validate(graph: WorkflowGraph): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check all nodes reference existing tools
    for (const node of graph.nodes) {
      const tool = toolRegistry.get(node.toolId);
      if (!tool) {
        errors.push(`Node "${node.id}" references unknown tool: ${node.toolId}`);
      }
    }

    // Check for cycles using Kahn's algorithm
    if (graph.edges.length > 0) {
      const inDegree = new Map<string, number>();
      const adjacency = new Map<string, string[]>();

      for (const node of graph.nodes) {
        inDegree.set(node.id, 0);
        adjacency.set(node.id, []);
      }

      for (const edge of graph.edges) {
        adjacency.get(edge.source)?.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      }

      const queue: string[] = [];
      for (const [nodeId, deg] of inDegree) {
        if (deg === 0) queue.push(nodeId);
      }

      let visited = 0;
      while (queue.length > 0) {
        const current = queue.shift()!;
        visited++;
        for (const neighbor of adjacency.get(current) || []) {
          const newDeg = (inDegree.get(neighbor) || 1) - 1;
          inDegree.set(neighbor, newDeg);
          if (newDeg === 0) queue.push(neighbor);
        }
      }

      if (visited !== graph.nodes.length) {
        errors.push('Workflow contains a cycle');
      }

      // Check adapter compatibility for each edge
      for (const edge of graph.edges) {
        const sourceNode = graph.nodes.find((n) => n.id === edge.source);
        const targetNode = graph.nodes.find((n) => n.id === edge.target);
        if (sourceNode && targetNode) {
          const sourceTool = toolRegistry.get(sourceNode.toolId);
          const targetTool = toolRegistry.get(targetNode.toolId);
          if (sourceTool && targetTool) {
            if (sourceTool.manifest.adapter.output.format !== targetTool.manifest.adapter.input.format) {
              errors.push(
                `Edge ${sourceNode.id}→${targetNode.id}: format mismatch ` +
                `(${sourceTool.manifest.adapter.output.format} → ${targetTool.manifest.adapter.input.format})`
              );
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute a workflow — topological order, parallel within levels
   */
  async execute(workflowId: string, initialParams?: Record<string, Record<string, unknown>>): Promise<{
    workflowId: string;
    nodeResults: Map<string, { status: string; output: string | null }>;
  }> {
    const wf = this.get(workflowId);
    if (!wf) throw new Error(`Workflow not found: ${workflowId}`);

    const { graph } = wf;
    const nodeResults = new Map<string, { status: string; output: string | null }>();

    // Compute topological order
    const order = this.topologicalSort(graph);
    if (!order) throw new Error('Workflow contains a cycle, cannot execute');

    // Execute in topological order
    // Nodes at the same depth can run in parallel
    const levels = this.groupByLevel(graph, order);

    for (const level of levels) {
      const promises = level.map(async (node) => {
        const tool = toolRegistry.get(node.toolId);
        if (!tool) {
          nodeResults.set(node.id, { status: 'failed', output: `Tool not found: ${node.toolId}` });
          return;
        }

        // Collect inputs from upstream nodes
        const params: Record<string, unknown> = {
          ...(node.config || {}),
          ...(initialParams?.[node.id] || {}),
        };

        // Get output from each upstream node
        const upstreamEdges = graph.edges.filter((e) => e.target === node.id);
        for (const edge of upstreamEdges) {
          const upstreamResult = nodeResults.get(edge.source);
          if (upstreamResult) {
            params[`__input_${edge.source}`] = upstreamResult.output;
          }
        }

        const result = await processManager.execute(tool.id, tool.manifest, params);
        nodeResults.set(node.id, { status: result.status, output: result.output });
      });

      await Promise.all(promises);
    }

    return { workflowId, nodeResults };
  }

  /**
   * Topological sort using Kahn's algorithm.
   * Returns null if there's a cycle.
   */
  private topologicalSort(graph: WorkflowGraph): string[] | null {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of graph.edges) {
      adjacency.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      for (const neighbor of adjacency.get(current) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    return result.length === graph.nodes.length ? result : null;
  }

  /**
   * Group nodes by execution level (parallel within same level)
   */
  private groupByLevel(graph: WorkflowGraph, order: string[]): WorkflowNode[][] {
    const levels: WorkflowNode[][] = [];
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

    // Compute longest path distance for each node
    const distance = new Map<string, number>();
    for (const nodeId of order) {
      let maxDist = 0;
      const incomingEdges = graph.edges.filter((e) => e.target === nodeId);
      for (const edge of incomingEdges) {
        maxDist = Math.max(maxDist, (distance.get(edge.source) || 0) + 1);
      }
      distance.set(nodeId, maxDist);
    }

    // Group by distance
    const byDistance = new Map<number, WorkflowNode[]>();
    for (const [nodeId, dist] of distance) {
      if (!byDistance.has(dist)) byDistance.set(dist, []);
      byDistance.get(dist)!.push(nodeMap.get(nodeId)!);
    }

    for (let i = 0; byDistance.has(i); i++) {
      levels.push(byDistance.get(i)!);
    }

    return levels;
  }

  count(): number {
    return store.count(COLLECTION);
  }
}

export const workflowEngine = new WorkflowEngine();
