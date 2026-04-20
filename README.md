# pi-mini

`pi-mini` 是一个基于 TypeScript 和 Node.js 开发的轻量级 CLI 工具与 AI Agent 框架。它旨在自动化项目的交付流，从需求分析、架构设计、开发到部署，全方位管理并执行项目的各个阶段。无论是作为开发者的辅助脚手架，还是作为 AI Agent 的编排核心，`pi-mini` 都能提供稳定可靠的流程管理机制。

## 主要特性 (Features)

- **流程编排与状态管理**：自动推断项目当前所处的阶段（需求、设计、开发、测试、部署），并推荐下一步操作。
- **自动化执行阶段任务**：一键生成各阶段的模板或项目代码，填补缺失的产物（Artifacts）。
- **灵活的 CLI 命令**：支持全局调度（如 `run`、`status`）和独立阶段调度（如 `requirement`、`design` 等）。
- **AI Agent 框架支持**：通过 `.pi-mini/state.json` 维护结构化状态，使 AI 能够无缝接入并基于当前上下文自动推进项目。

## 安装 (Installation)

1. 克隆项目或在当前项目下使用：
   ```bash
   git clone <repository-url>
   cd pi-mini
   npm install
   ```

2. 构建项目：
   ```bash
   npm run build
   ```

3. 全局链接以便在任意目录使用 `pi-mini` 命令：
   ```bash
   npm link
   ```

*(如果发布到 npm，可通过 `npm install -g pi-mini` 安装)*

## 作为 CLI 工具使用 (CLI Usage)

`pi-mini` 提供了丰富的命令来管理整个软件交付生命周期。

### 全局工作流命令

- **初始化项目**：
  ```bash
  pi-mini init
  ```
  初始化 `pi-mini` 的工作区和状态文件（创建 `.pi-mini/state.json`）。

- **查看当前状态**：
  ```bash
  pi-mini status
  ```
  检查当前目录下的交付产物（如 PRD 文档、设计文档、源码、测试用例），并显示推断的项目阶段以及下一步的建议操作。

- **一键运行交付流水线**：
  ```bash
  pi-mini run
  ```
  根据 `status` 命令的检查结果，自动并按顺序执行尚未完成的阶段。例如，如果缺失需求文档和设计文档，它将依次运行 `Requirement Stage` 和 `Design Stage`。

### 独立阶段命令

如果你希望单独运行某一个阶段的任务，可以使用以下命令：

- **需求阶段**：生成产品需求文档（PRD）等模板。
  ```bash
  pi-mini requirement
  # 或者使用简写
  pi-mini req
  ```

- **设计阶段**：生成架构设计、数据模型设计等模板。
  ```bash
  pi-mini design
  # 或者使用简写
  pi-mini des
  ```

- **开发阶段**：自动脚手架生成基础代码（如 Vue 3 + Vite 模板）。
  ```bash
  pi-mini development
  # 或者使用简写
  pi-mini dev
  ```

- **部署阶段**：生成部署文档并检查必要的脚本。
  ```bash
  pi-mini deployment
  # 或者使用简写
  pi-mini deploy
  ```

## 作为 AI Agent 框架使用 (Agent Framework Usage)

`pi-mini` 的设计理念同样适用于 AI 辅助编程系统（如 Trae 等 Agent 工具）。

1. **状态驱动的执行 (State-driven Execution)**：
   AI Agent 可以在每轮交互前调用 `pi-mini status`，通过标准输出解析当前的交付物状态，从而明确接下来应该协助人类完成什么工作（例如：发现缺失测试代码，AI 可以主动开始编写测试）。

2. **结构化的上下文 (.pi-mini/state.json)**：
   该框架将当前工作流的最新状态持久化到 JSON 文件中，这使得多个 Agent 之间或多次会话之间的上下文能够保持连贯。

3. **阶段式代码生成**：
   在明确了 PRD 或 Design 后，Agent 可通过调用内部类（如 `Orchestrator` 或各 Stage 模块）直接介入流水线，批量生成或审查项目代码。

## 开发与调试 (Development)

在本地开发 `pi-mini` 本身：

```bash
# 实时编译 TypeScript
npm run build -- --watch

# 运行 CLI 进行测试
npm start -- status
```

## 许可证 (License)

ISC
