import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTools, fetchCategories, scanTools } from '../lib/api';
import type { ToolRecord } from '../lib/types';

export default function ToolList() {
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadTools();
    loadCategories();
  }, [category]);

  async function loadTools() {
    try {
      const res = await fetchTools({ category: category || undefined, search: search || undefined });
      if (res.success && res.data) setTools(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    const res = await fetchCategories();
    if (res.success && res.data) setCategories(res.data);
  }

  async function handleScan() {
    setScanning(true);
    try {
      const res = await scanTools();
      if (res.success && res.data) {
        alert(`Scan complete: ${res.data.registered} new, ${res.data.updated} updated`);
        loadTools();
        loadCategories();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadTools();
  }

  const modeTag = (mode: string) => <span className={`tag tag--${mode}`}>{mode}</span>;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tools</h1>
        <p className="page-subtitle">{tools.length} tools registered</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
        <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 'var(--space-sm)' }}>
          <input
            className="form-input"
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          className="btn btn-secondary"
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? 'Scanning...' : '🔍 Scan'}
        </button>
      </div>

      {tools.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-title">No tools yet</div>
          <p>Register your first tool by placing a manifest.json in the tools/ directory, or use <code>/gadget register</code> in Claude.</p>
        </div>
      ) : (
        <div className="card-grid">
          {tools.map((tool) => (
            <Link key={tool.id} to={`/tools/${tool.id}`} className="card" style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{tool.name}</h3>
                {modeTag(tool.mode)}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                {tool.manifest.description}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                {tool.manifest.tags?.map((tag) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
              <div style={{ marginTop: 'var(--space-sm)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                v{tool.manifest.version} · {tool.manifest.runtime.type}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
