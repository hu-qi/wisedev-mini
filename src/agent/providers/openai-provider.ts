import type { ChatRequest, ChatResponse, LLMProvider } from '../contracts/llm';

type OpenAIChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export class OpenAIProvider implements LLMProvider {
  public readonly name = 'openai';

  public async chat(req: ChatRequest): Promise<ChatResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('缺少 OPENAI_API_KEY 环境变量');
    }

    const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutMs = req.timeoutMs ?? 60_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          temperature: req.temperature ?? 0.2,
          max_tokens: req.maxTokens
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI 请求失败: ${res.status} ${text}`);
      }

      const data = (await res.json()) as OpenAIChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content ?? '';
      return {
        provider: this.name,
        model: req.model,
        content,
        usage: data.usage
          ? {
              inputTokens: data.usage.prompt_tokens,
              outputTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens
            }
          : undefined,
        raw: data
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

