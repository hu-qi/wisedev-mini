
# 《LLMProvider.ts 多模型适配实现方案》

目标是让系统支持：

```text id="3d8v2m"
OpenAI
Anthropic
DeepSeek
Ollama
本地模型
```

统一成一个接口。

---

# 1. 为什么需要 LLMProvider

如果没有统一层，你后面代码会变成：

```ts id="1q6k4p"
if (openai) ...
if (claude) ...
if (deepseek) ...
```

很快失控。

---

所以需要：

```text id="7n5x1q"
统一模型抽象层
```

---

# 2. 职责

LLMProvider 负责：

```text id="5w9m2r"
1. 统一调用接口
2. 多模型切换
3. Tool Calling 兼容
4. Token 控制
5. 重试机制
6. 错误处理
```

---

# 3. 文件位置

---

```text id="2c7r8j"
src/agent/LLMProvider.ts
```

---

# 4. 统一接口定义

---

```ts id="9m4x0t"
export interface ChatRequest {
  prompt: string
  tools?: any[]
}

export interface ChatResponse {
  content: string
  toolCall?: {
    name: string
    args: any
  }
}
```

---

# 5. Provider 接口

---

```ts id="8p3v7n"
export interface ModelProvider {
  chat(req: ChatRequest): Promise<ChatResponse>
}
```

---

这样所有模型都实现：

```text id="1z5u9k"
chat()
```

---

# 6. LLMProvider 主类

---

```ts id="4r0m8x"
export class LLMProvider {
  private provider: ModelProvider

  constructor() {
    this.provider = this.createProvider()
  }

  async chat(req: ChatRequest) {
    return this.provider.chat(req)
  }
}
```

---

# 7. 根据配置选择模型

---

```ts id="6x2t5w"
private createProvider(): ModelProvider {
  const model = process.env.LLM_PROVIDER

  switch(model) {
    case "openai":
      return new OpenAIProvider()
    case "claude":
      return new ClaudeProvider()
    case "deepseek":
      return new DeepSeekProvider()
    default:
      return new OpenAIProvider()
  }
}
```

---

# 8. 配置文件

---

```env id="5k9p1s"
LLM_PROVIDER=openai
OPENAI_API_KEY=xxx
CLAUDE_API_KEY=xxx
DEEPSEEK_API_KEY=xxx
```

---

# 9. OpenAI 实现

---

支持 OpenAI API。

---

```ts id="0w4m9v"
export class OpenAIProvider implements ModelProvider {
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: req.prompt
    })

    return {
      content: response.output_text
    }
  }
}
```

---

# 10. Tool Calling 支持

---

如果启用工具：

```ts id="2v7k4m"
const response = await client.responses.create({
  model: "gpt-4.1",
  input: req.prompt,
  tools: req.tools
})
```

---

解析：

```ts id="7r5w1x"
if (response.tool_calls?.length) {
  return {
    content: "",
    toolCall: {
      name: response.tool_calls[0].name,
      args: JSON.parse(response.tool_calls[0].arguments)
    }
  }
}
```

---

# 11. Claude 实现

---

支持 Anthropic。

---

```ts id="8u1z6p"
export class ClaudeProvider implements ModelProvider {
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const response = await anthropic.messages.create({
      model: "claude-3-opus",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: req.prompt
      }]
    })

    return {
      content: response.content[0].text
    }
  }
}
```

---

# 12. DeepSeek 实现

---

支持 DeepSeek。

---

```ts id="3p6r9w"
export class DeepSeekProvider implements ModelProvider {
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(
      "https://api.deepseek.com/chat/completions",
      { ... }
    )

    return {
      content: result.choices[0].message.content
    }
  }
}
```

---

# 13. 本地模型支持

---

可接 Ollama。

---

```ts id="9t2m4q"
export class OllamaProvider implements ModelProvider {
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      body: JSON.stringify({
        model: "qwen2.5",
        prompt: req.prompt
      })
    })

    return {
      content: data.response
    }
  }
}
```

---

# 14. 重试机制

---

避免网络失败。

---

```ts id="1v8k3m"
async retry(fn: Function, times = 3) {
  for (let i = 0; i < times; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i === times - 1) throw e
    }
  }
}
```

---

调用：

```ts id="7n1x5q"
return this.retry(() => this.provider.chat(req))
```

---

# 15. Token 控制

---

防止超长。

---

```ts id="5u4z7n"
private truncate(prompt: string) {
  return prompt.slice(0, 12000)
}
```

---

---

# 16. 成本控制

---

不同任务选不同模型：

---

## 轻任务

```text id="4m9v2w"
gpt-4o-mini
```

---

## 编码任务

```text id="8p1r6t"
gpt-4.1
```

---

## 文档任务

```text id="6x5z3q"
claude
```

---

动态选择：

```ts id="0k7w4n"
selectModel(taskType)
```

---

# 17. 多模型路由

---

```ts id="2r8m5v"
if (task.includes("code")) {
  return openai
}

if (task.includes("document")) {
  return claude
}
```

---

# 18. 返回统一格式

---

无论什么模型，都返回：

```json id="3w9t1x"
{
  "content": "...",
  "toolCall": {
    "name": "read_file",
    "args": {
      "path": "src/app.ts"
    }
  }
}
```

---

# 19. 与 AgentRuntime 集成

---

```ts id="7p2m8q"
const aiResult = await this.llm.chat({
  prompt,
  tools: toolSchemas
})
```

---

AgentRuntime 无需关心具体模型。

---

# 20. 异常处理

---

```ts id="1m5v9x"
try {
  return await this.provider.chat(req)
} catch (error) {
  return {
    content: "",
    error: error.message
  }
}
```

---

# 21. 日志记录

---

```ts id="8n4w2r"
console.log({
  model: this.currentModel,
  tokens: usage.total_tokens
})
```

---

记录：

```text id="9q6x1p"
.pi-mini/logs/llm.log
```

---

# 22. 缓存机制（推荐）

---

避免重复调用。

---

```ts id="4v7k3m"
const cacheKey = hash(prompt)
```

---

保存：

```text id="1r9m5w"
.pi-mini/cache/
```

---

# 23. 最终结构

---

```text id="6z3x8p"
agent/
 ├── LLMProvider.ts
 ├── providers/
 │    ├── OpenAIProvider.ts
 │    ├── ClaudeProvider.ts
 │    ├── DeepSeekProvider.ts
 │    └── OllamaProvider.ts
```

---

# 24. 最终能力

---

你的系统将支持：

✅ 一套代码
✅ 多模型切换
✅ 动态路由
✅ Tool Calling
✅ 本地部署

---

# 25. 完整调用链

---

```text id="2x7m4v"
User
 ↓
PromptBuilder
 ↓
LLMProvider
 ↓
ToolManager
 ↓
MemoryManager
 ↓
AgentRuntime
```

---

# 26. 最关键收益

---

从：

```text id="5n8r2q"
固定单模型工具
```

升级成：

```text id="9w1m6x"
企业级 AI Agent Runtime
```

---

# 27. 下一步建议

---

接下来最值得做的是：

# 《AgentRuntime 多轮自主循环方案》

因为你现在已经有：

* Prompt
* Tool
* Memory
* LLM

下一步就是让它真正：

```text id="3p9v1w"
自己连续工作
```
