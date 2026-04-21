import type { PromptBuildInput } from '../contracts/trace';
import type { ChatMessage } from '../contracts/llm';
import { designPrototypeSystem, govDesignPrototypeSystem } from './presets';

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

    const systemParts = [
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
      '- 不允许输出任何除 JSON 外的内容。',
      '',
      '--- 当前项目上下文 ---',
      `工作区：${input.workspaceRoot}`,
      `当前执行 Run ID：${input.run.runId}`,
      '',
      '当前状态：',
      stateText,
      '',
      '可用工具（schema）：',
      toolsText,
      '',
      '记忆（short/long）：',
      memoryText
    ];

    if (input.activeSkills && input.activeSkills.length > 0) {
      const skillSystems = input.activeSkills
        .map(s => s.prompts?.systemAppend)
        .filter(Boolean) as string[];
      if (skillSystems.length > 0) {
        systemParts.push('', '--- 插件补充指令 (Skills) ---', ...skillSystems);
      }
    }

    if (input.policy.preset === 'gov-design-prototype') {
      systemParts.push(
        '',
        '--- Preset: Web 原型设计模式 ---',
        designPrototypeSystem,
        '',
        '--- Preset: 政企增强 ---',
        govDesignPrototypeSystem
      );
    } else if (input.policy.preset === 'design-prototype') {
      systemParts.push('', '--- Preset: Web 原型设计模式 ---', designPrototypeSystem);
    }

    const system = systemParts.join('\n');

    const userParts = [
      `第 ${input.run.turn}/${input.run.maxTurns} 轮执行。`,
      `用户请求/本轮观察：\n${input.userInput}`
    ];

    if (input.activeSkills && input.activeSkills.length > 0) {
      const skillUsers = input.activeSkills
        .map(s => s.prompts?.userAppend)
        .filter(Boolean) as string[];
      if (skillUsers.length > 0) {
        userParts.push('', '--- 插件补充信息 ---', ...skillUsers);
      }
    }

    const user = userParts.join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: system }
    ];

    if (input.history && input.history.length > 0) {
      messages.push(...input.history);
    }

    messages.push({ role: 'user', content: user });

    return { system, messages };
  }
}
