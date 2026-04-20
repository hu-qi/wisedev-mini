import crypto from 'crypto';
import path from 'path';
import type { LLMProvider } from '../contracts/llm';
import type { AgentPolicy } from '../contracts/tool';
import { ToolManager } from '../tools/tool-manager';
import { readFileTool } from '../tools/builtins/read-file';
import { writeFileTool } from '../tools/builtins/write-file';
import { runShellTool } from '../tools/builtins/run-shell';
import { PromptBuilder } from '../prompt/prompt-builder';
import { MemoryManager } from '../memory/memory-manager';
import { AgentStateManager } from '../state/state-manager';
import { TraceWriter } from './trace-writer';
import { RunLoop } from './run-loop';

export type AgentRuntimeOptions = {
  workspaceRoot: string;
  provider: LLMProvider;
  model: string;
  maxTurns: number;
  policy: AgentPolicy;
};

export class AgentRuntime {
  private baseDir: string;
  private toolManager: ToolManager;
  private promptBuilder: PromptBuilder;
  private memory: MemoryManager;
  private stateManager: AgentStateManager;

  public constructor(private opts: AgentRuntimeOptions) {
    this.baseDir = path.join(this.opts.workspaceRoot, '.pi-mini', 'agent');
    this.toolManager = new ToolManager();
    this.promptBuilder = new PromptBuilder();
    this.memory = new MemoryManager(this.baseDir);
    this.stateManager = new AgentStateManager(this.baseDir, this.opts.workspaceRoot);

    this.toolManager.register(readFileTool);
    this.toolManager.register(writeFileTool);
    this.toolManager.register(runShellTool);
  }

  public async init(): Promise<void> {
    await this.memory.init();
    await this.stateManager.load();
  }

  public async status(): Promise<{ baseDir: string; statePath: string }> {
    return { baseDir: this.baseDir, statePath: path.join(this.baseDir, 'state.json') };
  }

  public async ask(userInput: string): Promise<{ ok: true; response: string } | { ok: false; error: string }> {
    await this.init();

    const state = await this.stateManager.load();
    const runId = crypto.randomUUID();
    state.runs.push({ runId, startedAt: new Date().toISOString(), status: 'RUNNING' });
    state.currentGoal = userInput;
    await this.stateManager.save(state);

    const trace = new TraceWriter(this.baseDir, runId);
    await trace.init();
    await trace.append({ ts: new Date().toISOString(), runId, turn: 0, type: 'state', data: state });

    const loop = new RunLoop();
    try {
      const res = await loop.run({
        userInput,
        workspaceRoot: this.opts.workspaceRoot,
        model: this.opts.model,
        maxTurns: this.opts.maxTurns,
        provider: this.opts.provider,
        policy: this.opts.policy,
        state,
        toolManager: this.toolManager,
        promptBuilder: this.promptBuilder,
        memory: this.memory,
        trace
      });

      const last = state.runs[state.runs.length - 1];
      last.finishedAt = new Date().toISOString();
      last.status = res.ok ? 'DONE' : 'ERROR';
      await this.stateManager.save(state);

      return res.ok ? { ok: true, response: res.response } : { ok: false, error: res.error };
    } catch (e) {
      const last = state.runs[state.runs.length - 1];
      last.finishedAt = new Date().toISOString();
      last.status = 'ERROR';
      await this.stateManager.save(state);
      return { ok: false, error: (e as Error).message };
    }
  }
}

