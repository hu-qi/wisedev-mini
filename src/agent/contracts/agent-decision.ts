export type AgentDecision =
  | {
      kind: 'tool';
      thought?: string;
      tool: {
        name: string;
        args: Record<string, unknown>;
      };
      done?: false;
    }
  | {
      kind: 'final';
      thought?: string;
      response: string;
      done: true;
    }
  | {
      kind: 'error';
      thought?: string;
      message: string;
      done: true;
    };

export type DecisionParseResult =
  | { ok: true; decision: AgentDecision; rawJson: string }
  | { ok: false; error: string; rawText: string };

