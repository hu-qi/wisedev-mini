import fs from 'fs-extra';
import type { Tool, ToolResult } from '../../contracts/tool';
import { resolveInWorkspace } from './path-utils';

export const readFileTool: Tool = {
  schema: {
    name: 'read_file',
    description: '读取工作区内文件内容（UTF-8）',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },
  async execute(args, ctx): Promise<ToolResult> {
    try {
      const p = typeof args.path === 'string' ? args.path : '';
      const abs = resolveInWorkspace(ctx.workspaceRoot, p);
      const content = await fs.readFile(abs, 'utf-8');
      return { ok: true, name: 'read_file', data: { path: p, content } };
    } catch (e) {
      return { ok: false, name: 'read_file', error: (e as Error).message };
    }
  }
};

