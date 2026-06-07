import React, { useEffect, useState } from 'react';
import { fetchConfig, updateConfig, fetchStats } from '../lib/api';

export default function Settings() {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchConfig();
        if (res.success && res.data) setConfig(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const res = await updateConfig(config);
      if (res.success) {
        setMessage('✅ Settings saved successfully.');
      } else {
        setMessage('❌ Failed to save settings: ' + (res.error || 'Unknown error'));
      }
    } catch (err) {
      setMessage('❌ Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  }

  function handleChange(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your GadgetServer</p>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <div className="form-group">
          <label className="form-label">Port</label>
          <input
            className="form-input"
            type="number"
            value={Number(config.port) || 3000}
            onChange={(e) => handleChange('port', parseInt(e.target.value) || 3000)}
          />
          <div className="form-help">HTTP server port. Requires restart to take effect.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Tools Directory</label>
          <input
            className="form-input"
            value={String(config.toolsDir || '')}
            onChange={(e) => handleChange('toolsDir', e.target.value)}
          />
          <div className="form-help">Directory where tool manifests and code are stored.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Data Directory</label>
          <input
            className="form-input"
            value={String(config.dataDir || '')}
            onChange={(e) => handleChange('dataDir', e.target.value)}
          />
          <div className="form-help">Directory for database and log files.</div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(config.mcpEnabled)}
              onChange={(e) => handleChange('mcpEnabled', e.target.checked)}
            />
            <span>Enable MCP Server</span>
          </label>
          <div className="form-help">Expose tools via MCP protocol for Claude integration.</div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(config.autoStart)}
              onChange={(e) => handleChange('autoStart', e.target.checked)}
            />
            <span>Auto-start on boot</span>
          </label>
          <div className="form-help">Register as a Windows service for automatic startup.</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>
          {message && <span style={{ fontSize: '13px' }}>{message}</span>}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600, marginTop: 'var(--space-lg)' }}>
        <h3 style={{ fontSize: '14px', marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
          About
        </h3>
        <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
          <p><strong>GadgetServer v1.0.0</strong></p>
          <p>A local web application for managing and composing tools generated during Claude usage.</p>
          <p style={{ marginTop: 'var(--space-sm)', color: 'var(--color-text-muted)' }}>
            Register scripts, web apps, and API services. Create workflows to chain them together.
            Query everything from Claude via MCP.
          </p>
        </div>
      </div>
    </div>
  );
}
