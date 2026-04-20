import type { LLMProvider, ChatRequest, ChatResponse } from '../contracts/llm';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        stream: false,
        options: {
          temperature: req.temperature || 0.2
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      provider: this.name,
      model: req.model,
      content: data.message?.content || '',
      usage: {
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      },
      raw: data
    };
  }
}