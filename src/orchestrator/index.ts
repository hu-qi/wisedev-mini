import chalk from 'chalk';
import { StateManager } from './state';
import { ArtifactChecker } from './checker';
import { DeliveryState, DeliveryStage, ArtifactStatus } from './types';
import { Logger } from '../utils/logger';
import type { AgentPolicy } from '../agent/contracts/tool';

export class Orchestrator {
  public async init(): Promise<void> {
    Logger.info(chalk.blue('Initializing pi-mini project...'));
    const state = await StateManager.load();
    await StateManager.save(state);
    Logger.success('✅ Project initialized successfully.');
  }

  public async status(): Promise<void> {
    Logger.info(chalk.blue('Checking project status...'));

    const state = await StateManager.load();
    const checker = new ArtifactChecker();
    const artifacts = await checker.check();

    state.artifacts = artifacts;
    state.currentStage = this.inferStage(artifacts);

    await StateManager.save(state);

    if (Logger.isJson) {
      Logger.printJson({ state: state.currentStage, artifacts });
      return;
    }

    this.displayStatus(state);
  }

  public async run(opts?: { provider?: string; model?: string; maxTurns?: string; mode?: string; policy?: AgentPolicy }): Promise<void> {
    Logger.info(chalk.blue('Running pi-mini pipeline...'));

    // Check status first
    const state = await StateManager.load();
    const checker = new ArtifactChecker();
    const artifacts = await checker.check();
    const currentStage = this.inferStage(artifacts);

    Logger.info(chalk.cyan(`Current inferred stage: ${currentStage}`));

    // Load Agent Runtime for stages that need reasoning
    const { AgentRuntime } = await import('../agent/runtime/agent-runtime');
    const { createProvider } = await import('../agent/providers');
    const { loadConfig } = await import('../config/config-manager');
    const config = await loadConfig(process.cwd());
    const runtime = new AgentRuntime({
      workspaceRoot: process.cwd(),
      provider: createProvider(opts?.provider ?? config.llm.provider),
      model: opts?.model ?? config.llm.model,
      maxTurns: parseInt(opts?.maxTurns ?? String(config.llm.maxTurns), 10),
      policy: opts?.policy ?? {
        decisionFormat: 'json_only',
        maxToolCallsPerTurn: 1,
        workspaceJail: true,
        forbidNetwork: true,
        forbidGitPush: true,
        presetsDir: config.presetsDir
      }
    });
    await runtime.init();

    const isInteractive = opts?.mode === 'interactive';

    if (!artifacts.hasPrd) {
      Logger.info(chalk.yellow('\n--- Running Requirement Stage ---'));
      const { RequirementStage } = await import('../stages/requirement');
      const stage = new RequirementStage();
      await stage.execute();
      
      if (isInteractive) {
        Logger.info(chalk.blue('Agent is reviewing requirements...'));
        await runtime.ask('We just scaffolded requirement templates. Please review docs/requirement/01_prd.md and suggest if anything is missing based on standard project needs. DO NOT write code yet.', { silent: Logger.isJson || Logger.isQuiet });
      }
    }

    if (!artifacts.hasDesign) {
      Logger.info(chalk.yellow('\n--- Running Design Stage ---'));
      const { DesignStage } = await import('../stages/design');
      const stage = new DesignStage();
      await stage.execute();
      
      if (isInteractive) {
        Logger.info(chalk.blue('Agent is reviewing design...'));
        await runtime.ask('We just scaffolded design templates. Please review docs/design/06_solution_outline.md. Just acknowledge it.', { silent: Logger.isJson || Logger.isQuiet });
      }
    }

    if (!artifacts.hasPrototype) {
      Logger.info(chalk.yellow('\n--- Running Prototype Stage ---'));
      const { ensureProjectPrototypeDir, rebuildIndex, getDefaultProjectName } = await import('../prototype/prototype-manager');
      const projectName = getDefaultProjectName(process.cwd());
      const projectDir = await ensureProjectPrototypeDir(process.cwd(), projectName);
      
      if (isInteractive) {
        Logger.info(chalk.blue('Agent is designing the prototype based on PRD...'));
        await runtime.ask(`We just scaffolded the design templates. Please read docs/requirement/01_prd.md (if it exists) and docs/design/06_solution_outline.md, and then generate a high-fidelity web prototype for the main flow based on the PRD. Save the HTML file into ${projectDir}/ (e.g. main-flow.html). Use the robust ---WRITE_FILE:--- boundary protocol to write the file. Use routes and state to make it interactive.`, { silent: Logger.isJson || Logger.isQuiet });
        await rebuildIndex(projectDir, projectName);
      } else {
        Logger.info(chalk.blue('Generating default prototype...'));
        const targetPath = `${projectDir}/demo.html`;
        await runtime.ask(`Please generate a basic high-fidelity web prototype (single file HTML) based on the current project context and save it to ${targetPath}. Use the robust ---WRITE_FILE:--- boundary protocol to write the file. Use routes and state to make it interactive.`, { silent: Logger.isJson || Logger.isQuiet });
        await rebuildIndex(projectDir, projectName);
      }
    }

    if (!artifacts.hasSourceCode) {
      Logger.info(chalk.yellow('\n--- Running Development Stage ---'));
      const { DevelopmentStage } = await import('../stages/development');
      const stage = new DevelopmentStage();
      await stage.execute();
      
      if (isInteractive) {
        Logger.info(chalk.blue('Agent is implementing the frontend code...'));
        await runtime.ask('We just scaffolded the Vue/React project template. Please read docs/requirement/01_prd.md, docs/design/06_solution_outline.md, and the HTML prototypes in docs/prototypes/. Based on these, implement the actual frontend components and pages in the src/ directory. You can use tools like npm install to add necessary UI libraries like ant-design-vue or element-plus if needed.', { silent: Logger.isJson || Logger.isQuiet });
      }
    }

    if (!artifacts.hasTests) {
      Logger.info(chalk.yellow('\n--- Running Testing Stage ---'));
      const { TestingStage } = await import('../stages/testing');
      const stage = new TestingStage();
      await stage.execute();
    }

    // Always run deployment at the end to generate deployment docs / check scripts
    Logger.info(chalk.yellow('\n--- Running Deployment Stage ---'));
    const { DeploymentStage } = await import('../stages/deployment');
    const stage = new DeploymentStage();
    await stage.execute();

    Logger.success('\n✅ Pipeline execution completed.');
    await this.status(); // Show final status
  }

