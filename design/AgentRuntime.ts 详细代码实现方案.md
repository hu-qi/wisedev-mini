# 《AgentRuntime.ts 详细代码实现方案》

适用于：

```text
pi-mini + pi-mono
```

目标：

```text
让 AgentRuntime 成为整个 AI Agent 的执行核心
```

---

# 1. AgentRuntime 职责

---

AgentRuntime 负责：

```text
1. 加载项目状态
2. 构造 Prompt
3. 调用 LLM
4. 解析 Tool Call
5. 执行 Tool
6. 更新 Memory
7. 返回结果
```

---

# 2. 文件位置

---

建议：

```text
src/agent/AgentRuntime.ts
```

---

# 3. 类结构设计

---

核心类：

```ts
export class AgentRuntime {
  constructor()
  run()
  think()
  executeTool()
  updateState()
  saveMemory()
}
```

---

# 4. 依赖模块

---

依赖：

```text
StateManager
PromptBuilder
ToolManager
MemoryManager
LLMProvider
```

---

目录：

```text
src/
 └── agent/
      AgentRuntime.ts
      PromptBuilder.ts
      ToolManager.ts
      MemoryManager.ts
      types.ts
```

---

# 5. 类型定义

---

```ts
export interface AgentRequest {
  input: string
}

export interface AgentResponse {
  thought: string
  action?: string
  tool?: string
  result?: string
}

export interface ToolCall {
  name: string
  args: Record<string, any>
}
```

---

# 6. AgentRuntime 完整骨架

---

```ts
import { StateManager } from "../state/StateManager"
import { PromptBuilder } from "./PromptBuilder"
import { ToolManager } from "./ToolManager"
import { MemoryManager } from "./MemoryManager"
import { LLMProvider } from "./LLMProvider"

export class AgentRuntime {
  private stateManager: StateManager
  private promptBuilder: PromptBuilder
  private toolManager: ToolManager
  private memoryManager: MemoryManager
  private llm: LLMProvider

  constructor() {
    this.stateManager = new StateManager()
    this.promptBuilder = new PromptBuilder()
    this.toolManager = new ToolManager()
    this.memoryManager = new MemoryManager()
    this.llm = new LLMProvider()
  }

  async run(input: string) {
    const state = await this.stateManager.load()
    const memory = await this.memoryManager.load()

    const prompt = this.promptBuilder.build({
      input,
      state,
      memory
    })

    const aiResult = await this.llm.chat(prompt)

    const parsed = this.parseResponse(aiResult)

    if (parsed.tool) {
      const toolResult = await this.executeTool(parsed)
      await this.updateState(parsed, toolResult)
      return toolResult
    }

    return parsed
  }
}
```

---

# 7. PromptBuilder 设计

---

作用：

```text
把上下文转成 LLM 可理解内容
```

---

```ts
export class PromptBuilder {
  build(context: any): string {
    return `
你是一个软件交付 AI Agent

项目状态:
${JSON.stringify(context.state, null, 2)}

历史记忆:
${JSON.stringify(context.memory, null, 2)}

用户输入:
${context.input}

请返回 JSON:
{
  "thought": "...",
  "tool": "...",
  "args": {}
}
`
  }
}
```

---

# 8. LLM 返回格式

---

强制模型输出：

```json
{
  "thought": "需要读取登录模块",
  "tool": "read_file",
  "args": {
    "path": "src/login.ts"
  }
}
```

---

# 9. 响应解析

---

```ts
private parseResponse(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error("AI response parse failed")
  }
}
```

---

# 10. Tool 执行流程

---

```ts
private async executeTool(parsed: any) {
  return await this.toolManager.execute(
    parsed.tool,
    parsed.args
  )
}
```

---

# 11. ToolManager 实现

---

