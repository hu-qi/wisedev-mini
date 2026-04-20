import { OpenAIProvider } from './openai-provider';
import { MockProvider } from './mock-provider';
import { OllamaProvider } from './ollama-provider';
import type { LLMProvider } from '../contracts/llm';

export function createProvider(name: string = 'openai'): LLMProvider {
  switch (name.toLowerCase()) {
    case 'openai':
      return new OpenAIProvider();
    case 'mock':
      return new MockProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

