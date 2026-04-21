import fs from 'fs-extra';
import path from 'path';
import type { Tool, ToolResult } from '../../contracts/tool';
import { resolveInWorkspace } from './path-utils';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.pi-mini', 'coverage']);

async function walkDir(dir: string, baseDir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      results.push(`${relPath}/`);
      const sub = await walkDir(fullPath, baseDir);
      results.push(...sub);
    } else {
      results.push(relPath);
    }
  }
  return results;
}

export const listDirTool: Tool = {
  schema: {
    name: 'list_dir',
    description: '列出指定目录下的文件和文件夹结构，自动忽略 node_modules, .git 等',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对工作区的路径，为空则扫描根目录' }
      }
    }
  },
  async execute(args, ctx): Promise<ToolResult> {
    try {
      const p = typeof args.path === 'string' ? args.path : '';
      const targetDir = resolveInWorkspace(ctx.workspaceRoot, p);

      if (!(await fs.pathExists(targetDir))) {
        return { ok: false, name: 'list_dir', error: '目录不存在' };
      }

      const stat = await fs.stat(targetDir);
      if (!stat.isDirectory()) {
        return { ok: false, name: 'list_dir', error: '目标路径不是目录' };
      }

      const files = await walkDir(targetDir, targetDir);
      return { ok: true, name: 'list_dir', data: { path: p, files } };
    } catch (e) {
      return { ok: false, name: 'list_dir', error: (e as Error).message };
    }
  }
};
