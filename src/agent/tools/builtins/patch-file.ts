import fs from 'fs-extra';
import type { Tool, ToolResult } from '../../contracts/tool';
import { resolveInWorkspace } from './path-utils';

export const patchFileTool: Tool = {
  schema: {
    name: 'patch_file',
    description: '精确修改文件中指定的一段代码。需要提供 oldStr（要被替换的原内容）和 newStr（替换后的新内容）。oldStr 必须在原文件中精确匹配，否则会修改失败。',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对工作区的路径' },
        oldStr: { type: 'string', description: '原文件中要被替换的精确内容（含缩进和换行）' },
        newStr: { type: 'string', description: '替换后的新内容' }
      },
      required: ['path', 'oldStr', 'newStr']
    }
  },
  async execute(args, ctx): Promise<ToolResult> {
    try {
      const p = typeof args.path === 'string' ? args.path : '';
      const oldStr = typeof args.oldStr === 'string' ? args.oldStr : '';
      const newStr = typeof args.newStr === 'string' ? args.newStr : '';

      if (!oldStr) {
         return { ok: false, name: 'patch_file', error: 'oldStr 不能为空' };
      }

      const abs = resolveInWorkspace(ctx.workspaceRoot, p);
      if (!(await fs.pathExists(abs))) {
        return { ok: false, name: 'patch_file', error: `文件不存在: ${p}` };
      }

      let content = await fs.readFile(abs, 'utf-8');
      
      if (!content.includes(oldStr)) {
        return { ok: false, name: 'patch_file', error: 'oldStr 在原文件中找不到匹配项。请检查缩进、换行是否完全一致，或者先用 read_file 确认文件当前内容。' };
      }

      // 如果有多个匹配，目前仅替换第一个（防止误伤）
      content = content.replace(oldStr, newStr);
      await fs.writeFile(abs, content, 'utf-8');

      return { ok: true, name: 'patch_file', data: { path: p, replacedLength: newStr.length } };
    } catch (e) {
      return { ok: false, name: 'patch_file', error: (e as Error).message };
    }
  }
};