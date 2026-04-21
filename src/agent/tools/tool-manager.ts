import type { Tool, ToolResult, ToolSchema, ToolContext } from '../contracts/tool';
import { validateArgs } from './schema-validate';
import readline from 'readline';

export class ToolManager {
  private tools = new Map<string, Tool>();

  private async confirm(prompt: string): Promise<boolean> {
    if (!process.stdin.isTTY) return false;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer: string = await new Promise((resolve) => rl.question(prompt, resolve));
    rl.close();
    const s = answer.trim().toLowerCase();
    return s === 'y' || s === 'yes';
  }

  public register(tool: Tool): void {
    this.tools.set(tool.schema.name, tool);
  }

  public listSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map((t) => t.schema);
  }

  public has(name: string): boolean {
    return this.tools.has(name);
  }

  public async execute(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, name, error: `未知工具: ${name}` };

    const validated = validateArgs(tool.schema.inputSchema, args);
    if (!validated.ok) return { ok: false, name, error: validated.error };

    const autoApprove = ctx.policy.autoApprove ?? false;
    const dryRun = ctx.policy.dryRun ?? false;
    const confirmWrite = ctx.policy.confirmWrite ?? true;
    const confirmShell = ctx.policy.confirmShell ?? true;

    const sensitive = name === 'write_file' || name === 'run_shell';

    if (sensitive && dryRun) {
      return { ok: true, name, data: { dryRun: true, args } };
    }

    let needsConfirm = false;
    if (name === 'write_file' && confirmWrite && !autoApprove) needsConfirm = true;
    if (name === 'run_shell' && confirmShell && !autoApprove) needsConfirm = true;

    if (needsConfirm) {
      if (!process.stdin.isTTY) {
        return { ok: false, name, error: 'USER_REJECTED: 需要交互确认，请使用 --yes 或在交互终端运行' };
      }
      let summary = name;
      if (name === 'write_file') {
        const p = typeof args.path === 'string' ? args.path : '';
        const c = typeof args.content === 'string' ? args.content : '';
        summary = `write_file ${p} (${Buffer.byteLength(c, 'utf-8')} bytes)`;
      } else if (name === 'run_shell') {
        const command = typeof args.command === 'string' ? args.command : '';
        const cmdArgs = Array.isArray(args.args) ? args.args.filter((x) => typeof x === 'string') : [];
        summary = `run_shell ${command} ${(cmdArgs as string[]).join(' ')}`.trim();
      }

      const ok = await this.confirm(`Approve tool execution: ${summary} ? (y/N) `);
      if (!ok) {
        return { ok: false, name, error: 'USER_REJECTED: 用户拒绝执行' };
      }
    }

    return tool.execute(args, ctx);
  }
}
