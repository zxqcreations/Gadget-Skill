import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTools, fetchCategories, scanTools, registerTool } from '../lib/api';
import type { ToolRecord, ToolManifest } from '../lib/types';

const DEFAULT_MANIFEST: Partial<ToolManifest> = {
  mode: 'cli',
  version: '1.0.0',
  category: 'dev',
  tags: [],
  runtime: { type: 'python', entry: 'main.py', timeout: 30000 },
  inputs: [],
  outputs: [{ type: 'text', label: 'Output' }],
  adapter: { input: { format: 'text' }, output: { format: 'text' } },
};

export default function ToolList() {
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [scanning, setScanning] = useState(false);

  // Register form state
  const [showRegister, setShowRegister] = useState(false);
  const [regId, setRegId] = useState('');
  const [regName, setRegName] = useState('');
  const [regDesc, setRegDesc] = useState('');
  const [regMode, setRegMode] = useState<'cli' | 'http' | 'web' | 'composite'>('cli');
  const [regRuntime, setRegRuntime] = useState('python');
  const [regEntry, setRegEntry] = useState('main.py');
  const [regInFormat, setRegInFormat] = useState('text');
  const [regOutFormat, setRegOutFormat] = useState('text');
  const [regFileContent, setRegFileContent] = useState('');
  const [regFileExt, setRegFileExt] = useState('.py');
  const [registering, setRegistering] = useState(false);

  useEffect(() => { loadTools(); loadCategories(); }, [category]);

  async function loadTools() {
    try {
      const res = await fetchTools({ category: category || undefined, search: search || undefined });
      if (res.success && res.data) setTools(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
        loadTools(); loadCategories();
      }
    } catch (err) { console.error(err); }
    finally { setScanning(false); }
  }

  function handleSearch(e: React.FormEvent) { e.preventDefault(); loadTools(); }

  async function handleRegister() {
    if (!regId || !regName || !regEntry) {
      alert('ID, Name, and Entry are required.');
      return;
    }

    // Resolve file extension to runtime type
    const extMap: Record<string, string> = { '.py': 'python', '.js': 'node', '.ts': 'node', '.sh': 'shell', '.bat': 'shell' };
    const runtimeType = extMap[regFileExt] || 'python';
    const fileName = `${regId}${regFileExt}`;

    const manifest: ToolManifest = {
      id: regId,
      name: regName,
      version: '1.0.0',
      description: regDesc || regName,
      category: 'dev',
      tags: [],
      mode: regMode,
      runtime: { type: runtimeType as ToolManifest['runtime']['type'], entry: fileName, timeout: 30000 },
      inputs: [],
      outputs: [{ type: 'text', label: 'Output' }],
      adapter: { input: { format: regInFormat }, output: { format: regOutFormat } },
    };

    setRegistering(true);
    try {
      const files = regFileContent ? [{ name: fileName, content: regFileContent }] : [];
      const res = await registerTool(manifest, files);
      if (res.success) {
        alert(`✅ Tool "${regName}" registered!`);
        setShowRegister(false);
        resetForm();
        loadTools(); loadCategories();
      } else {
        alert(`Registration failed: ${res.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRegistering(false);
    }
  }

  function resetForm() {
    setRegId(''); setRegName(''); setRegDesc('');
    setRegMode('cli'); setRegRuntime('python'); setRegEntry('main.py');
    setRegInFormat('text'); setRegOutFormat('text');
    setRegFileContent(''); setRegFileExt('.py');
  }

  const modeTag = (mode: string) => <span className={`tag tag--${mode}`}>{mode}</span>;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Tools</h1>
          <p className="page-subtitle">{tools.length} tools registered</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRegister(true)}>+ Register Tool</button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
        <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 'var(--space-sm)' }}>
          <input className="form-input" placeholder="Search tools..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: 160 }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={handleScan} disabled={scanning}>{scanning ? 'Scanning...' : '🔍 Scan'}</button>
      </div>

      {/* Register Form */}
      {showRegister && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Register New Tool</h3>
          <p className="text-muted" style={{ fontSize: '13px', marginBottom: 'var(--space-md)' }}>
            Quick registration. For full control, create a manifest.json in the tools/ directory, or use <code>/gadget register</code> in Claude.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Tool ID *</label>
              <input className="form-input" value={regId} onChange={e => setRegId(e.target.value)} placeholder="my-cool-tool" />
              <div className="form-help">Unique identifier (kebab-case, no spaces)</div>
            </div>
            <div className="form-group">
              <label className="form-label">Display Name *</label>
              <input className="form-input" value={regName} onChange={e => setRegName(e.target.value)} placeholder="My Cool Tool" />
            </div>
            <div className="form-group">
              <label className="form-label">Mode</label>
              <select className="form-input" value={regMode} onChange={e => setRegMode(e.target.value as 'cli' | 'http' | 'web' | 'composite')}>
                <option value="cli">CLI (command line)</option>
                <option value="http">HTTP (API endpoint)</option>
                <option value="web">Web (frontend page)</option>
                <option value="composite">Composite (multi-file)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">File Extension</label>
              <select className="form-input" value={regFileExt} onChange={e => { setRegFileExt(e.target.value); setRegEntry(`${regId || 'main'}${e.target.value}`); }}>
                <option value=".py">.py (Python)</option>
                <option value=".js">.js (JavaScript)</option>
                <option value=".ts">.ts (TypeScript)</option>
                <option value=".sh">.sh (Shell)</option>
                <option value=".bat">.bat (Batch)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Entry File *</label>
              <input className="form-input" value={regEntry} onChange={e => setRegEntry(e.target.value)} placeholder="main.py" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={regDesc} onChange={e => setRegDesc(e.target.value)} placeholder="What does this tool do?" />
            </div>
            <div className="form-group">
              <label className="form-label">Input Format</label>
              <select className="form-input" value={regInFormat} onChange={e => setRegInFormat(e.target.value)}>
                <option value="text">text</option><option value="file">file</option><option value="file[]">file[]</option>
                <option value="json">json</option><option value="url">url</option><option value="binary">binary</option>
              </select>
              <div className="form-help">Used for workflow compatibility checking</div>
            </div>
            <div className="form-group">
              <label className="form-label">Output Format</label>
              <select className="form-input" value={regOutFormat} onChange={e => setRegOutFormat(e.target.value)}>
                <option value="text">text</option><option value="file">file</option><option value="file[]">file[]</option>
                <option value="json">json</option><option value="url">url</option><option value="binary">binary</option>
              </select>
              <div className="form-help">Used for workflow compatibility checking</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Source Code (optional)</label>
            <textarea
              className="form-input"
              value={regFileContent}
              onChange={e => setRegFileContent(e.target.value)}
              rows={10}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              placeholder={`# Paste your script/code here...\n# The file will be saved as ${regId || 'main'}${regFileExt}`}
            />
            <div className="form-help">Paste your tool's source code. You can also add it later in the tools/ directory.</div>
          </div>

          <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm)', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <strong>💡 Tip:</strong> After registration, edit the manifest.json in <code>tools/{regId || '...'}/</code> to add proper inputs, outputs, and adapter signatures for full UI generation.
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
            <button className="btn btn-primary" onClick={handleRegister} disabled={registering}>
              {registering ? 'Registering...' : '✅ Register Tool'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowRegister(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tool Grid */}
      {tools.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-title">No tools yet</div>
          <p>
            Register your first tool:<br />
            • In Claude: type <code>/gadget register</code> after generating code<br />
            • Manually: click <strong>"Register Tool"</strong> above<br />
            • File-based: create <code>tools/your-tool/manifest.json</code>
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {tools.map(tool => (
            <Link key={tool.id} to={`/tools/${tool.id}`} className="card" style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{tool.name}</h3>
                {modeTag(tool.mode)}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                {tool.manifest.description}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-xs)' }}>
                {tool.manifest.tags?.map(tag => <span key={tag} className="tag">{tag}</span>)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                v{tool.manifest.version} · {tool.manifest.runtime.type} · {tool.manifest.adapter.input.format}→{tool.manifest.adapter.output.format}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
