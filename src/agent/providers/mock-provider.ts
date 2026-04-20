import type { ChatRequest, ChatResponse, LLMProvider } from '../contracts/llm';

export class MockProvider implements LLMProvider {
  public readonly name = 'mock';

  public async chat(req: ChatRequest): Promise<ChatResponse> {
    const content =
      '{"kind":"final","thought":"mock provider","response":"当前未配置真实大模型（OPENAI_API_KEY）。已进入 mock 模式，无法执行真实推理。","done":true}';
    return { provider: this.name, model: req.model, content };
  }
}

