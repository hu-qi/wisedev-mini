import crypto from 'crypto';
import path from 'path';
import type { LLMProvider, ChatMessage } from '../contracts/llm';
import type { AgentPolicy } from '../contracts/tool';
import { ToolManager } from '../tools/tool-manager';
import { readFileTool } from '../tools/builtins/read-file';
import { writeFileTool } from '../tools/builtins/write-file';
import { runShellTool } from '../tools/builtins/run-shell';
import { listDirTool } from '../tools/builtins/list-dir';
import { PromptBuilder } from '../prompt/prompt-builder';
import { MemoryManager } from '../memory/memory-manager';
import { AgentStateManager } from '../state/state-manager';
import { SkillManager } from '../skills/skill-manager';
import { TraceWriter } from './trace-writer';
import { TraceReader } from './trace-reader';
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
  private skillManager: SkillManager;

  public constructor(private opts: AgentRuntimeOptions) {
    this.baseDir = path.join(this.opts.workspaceRoot, '.pi-mini', 'agent');
    this.toolManager = new ToolManager();
    this.promptBuilder = new PromptBuilder();
    this.memory = new MemoryManager(this.baseDir);
    this.stateManager = new AgentStateManager(this.baseDir, this.opts.workspaceRoot);
    this.skillManager = new SkillManager(this.baseDir);

    this.toolManager.register(readFileTool);
    this.toolManager.register(writeFileTool);
    this.toolManager.register(runShellTool);
    this.toolManager.register(listDirTool);
  }

  public getSkillManager(): SkillManager {
    return this.skillManager;
  }

  public async init(): Promise<void> {
    await this.memory.init();
    await this.stateManager.load();
    await this.skillManager.init();
    await this.skillManager.loadAll();
  }

  public async status(): Promise<{ baseDir: string; statePath: string }> {
    return { baseDir: this.baseDir, statePath: path.join(this.baseDir, 'state.json') };
  }

  public async ask(userInput: string, opts?: { silent?: boolean }): Promise<{ ok: true; response: string } | { ok: false; error: string }> {
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
        activeSkills: this.skillManager.getActiveSkills(),
        trace,
        silent: opts?.silent
      });

      const last = state.runs[state.runs.length - 1];
      if (last) {
        last.finishedAt = new Date().toISOString();
        last.status = res.ok ? 'DONE' : 'ERROR';
        await this.stateManager.syncState(state);
        await this.stateManager.save(state);
      }

      return res;
    } catch (e) {
      const last = state.runs[state.runs.length - 1];
      if (last) {
        last.finishedAt = new Date().toISOString();
        last.status = 'ERROR';
        await this.stateManager.syncState(state);
        await this.stateManager.save(state);
      }
      return { ok: false, error: (e as Error).message };
    }
  }

  public async resume(targetRunId?: string, opts?: { silent?: boolean }): Promise<{ ok: true; response: string } | { ok: false; error: string }> {
    await this.init();
    const state = await this.stateManager.load();
    let runId = targetRunId;

    if (!runId) {
      const unfinished = state.runs?.filter(r => r.status === 'RUNNING' || r.status === 'ERROR') || [];
      if (unfinished.length === 0) {
        return { ok: false, error: '未找到可恢复的运行任务（Run ID）。' };
      }
      runId = unfinished[unfinished.length - 1].runId;
    }

    const runInfo = state.runs?.find(r => r.runId === runId);
    if (!runInfo) {
      return { ok: false, error: `在状态中未找到 Run ID: ${runId}` };
    }

    const reader = new TraceReader(this.opts.workspaceRoot);
    const events = await reader.readTrace(runId!);
    
    if (events.length === 0) {
      return { ok: false, error: `Trace 文件为空或不存在: ${runId}` };
    }

    const userInput = state.currentGoal || '继续执行任务';
    const history: ChatMessage[] = [];
    let startTurn = 1;
    let lastObservation = '';

    // Reconstruct history
    for (const ev of events) {
      if (ev.type === 'prompt_input') {
        const promptData = ev.data;
        const msgContent = [
          `第 ${promptData.run.turn}/${promptData.run.maxTurns} 轮执行。`,
          `用户请求/本轮观察：\n${promptData.userInput}`
        ].join('\n');
        history.push({ role: 'user', content: msgContent });
        startTurn = ev.turn;
      } else if (ev.type === 'llm_response') {
        history.push({ role: 'assistant', content: ev.data.content });
      } else if (ev.type === 'tool_result') {
        lastObservation = JSON.stringify(ev.data).slice(0, 8000);
      }
    }

    // Since we are resuming from the end of the trace, we increment turn.
    // If the last event was a tool_result or error, we proceed to startTurn + 1.
    // Wait, if the trace ended at llm_response, maybe it crashed parsing.
    // Generally, startTurn = last recorded turn + 1
    startTurn += 1;

    runInfo.status = 'RUNNING';
    await this.stateManager.save(state);

    const trace = new TraceWriter(this.baseDir, runId!);
    await trace.init();

    const loop = new RunLoop();
    try {
      const res = await loop.run({
        userInput,
        workspaceRoot: this.opts.workspaceRoot,
        model: this.opts.model,
        maxTurns: this.opts.maxTurns,
        startTurn,
        history,
        lastObservation,
        provider: this.opts.provider,
        policy: this.opts.policy,
        state,
        toolManager: this.toolManager,
        promptBuilder: this.promptBuilder,
        memory: this.memory,
        activeSkills: this.skillManager.getActiveSkills(),
        trace,
        silent: opts?.silent
      });

      runInfo.finishedAt = new Date().toISOString();
      runInfo.status = res.ok ? 'DONE' : 'ERROR';
      await this.stateManager.syncState(state);
      await this.stateManager.save(state);
      return res;
    } catch (e) {
      runInfo.finishedAt = new Date().toISOString();
      runInfo.status = 'ERROR';
      await this.stateManager.syncState(state);
      await this.stateManager.save(state);
      return { ok: false, error: (e as Error).message };
    }
  }
}

