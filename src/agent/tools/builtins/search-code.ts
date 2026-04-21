import fs from 'fs-extra';
import path from 'path';
import type { Tool, ToolResult } from '../../contracts/tool';
import { resolveInWorkspace } from './path-utils';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.pi-mini', 'coverage']);
const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.exe', '.dll', '.so', '.dylib']);

async function searchInDir(dir: string, baseDir: string, query: string, results: any[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      await searchInDir(fullPath, baseDir, query, results);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (BINARY_EXTS.has(ext)) continue;

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(query)) {
            results.push({
              file: relPath,
              line: i + 1,
              content: lines[i].trim().slice(0, 100) // truncate long lines
            });
            if (results.length > 50) return; // early stop if too many matches
          }
        }
      } catch (e) {
        // ignore read errors (e.g. binary files or no permission)
      }
    }
  }
}

export const searchCodeTool: Tool = {
  schema: {
    name: 'search_code',
    description: '在指定目录下全局搜索包含指定字符串的代码文件',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要搜索的相对目录，为空则搜索根目录' },
        query: { type: 'string', description: '要搜索的字符串（目前仅支持纯文本搜索）' }
      },
      required: ['query']
    }
  },
  async execute(args, ctx): Promise<ToolResult> {
    try {
      const p = typeof args.path === 'string' ? args.path : '';
      const query = typeof args.query === 'string' ? args.query : '';
      
      if (!query) {
        return { ok: false, name: 'search_code', error: '搜索词不能为空' };
      }

      const targetDir = resolveInWorkspace(ctx.workspaceRoot, p);

      if (!(await fs.pathExists(targetDir))) {
        return { ok: false, name: 'search_code', error: '目录不存在' };
      }

      const stat = await fs.stat(targetDir);
      if (!stat.isDirectory()) {
        return { ok: false, name: 'search_code', error: '目标路径不是目录' };
      }

      const results: any[] = [];
      await searchInDir(targetDir, targetDir, query, results);

      return { ok: true, name: 'search_code', data: { path: p, query, matches: results } };
    } catch (e) {
      return { ok: false, name: 'search_code', error: (e as Error).message };
    }
  }
};
