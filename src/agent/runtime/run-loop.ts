import chalk from 'chalk';
import ora from 'ora';
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
import { resolvePreset } from '../prompt/presets';

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
  silent?: boolean;
};

export class RunLoop {
  public async run(input: RunLoopInput): Promise<{ ok: true; response: string } | { ok: false; error: string }> {
    const toolSchemas = input.toolManager.listSchemas();

    let lastObservation = input.lastObservation ?? '';
    let history = input.history ? [...input.history] : [];
    const startTurn = input.startTurn ?? 1;

    if (!input.silent) {
      console.log(chalk.blue(`\n[Agent Run] Starting loop (max ${input.maxTurns} turns)`));
    }
    const noopSpinner: any = {
      text: '',
      start() { return this; },
      succeed() { return this; },
      fail() { return this; },
      warn() { return this; }
    };
    const spinner = input.silent ? noopSpinner : ora('Initializing Agent...').start();

    let presetContent: string | undefined;
    if (input.policy.preset) {
      presetContent = await resolvePreset(input.policy.preset, input.policy.presetsDir);
    }

    for (let turn = startTurn; turn <= input.maxTurns; turn += 1) {
      spinner.text = `Turn ${turn}/${input.maxTurns} - Building prompt & context...`;
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
        policy: input.policy,
        presetContent
      };

      await input.trace.append({
        ts: new Date().toISOString(),
        runId: promptInput.run.runId,
        turn,
        type: 'prompt_input',
        data: promptInput
      });

      const built = input.promptBuilder.build(promptInput);
      spinner.text = `Turn ${turn}/${input.maxTurns} - Calling LLM (${input.provider.name}/${input.model})...`;
      const llmRes = await input.provider.chat({
        model: input.model,
        messages: built.messages,
        temperature: 0.2,
        timeoutMs: 120_000 // 增加到 120s，增强商用网络波动容忍度
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
        spinner.fail(`Turn ${turn}/${input.maxTurns} - Decision parse failed: ${parsed.error}`);
        const msg = parsed.error;
        
        // 增加解析错误重试次数保护（避免无限死循环）
        const parseErrorCount = history.filter(m => m.role === 'user' && m.content.includes('决策解析失败')).length;
        if (parseErrorCount >= 3) {
          spinner.fail(`Turn ${turn}/${input.maxTurns} - Exceeded max parse retries`);
          return { ok: false, error: '决策解析连续失败超过3次，已中断执行' };
        }

        await input.memory.append('observation', `决策解析失败：${msg}。\n你输出的原始内容为：\n${llmRes.content}\n\n请检查你的输出格式，必须且只能输出一个合法的 JSON 对象，不要附加任何 Markdown 代码块或其他解释文字。`);
        lastObservation = `决策解析失败：${msg}。\n你输出的原始内容为：\n${llmRes.content}\n\n请检查你的输出格式，必须且只能输出一个合法的 JSON 对象，不要附加任何 Markdown 代码块或其他解释文字。`;
        await input.trace.append({
          ts: new Date().toISOString(),
          runId: promptInput.run.runId,
          turn,
          type: 'error',
          data: { message: msg, raw: llmRes.content }
        });
        spinner.start(`Turn ${turn}/${input.maxTurns} - Retrying due to parse error...`);
        continue;
      }

      await input.trace.append({
        ts: new Date().toISOString(),
        runId: promptInput.run.runId,
        turn,
        type: 'decision',
        data: parsed.decision
      });

      if (parsed.decision.kind === 'final') {
        spinner.succeed(`Turn ${turn}/${input.maxTurns} - Agent reached final conclusion`);
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
        spinner.fail(`Turn ${turn}/${input.maxTurns} - Agent encountered unrecoverable error`);
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
        spinner.text = `Turn ${turn}/${input.maxTurns} - Executing tool [${parsed.decision.tool.name}]...`;
        if (!input.toolManager.has(parsed.decision.tool.name)) {
          const msg = `工具不存在: ${parsed.decision.tool.name}`;
          spinner.warn(`Turn ${turn}/${input.maxTurns} - Tool not found: ${parsed.decision.tool.name}`);
          await input.memory.append('observation', msg);
          lastObservation = msg;
          spinner.start(`Turn ${turn}/${input.maxTurns} - Continuing...`);
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

        if (!toolRes.ok && typeof toolRes.error === 'string' && toolRes.error.startsWith('USER_REJECTED:')) {
          spinner.fail(`Turn ${turn}/${input.maxTurns} - User rejected tool execution`);
          await input.trace.append({
            ts: new Date().toISOString(),
            runId: promptInput.run.runId,
            turn,
            type: 'error',
            data: { message: toolRes.error }
          });
          return { ok: false, error: toolRes.error };
        }

        lastObservation = JSON.stringify(toolRes).slice(0, 8000);
        await input.memory.append('observation', lastObservation);
        spinner.succeed(`Turn ${turn}/${input.maxTurns} - Tool [${parsed.decision.tool.name}] completed`);
        spinner.start(`Turn ${turn}/${input.maxTurns} - Processing next step...`);
      }

      // 每轮结束尝试压缩记忆
      await input.memory.compact();
    }

    spinner.fail(`Exceeded max turns (${input.maxTurns}) without completing the task`);
    return { ok: false, error: '超过最大轮次仍未完成' };
  }
}
