# 《StateManager.ts 项目阶段状态机实现方案》

目标：

让 pi-mini 不只是会“执行”，还会真正知道：

```text id="u4v9mk"
项目现在进行到哪一步
下一步该做什么
```

---

# 1. 为什么需要状态机

如果没有状态机：

Agent 可能会乱跳：

```text id="p8q2xr"
直接部署
→ 还没写代码
→ 没测试
→ 项目崩掉
```

---

有状态机后：

```text id="m6w1qp"
Requirement
→ Design
→ Development
→ Testing
→ Deployment
```

---

Agent 就能：

```text id="r9v5mn"
按软件生命周期推进
```

---

# 2. 文件位置

---

```text id="x2k8qp"
src/state/StateManager.ts
```

---

# 3. 状态定义

---

建议定义阶段枚举：

```ts id="w5m3qr"
export enum ProjectStage {
  INIT = "init",
  REQUIREMENT = "requirement",
  DESIGN = "design",
  DEVELOPMENT = "development",
  TESTING = "testing",
  DEPLOYMENT = "deployment",
  DONE = "done"
}
```

---

# 4. 状态文件结构

---

```text id="n7v1mk"
.pi-mini/state.json
```

---

内容：

```json id="q4w8xp"
{
  "projectName": "crm-system",
  "stage": "development",
  "currentTask": "login module",
  "completedTasks": [],
  "artifacts": [],
  "history": []
}
```

---

# 5. 类型定义

---

```ts id="y8q3mr"
export interface ProjectState {
  projectName: string
  stage: ProjectStage
  currentTask?: string
  completedTasks: string[]
  artifacts: string[]
  history: StateHistory[]
}
```

---

---

```ts id="k6v9px"
export interface StateHistory {
  time: number
  from: ProjectStage
  to: ProjectStage
  reason: string
}
```

---

# 6. StateManager 基础类

---

```ts id="r1m7qw"
export class StateManager {
  private filePath = ".pi-mini/state.json"

  async load()
  async save()
  async transition()
  async updateTask()
}
```

---

# 7. load()

---

```ts id="v3q8mk"
async load(): Promise<ProjectState> {
  if (!fs.existsSync(this.filePath)) {
    return this.createDefault()
  }

  return JSON.parse(
    fs.readFileSync(this.filePath, "utf8")
  )
}
```

---

# 8. 默认状态

---

```ts id="m9w2xp"
private createDefault(): ProjectState {
  return {
    projectName: "",
    stage: ProjectStage.INIT,
    completedTasks: [],
    artifacts: [],
    history: []
  }
}
```

---

# 9. save()

---

```ts id="t5v1mq"
async save(state: ProjectState) {
  fs.writeFileSync(
    this.filePath,
    JSON.stringify(state, null, 2)
  )
}
```

---

# 10. 阶段流转规则

---

定义合法流转：

```ts id="p7w4xr"
const stageFlow = {
  init: ["requirement"],
  requirement: ["design"],
  design: ["development"],
  development: ["testing"],
  testing: ["deployment"],
  deployment: ["done"]
}
```

---

防止跳跃：

```text id="q1m8vk"
development → deployment
```

直接跳过测试。

---

# 11. transition()

---

```ts id="x6v3mp"
async transition(
  next: ProjectStage,
  reason: string
) {
  const state = await this.load()

  const allowed =
    stageFlow[state.stage] || []

  if (!allowed.includes(next)) {
    throw new Error(
      `非法状态转换 ${state.stage} -> ${next}`
    )
  }

  state.history.push({
    time: Date.now(),
    from: state.stage,
    to: next,
    reason
  })

  state.stage = next

  await this.save(state)
}
```

---

# 12. 更新当前任务

---

```ts id="n2q9mw"
async updateTask(task: string) {
  const state = await this.load()

  state.currentTask = task

  await this.save(state)
}
```

---

# 13. 完成任务

---

```ts id="k5w7xp"
async completeTask(task: string) {
  const state = await this.load()

  state.completedTasks.push(task)

  if (state.currentTask === task) {
    state.currentTask = ""
  }

  await this.save(state)
}
```

---

# 14. 产物管理

---

保存生成内容：

