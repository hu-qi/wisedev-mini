export type JsonSchema = Record<string, unknown>;

export type ToolSchema = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

export type ToolContext = {
  workspaceRoot: string;
  runId: string;
  turn: number;
  policy: AgentPolicy;
};

export type ToolResult =
  | { ok: true; name: string; data: unknown }
  | { ok: false; name: string; error: string; data?: unknown };

export interface Tool {
  schema: ToolSchema;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export type AgentPolicy = {
  decisionFormat: 'json_only';
  maxToolCallsPerTurn: 1;
  workspaceJail: boolean;
  forbidNetwork: boolean;
  forbidGitPush: boolean;
  autoApprove?: boolean;
  dryRun?: boolean;
  confirmWrite?: boolean;
  confirmShell?: boolean;
};
