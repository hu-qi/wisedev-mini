import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import type { MemoryItem, MemorySnapshot } from '../contracts/memory';

export class MemoryManager {
  private shortPath: string;
  private longPath: string;

  public constructor(private baseDir: string) {
    this.shortPath = path.join(baseDir, 'memory', 'short.jsonl');
    this.longPath = path.join(baseDir, 'memory', 'long.jsonl');
  }

  public async init(): Promise<void> {
    await fs.ensureDir(path.dirname(this.shortPath));
    await fs.ensureFile(this.shortPath);
    await fs.ensureFile(this.longPath);
  }

  public async append(type: MemoryItem['type'], content: string, tags?: string[]): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      type,
      content,
      tags
    };
    await fs.appendFile(this.shortPath, JSON.stringify(item) + '\n', { encoding: 'utf-8' });
    return item;
  }

  private async readJsonl(filePath: string, limit: number): Promise<MemoryItem[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const items: MemoryItem[] = [];
      for (let i = Math.max(0, lines.length - limit); i < lines.length; i += 1) {
        try {
          items.push(JSON.parse(lines[i]) as MemoryItem);
        } catch {
          continue;
        }
      }
      return items;
    } catch {
      return [];
    }
  }

  public async snapshot(): Promise<MemorySnapshot> {
    const short = await this.readJsonl(this.shortPath, 20);
    const long = await this.readJsonl(this.longPath, 20);
    return { short, long };
  }
}

