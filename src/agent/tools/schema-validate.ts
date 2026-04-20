import type { JsonSchema } from '../contracts/tool';

type ValidateResult = { ok: true } | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function typeMatches(value: unknown, expected: unknown): boolean {
  if (expected === 'string') return typeof value === 'string';
  if (expected === 'number') return typeof value === 'number';
  if (expected === 'boolean') return typeof value === 'boolean';
  if (expected === 'object') return isObject(value);
  if (expected === 'array') return Array.isArray(value);
  return true;
}

export function validateArgs(schema: JsonSchema, args: Record<string, unknown>): ValidateResult {
  const required = Array.isArray(schema.required) ? (schema.required as unknown[]) : [];
  for (const key of required) {
    if (typeof key !== 'string') continue;
    if (!(key in args)) return { ok: false, error: `缺少必填参数: ${key}` };
  }

  const properties = isObject(schema.properties) ? (schema.properties as Record<string, unknown>) : undefined;
  if (!properties) return { ok: true };

  for (const [k, v] of Object.entries(args)) {
    const propSchema = properties[k];
    if (!propSchema || !isObject(propSchema)) continue;
    if ('type' in propSchema && !typeMatches(v, propSchema.type)) {
      return { ok: false, error: `参数类型不匹配: ${k}` };
    }
  }

  return { ok: true };
}

