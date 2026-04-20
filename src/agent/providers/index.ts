import type { LLMProvider } from '../contracts/llm';
import { OpenAIProvider } from './openai-provider';
import { MockProvider } from './mock-provider';

export function createProvider(name: string | undefined): LLMProvider {
  const normalized = (name ?? '').trim().toLowerCase();
  if (normalized === 'mock') return new MockProvider();
  if (normalized === 'openai') return new OpenAIProvider();

  if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
  return new MockProvider();
}

