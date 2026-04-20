# 《Skill 插件系统设计方案》

目标：

让你的 Agent 从：

```text id="a8m2vq"
写死工具
```

升级成：

```text id="q4w9mr"
动态安装能力
```

---

# 1. 为什么需要 Skill

当前 ToolManager 是：

```text id="r6v1xp"
固定工具集合
```

比如：

```text id="m3q8wk"
read_file
write_file
run_shell
```

问题：

每增加新能力都要改源码。

---

而 Skill 方案可以做到：

```bash id="x7m4qp"
pi-mini install-skill huawei-case-writer
```

然后系统立即获得：

```text id="u1w5mr"
生成华为案例
```

---

# 2. Skill 本质

Skill 是：

```text id="p9v2xk"
可热插拔能力包
```

包括：

```text id="w5q8mp"
Prompt
Tools
Memory
Templates
Config
```

---

# 3. Skill 目录结构

---

建议：

```text id="n4m7wq"
skills/
 └── huawei-case-writer/
      ├── skill.json
      ├── prompt.md
      ├── tools/
      ├── templates/
      └── memory/
```

---

# 4. skill.json 结构

---

核心配置：

```json id="v8q3mr"
{
  "name": "huawei-case-writer",
  "version": "1.0.0",
  "description": "生成华为云案例",
  "entry": "tools/index.js",
  "prompts": ["prompt.md"],
  "enabled": true
}
```

---

# 5. SkillManager 职责

---

新建：

```text id="m2w9xk"
src/agent/SkillManager.ts
```

---

负责：

```text id="r5q1mp"
1. 扫描插件
2. 加载插件
3. 注册工具
4. 注入 Prompt
5. 生命周期管理
```

---

# 6. Skill 类型定义

---

```ts id="x3v7mq"
export interface SkillManifest {
  name: string
  version: string
  description: string
  entry: string
  prompts?: string[]
  enabled?: boolean
}
```

---

# 7. SkillManager 主体

---

```ts id="p6m2wk"
export class SkillManager {
  private skills = []

  async loadSkills()
  async installSkill()
  getPromptFragments()
}
```

---

# 8. 自动扫描技能

---

```ts id="u9q4mr"
async loadSkills() {
  const skillDirs = fs.readdirSync("./skills")

  for (const dir of skillDirs) {
    await this.loadSkill(dir)
  }
}
```

---

# 9. 加载单个 Skill

---

```ts id="w1m8xp"
async loadSkill(dir: string) {
  const manifestPath =
    `./skills/${dir}/skill.json`

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8")
  )

  if (!manifest.enabled) return

  this.skills.push(manifest)
}
```

---

# 10. 注册 Skill 工具

---

每个 Skill 可注册自己的 Tool。

---

```ts id="m4q7wk"
const module = require(entryPath)

module.register(toolManager)
```

---

Skill 内：

```ts id="r8v1mp"
export function register(toolManager) {
  toolManager.register({
    name: "generate_huawei_case",
    description: "生成华为案例",
    parameters: {
      topic: "string"
    },
    execute: async ({ topic }) => {
      return buildCase(topic)
    }
  })
}
```

---

# 11. Prompt 注入

---

每个 Skill 可附加 Prompt。

---

```ts id="q5w2xr"
getPromptFragments() {
  return this.skills.flatMap(skill => {
    return skill.prompts.map(file =>
      fs.readFileSync(file, "utf8")
    )
  })
}
```

---

然后 PromptBuilder：

```ts id="v7m3qp"
skillPrompts.join("\n")
```

---

让模型自动理解：

```text id="k1q9mw"
这个插件能干什么
```

---

# 12. Skill Prompt 示例

---

`prompt.md`

```md id="p3v8xr"
当用户要求生成华为案例时：
1. 读取模板
2. 生成案例标题
3. 输出 markdown
```

---

---

# 13. 安装插件命令

---

CLI：

```bash id="n6m4wq"
pi-mini install-skill ./plugins/huawei-case
```

---

实现：

```ts id="u2q7mp"
async installSkill(path: string) {
  fs.cpSync(
    path,
    `./skills/${basename(path)}`,
    { recursive: true }
  )
}
```

---

# 14. 启用禁用插件

---

```bash id="r9w1mk"
pi-mini skill disable huawei-case-writer
```

---

修改：

```json id="m5q8xp"
"enabled": false
```

---

# 15. Skill 生命周期

---

插件支持：

```text id="x8m3vq"
onLoad()
onUnload()
onTaskStart()
onTaskEnd()
```

---

例如：

```ts id="p4w7mr"
export function onLoad() {
  console.log("skill loaded")
}
```

---

# 16. Skill 记忆独立

---

每个 Skill 有自己的：

```text id="q2v9mk"
memory/
```

---

例如：

```text id="r7m1xp"
skills/
 └── huawei-case/
      └── memory/
```

---

这样每个插件：

```text id="u4q6wr"
记住自己的上下文
```

---

# 17. Skill 专属模板

---

例如：

```text id="m9w2xq"
templates/
 ├── huawei_case.md
 └── summary.md
```

---

调用：

```ts id="k3v8mp"
loadTemplate("huawei_case")
```

---

# 18. Skill 权限控制

---

防止危险插件。

---

```json id="v6q4mr"
{
  "permissions": [
    "read_file",
    "write_file"
  ]
}
```

---

运行前校验：

```ts id="w8m1xp"
validatePermissions(skill)
```

---

# 19. ToolManager 集成

---

ToolManager 启动时：

```ts id="p7q3wk"
await skillManager.loadSkills()

skillManager.registerTools(toolManager)
```

---

---

# 20. PromptBuilder 集成

---

Prompt 自动增加：

```ts id="n1v9mq"
const skillPrompts =
  skillManager.getPromptFragments()
```

---

让 Agent 自动学会：

```text id="r5w2xp"
插件能力
```

---

# 21. 示例调用

---

用户：

```text id="m4q8wr"
帮我生成华为案例
```

---

Agent：

```text id="u7m1xp"
发现匹配 skill
→ 调用 generate_huawei_case
→ 输出文档
```

---

# 22. 支持远程插件仓库

---

未来可做：

```bash id="x2q6mk"
pi-mini install-skill github:user/repo
```

---

从 GitHub 下载。

---

```ts id="q8m3wr"
downloadSkill(repoUrl)
```

---

# 23. 最终目录结构

---

```text id="p5v7mq"
src/
 ├── agent/
 │    ├── SkillManager.ts
 │    └── ToolManager.ts
 └── skills/
      └── huawei-case-writer/
```

---

# 24. 最终能力提升

---

从：

```text id="m1q9wk"
固定 Agent
```

升级成：

```text id="r4v8xp"
可扩展平台
```

---

支持：

✅ 动态安装
✅ 动态加载
✅ 热插拔
✅ 插件隔离
✅ Prompt 扩展

---

# 25. 最终调用链

---

```text id="u8m2xr"
User
 ↓
PromptBuilder
 ↓
Skill Prompt
 ↓
LLM
 ↓
Skill Tool
 ↓
Memory
 ↓
State
```

---

# 26. 你的系统将升级成

---

真正像：

```text id="q3w7mp"
Claude Skill
OpenHands Plugin
VSCode Extension
```

风格的：

```text id="v9m4xq"
AI Agent 平台
```

---

# 27. 推荐下一步

---

接下来最值得做的是：

# 《CLI 命令体系设计》

让用户可以：

```bash id="m6q1wk"
pi-mini ask
pi-mini resume
pi-mini install-skill
pi-mini memory
```

形成完整产品。
