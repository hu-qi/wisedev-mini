# 《CLI 命令体系设计方案》

目标：

让用户可以像这样使用你的 Agent：

```bash id="c7m2xp"
pi-mini ask "帮我补全登录模块"
pi-mini status
pi-mini resume
pi-mini install-skill ./xxx
```

形成完整：

```text id="v4q8mr"
AI Agent CLI 产品
```

---

# 1. CLI 的定位

CLI 是整个系统入口。

负责：

```text id="m1w7xq"
接收命令
解析参数
调用 Runtime
输出结果
```

---

# 2. 技术选型

推荐：

* Commander.js（轻量）
  或
* oclif（大型）

建议你先用：

```text id="p8v3mk"
Commander.js
```

更适合你的项目。

---

# 3. 文件结构

---

```text id="r5q9xp"
src/
 └── cli/
      ├── index.ts
      ├── commands/
      │    ├── ask.ts
      │    ├── status.ts
      │    ├── resume.ts
      │    ├── skill.ts
      │    └── memory.ts
```

---

# 4. CLI 总入口

---

```ts id="x2m6wr"
#!/usr/bin/env node

import { Command } from "commander"

const program = new Command()

program
  .name("pi-mini")
  .version("1.0.0")

program.parse()
```

---

# 5. ask 命令

---

用户：

```bash id="q7v1mp"
pi-mini ask "帮我生成支付模块"
```

---

实现：

```ts id="m4q8xr"
program
  .command("ask <input>")
  .description("执行 AI Agent")
  .action(async (input) => {
    const runtime = new AgentRuntime()
    const result = await runtime.runLoop(input)

    console.log(result.response)
  })
```

---

# 6. status 命令

---

```bash id="w3m9qk"
pi-mini status
```

---

实现：

```ts id="r8v2mx"
program
  .command("status")
  .description("查看项目状态")
  .action(async () => {
    const state = await stateManager.load()

    console.log(state)
  })
```

---

输出：

```text id="u5q7wr"
Project: crm
Stage: development
Task: login
```

---

# 7. resume 命令

---

继续任务：

```bash id="k9m1xp"
pi-mini resume
```

---

实现：

```ts id="p4w6mq"
program
  .command("resume")
  .description("恢复上次任务")
  .action(async () => {
    const state = await stateManager.load()

    const runtime = new AgentRuntime()

    await runtime.runLoop(
      `继续任务: ${state.currentTask}`
    )
  })
```

---

# 8. skill 命令

---

## 安装插件

```bash id="x6q2mr"
pi-mini skill install ./huawei-case
```

---

实现：

```ts id="m7v4xp"
program
  .command("skill install <path>")
  .action(async (path) => {
    await skillManager.installSkill(path)
    console.log("skill installed")
  })
```

---

# 9. 查看技能

---

```bash id="q1m8wk"
pi-mini skill list
```

---

实现：

```ts id="v3q9mr"
program
  .command("skill list")
  .action(() => {
    console.table(skillManager.list())
  })
```

---

输出：

```text id="r2v5xq"
huawei-case-writer
code-review
test-runner
```

---

# 10. 启用禁用技能

---

```bash id="m8q3xp"
pi-mini skill disable huawei-case
```

---

```ts id="p5v7wr"
program
  .command("skill disable <name>")
```

---

# 11. memory 命令

---

查看记忆：

```bash id="u4m9qk"
pi-mini memory
```

---

实现：

```ts id="w7q1mr"
program
  .command("memory")
  .action(async () => {
    const mem = await memoryManager.load("long")
    console.log(mem)
  })
```

---

# 12. 清除记忆

---

```bash id="k3v8xp"
pi-mini memory clear
```

---

```ts id="r9m2wq"
program
  .command("memory clear")
```

---

# 13. init 命令

---

初始化项目：

```bash id="m2q6xr"
pi-mini init
```

---

作用：

