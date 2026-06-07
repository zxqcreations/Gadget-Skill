import React, { useEffect, useState } from 'react';
import { fetchStats, fetchExecutions } from '../lib/api';
import type { ExecutionRecord } from '../lib/types';

export default function Dashboard() {
  const [stats, setStats] = useState({ tools: 0, workflows: 0, executions: 0, successRate: 100 });
  const [recent, setRecent] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, execRes] = await Promise.all([fetchStats(), fetchExecutions(10)]);
        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
        if (execRes.success && execRes.data) {
          setRecent(execRes.data.recent);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Poll every 10 seconds
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return '🟢';
      case 'failed': return '🔴';
      case 'timeout': return '⏰';
      case 'running': return '🔄';
      case 'cancelled': return '⏹️';
      default: return '⚪';
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your tool ecosystem</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{ borderTop: '3px solid var(--color-accent)' }}>
          <div className="stat-value" style={{ color: 'var(--color-accent)' }}>{stats.tools}</div>
          <div className="stat-label">Registered Tools</div>
        </div>
        <div className="stat-card" style={{ borderTop: '3px solid var(--color-success)' }}>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>{stats.executions}</div>
          <div className="stat-label">Total Executions</div>
        </div>
        <div className="stat-card" style={{ borderTop: '3px solid var(--color-warning)' }}>
          <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{stats.workflows}</div>
          <div className="stat-label">Workflows</div>
        </div>
        <div className="stat-card" style={{ borderTop: '3px solid var(--color-info)' }}>
          <div className="stat-value" style={{ color: 'var(--color-info)' }}>{stats.successRate}%</div>
          <div className="stat-label">Success Rate</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '16px' }}>Recent Executions</h3>
        {recent.length === 0 ? (
          <p className="text-muted">No executions yet. Register a tool and run it!</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)' }}>Tool</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)' }}>Time</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)' }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((exec) => (
                <tr key={exec.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px' }}>{statusIcon(exec.status)} {exec.status}</td>
                  <td style={{ padding: '8px' }}>{exec.toolId}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-muted)' }}>
                    {new Date(exec.startedAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px', color: 'var(--color-text-muted)' }}>
                    {exec.durationMs ? `${exec.durationMs}ms` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
