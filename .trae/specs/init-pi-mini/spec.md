# pi-mini Execution Framework Spec

## Why
当前软件研发中，AI 参与开发时经常出现需求不清晰、输出不稳定、交付链路断裂等问题。为了解决这些痛点，需要实现 `pi-mini` —— 一套面向软件交付的最小执行框架，将“需求 → 设计 → 开发 → 部署”四个阶段标准化，并约束 AI 稳定输出 Vue 前端 + mock 原型。

## What Changes
- 初始化 Node.js TypeScript CLI 工程，作为 `pi-mini` 框架的总控程序。
- 实现 `Orchestrator` (总控模块)，负责维护 `DeliveryState`，判断当前阶段、检查缺失产物并决定下一步动作。
- 实现四大阶段模块的执行逻辑与提示词/模板封装：
  - **Requirement (需求阶段)**：输出 `01_prd.md`, `02_work_items.json`, `03_acceptance.md`。
  - **Design (设计阶段)**：输出 `06_solution_outline.md`, `07_detailed_design.md`, `openapi.yaml`, `05_data_model.md`, `08_prototype_design.md`。
  - **Development (开发阶段)**：基于模板初始化 Vue 3 + TypeScript 工程，生成页面切片和 mock 代码，输出开发报告。
  - **Deployment (部署阶段)**：校验 `dev` / `build` / `preview` 脚本，输出 `.env.mock` 和 `09_deploy_guide.md`。
- 构建核心模板体系，包括 `AGENTS.md` 及各阶段的 Markdown/YAML 输出模板。

## Impact
- Affected specs: `pi-mini` 基础能力的从 0 到 1 构建。
- Affected code: 整个 CLI 工程文件，包括 `src/orchestrator`, `src/stages/*`, `templates/*` 等。

## ADDED Requirements
### Requirement: Orchestrator 状态流转
系统 SHALL 提供 `DeliveryState` 维护和阶段流转控制。
#### Scenario: 阶段识别与流转
- **WHEN** 用户运行 `pi-mini run` 时
- **THEN** 系统检查本地 `docs/` 和 `src/` 目录的产物，判断当前阶段（Requirement/Design/Development/Deployment），并提示下一步动作。

### Requirement: 阶段产物生成 (Requirement & Design)
系统 SHALL 能够调用 AI (或提供模板供 AI 代理调用) 结构化输入并输出 Markdown/JSON 规范文档。
#### Scenario: 需求阶段产出
- **WHEN** 执行需求阶段任务
- **THEN** 在 `docs/` 目录下生成标准的 `01_prd.md`, `02_work_items.json` 等文件。

### Requirement: Vue 原型骨架初始化 (Development)
系统 SHALL 能够自动生成基础的 Vue 3 + TS 工程结构。
#### Scenario: 开发阶段工程初始化
- **WHEN** 进入开发阶段且缺少前端工程时
- **THEN** 自动创建 `package.json`, `vite.config.ts`, `src/views`, `src/mocks` 等基础结构。