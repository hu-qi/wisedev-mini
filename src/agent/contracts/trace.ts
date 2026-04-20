import type { AgentDecision } from './agent-decision';
import type { ChatResponse } from './llm';
import type { ToolResult } from './tool';
import type { ProjectState } from './state';
import type { MemorySnapshot } from './memory';
import type { ToolSchema, AgentPolicy } from './tool';

export type PromptBuildInput = {
  userInput: string;
  workspaceRoot: string;
  state: ProjectState;
  memory: MemorySnapshot;
  tools: ToolSchema[];
  run: {
    runId: string;
    turn: number;
    maxTurns: number;
  };
  policy: AgentPolicy;
};

export type RunTraceEvent =
  | { ts: string; runId: string; turn: number; type: 'state'; data: ProjectState }
  | { ts: string; runId: string; turn: number; type: 'prompt_input'; data: PromptBuildInput }
  | { ts: string; runId: string; turn: number; type: 'llm_response'; data: ChatResponse }
  | { ts: string; runId: string; turn: number; type: 'decision'; data: AgentDecision }
  | { ts: string; runId: string; turn: number; type: 'tool_result'; data: ToolResult }
  | { ts: string; runId: string; turn: number; type: 'final'; data: { response: string } }
  | { ts: string; runId: string; turn: number; type: 'error'; data: { message: string } };

