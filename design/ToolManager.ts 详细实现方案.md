# 《ToolManager.ts 详细实现方案》

适用于你的：

```text id="vxvbxe"
pi-mini AgentRuntime
```

目标：

```text id="3kbh9o"
让 Agent 真正拥有“可执行能力”
```

---

# 1. ToolManager 的职责

---

ToolManager 负责：

```text id="pvzcnx"
1. 注册工具
2. 描述工具
3. 权限控制
4. 参数校验
5. 调用执行
6. 返回统一结果
```

---

# 2. 文件位置

---

```text id="6qkmzq"
src/agent/ToolManager.ts
```

---

# 3. 工具系统架构

---

```text id="sgm8ik"
AgentRuntime
    ↓
ToolManager
    ↓
具体工具
 ├── FileTools
 ├── ShellTools
 ├── GitTools
 ├── ProjectTools
 └── SkillTools
```

---

# 4. 类型定义

---

## Tool 接口

```ts id="omvshn"
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (args: any) => Promise<any>
}
```

---

## Tool 返回值

```ts id="v1j32y"
export interface ToolResult {
  success: boolean
  tool: string
  output: any
  error?: string
}
```

---

# 5. ToolManager 主体代码

---

```ts id="mlcvb7"
export class ToolManager {
  private tools = new Map<string, ToolDefinition>()

  constructor() {
    this.registerBuiltInTools()
  }

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
  }

  getTool(name: string) {
    return this.tools.get(name)
  }

  listTools() {
    return Array.from(this.tools.values())
  }

  async execute(name: string, args: any): Promise<ToolResult> {
    const tool = this.getTool(name)

    if (!tool) {
      return {
        success: false,
        tool: name,
        output: null,
        error: "Tool not found"
      }
    }

    try {
      const result = await tool.execute(args)

      return {
        success: true,
        tool: name,
        output: result
      }
    } catch (error: any) {
      return {
        success: false,
        tool: name,
        output: null,
        error: error.message
      }
    }
  }
}
```

---

# 6. 内置工具注册

---

```ts id="7k70gq"
private registerBuiltInTools() {
  this.registerReadFile()
  this.registerWriteFile()
  this.registerRunShell()
  this.registerAnalyzeProject()
}
```

---

# 7. 文件工具实现

---

# 7.1 read_file

```ts id="8oqdkl"
private registerReadFile() {
  this.register({
    name: "read_file",
    description: "读取文件内容",
    parameters: {
      path: "string"
    },
    execute: async ({ path }) => {
      return fs.readFileSync(path, "utf8")
    }
  })
}
```

---

# 7.2 write_file

```ts id="wujzqn"
private registerWriteFile() {
  this.register({
    name: "write_file",
    description: "写入文件内容",
    parameters: {
      path: "string",
      content: "string"
    },
    execute: async ({ path, content }) => {
      fs.writeFileSync(path, content)
      return "write success"
    }
  })
}
```

---

# 7.3 append_file

```ts id="kk3x5m"
private registerAppendFile() {
  this.register({
    name: "append_file",
    description: "追加文件内容",
    parameters: {
      path: "string",
      content: "string"
    },
    execute: async ({ path, content }) => {
      fs.appendFileSync(path, content)
      return "append success"
    }
  })
}
```

---

# 8. Shell 工具实现

---

```ts id="0y6mvy"
private registerRunShell() {
  this.register({
    name: "run_shell",
    description: "执行 shell 命令",
    parameters: {
      command: "string"
    },
    execute: async ({ command }) => {
      this.validateCommand(command)

      return execSync(command, {
        encoding: "utf8"
      })
    }
  })
}
```

---

# 9. 安全校验

---

非常关键。

---

```ts id="7g4s49"
private validateCommand(command: string) {
  const blocked = [
    "rm -rf",
    "shutdown",
    "reboot",
    "mkfs",
    "sudo"
  ]

  for (const item of blocked) {
    if (command.includes(item)) {
      throw new Error(`危险命令已拦截: ${item}`)
    }
  }
}
```

---

# 10. 项目分析工具

---

