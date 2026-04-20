# pi-mini Agent（P0/P1/P2）走查与演示

本文用于团队走查 `pi-mini` 的 Agent 子系统：统一决策协议、运行闭环、状态/记忆、工具安全边界、插件（Skill）与多模型适配。

## 1. 一句话定位
- `pi-mini` 的 Agent 能力不是“让模型自由发挥”，而是将模型约束为“基于统一 JSON 协议做决策”，由 Runtime 负责执行工具与产物落盘，从而实现可控、可回放、可审计的自动化交付链路。

## 2. 目录结构（Agent 子系统）
- contracts（统一协议）：[contracts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/contracts)
- runtime（多轮执行与恢复）：[runtime](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/runtime)
- prompt（强约束提示词拼装）：[prompt](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/prompt)
- providers（模型适配层）：[providers](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/providers)
- tools（工具与安全边界）：[tools](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/tools)
- state / memory（持久化）：[state](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/state) / [memory](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/memory)
- skills（插件系统）：[skills](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/skills)

运行时落盘目录：
- `.pi-mini/agent/state.json`
- `.pi-mini/agent/memory/short.jsonl` / `.pi-mini/agent/memory/long.jsonl`
- `.pi-mini/agent/runs/<runId>.jsonl`
- `.pi-mini/agent/skills/<skillName>/skill.json`

## 3. 统一协议（Contract）
### 3.1 Agent 决策协议（唯一上层协议）
- [agent-decision.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/contracts/agent-decision.ts)
- 模型每轮必须输出且仅输出 JSON（三选一）：
  - tool：`{"kind":"tool","tool":{"name":"...","args":{}},"done":false}`
  - final：`{"kind":"final","response":"...","done":true}`
  - error：`{"kind":"error","message":"...","done":true}`

### 3.2 Tool 协议（schema + 执行结果）
- [tool.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/contracts/tool.ts)
- ToolManager 通过 schema 让 PromptBuilder“可解释工具”，并在执行前做参数校验与安全策略约束。

### 3.3 Provider 协议（多模型统一为文本）
- [llm.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/contracts/llm.ts)
- Provider 必须最终输出 `content: string`，由 Runtime 解析为 `AgentDecision`。

## 4. 运行闭环（P0）
- 主循环：[run-loop.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/runtime/run-loop.ts)
- 决策解析：[decision-parser.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/runtime/decision-parser.ts)
- 运行入口：[agent-runtime.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/runtime/agent-runtime.ts)

每轮基本步骤：
1) 读取 state + memory
2) PromptBuilder 拼装（system + history + user）
3) 调用 Provider 得到 `content`
4) parse 为 `AgentDecision`
5) ToolManager 执行工具并得到 `ToolResult`
6) 将关键事件写入 Trace（jsonl）

## 5. 中断恢复（P1）
- Trace 写入：[trace-writer.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/runtime/trace-writer.ts)
- Trace 读取：[trace-reader.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/runtime/trace-reader.ts)
- `pi-mini agent resume` 会读取 `.pi-mini/agent/runs/<runId>.jsonl`，重建 history 后继续跑。

## 6. 记忆（P2）
- MemoryManager：[memory-manager.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/memory/memory-manager.ts)
- 支持：
  - short/long 快照注入 Prompt
  - long 关键词检索（为后续向量检索预留接口）
  - short 自动压缩归档到 long（避免上下文无限膨胀）

## 7. 工具与安全策略（P0/P2）
内置工具：
- 读文件：[read-file.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/tools/builtins/read-file.ts)
- 写文件：[write-file.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/tools/builtins/write-file.ts)
- 执行命令（allowlist + policy）：[run-shell.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/tools/builtins/run-shell.ts)

默认策略（在 CLI 中设置）：
- `workspaceJail: true`：读写路径必须在工作区根目录内
- `forbidNetwork: true`：禁止 curl/wget/ssh 等网络命令
- `forbidGitPush: true`：禁止 `git push`

## 8. Skill 插件系统（P2）
- 清单类型：[skill.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/contracts/skill.ts)
- SkillManager：[skill-manager.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/skills/skill-manager.ts)

插件当前最小能力：
- 提供 `skill.json`（name/version/description）
- 可选注入：
  - `prompts.systemAppend`：追加到 system 指令
  - `prompts.userAppend`：追加到 user 输入

## 9. 多模型适配（P2）
- OpenAI：[openai-provider.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/providers/openai-provider.ts)
- Ollama（本地）：[ollama-provider.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/providers/ollama-provider.ts)
- Mock：[mock-provider.ts](file:///Users/huqi/Develop/aigc/vibe-coding/atomcode/pi-mini/src/agent/providers/mock-provider.ts)

## 10. 演示命令（建议用一个空目录演示）
```bash
mkdir demo-agent && cd demo-agent

# 初始化 Agent 工作区
pi-mini agent init

# 以 mock 模式跑通（不会真正推理，但能验证链路）
pi-mini agent ask "输出当前目录有哪些文件" --provider mock --max-turns 2

# 安装一个本地 skill（目录内要有 skill.json）
pi-mini agent skill install /path/to/skill-dir
pi-mini agent skill list

# 使用 Ollama（需先启动 ollama 服务）
pi-mini agent ask "读取 package.json 并总结 scripts" --provider ollama --model deepseek-coder:6.7b

# 发生中断后恢复
pi-mini agent resume

# 清空记忆
pi-mini agent memory clear
```

