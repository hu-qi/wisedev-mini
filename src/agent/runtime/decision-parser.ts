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
  
  // Strip think tags first
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // --- BOUNDARY PROTOCOL PARSING ---
  const writeFileMatch = cleaned.match(/---WRITE_FILE:\s*([^\n]+?)---\n([\s\S]*?)[\s\n]*---END WRITE_FILE---/i);
  if (writeFileMatch) {
    const filePath = writeFileMatch[1].trim();
    // Trim right to remove trailing newlines before ---END WRITE_FILE--- but keep internal structure
    const content = writeFileMatch[2].replace(/\n+$/, '');
    return {
      ok: true,
      rawJson: '',
      decision: {
        kind: 'tool',
        tool: {
          name: 'write_file',
          args: { path: filePath, content }
        }
      }
    };
  }

  const patchFileMatch = cleaned.match(/---PATCH_FILE:\s*([^\n]+?)---\n<<<<\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>[\s\n]*---END PATCH_FILE---/i);
  if (patchFileMatch) {
    const filePath = patchFileMatch[1].trim();
    const oldStr = patchFileMatch[2];
    const newStr = patchFileMatch[3];
    return {
      ok: true,
      rawJson: '',
      decision: {
        kind: 'tool',
        tool: {
          name: 'patch_file',
          args: { path: filePath, oldStr, newStr }
        }
      }
    };
  }

  // --- JSON PARSING ---
  cleaned = stripCodeFences(cleaned);

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace < 0 || lastBrace <= firstBrace) {
     return { ok: false, error: '未找到有效的 JSON 结构（没有大括号）', rawText };
  }

  const candidate = cleaned.slice(firstBrace, lastBrace + 1);

  // 1. 先尝试最原生的 parse
  try {
    const obj = JSON.parse(candidate) as AgentDecision;
    if (!obj || typeof obj !== 'object' || !('kind' in obj)) {
      return { ok: false, error: '决策 JSON 缺少 kind 字段', rawText };
    }
    return { ok: true, decision: obj, rawJson: candidate };
  } catch (err1) {
    // 2. 如果失败，尝试替换控制字符（特别是值中的换行符）
    let escaped = candidate;
    // 使用正则替换 JSON 字符串值中的换行符，而不是替换整个 candidate 中的换行符
    escaped = escaped.replace(/("[\s\S]*?")/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    });
    try {
      const obj = JSON.parse(escaped) as AgentDecision;
      if (!obj || typeof obj !== 'object' || !('kind' in obj)) {
        return { ok: false, error: '决策 JSON 缺少 kind 字段', rawText };
      }
      return { ok: true, decision: obj, rawJson: escaped };
    } catch(err2) {
      // 3. 很多时候模型输出的 JSON 有多余的逗号，尝试修复尾部多余逗号
      try {
         const fixed = escaped.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
         const obj = JSON.parse(fixed) as AgentDecision;
         if (!obj || typeof obj !== 'object' || !('kind' in obj)) {
           return { ok: false, error: '决策 JSON 缺少 kind 字段', rawText };
         }
         return { ok: true, decision: obj, rawJson: fixed };
      } catch(err3) {
         return { ok: false, error: `无法解析决策 JSON: ${(err1 as Error).message}`, rawText };
      }
    }
  }
}

