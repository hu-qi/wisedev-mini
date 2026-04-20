import fs from 'fs-extra';
import path from 'path';
import { resolveInWorkspace } from './path-utils';
import type { Tool, ToolResult, ToolContext } from '../../contracts/tool';

export const listDirTool: Tool = {
  schema: {
    name: 'list_dir',
    description: 'List contents of a directory in the workspace. Use this to explore the project structure and find files.',
    inputSchema: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'Relative path to the directory (e.g. ".", "src", "docs")'
        }
      },
      required: ['dir_path']
    }
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    try {
      const relPath = (args.dir_path as string) || '.';
      const targetPath = resolveInWorkspace(ctx.workspaceRoot, relPath);

      const stat = await fs.stat(targetPath);
      if (!stat.isDirectory()) {
        return {
          ok: false,
          name: this.schema.name,
          error: `Path is not a directory: ${relPath}`
        };
      }

      const entries = await fs.readdir(targetPath);
      const result: string[] = [];

      for (const entry of entries) {
        const entryPath = path.join(targetPath, entry);
        try {
          const entryStat = await fs.stat(entryPath);
          result.push(`${entry}${entryStat.isDirectory() ? '/' : ''}`);
        } catch (e) {
          result.push(`${entry} (unreadable)`);
        }
      }

      return {
        ok: true,
        name: this.schema.name,
        data: result
      };
    } catch (err) {
      return {
        ok: false,
        name: this.schema.name,
        error: (err as Error).message
      };
    }
  }
};