```ts id="r8v2mq"
async addArtifact(path: string) {
  const state = await this.load()

  state.artifacts.push(path)

  await this.save(state)
}
```

---

例如：

```text id="u3m6wk"
docs/design.md
src/auth.ts
test/payment.spec.ts
```

---

# 15. Agent 自动判断下一阶段

---

根据状态：

```ts id="y7q4xp"
getNextStage(stage: ProjectStage) {
  const order = [
    "init",
    "requirement",
    "design",
    "development",
    "testing",
    "deployment",
    "done"
  ]

  const index = order.indexOf(stage)

  return order[index + 1]
}
```

---

Agent 可自动推进：

```text id="m4v9kr"
development 完成
→ testing
```

---

# 16. 与 PromptBuilder 集成

---

Prompt 中注入：

```text id="q8m2wx"
当前阶段:
development

当前任务:
login module
```

---

模型就知道：

```text id="v1r7mp"
该写代码，不该部署
```

---

# 17. 自动阶段判断

---

可让模型返回：

```json id="p3w6mq"
{
  "nextStage": "testing"
}
```

---

然后：

```ts id="n5v8xp"
await stateManager.transition(
  response.nextStage,
  response.thought
)
```

---

# 18. 状态历史

---

记录：

```json id="r2m9wk"
[
  {
    "from": "design",
    "to": "development",
    "reason": "设计文档已完成"
  }
]
```

---

这样可以：

```text id="x7q1mv"
追踪整个项目
```

---

# 19. CLI 查看状态

---

```bash id="w4v6xp"
pi-mini status
```

---

输出：

```text id="m8q3wr"
Project: crm-system
Stage: development
Task: login module
Completed: 4
Artifacts: 12
```

---

# 20. 自动恢复项目

---

下次打开：

```bash id="u9m2qx"
pi-mini resume
```

读取：

```json id="k1v7mp"
stage=development
task=payment module
```

继续工作。

---

# 21. 状态变化流程

---

```text id="n6w4xr"
创建项目
↓
需求分析
↓
架构设计
↓
代码开发
↓
自动测试
↓
部署上线
```

---

# 22. 与 Loop 结合

---

每轮执行后：

```ts id="p5m8wk"
if (taskDone) {
  await stateManager.transition(
    nextStage,
    "任务完成"
  )
}
```

---

实现：

```text id="x3v9mq"
Agent 自动推动项目阶段
```

---

# 23. 防止状态错乱

---

增加校验：

```ts id="r7q2xp"
validateState(state)
```

---

例如：

```text id="u1m5wr"
Testing 前必须有测试文件
```

---

# 24. 最终 StateManager 结构

---

```ts id="m9v4qk"
StateManager
 ├── load()
 ├── save()
 ├── transition()
 ├── updateTask()
 ├── completeTask()
 ├── addArtifact()
 └── getNextStage()
```

---

# 25. 最终能力

---

StateManager 让系统从：

```text id="q2w8mx"
单纯调用工具
```

升级为：

```text id="v5r1pk"
理解软件生命周期
```

---

Agent 将具备：

✅ 知道当前阶段
✅ 知道下一阶段
✅ 自动推进
✅ 可恢复工作

---

# 26. 完整调用链

---

```text id="w8m3vq"
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
StateManager
 ↓
Autonomous Loop
```

---

# 27. 你已经拥有的核心能力

---

现在你的系统已经具备：

---

## Agent Brain

```text id="x4q9mr"
PromptBuilder
```

---

## Agent Hands

```text id="r1v6wp"
ToolManager
```

---

## Agent Memory

```text id="m7q2xk"
MemoryManager
```

---

## Agent Workflow

```text id="u3w8mq"
StateManager
```

---

## Agent Autonomy

```text id="p9v4xr"
Loop
```

---

所以已经接近：

```text id="n5m1wk"
完整 AI Agent Runtime
```

---

# 28. 下一步最关键

---

下一步建议继续做：

# 《Skill 插件系统设计》

让你的系统支持：

```bash id="v2q8mx"
pi-mini install-skill xxx
```

像：

```text id="w6r3mp"
华为案例生成
代码审查
自动测试
部署插件
```

动态扩展。