```ts
export class ToolManager {
  private tools = new Map()

  constructor() {
    this.registerDefaultTools()
  }

  register(name: string, handler: Function) {
    this.tools.set(name, handler)
  }

  async execute(name: string, args: any) {
    const tool = this.tools.get(name)

    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }

    return await tool(args)
  }
}
```

---

# 12. 默认工具注册

---

```ts
private registerDefaultTools() {
  this.register("read_file", async ({ path }) => {
    return fs.readFileSync(path, "utf8")
  })

  this.register("write_file", async ({ path, content }) => {
    fs.writeFileSync(path, content)
    return "file written"
  })

  this.register("run_shell", async ({ command }) => {
    return execSync(command).toString()
  })
}
```

---

# 13. 状态更新逻辑

---

```ts
private async updateState(parsed: any, toolResult: any) {
  const state = await this.stateManager.load()

  state.history.push({
    time: Date.now(),
    thought: parsed.thought,
    tool: parsed.tool,
    args: parsed.args
  })

  state.lastResult = toolResult

  await this.stateManager.save(state)
}
```

---

# 14. Memory 管理

---

```ts
export class MemoryManager {
  async load() {
    return []
  }

  async append(record: any) {
    // 保存到 memory.json
  }
}
```

---

建议：

```text
.pi-mini/memory.json
```

---

# 15. 多轮 Agent Loop

---

实现真正 Agent：

```ts
async runLoop(input: string) {
  let nextInput = input

  for (let i = 0; i < 5; i++) {
    const result = await this.run(nextInput)

    if (result.done) {
      return result
    }

    nextInput = JSON.stringify(result)
  }
}
```

---

作用：

```text
AI → Tool → AI → Tool → 完成
```

---

# 16. 防止危险命令

---

安全限制：

```ts
private validateTool(name: string) {
  const blocked = ["rm", "sudo", "shutdown"]

  if (blocked.includes(name)) {
    throw new Error("dangerous tool")
  }
}
```

---

# 17. Agent 输出标准

---

统一返回：

```ts
{
  success: true,
  thought: "",
  action: "",
  result: ""
}
```

---

# 18. CLI 调用方式

---

CLI：

```ts
const runtime = new AgentRuntime()

const result = await runtime.run(
  "帮我补全登录功能"
)

console.log(result)
```

---

# 19. 运行时流程图

---

```text
User Input
   ↓
AgentRuntime.run()
   ↓
Load State
   ↓
Build Prompt
   ↓
LLM Decide
   ↓
Tool Execute
   ↓
Update Memory
   ↓
Return
```

---

# 20. 示例完整执行过程

---

用户：

```bash
pi-mini ask "分析项目缺失接口"
```

---

Agent：

```json
{
  "thought": "先扫描 src/api",
  "tool": "read_file",
  "args": {
    "path": "src/api"
  }
}
```

---

Tool 执行后：

```json
{
  "files": ["user.ts", "auth.ts"]
}
```

---

Agent 下一轮：

```json
{
  "thought": "缺少 payment.ts",
  "tool": "write_file",
  "args": {
    "path": "src/api/payment.ts",
    "content": "..."
  }
}
```

---

# 21. 推荐增强能力

---

后续可扩展：

---

## 代码理解

```ts
analyze_project()
```

---

## Git

```ts
git_commit()
```

---

## 测试

```ts
run_test()
```

---

## 部署

```ts
deploy_project()
```

---

# 22. 最终效果

---

你会得到：

```text
一个真正的软件开发 Agent Runtime
```

具备：

✅ 自主决策
✅ 工具调用
✅ 状态记忆
✅ 多轮执行
✅ 安全控制

---

# 23. 最小 MVP

---

第一版先实现：

```text
read_file
write_file
run_shell
```

即可跑通：

```text
状态 → AI → 工具 → 状态
```

---

# 24. 下一步建议

---

下一步建议继续细化：

```text
ToolManager.ts 详细实现
```

因为真正决定 Agent 能力的是：

```text
Tool Layer
```