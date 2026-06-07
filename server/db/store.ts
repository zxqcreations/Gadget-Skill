import fs from 'fs';
import path from 'path';
import { config } from '../config';

// Simple JSON file-based store. Each "table" is a JSON file.
// This avoids native compilation issues with better-sqlite3 on Windows.

class JsonStore {
  private baseDir: string;

  constructor() {
    this.baseDir = config.dataDir;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  private filePath(collection: string): string {
    return path.join(this.baseDir, `${collection}.json`);
  }

  read<T>(collection: string): T[] {
    const fp = this.filePath(collection);
    if (!fs.existsSync(fp)) return [];
    try {
      return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T[];
    } catch {
      return [];
    }
  }

  write<T>(collection: string, data: T[]): void {
    const fp = this.filePath(collection);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  }

  // CRUD helpers
  findAll<T extends { id: string }>(collection: string): T[] {
    return this.read<T>(collection);
  }

  findById<T extends { id: string }>(collection: string, id: string): T | undefined {
    return this.read<T>(collection).find((item) => item.id === id);
  }

  insert<T extends { id: string }>(collection: string, item: T): T {
    const items = this.read<T>(collection);
    items.push(item);
    this.write(collection, items);
    return item;
  }

  update<T extends { id: string }>(collection: string, id: string, updates: Partial<T>): T | null {
    const items = this.read<T>(collection);
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...updates };
    this.write(collection, items);
    return items[idx];
  }

  delete(collection: string, id: string): boolean {
    const items = this.read<{ id: string }>(collection);
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    items.splice(idx, 1);
    this.write(collection, items);
    return true;
  }

  query<T extends { id: string }>(
    collection: string,
    filter: (item: T) => boolean
  ): T[] {
    return this.read<T>(collection).filter(filter);
  }

  count(collection: string): number {
    return this.read(collection).length;
  }
}

export const store = new JsonStore();
