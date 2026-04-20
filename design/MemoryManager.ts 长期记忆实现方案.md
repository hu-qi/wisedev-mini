
# 《MemoryManager.ts 长期记忆实现方案》

目标是让你的 Agent 从：

```text id="7f0t5p"
每次都重新认识项目
```

升级成：

```text id="8j6s4n"
持续理解同一个项目
```

---

# 1. 为什么需要 Memory

没有记忆时：

```text id="2g4r0m"
用户: 帮我继续完善支付模块
Agent: 支付模块是什么？
```

有记忆后：

```text id="4q1n9z"
Agent 知道：
- 上次改过 payment.ts
- 使用 Stripe
- 已完成退款接口
- 待补 webhook
```

---

# 2. 记忆分层设计

建议分 3 层：

---

## 短期记忆（会话）

```text id="p4r5wb"
当前对话上下文
```

保存最近几轮：

```json id="3v0a2x"
[
  {
    "role": "user",
    "content": "帮我补全登录"
  }
]
```

---

## 中期记忆（任务）

```text id="m1z3hy"
当前任务相关
```

比如：

```json id="6u7r8k"
{
  "task": "login module",
  "files": ["auth.ts"],
  "status": "in_progress"
}
```

---

## 长期记忆（项目）

```text id="1c9e2f"
项目知识库
```

保存：

```text id="5y8d0s"
架构
技术栈
编码风格
已知问题
```

---

# 3. 文件结构设计

---

建议目录：

```text id="3o9v8j"
.pi-mini/
 ├── state.json
 ├── memory/
 │    ├── short.json
 │    ├── task.json
 │    └── long.json
```

---

# 4. MemoryManager 职责

---

```text id="6x7p1w"
1. 读取记忆
2. 保存记忆
3. 压缩记忆
4. 检索相关记忆
5. 清理过期记忆
```

---

# 5. 类型定义

---

```ts id="2u6s4z"
export interface MemoryRecord {
  id: string
  type: "short" | "task" | "long"
  content: string
  metadata?: Record<string, any>
  createdAt: number
}
```

---

# 6. MemoryManager 基础类

---

```ts id="9h3m8k"
export class MemoryManager {
  private basePath = ".pi-mini/memory"

  async load(type: string) {}
  async save(type: string, data: any) {}
  async append(record: MemoryRecord) {}
  async search(query: string) {}
}
```

---

# 7. 初始化目录

---

```ts id="8n0r6q"
constructor() {
  if (!fs.existsSync(this.basePath)) {
    fs.mkdirSync(this.basePath, { recursive: true })
  }
}
```

---

# 8. 读取记忆

---

```ts id="0l2w7p"
async load(type: string) {
  const file = `${this.basePath}/${type}.json`

  if (!fs.existsSync(file)) {
    return []
  }

  return JSON.parse(fs.readFileSync(file, "utf8"))
}
```

---

# 9. 保存记忆

---

```ts id="5m1x9d"
async save(type: string, data: any) {
  const file = `${this.basePath}/${type}.json`

  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  )
}
```

---

# 10. 追加记忆

---

```ts id="1q8c4t"
async append(record: MemoryRecord) {
  const list = await this.load(record.type)

  list.push(record)

  await this.save(record.type, list)
}
```

---

# 11. 保存会话记忆

---

每轮对话：

```ts id="4r5t1m"
await memory.append({
  id: crypto.randomUUID(),
  type: "short",
  content: "用户要求补全登录模块",
  createdAt: Date.now()
})
```

---

# 12. 长期记忆内容

---

推荐长期保存：

---

## 技术栈

```json id="9f0g2p"
{
  "stack": ["Vue", "Node", "Postgres"]
}
```

---

## 架构风格

```json id="6k1z7w"
{
  "architecture": "MVC"
}
```

---

## 编码习惯

```json id="0v8x3n"
{
  "style": "typescript strict mode"
}
```

---

## 已知问题

```json id="7m2p4s"
{
  "knownIssues": ["token refresh bug"]
}
```

