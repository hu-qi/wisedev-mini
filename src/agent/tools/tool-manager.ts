import type { Tool, ToolResult, ToolSchema, ToolContext } from '../contracts/tool';
import { validateArgs } from './schema-validate';

export class ToolManager {
  private tools = new Map<string, Tool>();

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

    return tool.execute(args, ctx);
  }
}

