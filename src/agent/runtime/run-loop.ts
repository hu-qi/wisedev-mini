import type { LLMProvider } from '../contracts/llm';
import type { AgentPolicy, ToolContext } from '../contracts/tool';
import type { ProjectState } from '../contracts/state';
import type { MemoryManager } from '../memory/memory-manager';
import type { PromptBuilder } from '../prompt/prompt-builder';
import type { ToolManager } from '../tools/tool-manager';
import type { TraceWriter } from './trace-writer';
import { parseAgentDecision } from './decision-parser';
import type { ChatMessage } from '../contracts/llm';
import type { SkillManifest } from '../contracts/skill';

export type RunLoopInput = {
  userInput: string;
  workspaceRoot: string;
  model: string;
  maxTurns: number;
  startTurn?: number;
  history?: ChatMessage[];
  lastObservation?: string;
  provider: LLMProvider;
  policy: AgentPolicy;
  state: ProjectState;
  toolManager: ToolManager;
  promptBuilder: PromptBuilder;
  memory: MemoryManager;
  activeSkills?: SkillManifest[];
  trace: TraceWriter;
};

export class RunLoop {
  public async run(input: RunLoopInput): Promise<{ ok: true; response: string } | { ok: false; error: string }> {
    const toolSchemas = input.toolManager.listSchemas();

    let lastObservation = input.lastObservation ?? '';
    let history = input.history ? [...input.history] : [];
    const startTurn = input.startTurn ?? 1;

    for (let turn = startTurn; turn <= input.maxTurns; turn += 1) {
      const memorySnap = await input.memory.snapshot();

      const promptInput = {
        userInput: input.userInput + (lastObservation ? `\n\n上轮观察：\n${lastObservation}` : ''),
        workspaceRoot: input.workspaceRoot,
        state: input.state,
        memory: memorySnap,
        tools: toolSchemas,
        activeSkills: input.activeSkills,
        history,
        run: {
          runId: input.state.runs[input.state.runs.length - 1]?.runId ?? '',
          turn,
          maxTurns: input.maxTurns
        },
        policy: input.policy
      };

      await input.trace.append({
        ts: new Date().toISOString(),
        runId: promptInput.run.runId,
        turn,
        type: 'prompt_input',
        data: promptInput
      });

      const built = input.promptBuilder.build(promptInput);
      const llmRes = await input.provider.chat({
        model: input.model,
        messages: built.messages,
        temperature: 0.2,
        timeoutMs: 60_000
      });

      // 追加当前轮的交互到 history 中，供下一轮使用
      const userMsg = built.messages[built.messages.length - 1];
      history.push(userMsg);
      history.push({ role: 'assistant', content: llmRes.content });

      await input.trace.append({
        ts: new Date().toISOString(),
        runId: promptInput.run.runId,
        turn,
        type: 'llm_response',
        data: llmRes
      });

      const parsed = parseAgentDecision(llmRes.content);
      if (!parsed.ok) {
        const msg = parsed.error;
        await input.memory.append('observation', `决策解析失败：${msg}`);
        await input.trace.append({
          ts: new Date().toISOString(),
          runId: promptInput.run.runId,
          turn,
          type: 'error',
          data: { message: msg }
        });
        return { ok: false, error: msg };
      }

      await input.trace.append({
        ts: new Date().toISOString(),
        runId: promptInput.run.runId,
        turn,
        type: 'decision',
        data: parsed.decision
      });

      if (parsed.decision.kind === 'final') {
        await input.memory.append('decision', parsed.decision.response);
        await input.trace.append({
          ts: new Date().toISOString(),
          runId: promptInput.run.runId,
          turn,
          type: 'final',
          data: { response: parsed.decision.response }
        });
        return { ok: true, response: parsed.decision.response };
      }

      if (parsed.decision.kind === 'error') {
        await input.memory.append('decision', parsed.decision.message);
        await input.trace.append({
          ts: new Date().toISOString(),
          runId: promptInput.run.runId,
          turn,
          type: 'error',
          data: { message: parsed.decision.message }
        });
        return { ok: false, error: parsed.decision.message };
      }

      if (parsed.decision.kind === 'tool') {
        if (!input.toolManager.has(parsed.decision.tool.name)) {
          const msg = `工具不存在: ${parsed.decision.tool.name}`;
          await input.memory.append('observation', msg);
          lastObservation = msg;
          continue;
        }

        const ctx: ToolContext = {
          workspaceRoot: input.workspaceRoot,
          runId: promptInput.run.runId,
          turn,
          policy: input.policy
        };

        const toolRes = await input.toolManager.execute(parsed.decision.tool.name, parsed.decision.tool.args, ctx);
        await input.trace.append({
          ts: new Date().toISOString(),
          runId: promptInput.run.runId,
          turn,
          type: 'tool_result',
          data: toolRes
        });

        lastObservation = JSON.stringify(toolRes).slice(0, 8000);
        await input.memory.append('observation', lastObservation);
      }

      // 每轮结束尝试压缩记忆
      await input.memory.compact();
    }

    return { ok: false, error: '超过最大轮次仍未完成' };
  }
}

