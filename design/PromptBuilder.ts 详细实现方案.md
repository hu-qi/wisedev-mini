
# 《PromptBuilder.ts 详细实现方案》

它决定你的 Agent 是：

```text id="l8v0pz"
普通调用模型
```

还是：

```text id="hy7vij"
真正会思考的 AI Agent
```

---

# 1. PromptBuilder 的职责

---

PromptBuilder 负责把：

```text id="p2r6it"
项目状态
用户需求
历史记忆
工具列表
系统规则
```

整理成模型能理解的 Prompt。

---

## 目标

让模型知道：

```text id="tmchsk"
你是谁
你能做什么
现在要做什么
如何做
```

---

# 2. 文件位置

---

```text id="u6u4i0"
src/agent/PromptBuilder.ts
```

---

# 3. 核心结构

---

```ts id="xjvzti"
export class PromptBuilder {
  build(context)
  buildSystemPrompt()
  buildUserPrompt()
  buildToolPrompt()
}
```

---

# 4. 输入数据结构

---

```ts id="1e2z0w"
export interface PromptContext {
  input: string
  state: any
  memory: any[]
  tools: any[]
}
```

---

# 5. 最终 Prompt 结构

---

模型收到：

```text id="4p8tr0"
System Prompt
+
Tool Prompt
+
Project Context
+
User Request
```

---

形成：

```text id="3q8n53"
你是一个软件开发 Agent
↓
这是项目状态
↓
这些工具可用
↓
这是用户请求
↓
请返回 JSON
```

---

# 6. build() 主方法

---

```ts id="r6muvz"
build(context: PromptContext) {
  return [
    this.buildSystemPrompt(),
    this.buildToolPrompt(context.tools),
    this.buildProjectPrompt(context.state),
    this.buildMemoryPrompt(context.memory),
    this.buildUserPrompt(context.input)
  ].join("\n\n")
}
```

---

# 7. System Prompt

---

这是最关键部分。

---

```ts id="4o4yif"
buildSystemPrompt() {
  return `
你是一个专业的软件交付 AI Agent。

你的职责：
1. 理解用户需求
2. 分析项目结构
3. 选择合适工具
4. 修改代码
5. 更新项目状态

必须：
- 优先最小修改
- 保持代码风格一致
- 避免危险操作
- 返回 JSON
`
}
```

---

# 8. 工具提示

---

告诉模型有哪些能力。

---

```ts id="0gg5gl"
buildToolPrompt(tools: any[]) {
  return `
可用工具：

${tools.map(tool => `
工具: ${tool.name}
说明: ${tool.description}
参数: ${JSON.stringify(tool.parameters)}
`).join("\n")}
`
}
```

---

生成类似：

```text id="n4hm6x"
工具: read_file
说明: 读取文件
参数: {"path":"string"}
```

---

# 9. 项目状态提示

---

让模型知道当前环境。

---

```ts id="8g7h10"
buildProjectPrompt(state: any) {
  return `
当前项目状态：

${JSON.stringify(state, null, 2)}
`
}
```

---

示例：

```json id="1c4bzr"
{
  "stage": "development",
  "current_task": "login module",
  "files": ["src/auth.ts"]
}
```

---

# 10. Memory 提示

---

保留上下文。

---

```ts id="kp1r41"
buildMemoryPrompt(memory: any[]) {
  if (!memory.length) return ""

  return `
历史上下文：

${memory.slice(-5).map(item =>
  `- ${item.role}: ${item.content}`
).join("\n")}
`
}
```

---

作用：

```text id="y5vj0j"
让 Agent 记住上一步
```

---

# 11. 用户请求提示

---

```ts id="qowv4n"
buildUserPrompt(input: string) {
  return `
用户请求：
${input}

请分析后返回：
{
  "thought": "...",
  "tool": "...",
  "args": {},
  "done": false
}
`
}
```

---

# 12. 强制 JSON 输出

---

非常重要。

---

建议加入：

```ts id="x2rrrw"
你必须仅返回合法 JSON。
不要返回 markdown。
不要返回解释。
```

---

加入 system prompt：

```ts id="f6frhx"
返回格式：
{
  "thought": "你的思考",
  "tool": "工具名",
  "args": {},
  "done": false
}
```

---

# 13. 示例最终 Prompt

---

生成后的 Prompt：

```text id="n53b8r"
你是一个软件开发 AI Agent

可用工具:
read_file
write_file
run_shell

当前状态:
{
  "stage":"development"
}

用户请求:
帮我分析登录模块

请仅返回 JSON
```

---

# 14. 模型返回示例

---

```json id="9ycxks"
{
  "thought": "需要先查看 auth.ts",
  "tool": "read_file",
  "args": {
    "path": "src/auth.ts"
  },
  "done": false
}
```

---

# 15. 任务完成格式

---

如果无需工具：

```json id="mx7x96"
{
  "thought": "登录模块已完成",
  "tool": null,
  "args": {},
  "done": true,
  "response": "登录模块已补全"
}
```

---

# 16. 不同模式 Prompt

---

你可以设计不同模式。

---

## 代码模式

```ts id="pw24tq"
mode = "coding"
```

Prompt：

```text id="x8gxqb"
重点关注代码修改
```

---

## 文档模式

```ts id="c6v6r4"
mode = "document"
```

Prompt：

```text id="bjx2cu"
重点生成技术文档
```

---

# 17. buildByMode()

---

```ts id="5r0ncu"
build(context, mode = "coding") {
  switch(mode) {
    case "document":
      return this.buildDocumentPrompt(context)
    default:
      return this.buildCodingPrompt(context)
  }
}
```

---

# 18. 防止幻觉

---

加入约束：

```ts id="mj4x0q"
禁止：
- 猜测不存在文件
- 调用不存在工具
- 修改无关模块
```

---

加入：

```text id="t5pk5d"
如果信息不足，请先读取文件，不要猜测
```

---

# 19. Token 优化

---

避免上下文过长。

---

## 只保留最近记忆

```ts id="brl4ml"
memory.slice(-3)
```

---

## 只传当前文件

```ts id="0vr9cw"
state.currentFiles
```

---

## 压缩状态

```ts id="7jq7nd"
只保留核心字段
```

---

# 20. PromptBuilder 完整代码

---

```ts id="7uwr4f"
export class PromptBuilder {
  build(context: PromptContext) {
    return `
${this.buildSystemPrompt()}

${this.buildToolPrompt(context.tools)}

${this.buildProjectPrompt(context.state)}

${this.buildMemoryPrompt(context.memory)}

${this.buildUserPrompt(context.input)}
`
  }
}
```

---

# 21. 与 AgentRuntime 集成

---

```ts id="kr5m4w"
const prompt = this.promptBuilder.build({
  input,
  state,
  memory,
  tools: this.toolManager.getToolSchemas()
})
```

---

# 22. 最终效果

---

PromptBuilder 帮你实现：

```text id="tvzfrg"
让模型真正理解“项目”
```

而不是单纯：

```text id="b7wl4y"
聊天
```

---

# 23. Agent 智能提升来源

---

决定效果的核心：

| 模块            | 影响   |
| ------------- | ---- |
| ToolManager   | 手脚   |
| PromptBuilder | 大脑   |
| Memory        | 长期记忆 |

---

所以：

```text id="npzjtn"
PromptBuilder 决定 Agent 是否聪明
```

---

# 24. 下一步建议

---

接下来最重要的是：

# 《MemoryManager.ts 详细实现方案》

因为真正 AI Agent 需要：

```text id="97ynlc"
记住项目
```

否则每次都是：

```text id="sdmiyv"
重新开始
```
=
