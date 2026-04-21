import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolResult } from '../../contracts/tool';

const execFileAsync = promisify(execFile);

function isAllowed(command: string, args: string[], forbidGitPush: boolean): boolean {
  const allow = new Set(['npm', 'pnpm', 'yarn', 'node', 'git', 'ls', 'cat', 'echo']);
  if (!allow.has(command)) return false;

  if (command === 'git') {
    const sub = args[0] ?? '';
    if (forbidGitPush && sub === 'push') return false;
    if (!['status', 'diff', 'log', 'show', 'rev-parse', 'add', 'commit'].includes(sub)) return false;
  }

  return true;
}

export const runShellTool: Tool = {
  schema: {
    name: 'run_shell',
    description: '在工作区根目录执行命令（严格 allowlist）',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        args: { type: 'array' }
      },
      required: ['command']
    }
  },
  async execute(args, ctx): Promise<ToolResult> {
    try {
      const command = typeof args.command === 'string' ? args.command : '';
      const cmdArgs = Array.isArray(args.args) ? (args.args.filter((x) => typeof x === 'string') as string[]) : [];

      if (!isAllowed(command, cmdArgs, ctx.policy.forbidGitPush)) {
        return { ok: false, name: 'run_shell', error: '命令不在允许列表中' };
      }

      if (ctx.policy.forbidNetwork) {
        const networkCommands = ['curl ', 'wget ', 'ping ', 'nc ', 'ssh '];
        if (networkCommands.some(cmd => command.startsWith(cmd) || command.includes(` ${cmd}`))) {
          return {
            ok: false,
            name: 'run_shell',
            error: 'Policy violation: Network commands (curl, wget, ssh, etc.) are forbidden.'
          };
        }
      }

      const res = await execFileAsync(command, cmdArgs, {
        cwd: ctx.workspaceRoot,
        timeout: 60_000,
        maxBuffer: 1024 * 1024
      });

      return {
        ok: true,
        name: 'run_shell',
        data: {
          command,
          args: cmdArgs,
          stdout: res.stdout?.toString?.() ?? '',
          stderr: res.stderr?.toString?.() ?? ''
        }
      };
    } catch (e) {
      return { ok: false, name: 'run_shell', error: (e as Error).message };
    }
  }
};

