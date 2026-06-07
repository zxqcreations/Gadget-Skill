import React, { useEffect, useState } from 'react';
import { fetchTools, fetchWorkflows, createWorkflow, runWorkflow, deleteWorkflow, validateWorkflow } from '../lib/api';
import type { ToolRecord, WorkflowRecord, WorkflowNode, WorkflowEdge, WorkflowGraph } from '../lib/types';

export default function WorkflowEditor() {
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [wfName, setWfName] = useState('');
  const [wfDesc, setWfDesc] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [wfRes, toolRes] = await Promise.all([fetchWorkflows(), fetchTools()]);
      if (wfRes.success && wfRes.data) setWorkflows(wfRes.data);
      if (toolRes.success && toolRes.data) setTools(toolRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectTool(toolId: string) {
    setSelectedTools((prev) => {
      if (prev.includes(toolId)) return prev.filter((t) => t !== toolId);
      return [...prev, toolId];
    });
  }

  function moveTool(index: number, direction: 'up' | 'down') {
    setSelectedTools((prev) => {
      const next = [...prev];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= next.length) return prev;
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  }

  function buildGraph(): WorkflowGraph {
    const nodes: WorkflowNode[] = selectedTools.map((toolId, i) => ({
      id: `node_${i}`,
      toolId,
      label: tools.find((t) => t.id === toolId)?.name || toolId,
    }));

    const edges: WorkflowEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `edge_${i}_${i + 1}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
      });
    }

    return { nodes, edges };
  }

  async function handleCreate() {
    if (!wfName || selectedTools.length < 2) {
      alert('Workflow name and at least 2 tools are required.');
      return;
    }

    const graph = buildGraph();

    // Validate first
    const validation = await validateWorkflow(graph);
    if (validation.success && validation.data && !validation.data.valid) {
      setValidationErrors(validation.data.errors);
      return;
    }

    const res = await createWorkflow({ name: wfName, description: wfDesc, graph });
    if (res.success) {
      setShowCreate(false);
      setWfName('');
      setWfDesc('');
      setSelectedTools([]);
      setValidationErrors([]);
      loadData();
    } else {
      alert('Failed to create workflow: ' + (res.error || 'Unknown error'));
    }
  }

  async function handleRun(wfId: string) {
    const res = await runWorkflow(wfId);
    if (res.success) {
      alert('Workflow started. Check execution logs for results.');
    } else {
      alert('Failed to run workflow: ' + (res.error || 'Unknown error'));
    }
  }

  async function handleDelete(wfId: string) {
    if (!confirm('Delete this workflow?')) return;
    await deleteWorkflow(wfId);
    loadData();
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Workflows</h1>
          <p className="page-subtitle">{workflows.length} workflows</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Workflow
        </button>
      </div>

      {/* Create Workflow Modal */}
      {showCreate && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Create Workflow</h3>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="e.g., Download → Compress → Upload" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" value={wfDesc} onChange={(e) => setWfDesc(e.target.value)} rows={2} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            {/* Available Tools */}
            <div>
              <label className="form-label">Available Tools</label>
              <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm)' }}>
                {tools.map((tool) => {
                  const selected = selectedTools.includes(tool.id);
                  return (
                    <div
                      key={tool.id}
                      onClick={() => handleSelectTool(tool.id)}
                      style={{
                        padding: '8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        fontSize: '13px',
                        background: selected ? 'var(--color-accent)' : 'transparent',
                        color: selected ? 'white' : 'var(--color-text)',
                        marginBottom: '4px',
                      }}
                    >
                      {tool.name}
                      <span className="text-muted" style={{ fontSize: '11px', display: 'block' }}>
                        {tool.manifest.adapter.input.format} → {tool.manifest.adapter.output.format}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pipeline Order */}
            <div>
              <label className="form-label">Pipeline Order ({selectedTools.length} selected)</label>
              <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm)' }}>
                {selectedTools.length === 0 && (
                  <p className="text-muted" style={{ fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                    Click tools on the left to add them to the pipeline. Drag to reorder.
                  </p>
                )}
                {selectedTools.map((toolId, i) => {
                  const tool = tools.find((t) => t.id === toolId);
                  return (
                    <div key={toolId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      background: 'var(--color-surface)',
                      borderRadius: '4px',
                      marginBottom: '4px',
                    }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: '13px' }}>{tool?.name || toolId}</span>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => moveTool(i, 'up')}
                        disabled={i === 0}
                      >
                        ↑
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => moveTool(i, 'down')}
                        disabled={i === selectedTools.length - 1}
                      >
                        ↓
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div style={{ marginTop: 'var(--space-md)', background: 'rgba(239,68,68,0.1)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
              {validationErrors.map((err, i) => (
                <div key={i} className="text-danger" style={{ fontSize: '12px' }}>⚠ {err}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
            <button className="btn btn-primary" onClick={handleCreate}>Create Workflow</button>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Workflow List */}
      {workflows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔗</div>
          <div className="empty-state-title">No workflows yet</div>
          <p>Create a workflow to chain multiple tools together into a pipeline.</p>
        </div>
      ) : (
        <div className="card-grid">
          {workflows.map((wf) => (
            <div key={wf.id} className="card">
              <h3 style={{ fontSize: '15px', marginBottom: '4px' }}>{wf.name}</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                {wf.description || 'No description'}
              </p>
              <div style={{ marginBottom: 'var(--space-sm)' }}>
                {wf.graph.nodes.map((node, i) => (
                  <span key={node.id}>
                    {i > 0 && <span style={{ color: 'var(--color-text-muted)', margin: '0 4px' }}>→</span>}
                    <span className="tag">{node.toolId}</span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleRun(wf.id)}>▶ Run</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(wf.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
