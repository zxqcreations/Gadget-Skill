import React, { useEffect, useState, useRef } from 'react';
import {
  fetchFileList, uploadFiles, getFileDownloadUrl,
  deleteFile, createDirectory, readFileContent, writeFileContent,
  type FileEntry,
} from '../lib/api';

export default function FileBrowser() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentDir, setCurrentDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const [showNewDir, setShowNewDir] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadDir(currentDir); }, [currentDir]);

  async function loadDir(dir: string) {
    setLoading(true);
    try {
      const res = await fetchFileList(dir);
      if (res.success && res.data) {
        setEntries(res.data.entries);
        setCurrentDir(res.data.path);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage('');
    try {
      const res = await uploadFiles(files, currentDir);
      if (res.success && res.data) {
        setMessage(`✅ Uploaded ${res.data.uploaded.length} file(s)`);
        loadDir(currentDir);
      }
    } catch (err) { setMessage('❌ Upload failed'); }
    finally { setUploading(false); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function navigateTo(subDir: string) {
    setSelectedFile(null); setFileContent('');
    setCurrentDir((prev) => {
      const clean = prev ? `${prev}/${subDir}` : subDir;
      return clean.replace(/\/+/g, '/');
    });
  }

  function navigateUp() {
    setSelectedFile(null); setFileContent('');
    const parts = currentDir.split('/');
    parts.pop();
    setCurrentDir(parts.join('/'));
  }

  async function handleFileClick(entry: FileEntry) {
    if (entry.type === 'directory') {
      navigateTo(entry.name);
      return;
    }

    setSelectedFile(entry.name);
    try {
      const filePath = currentDir ? `${currentDir}/${entry.name}` : entry.name;
      const res = await readFileContent(filePath);
      if (res.success && res.data) {
        setFileContent(res.data.content);
      } else if (res.error) {
        setFileContent(`[Cannot preview: ${res.error}]`);
      }
    } catch {
      setFileContent('[Error reading file]');
    }
  }

  function handleEditStart() {
    setEditContent(fileContent);
    setEditing(true);
  }

  async function handleEditSave() {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const filePath = currentDir ? `${currentDir}/${selectedFile}` : selectedFile;
      const res = await writeFileContent(filePath, editContent);
      if (res.success) {
        setFileContent(editContent);
        setEditing(false);
        setMessage('✅ Saved');
        setTimeout(() => setMessage(''), 2000);
      }
    } catch (err) { setMessage('❌ Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete(entryName: string) {
    if (!confirm(`Delete "${entryName}"?`)) return;
    const filePath = currentDir ? `${currentDir}/${entryName}` : entryName;
    const res = await deleteFile(filePath);
    if (res.success) {
      setSelectedFile(null); setFileContent('');
      loadDir(currentDir);
      setMessage('🗑 Deleted');
      setTimeout(() => setMessage(''), 2000);
    }
  }

  async function handleCreateDir() {
    if (!newDirName.trim()) return;
    const dir = currentDir ? `${currentDir}/${newDirName.trim()}` : newDirName.trim();
    const res = await createDirectory(dir);
    if (res.success) {
      setNewDirName(''); setShowNewDir(false);
      loadDir(currentDir);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  const breadcrumbs = currentDir ? currentDir.split('/') : [];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Files</h1>
          <p className="page-subtitle">Workspace file browser</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
          <input
            ref={dirInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? '⏳' : '📤'} Upload Files
          </button>
          <button className="btn btn-secondary" onClick={() => dirInputRef.current?.click()} disabled={uploading}>
            📁 Upload Folder
          </button>
          <button className="btn btn-secondary" onClick={() => setShowNewDir(!showNewDir)}>
            📂 New Folder
          </button>
        </div>
      </div>

      {message && (
        <div style={{ fontSize: '13px', marginBottom: 'var(--space-md)', padding: 'var(--space-sm)', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)' }}>
          {message}
        </div>
      )}

      {/* New folder input */}
      {showNewDir && (
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <input
            className="form-input"
            value={newDirName}
            onChange={e => setNewDirName(e.target.value)}
            placeholder="Folder name..."
            onKeyDown={e => e.key === 'Enter' && handleCreateDir()}
            autoFocus
          />
          <button className="btn btn-sm btn-primary" onClick={handleCreateDir}>Create</button>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowNewDir(false)}>Cancel</button>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ fontSize: '13px', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <span onClick={() => setCurrentDir('')} style={{ cursor: 'pointer', color: 'var(--color-accent)' }}>🏠 root</span>
        {breadcrumbs.map((part, i) => (
          <span key={i}>
            <span style={{ color: 'var(--color-text-muted)' }}> / </span>
            <span
              onClick={() => setCurrentDir(breadcrumbs.slice(0, i + 1).join('/'))}
              style={{ cursor: 'pointer', color: i === breadcrumbs.length - 1 ? 'var(--color-text)' : 'var(--color-accent)' }}
            >
              {part}
            </span>
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
        {/* File List */}
        <div>
          <div className="card" style={{ minHeight: '300px' }}>
            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <>
                {currentDir && (
                  <div
                    onClick={navigateUp}
                    style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', color: 'var(--color-accent)', marginBottom: '4px' }}
                  >
                    📁 ../
                  </div>
                )}
                {entries.length === 0 && !currentDir ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📂</div>
                    <div className="empty-state-title">Empty workspace</div>
                    <p>Upload files or create folders to get started.</p>
                  </div>
                ) : null}
                {entries.map((entry) => (
                  <div
                    key={entry.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px',
                      borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
                      background: selectedFile === entry.name ? 'var(--color-surface3)' : 'transparent',
                    }}
                  >
                    <span style={{ flex: 1 }} onClick={() => handleFileClick(entry)}>
                      {entry.type === 'directory' ? '📁' : '📄'} {entry.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', minWidth: '60px', textAlign: 'right' }}>
                      {entry.type === 'file' ? formatSize(entry.size) : ''}
                    </span>
                    {entry.type === 'file' && (
                      <a
                        href={getFileDownloadUrl(currentDir ? `${currentDir}/${entry.name}` : entry.name)}
                        download
                        style={{ fontSize: '11px', padding: '2px 6px' }}
                        onClick={e => e.stopPropagation()}
                      >
                        ⬇
                      </a>
                    )}
                    <span
                      style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', color: 'var(--color-danger)' }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(entry.name); }}
                    >
                      🗑
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* File Preview / Editor */}
        <div>
          {selectedFile && !editing && (
            <div className="card" style={{ minHeight: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                <h3 style={{ fontSize: '14px' }}>📄 {selectedFile}</h3>
                <button className="btn btn-sm btn-secondary" onClick={handleEditStart}>✏️ Edit</button>
              </div>
              <div className="log-viewer" style={{ maxHeight: '400px' }}>
                {fileContent || '[Empty file]'}
              </div>
            </div>
          )}

          {selectedFile && editing && (
            <div className="card" style={{ minHeight: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                <h3 style={{ fontSize: '14px' }}>✏️ Editing: {selectedFile}</h3>
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <button className="btn btn-sm btn-primary" onClick={handleEditSave} disabled={saving}>
                    {saving ? 'Saving...' : '💾 Save'}
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{
                  width: '100%', minHeight: '350px', background: '#0a0a0f',
                  color: '#e2e8f0', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', padding: '12px',
                  fontFamily: 'var(--font-mono)', fontSize: '12px',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {!selectedFile && (
            <div className="card" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-state">
                <div className="empty-state-icon">👆</div>
                <div className="empty-state-title">Select a file</div>
                <p>Click on a file to preview, or upload new files.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