---

# 13. search() 检索记忆

---

简单版关键词搜索：

```ts id="2w9n5j"
async search(query: string) {
  const longMemory = await this.load("long")

  return longMemory.filter((item: any) =>
    item.content.includes(query)
  )
}
```

---

例如：

```ts id="1x6j8v"
await memory.search("payment")
```

返回：

```text id="9y3p2h"
payment.ts 使用 Stripe
```

---

# 14. 供 PromptBuilder 使用

---

Agent 构建 Prompt 时：

```ts id="7b1r6m"
const relevantMemory =
  await memory.search(input)
```

注入：

```text id="8u4w9d"
相关历史:
支付模块使用 Stripe
```

---

# 15. 自动压缩记忆

---

避免无限增长。

---

```ts id="3n8m5x"
async compact() {
  const short = await this.load("short")

  if (short.length > 20) {
    const summary = short.slice(-20)
      .map(x => x.content)
      .join("\n")

    await this.append({
      id: crypto.randomUUID(),
      type: "long",
      content: summary,
      createdAt: Date.now()
    })

    await this.save("short", short.slice(-5))
  }
}
```

---

# 16. 记忆提炼策略

---

把多轮对话总结为：

```text id="1m8x0r"
支付模块:
- 已接 Stripe
- 已支持退款
- 缺 webhook
```

---

让模型更高效。

---

# 17. 任务记忆管理

---

当前任务：

```ts id="4x7w1v"
async saveTaskMemory(task: any) {
  await this.save("task", task)
}
```

---

例如：

```json id="0q5e2t"
{
  "task": "payment module",
  "progress": 60,
  "nextStep": "generate webhook"
}
```

---

# 18. 删除记忆

---

```ts id="6t9z3k"
async clear(type: string) {
  await this.save(type, [])
}
```

---

支持：

```bash id="9v2c8y"
pi-mini memory clear
```

---

# 19. MemoryManager 完整结构

---

```ts id="2m5r7p"
export class MemoryManager {
  load()
  save()
  append()
  search()
  compact()
  clear()
}
```

---

# 20. 与 AgentRuntime 集成

---

```ts id="5u8x1n"
const memory =
  await this.memoryManager.search(input)
```

执行后保存：

```ts id="7p4v0m"
await this.memoryManager.append({
  id: crypto.randomUUID(),
  type: "short",
  content: parsed.thought,
  createdAt: Date.now()
})
```

---

# 21. 典型流程

---

```text id="6y0w4q"
用户提问
↓
搜索相关记忆
↓
注入 Prompt
↓
AI 决策
↓
保存新记忆
↓
压缩归档
```

---

# 22. 示例长期记忆

---

```json id="1r9t3m"
[
  {
    "id": "1",
    "type": "long",
    "content": "认证模块使用 JWT",
    "createdAt": 1711111111111
  },
  {
    "id": "2",
    "type": "long",
    "content": "数据库使用 PostgreSQL",
    "createdAt": 1711111112222
  }
]
```

---

# 23. 后续升级（向量记忆）

---

未来可升级成：

```text id="4w6q8s"
Embedding Memory
```

实现：

```text id="3j9m0x"
语义搜索
```

例如：

```text id="5x1k7v"
“支付”
≈
“订单结算”
```

---

可接：

* OpenAI embeddings
* Pinecone
* Qdrant

---

# 24. 最终效果

---

MemoryManager 会让你的 Agent：

---

从：

```text id="8z2v4m"
每次重新理解项目
```

升级为：

```text id="7s5x1n"
持续跟踪整个项目生命周期
```

---

Agent 将具备：

✅ 记住项目结构
✅ 记住历史修改
✅ 记住编码习惯
✅ 记住未完成任务

---

# 25. 推荐下一步

---

接下来最关键的是：

# 《LLMProvider.ts 多模型适配方案》

因为你后面可能接：

```text id="0n3w7q"
OpenAI
Claude
DeepSeek
本地模型
```
