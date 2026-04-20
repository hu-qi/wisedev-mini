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

  public async search(query: string): Promise<MemoryItem[]> {
    const long = await this.readJsonl(this.longPath, 1000);
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
    
    if (keywords.length === 0) return [];

    return long.filter(item => {
      const contentLower = item.content.toLowerCase();
      const tagsLower = (item.tags || []).map(t => t.toLowerCase());
      
      return keywords.some(kw => 
        contentLower.includes(kw) || tagsLower.some(t => t.includes(kw))
      );
    });
  }

  public async compact(llmSummarizer?: (texts: string[]) => Promise<string>): Promise<void> {
    const shortItems = await this.readJsonl(this.shortPath, 100);
    if (shortItems.length < 20) return; // 没积累到一定数量不压缩

    // 取最旧的 N 条进行压缩
    const toCompact = shortItems.slice(0, shortItems.length - 10);
    const keep = shortItems.slice(shortItems.length - 10);

    let summary = '';
    if (llmSummarizer) {
      summary = await llmSummarizer(toCompact.map(x => `[${x.type}] ${x.content}`));
    } else {
      // 简单拼接
      summary = toCompact.map(x => `- ${x.content.substring(0, 100)}...`).join('\n');
    }

    // 写入 long
    const longItem: MemoryItem = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      type: 'observation',
      content: `[归档记忆]\n${summary}`,
      tags: ['compacted']
    };
    await fs.appendFile(this.longPath, JSON.stringify(longItem) + '\n', { encoding: 'utf-8' });

    // 重写 short
    await fs.writeFile(this.shortPath, keep.map(x => JSON.stringify(x)).join('\n') + (keep.length > 0 ? '\n' : ''), { encoding: 'utf-8' });
  }

  public async snapshot(): Promise<MemorySnapshot> {
    const short = await this.readJsonl(this.shortPath, 20);
    const long = await this.readJsonl(this.longPath, 20);
    return { short, long };
  }
}

