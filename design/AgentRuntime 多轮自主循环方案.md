# 《AgentRuntime 多轮自主循环（Autonomous Loop）方案》

目标：

让 Agent 从：

```text id="g8k2mv"
执行一次就结束
```

升级成：

```text id="r4w1xp"
自己思考 → 调工具 → 再思考 → 直到完成
```

---

# 1. 为什么需要 Loop

普通模式：

```text id="v2n8sq"
用户 → AI → 工具 → 返回
```

只能做一步。

---

Agent 模式：

```text id="f6m3zd"
用户 → AI → 工具 → AI → 工具 → AI → 完成
```

---

比如：

用户说：

```text id="n1p9wx"
帮我补全支付模块
```

Agent 自动：

```text id="d3k7rt"
1. 查看项目
2. 找 payment.ts
3. 读取代码
4. 发现缺 webhook
5. 生成代码
6. 写入文件
7. 运行测试
8. 完成
```

---

# 2. Loop 的核心思想

每一轮都：

```text id="q5m8vy"
Think → Act → Observe
```

---

也叫：

```text id="x9r2nc"
ReAct Pattern
```

---

# 3. 流程图

---

```text id="p4s7jw"
用户请求
   ↓
构造 Prompt
   ↓
模型思考
   ↓
是否调用工具?
   ├─ 否 → 完成
   └─ 是
       ↓
执行工具
       ↓
追加观察结果
       ↓
继续下一轮
```

---

# 4. AgentRuntime 新结构

---

```ts id="y8v1mk"
export class AgentRuntime {
  async runLoop()
  private think()
  private act()
  private observe()
}
```

---

# 5. runLoop() 核心实现

---

```ts id="n2w7rq"
async runLoop(input: string) {
  const maxSteps = 8
  let step = 0
  let context = input

  while (step < maxSteps) {
    const response = await this.think(context)

    if (response.done) {
      return response
    }

    const observation = await this.act(response)

    context = this.observe(context, response, observation)

    step++
  }

  throw new Error("Agent exceeded max steps")
}
```

---

# 6. think() 实现

---

负责调用模型。

---

```ts id="z5m4kx"
private async think(context: string) {
  const state = await this.stateManager.load()
  const memory = await this.memoryManager.search(context)

  const prompt = this.promptBuilder.build({
    input: context,
    state,
    memory,
    tools: this.toolManager.getToolSchemas()
  })

  return await this.llm.chat({
    prompt,
    tools: this.toolManager.getToolSchemas()
  })
}
```

---

# 7. 模型输出格式

---

每轮模型返回：

```json id="a7r3tv"
{
  "thought": "需要查看 payment.ts",
  "tool": "read_file",
  "args": {
    "path": "src/payment.ts"
  },
  "done": false
}
```

---

完成时：

```json id="w1q9mu"
{
  "thought": "支付模块已完成",
  "done": true,
  "response": "已补全 webhook"
}
```

---

# 8. act() 执行动作

---

```ts id="s4m8qx"
private async act(response: any) {
  if (!response.tool) {
    return null
  }

  return await this.toolManager.execute(
    response.tool,
    response.args
  )
}
```

---

# 9. observe() 更新上下文

---

把工具结果加入下一轮。

---

```ts id="e9w2rp"
private observe(
  context: string,
  response: any,
  result: any
) {
  return `
原始任务:
${context}

上一步思考:
${response.thought}

执行结果:
${JSON.stringify(result)}
`
}
```

---

这样下一轮模型知道：

```text id="m3v8kn"
刚才做了什么
```

---

# 10. Memory 持续记录

---

每轮写入：

```ts id="u5r1px"
await this.memoryManager.append({
  id: crypto.randomUUID(),
  type: "short",
  content: response.thought,
  metadata: {
    tool: response.tool,
    result
  },
  createdAt: Date.now()
})
```

---

# 11. 防止无限循环

---

非常重要。

---

## 最大步数

```ts id="r8x4mq"
const maxSteps = 8
```

---

## 重复检测