  private inferStage(artifacts: ArtifactStatus): DeliveryStage {
    if (!artifacts.hasPrd) return 'init';
    if (!artifacts.hasDesign) return 'design';
    if (!artifacts.hasPrototype) return 'prototype';
    if (!artifacts.hasSourceCode) return 'development';
    if (!artifacts.hasTests) return 'testing';
    return 'deployment';
  }

  private recommendNextAction(stage: DeliveryStage): string {
    switch (stage) {
      case 'init':
        return 'Create a Product Requirements Document at docs/requirement/01_prd.md';
      case 'design':
        return 'Create a Design Document at docs/design/06_solution_outline.md';
      case 'prototype':
        return 'Generate high-fidelity web prototypes based on the PRD and Design';
      case 'development':
        return 'Start implementing features in the src/ directory';
      case 'testing':
        return 'Add unit tests in a tests/ directory or alongside source files';
      case 'deployment':
        return 'Prepare for deployment or publish the package';
      case 'done':
        return 'Project delivery complete!';
      default:
        return 'Unknown stage, please review the project state.';
    }
  }

  private displayStatus(state: DeliveryState): void {
    console.log(chalk.green('\n--- Delivery State ---'));
    console.log(`Stage: ${chalk.bold.cyan(state.currentStage.toUpperCase())}`);
    
    console.log('\nArtifacts:');
    console.log(`  PRD:         ${this.formatBoolean(state.artifacts.hasPrd)}`);
    console.log(`  Design:      ${this.formatBoolean(state.artifacts.hasDesign)}`);
    console.log(`  Prototype:   ${this.formatBoolean(state.artifacts.hasPrototype)}`);
    console.log(`  Source Code: ${this.formatBoolean(state.artifacts.hasSourceCode)}`);
    console.log(`  Tests:       ${this.formatBoolean(state.artifacts.hasTests)}`);

    const recommendation = this.recommendNextAction(state.currentStage);
    console.log(chalk.yellow(`\n💡 Next Action: ${recommendation}\n`));
  }

  private formatBoolean(val: boolean): string {
    return val ? chalk.green('✅ Found') : chalk.red('❌ Missing');
  }
}