```text id="v8w1mk"
创建 .pi-mini/
```

---

实现：

```ts id="q4m7xp"
program
  .command("init")
  .action(async () => {
    await stateManager.save(defaultState)
  })
```

---

# 14. doctor 命令

---

检查环境：

```bash id="x9q3mr"
pi-mini doctor
```

---

检查：

```text id="p1v5wk"
API Key
Node
Git
技能
目录
```

---

# 15. config 命令

---

查看配置：

```bash id="u6m8xq"
pi-mini config
```

---

修改：

```bash id="r5q2mp"
pi-mini config set model openai
```

---

# 16. 日志命令

---

```bash id="m1v9wr"
pi-mini logs
```

---

查看：

```text id="q7m4xp"
最近 Agent 执行记录
```

---

# 17. 推荐命令清单

---

| 命令     | 作用   |
| ------ | ---- |
| ask    | 执行任务 |
| status | 查看状态 |
| resume | 恢复任务 |
| init   | 初始化  |
| memory | 管理记忆 |
| skill  | 管理插件 |
| config | 修改配置 |
| logs   | 查看日志 |

---

# 18. 彩色输出（推荐）

---

可用：

* chalk
* ora

---

例如：

```ts id="v4q6mk"
console.log(chalk.green("✔ done"))
```

---

加载动画：

```ts id="m9w3xr"
const spinner = ora("Thinking...").start()
```

---

效果：

```text id="r8m1qp"
更像真实产品
```

---

# 19. 交互模式

---

支持：

```bash id="p3q7mv"
pi-mini chat
```

---

进入：

```text id="w2m8xq"
> 请输入需求:
```

---

类似：

```text id="u5v1wr"
Claude Code
```

风格。

---

# 20. chat 模式

---

```ts id="k7q4mp"
program
  .command("chat")
  .action(async () => {
    while(true) {
      const input = await prompt()
      await runtime.runLoop(input)
    }
  })
```

---

# 21. CLI 生命周期

---

```text id="x1m9qr"
CLI
 ↓
解析命令
 ↓
调用模块
 ↓
输出结果
```

---

# 22. 命令执行链

---

```text id="m6v3xp"
pi-mini ask
 ↓
AgentRuntime
 ↓
PromptBuilder
 ↓
LLM
 ↓
Tools
 ↓
State
 ↓
Output
```

---

# 23. 用户体验示例

---

用户：

```bash id="q8m2wk"
pi-mini ask "完善支付模块"
```

终端：

```text id="v5q7mr"
[1] 分析项目...
[2] 读取 payment.ts...
[3] 生成 webhook...
[4] 运行测试...
✔ 支付模块已完成
```

---

# 24. package.json 配置

---

```json id="r3m8xp"
{
  "bin": {
    "pi-mini": "./dist/cli/index.js"
  }
}
```

---

安装后：

```bash id="m4q1wr"
npm link
```

---

全局使用：

```bash id="u7m9xq"
pi-mini
```

---

# 25. 最终目录结构

---

```text id="k2v6mp"
src/
 ├── cli/
 ├── agent/
 ├── state/
 ├── memory/
 └── skills/
```

---

# 26. 最终能力

---

CLI 让系统从：

```text id="w9m4qr"
开发框架
```

升级成：

```text id="x5q8mk"
真正可用工具
```

---

用户可以：

✅ 一句话调用
✅ 查看进度
✅ 恢复任务
✅ 安装能力

---

# 27. 最终产品形态

---

你最终会得到类似：

```text id="r1v7xp"
Claude Code
Aider
OpenHands CLI
```

风格的：

```text id="m8q2wr"
本地 AI 开发助手
```

---

# 28. 最建议的下一步

---

下一步最值得继续的是：

# 《项目落地开发顺序（MVP）》

因为现在模块已经完整，
需要告诉你：

```text id="p6m3xq"
先写什么
后写什么
最快跑通
```