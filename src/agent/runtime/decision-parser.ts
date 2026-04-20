import type { DecisionParseResult, AgentDecision } from '../contracts/agent-decision';

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

export function parseAgentDecision(text: string): DecisionParseResult {
  const rawText = text;
  const cleaned = stripCodeFences(text);

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const candidate = firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;

  try {
    const obj = JSON.parse(candidate) as AgentDecision;
    if (!obj || typeof obj !== 'object' || !('kind' in obj)) {
      return { ok: false, error: '决策 JSON 缺少 kind 字段', rawText };
    }
    return { ok: true, decision: obj, rawJson: candidate };
  } catch (e) {
    return { ok: false, error: `无法解析决策 JSON: ${(e as Error).message}`, rawText };
  }
}