```ts id="j2v7kp"
if (sameToolRepeated()) {
  break
}
```

---

---

# 12. 重复工具检测

---

```ts id="h6m1zw"
private isRepeating(history: any[]) {
  const recent = history.slice(-3)

  return recent.every(
    x => x.tool === recent[0].tool
  )
}
```

---

防止：

```text id="b9q3rv"
read_file → read_file → read_file
```

死循环。

---

# 13. 错误恢复机制

---

工具失败时：

```json id="v4n8px"
{
  "success": false,
  "error": "file not found"
}
```

下一轮模型可重新决策：

```text id="t7k2mz"
尝试读取其他文件
```

---

这样更智能。

---

# 14. 示例完整循环

---

用户：

```text id="x1m5vw"
帮我完善登录模块
```

---

第 1 轮：

```json id="q7v4nr"
{
  "thought": "先分析 auth.ts",
  "tool": "read_file"
}
```

---

第 2 轮：

```json id="f8w3kp"
{
  "thought": "发现缺 refreshToken",
  "tool": "write_file"
}
```

---

第 3 轮：

```json id="m2r9qx"
{
  "thought": "运行测试",
  "tool": "run_shell"
}
```

---

第 4 轮：

```json id="k6v1pn"
{
  "done": true,
  "response": "登录模块已补全"
}
```

---

# 15. 保存执行轨迹

---

建议保存：

```text id="c5m8wr"
.pi-mini/runs/
```

---

格式：

```json id="n9q2xp"
{
  "input": "补全登录模块",
  "steps": [
    {},
    {},
    {}
  ]
}
```

---

方便调试。

---

# 16. 可视化执行日志

---

终端输出：

```text id="z4m1qw"
[1] Thinking...
[2] Reading auth.ts
[3] Writing refresh token logic
[4] Running tests
[5] Done
```

---

用户体验会更像：

```text id="r1v9mk"
真实 Agent
```

---

# 17. 支持暂停恢复

---

保存当前 loop：

```json id="w6k2mp"
{
  "step": 3,
  "context": "...",
  "pendingTask": "payment module"
}
```

---

下次继续：

```bash id="p3v7qn"
pi-mini resume
```

---

# 18. 可中断设计

---

用户可停止：

```bash id="m8q4vx"
Ctrl + C
```

---

Agent 保存状态：

```ts id="t2m9rw"
process.on("SIGINT")
```

---

---

# 19. runLoop 完整版

---

```ts id="y7w3mp"
async runLoop(input: string) {
  let context = input

  for (let i = 0; i < 8; i++) {
    const decision = await this.think(context)

    if (decision.done) {
      return decision
    }

    const result = await this.act(decision)

    await this.saveStep(decision, result)

    context = this.observe(
      context,
      decision,
      result
    )
  }

  return {
    done: false,
    error: "max steps reached"
  }
}
```

---

# 20. 与 CLI 集成

---

```ts id="x5v8qp"
const result = await runtime.runLoop(
  "帮我补全支付模块"
)
```

---

# 21. 最终能力提升

---

从：

```text id="v9k2mw"
单轮问答工具
```

升级成：

```text id="n4r7xp"
持续工作的开发 Agent
```

---

Agent 会具备：

✅ 连续思考
✅ 自动修正
✅ 多步执行
✅ 自主完成任务

---

# 22. 最关键变化

---

你现在拥有：

---

## PromptBuilder

```text id="s8m1qw"
思考能力
```

---

## ToolManager

```text id="d3v9mk"
执行能力
```

---

## MemoryManager

```text id="k7q2xp"
记忆能力
```

---

## Loop

```text id="m5w8rn"
自主能力
```

---

于是变成真正：

```text id="r2v6mp"
AI Agent Runtime
```

---

# 23. 推荐下一步

---

下一步最值得继续的是：

# 《StateManager.ts 状态机实现方案》

因为你的：

```text id="w9m4qx"
Requirement → Design → Dev → Test → Deploy
```

还需要真正接入 Agent。

