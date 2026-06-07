import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTool, fetchToolUI, executeTool, uninstallTool } from '../lib/api';
import type { ToolRecord, UIConfig, ExecutionRecord } from '../lib/types';
import ToolForm from '../components/ToolForm';
import ExecutionLog from '../components/ExecutionLog';

export default function ToolDetail() {
  const { id } = useParams<{ id: string }>();
  const [tool, setTool] = useState<ToolRecord | null>(null);
  const [uiConfig, setUiConfig] = useState<UIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentExecId, setCurrentExecId] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<ExecutionRecord | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [toolRes, uiRes] = await Promise.all([fetchTool(id!), fetchToolUI(id!)]);
        if (toolRes.success && toolRes.data) setTool(toolRes.data);
        if (uiRes.success && uiRes.data) setUiConfig(uiRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleExecute(params: Record<string, unknown>) {
    if (!id) return;
    setExecuting(true);
    setExecResult(null);
    try {
      const res = await executeTool(id, params);
      if (res.success && res.data) {
        setCurrentExecId(res.data.id);
        setExecResult(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExecuting(false);
    }
  }

  async function handleUninstall() {
    if (!id || !tool) return;
    if (!confirm(`Uninstall "${tool.name}"? This cannot be undone.`)) return;
    const removeFiles = confirm('Also delete tool files from disk?');
    const res = await uninstallTool(id, removeFiles);
    if (res.success) {
      window.location.href = '/tools';
    }
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!tool) return <div className="empty-state"><div className="empty-state-title">Tool not found</div></div>;

  const modeColors: Record<string, string> = {
    cli: '#818cf8',
    http: '#4ade80',
    web: '#a78bfa',
    composite: '#fbbf24',
  };

  return (
    <div>
      <div className="page-header">
        <Link to="/tools" style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>← Back to Tools</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
          <h1 className="page-title">{tool.name}</h1>
          <span
            className={`tag tag--${tool.mode}`}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            {tool.mode}
          </span>
        </div>
        <p className="page-subtitle">{tool.manifest.description}</p>
      </div>

      <div className="tool-detail-layout">
        {/* Left: Tool Info + Form */}
        <div>
          <div className="card tool-detail-section">
            <h3 style={{ fontSize: '14px', marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
              Execute Tool
            </h3>
            {uiConfig && (
              <ToolForm
                uiConfig={uiConfig}
                onExecute={handleExecute}
                executing={executing}
              />
            )}
          </div>

          {/* Execution Result */}
          {execResult && (
            <div className="card tool-detail-section">
              <h3 style={{ fontSize: '14px', marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                Result
              </h3>
              <div style={{ marginBottom: 'var(--space-sm)' }}>
                Status: <span className={execResult.status === 'success' ? 'text-success' : 'text-danger'}>
                  {execResult.status}
                </span>
                {execResult.durationMs && ` · ${execResult.durationMs}ms`}
              </div>
              {execResult.output && (
                <div className="log-viewer">
                  {execResult.output}
                </div>
              )}
              {currentExecId && (
                <ExecutionLog executionId={currentExecId} autoConnect />
              )}
            </div>
          )}
        </div>

        {/* Right: Tool Metadata */}
        <div>
          <div className="card tool-detail-section">
            <h3 style={{ fontSize: '14px', marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
              Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', fontSize: '13px' }}>
              <div><span className="text-muted">Version:</span> {tool.manifest.version}</div>
              <div><span className="text-muted">Category:</span> {tool.manifest.category || '-'}</div>
              <div><span className="text-muted">Runtime:</span> {tool.manifest.runtime.type}</div>
              <div><span className="text-muted">Entry:</span> {tool.manifest.runtime.entry}</div>
              <div><span className="text-muted">Timeout:</span> {tool.manifest.runtime.timeout || 30000}ms</div>
              <div><span className="text-muted">Status:</span> {tool.status}</div>
            </div>
          </div>

          <div className="card tool-detail-section">
            <h3 style={{ fontSize: '14px', marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
              Adapter
            </h3>
            <div style={{ fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                <span className="text-muted">Input:</span>
                <code style={{ background: 'var(--color-surface2)', padding: '2px 8px', borderRadius: '4px' }}>
                  {tool.manifest.adapter.input.format}
                </code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span className="text-muted">Output:</span>
                <code style={{ background: 'var(--color-surface2)', padding: '2px 8px', borderRadius: '4px' }}>
                  {tool.manifest.adapter.output.format}
                </code>
              </div>
            </div>
          </div>

          <div className="card tool-detail-section">
            <h3 style={{ fontSize: '14px', marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
              Inputs
            </h3>
            {tool.manifest.inputs.map((input) => (
              <div key={input.key} style={{ marginBottom: 'var(--space-sm)', fontSize: '13px' }}>
                <strong>{input.label}</strong>{' '}
                <span className="tag">{input.type}</span>
                {input.required && <span className="text-danger" style={{ fontSize: '11px', marginLeft: '4px' }}>*required</span>}
                {input.help && <div className="text-muted" style={{ fontSize: '11px' }}>{input.help}</div>}
              </div>
            ))}
          </div>

          <div className="card tool-detail-section">
            <h3 style={{ fontSize: '14px', marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
              Tags
            </h3>
            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
              {tool.manifest.tags?.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          </div>

          <button className="btn btn-danger btn-sm" onClick={handleUninstall} style={{ marginTop: 'var(--space-md)' }}>
            🗑 Uninstall Tool
          </button>
        </div>
      </div>
    </div>
  );
}
