import type { DecisionParseResult, AgentDecision } from '../contracts/agent-decision';

function stripCodeFences(text: string): string {
  let cleaned = text.trim();

  // Remove <think>...</think> tags if they exist (Minimax often outputs these)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const jsonFenceMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonFenceMatch) return jsonFenceMatch[1].trim();
  
  const anyFenceMatch = cleaned.match(/```\s*([\s\S]*?)\s*```/i);
  if (anyFenceMatch) return anyFenceMatch[1].trim();

  return cleaned;
}

export function parseAgentDecision(text: string): DecisionParseResult {
  const rawText = text;
  const cleaned = stripCodeFences(text);

  // 尝试寻找第一个 { 和最后一个 }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  // 如果连 {} 都没有，直接报错
  if (firstBrace < 0 || lastBrace <= firstBrace) {
     return { ok: false, error: '未找到有效的 JSON 结构（没有大括号）', rawText };
  }

  // 截取大括号之间的内容
  let candidate = cleaned.slice(firstBrace, lastBrace + 1);

  // 很多模型会在 JSON 内部包含未转义的换行符，这会导致 JSON.parse 失败
  // 简单把 \n 替换成 \\n 以便让 JSON.parse 存活（如果模型在内容里直接换行了的话）
  // 但要注意如果已经是 \\n 就不要再转了，简单处理：先做粗略替换
  const candidateWithEscapedNewlines = candidate
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');

  try {
    const obj = JSON.parse(candidateWithEscapedNewlines) as AgentDecision;
    if (!obj || typeof obj !== 'object' || !('kind' in obj)) {
      return { ok: false, error: '决策 JSON 缺少 kind 字段', rawText };
    }
    return { ok: true, decision: obj, rawJson: candidateWithEscapedNewlines };
  } catch (e) {
    try {
      const obj = JSON.parse(candidate) as AgentDecision;
      if (!obj || typeof obj !== 'object' || !('kind' in obj)) {
        return { ok: false, error: '决策 JSON 缺少 kind 字段', rawText };
      }
      return { ok: true, decision: obj, rawJson: candidate };
    } catch(err2) {
      // 很多时候模型输出的 JSON 有多余的逗号，尝试修复尾部多余逗号
      try {
         const fixedCandidate = candidateWithEscapedNewlines.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
         const obj = JSON.parse(fixedCandidate) as AgentDecision;
         if (!obj || typeof obj !== 'object' || !('kind' in obj)) {
           return { ok: false, error: '决策 JSON 缺少 kind 字段', rawText };
         }
         return { ok: true, decision: obj, rawJson: fixedCandidate };
      } catch(err3) {
         // Fallback: Use repair-json or basic eval if possible, but for security we avoid eval.
         // Let's just log the failure.
         return { ok: false, error: `无法解析决策 JSON: ${(err3 as Error).message}`, rawText };
      }
    }
  }
}