```ts id="ehm9j9"
private registerAnalyzeProject() {
  this.register({
    name: "analyze_project",
    description: "分析项目结构",
    parameters: {},
    execute: async () => {
      const files = glob.sync("src/**/*")
      return {
        fileCount: files.length,
        files
      }
    }
  })
}
```

---

# 11. Git 工具

---

## git_status

```ts id="0znn4v"
private registerGitStatus() {
  this.register({
    name: "git_status",
    description: "查看 git 状态",
    parameters: {},
    execute: async () => {
      return execSync("git status --short", {
        encoding: "utf8"
      })
    }
  })
}
```

---

## git_commit

```ts id="4vz7te"
private registerGitCommit() {
  this.register({
    name: "git_commit",
    description: "提交 git",
    parameters: {
      message: "string"
    },
    execute: async ({ message }) => {
      execSync("git add .")
      execSync(`git commit -m "${message}"`)
      return "commit success"
    }
  })
}
```

---

# 12. 提供给 LLM 的工具描述

---

Agent 需要看到：

```ts id="hsvm9p"
getToolSchemas() {
  return this.listTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }))
}
```

---

这样发送给模型：

```json id="v8dd8q"
[
  {
    "name": "read_file",
    "description": "读取文件",
    "parameters": {
      "path": "string"
    }
  }
]
```

---

# 13. 动态 Skill 注册

---

未来支持：

```bash id="o2tsf8"
pi-mini install-skill
```

---

```ts id="v2l5f7"
registerSkill(skill: ToolDefinition) {
  this.register(skill)
}
```

---

# 14. Skill 示例

---

```ts id="kx1c0s"
toolManager.register({
  name: "generate_case",
  description: "生成华为案例",
  parameters: {
    topic: "string"
  },
  execute: async ({ topic }) => {
    return generateHuaweiCase(topic)
  }
})
```

---

# 15. 参数校验

---

防止模型传错参数：

```ts id="ql9vbv"
private validateArgs(tool: ToolDefinition, args: any) {
  for (const key of Object.keys(tool.parameters)) {
    if (!(key in args)) {
      throw new Error(`缺少参数: ${key}`)
    }
  }
}
```

在 execute 中：

```ts id="0f5t4m"
this.validateArgs(tool, args)
```

---

# 16. 日志记录

---

每次调用记录：

```ts id="84h8sx"
private logToolCall(name: string, args: any) {
  console.log("[Tool]", name, args)
}
```

---

可保存：

```text id="86n0ol"
.pi-mini/logs/
```

---

# 17. 执行流程

---

```text id="5yfq3j"
AI 输出
   ↓
ToolManager.execute()
   ↓
权限校验
   ↓
参数校验
   ↓
执行工具
   ↓
返回结果
```

---

# 18. 返回统一格式

---

```json id="4tw4li"
{
  "success": true,
  "tool": "read_file",
  "output": "..."
}
```

---

失败：

```json id="89hv1j"
{
  "success": false,
  "tool": "run_shell",
  "error": "危险命令已拦截"
}
```

---

# 19. AgentRuntime 中调用方式

---

```ts id="plmrc4"
const result = await this.toolManager.execute(
  parsed.tool,
  parsed.args
)
```

---

# 20. 推荐首批工具

---

建议先实现：

| 工具              | 优先级   |
| --------------- | ----- |
| read_file       | ★★★★★ |
| write_file      | ★★★★★ |
| analyze_project | ★★★★  |
| run_shell       | ★★★★  |
| git_status      | ★★★   |
| git_commit      | ★★★   |

---

# 21. 未来扩展工具

---

后续可加：

```text id="ol0gmu"
search_code
run_test
deploy_project
read_url
install_package
```

---

# 22. 最终效果

---

有了 ToolManager 后：

AI 可以：

```text id="l5txkg"
看文件
改文件
执行命令
提交代码
生成文档
```

---

你的系统从：

```text id="8imw8f"
聊天机器人
```

升级为：

```text id="hmprk8"
可执行型 AI Agent
```

---

# 23. 下一步建议

---

下一步最关键的是：

# 《PromptBuilder.ts 详细实现方案》

因为：

```text id="5r6z4s"
Prompt 决定 Agent 是否聪明
```