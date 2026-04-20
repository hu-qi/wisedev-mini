import type { PromptBuildInput } from '../contracts/trace';
import type { ChatMessage } from '../contracts/llm';

function jsonStringifySafe(v: unknown, maxLen: number): string {
  const s = JSON.stringify(v, null, 2) ?? '';
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '\n...TRUNCATED';
}

export class PromptBuilder {
  public build(input: PromptBuildInput): { system: string; messages: ChatMessage[] } {
    const toolsText = jsonStringifySafe(input.tools, 12_000);
    const stateText = jsonStringifySafe(input.state, 8_000);
    const memoryText = jsonStringifySafe(input.memory, 8_000);

    const system = [
      '你是一个软件工程执行型智能体（Agent）。',
      '你必须严格按以下 JSON 协议输出决策，且只能输出 JSON，不能输出 Markdown、解释性文字或代码块。',
      '',
      '决策协议（只能三选一）：',
      '1) 调用工具：{"kind":"tool","thought":"...可选","tool":{"name":"tool_name","args":{}},"done":false}',
      '2) 最终回答：{"kind":"final","thought":"...可选","response":"...","done":true}',
      '3) 错误结束：{"kind":"error","thought":"...可选","message":"...","done":true}',
      '',
      '约束：',
      '- 每轮最多调用 1 个工具。',
      '- 工具参数必须符合 schema。',
      '- 不允许输出任何除 JSON 外的内容。'
    ].join('\n');

    const user = [
      `工作区：${input.workspaceRoot}`,
      `Run：${input.run.runId}，第 ${input.run.turn}/${input.run.maxTurns} 轮`,
      '',
      '当前状态：',
      stateText,
      '',
      '可用工具（schema）：',
      toolsText,
      '',
      '记忆（short/long）：',
      memoryText,
      '',
      '用户请求：',
      input.userInput
    ].join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];

    return { system, messages };
  }
}

