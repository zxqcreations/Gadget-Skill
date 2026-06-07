import React, { useState } from 'react';
import type { UIConfig, UIFieldConfig } from '../lib/types';

interface Props {
  uiConfig: UIConfig;
  onExecute: (params: Record<string, unknown>) => void;
  executing: boolean;
}

export default function ToolForm({ uiConfig, onExecute, executing }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const field of uiConfig.fields) {
      if (field.defaultValue !== undefined) {
        init[field.key] = field.defaultValue;
      }
    }
    return init;
  });

  function handleChange(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onExecute(values);
  }

  function renderField(field: UIFieldConfig) {
    const value = values[field.key];

    switch (field.type) {
      case 'text':
        return (
          <textarea
            className="form-input"
            value={String(value || '')}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            required={field.required}
          />
        );

      case 'number':
        return (
          <input
            className="form-input"
            type="number"
            value={value !== undefined ? Number(value) : ''}
            onChange={(e) => handleChange(field.key, parseFloat(e.target.value) || 0)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
            required={field.required}
          />
        );

      case 'range':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', minWidth: '24px' }}>
              {field.min || 0}
            </span>
            <input
              type="range"
              style={{ flex: 1 }}
              value={value !== undefined ? Number(value) : field.defaultValue || field.min || 0}
              onChange={(e) => handleChange(field.key, parseInt(e.target.value))}
              min={field.min}
              max={field.max}
              step={field.step}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', minWidth: '24px' }}>
              {field.max || 100}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', minWidth: '36px', textAlign: 'right' }}>
              {value !== undefined ? String(value) : String(field.defaultValue ?? (field.min || 0))}
            </span>
          </div>
        );

      case 'boolean':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleChange(field.key, e.target.checked)}
            />
            <span style={{ fontSize: '13px' }}>{field.label}</span>
          </label>
        );

      case 'select':
        return (
          <select
            className="form-input"
            value={String(value || field.defaultValue || '')}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'file':
      case 'file[]':
        return (
          <input
            className="form-input"
            type="file"
            multiple={field.type === 'file[]'}
            accept={field.accept}
            onChange={(e) => {
              const files = field.type === 'file[]'
                ? Array.from(e.target.files || [])
                : e.target.files?.[0] || null;
              handleChange(field.key, files);
            }}
            required={field.required}
          />
        );

      case 'folder':
        return (
          <input
            className="form-input"
            type="text"
            value={String(value || '')}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder="Folder path..."
            required={field.required}
          />
        );

      case 'url':
        return (
          <input
            className="form-input"
            type="url"
            value={String(value || '')}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder="https://..."
            required={field.required}
          />
        );

      case 'json':
        return (
          <textarea
            className="form-input"
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '')}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleChange(field.key, parsed);
              } catch {
                handleChange(field.key, e.target.value);
              }
            }}
            placeholder='{"key": "value"}'
            rows={6}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            required={field.required}
          />
        );

      case 'secret':
        return (
          <input
            className="form-input"
            type="password"
            value={String(value || '')}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'color':
        return (
          <input
            type="color"
            value={String(value || '#6366f1')}
            onChange={(e) => handleChange(field.key, e.target.value)}
            style={{ width: '100%', height: '40px', border: 'none', cursor: 'pointer' }}
          />
        );

      default: // 'string'
        return (
          <input
            className="form-input"
            type="text"
            value={String(value || '')}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {uiConfig.fields.map((field) => {
        // Check conditional display
        if (field.showIf) {
          const condValue = values[field.showIf.key];
          if (condValue !== field.showIf.value) return null;
        }

        return (
          <div className="form-group" key={field.key}>
            <label className="form-label">
              {field.label}
              {field.required && <span style={{ color: 'var(--color-danger)', marginLeft: '4px' }}>*</span>}
            </label>
            {renderField(field)}
            {field.help && <div className="form-help">{field.help}</div>}
          </div>
        );
      })}

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={executing}
        style={{ width: '100%', marginTop: 'var(--space-md)' }}
      >
        {executing ? '⏳ Executing...' : '▶ Execute'}
      </button>
    </form>
  );
}
