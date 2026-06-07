import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { ToolManifest, ToolRecord, ToolStatus, ApiResponse } from '../../shared/types';
import { store } from '../db/store';
import { eventBus } from '../events/EventBus';

const COLLECTION = 'tools';

export class ToolRegistry {
  /**
   * Register a new tool from a manifest
   */
  register(manifest: ToolManifest, dirPath: string): ToolRecord {
    // Check if already exists
    const existing = store.findById<ToolRecord>(COLLECTION, manifest.id);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing
      const updated = store.update<ToolRecord>(COLLECTION, manifest.id, {
        manifest,
        name: manifest.name,
        mode: manifest.mode,
        dirPath,
        updatedAt: now,
      })!;
      eventBus.emit('tool:updated', { toolId: manifest.id });
      return updated;
    }

    const record: ToolRecord = {
      id: manifest.id,
      name: manifest.name,
      mode: manifest.mode,
      manifest,
      status: 'active',
      dirPath,
      createdAt: now,
      updatedAt: now,
    };

    store.insert(COLLECTION, record);
    eventBus.emit('tool:registered', { toolId: manifest.id });
    return record;
  }

  /**
   * Get a tool by ID
   */
  get(id: string): ToolRecord | undefined {
    return store.findById<ToolRecord>(COLLECTION, id);
  }

  /**
   * List all tools, optionally filtered
   */
  list(filter?: { category?: string; mode?: string; status?: ToolStatus; search?: string }): ToolRecord[] {
    let tools = store.findAll<ToolRecord>(COLLECTION);

    if (filter?.category) {
      tools = tools.filter((t) => t.manifest.category === filter.category);
    }
    if (filter?.mode) {
      tools = tools.filter((t) => t.mode === filter.mode);
    }
    if (filter?.status) {
      tools = tools.filter((t) => t.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.manifest.description.toLowerCase().includes(q) ||
          t.manifest.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return tools.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /**
   * Get all categories (for filter UI)
   */
  getCategories(): string[] {
    const tools = store.findAll<ToolRecord>(COLLECTION);
    const cats = new Set<string>();
    for (const t of tools) {
      if (t.manifest.category) cats.add(t.manifest.category);
    }
    return [...cats].sort();
  }

  /**
   * Update a tool
   */
  update(id: string, updates: { manifest?: Partial<ToolManifest>; status?: ToolStatus }): ToolRecord | null {
    const existing = store.findById<ToolRecord>(COLLECTION, id);
    if (!existing) return null;

    const patch: Partial<ToolRecord> = { updatedAt: new Date().toISOString() };
    if (updates.manifest) {
      patch.manifest = { ...existing.manifest, ...updates.manifest };
      patch.name = patch.manifest.name;
    }
    if (updates.status) {
      patch.status = updates.status;
    }

    const updated = store.update<ToolRecord>(COLLECTION, id, patch);
    if (updated) {
      eventBus.emit('tool:updated', { toolId: id });
    }
    return updated;
  }

  /**
   * Delete/uninstall a tool
   */
  uninstall(id: string, removeFiles: boolean = false): boolean {
    const tool = store.findById<ToolRecord>(COLLECTION, id);
    if (!tool) return false;

    if (removeFiles && fs.existsSync(tool.dirPath)) {
      fs.rmSync(tool.dirPath, { recursive: true, force: true });
    }

    const deleted = store.delete(COLLECTION, id);
    if (deleted) {
      eventBus.emit('tool:unregistered', { toolId: id });
    }
    return deleted;
  }

  /**
   * Get tool count
   */
  count(): number {
    return store.count(COLLECTION);
  }

  /**
   * Find tools compatible with a given adapter (for workflow chaining)
   */
  findCompatible(targetFormat: string, direction: 'upstream' | 'downstream'): ToolRecord[] {
    const tools = store.findAll<ToolRecord>(COLLECTION);
    return tools.filter((t) => {
      if (direction === 'upstream') {
        // Tools whose output format matches the target's input
        return t.manifest.adapter.output.format === targetFormat;
      } else {
        // Tools whose input format matches the target's output
        return t.manifest.adapter.input.format === targetFormat;
      }
    });
  }

  /**
   * Full-text search tools
   */
  search(query: string): ToolRecord[] {
    const q = query.toLowerCase();
    return store.query<ToolRecord>(COLLECTION, (t) => {
      return (
        t.name.toLowerCase().includes(q) ||
        t.manifest.description.toLowerCase().includes(q) ||
        t.manifest.id.toLowerCase().includes(q) ||
        t.manifest.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
        t.manifest.category?.toLowerCase().includes(q) ||
        false
      );
    });
  }
}

export const toolRegistry = new ToolRegistry();
