import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const router = Router();

// Shared workspace directory for file operations
const WORKSPACE = path.join(config.dataDir, 'workspace');
fs.mkdirSync(WORKSPACE, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = _req.query.dir as string || '';
    const dest = path.join(WORKSPACE, dir);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    // Preserve original name, handle duplicates
    cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
  },
});

const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit

// ========== File Operations ==========

// List files in a directory
router.get('/list', (req: Request, res: Response) => {
  try {
    const subDir = (req.query.dir as string) || '';
    const dirPath = path.join(WORKSPACE, subDir);

    // Security: prevent path traversal
    if (!dirPath.startsWith(WORKSPACE)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      res.json({ success: true, data: { path: subDir, entries: [] } });
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = entries.map((entry) => {
      const entryPath = path.join(dirPath, entry.name);
      const stat = fs.statSync(entryPath);
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    });

    // Sort: directories first, then by name
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ success: true, data: { path: subDir, entries: result } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Upload files
router.post('/upload', upload.array('files', 20), (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) || [];
  res.json({
    success: true,
    data: {
      uploaded: files.map((f) => ({
        name: f.originalname,
        size: f.size,
        path: path.relative(WORKSPACE, f.path).replace(/\\/g, '/'),
      })),
    },
  });
});

// Download a file
router.get('/download', (req: Request, res: Response) => {
  try {
    const filePath = (req.query.path as string) || '';
    const fullPath = path.join(WORKSPACE, filePath);

    if (!fullPath.startsWith(WORKSPACE)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    res.download(fullPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Delete a file or directory
router.delete('/delete', (req: Request, res: Response) => {
  try {
    const targetPath = (req.query.path as string) || '';
    const fullPath = path.join(WORKSPACE, targetPath);

    if (!fullPath.startsWith(WORKSPACE)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    fs.rmSync(fullPath, { recursive: true, force: true });
    res.json({ success: true, data: { path: targetPath } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Create directory
router.post('/mkdir', (req: Request, res: Response) => {
  try {
    const dirPath = (req.body.dir as string) || '';
    const fullPath = path.join(WORKSPACE, dirPath);

    if (!fullPath.startsWith(WORKSPACE)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    fs.mkdirSync(fullPath, { recursive: true });
    res.json({ success: true, data: { path: dirPath } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Read file content (text files only, max 1MB)
router.get('/read', (req: Request, res: Response) => {
  try {
    const filePath = (req.query.path as string) || '';
    const fullPath = path.join(WORKSPACE, filePath);

    if (!fullPath.startsWith(WORKSPACE)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    const stat = fs.statSync(fullPath);
    if (stat.size > 1024 * 1024) {
      res.status(400).json({ success: false, error: 'File too large (>1MB). Download instead.' });
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ success: true, data: { path: filePath, content, size: stat.size } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Write file content
router.post('/write', (req: Request, res: Response) => {
  try {
    const { path: filePath, content } = req.body as { path: string; content: string };

    if (!filePath) {
      res.status(400).json({ success: false, error: 'path is required' });
      return;
    }

    const fullPath = path.join(WORKSPACE, filePath);

    if (!fullPath.startsWith(WORKSPACE)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ success: true, data: { path: filePath } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
