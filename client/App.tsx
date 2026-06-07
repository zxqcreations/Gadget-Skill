import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ToolList from './pages/ToolList';
import ToolDetail from './pages/ToolDetail';
import WorkflowEditor from './pages/WorkflowEditor';
import Settings from './pages/Settings';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/tools', label: 'Tools', icon: '🔧' },
  { to: '/workflows', label: 'Workflows', icon: '🔗' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function App() {
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">⚡</span>
          <span className="sidebar-title">GadgetServer</span>
        </div>
        <div className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link--active' : ''}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-footer">
          <span className="status-dot status-dot--online" />
          <span className="text-muted">Server running</span>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tools" element={<ToolList />} />
          <Route path="/tools/:id" element={<ToolDetail />} />
          <Route path="/workflows" element={<WorkflowEditor />} />
          <Route path="/workflows/:id" element={<WorkflowEditor />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
