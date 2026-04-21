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
      '',
      '决策协议（通常情况下你必须输出且仅输出一个合法的 JSON，如下三选一）：',
      '1) 调用常规工具：{"kind":"tool","thought":"...可选","tool":{"name":"tool_name","args":{}},"done":false}',
      '2) 最终回答：{"kind":"final","thought":"...可选","response":"...","done":true}',
      '3) 错误结束：{"kind":"error","thought":"...可选","message":"...","done":true}',
      '',
      '【特别支持的稳健文本协议 (Robust Boundary Protocol)】',
      '当你要调用 `write_file` 或 `patch_file` 工具生成/修改大段代码时，为了避免 JSON 嵌套带来的解析崩溃，请**绝对不要**使用 JSON！请直接输出以下纯文本块：',
      '',
      '>> 若要全量覆写或新建文件 (write_file)，请精确输出（注意结束标记前面不要有多余的空行）：',
      '---WRITE_FILE: path/to/file.ext---',
      '文件内容...',
      '---END WRITE_FILE---',
      '',
      '>> 若要精准修改已有文件的一部分 (patch_file)，请精确输出：',
      '---PATCH_FILE: path/to/file.ext---',
      '<<<<',
      '原文件里要被替换的一段精确内容（必须完全匹配原文件的换行和缩进）',
      '====',
      '替换后的新内容',
      '>>>>',
      '---END PATCH_FILE---',
      '',
      '约束：',
      '- 每轮最多只能进行一次操作（一个 JSON，或一个 ---XXX_FILE--- 块）。',
      '- 使用稳健文本协议时，不要输出其他废话，直接输出块。',
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

    if (input.presetContent) {
      systemParts.push('', input.presetContent);
    } else if (input.policy.preset === 'gov-design-prototype') {
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
