# Tasks
- [x] Task 1: Initialize Node.js CLI Project: 初始化 TypeScript 工程，配置 ESLint/Prettier, Commander 等基础库。
  - [x] SubTask 1.1: 创建 `package.json` 并安装依赖 (commander, chalk, fs-extra, etc.)
  - [x] SubTask 1.2: 配置 `tsconfig.json` 和构建脚本
  - [x] SubTask 1.3: 编写 CLI 入口文件 `src/index.ts`
- [x] Task 2: Implement DeliveryState & Orchestrator: 实现总控模块，负责状态管理和目录扫描。
  - [x] SubTask 2.1: 定义 `DeliveryState` 接口与状态存储逻辑 (例如保存在 `.pi-mini/state.json`)
  - [x] SubTask 2.2: 实现产物检查逻辑 (检查 `docs/` 和 `src/` 下的关键文件)
  - [x] SubTask 2.3: 实现阶段推断与下一步动作建议逻辑
- [x] Task 3: Implement Requirement Stage: 实现需求阶段逻辑与模板。
  - [x] SubTask 3.1: 准备需求阶段的模板文件 (`01_prd.md`, `02_work_items.json`, `03_acceptance.md`)
  - [x] SubTask 3.2: 编写 Requirement 模块，负责引导或直接生成需求阶段产物
- [x] Task 4: Implement Design Stage: 实现设计阶段逻辑与模板。
  - [x] SubTask 4.1: 准备设计阶段的模板文件 (概要设计、详细设计、API契约等)
  - [x] SubTask 4.2: 编写 Design 模块执行逻辑
- [x] Task 5: Implement Development & Deployment Stages: 实现 Vue 工程脚手架和部署检查逻辑。
  - [x] SubTask 5.1: 创建 Vue 3 + TS + Mock 的基础工程模板
  - [x] SubTask 5.2: 编写 Development 模块，负责拷贝模板、生成结构和报告
  - [x] SubTask 5.3: 编写 Deployment 模块，负责环境校验和生成 `09_deploy_guide.md`
- [x] Task 6: Add CLI Commands & Testing: 集成所有模块，提供完整的命令行交互。
  - [x] SubTask 6.1: 注册 `pi-mini init`, `pi-mini status`, `pi-mini run` 命令
  - [x] SubTask 6.2: 编写 README.md，说明如何作为 CLI 工具或 AI Agent 框架使用

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]