import fs from 'fs-extra';
import path from 'path';
import type { Tool, ToolResult } from '../../contracts/tool';
import { resolveInWorkspace } from './path-utils';

export const writeFileTool: Tool = {
  schema: {
    name: 'write_file',
    description: '写入工作区内文件内容（UTF-8），会自动创建父目录',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content']
    }
  },
  async execute(args, ctx): Promise<ToolResult> {
    try {
      const p = typeof args.path === 'string' ? args.path : '';
      const c = typeof args.content === 'string' ? args.content : '';
      const abs = resolveInWorkspace(ctx.workspaceRoot, p);
      await fs.ensureDir(path.dirname(abs));
      await fs.writeFile(abs, c, { encoding: 'utf-8' });
      return { ok: true, name: 'write_file', data: { path: p, bytes: Buffer.byteLength(c, 'utf-8') } };
    } catch (e) {
      return { ok: false, name: 'write_file', error: (e as Error).message };
    }
  }
};

