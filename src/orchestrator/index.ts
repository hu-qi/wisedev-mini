import chalk from 'chalk';
import { StateManager } from './state';
import { ArtifactChecker } from './checker';
import { DeliveryState, DeliveryStage, ArtifactStatus } from './types';

export class Orchestrator {
  public async init(): Promise<void> {
    console.log(chalk.blue('Initializing pi-mini project...'));
    const state = await StateManager.load();
    await StateManager.save(state);
    console.log(chalk.green('✅ Project initialized successfully.'));
  }

  public async status(): Promise<void> {
    console.log(chalk.blue('Checking project status...'));

    const state = await StateManager.load();
    const checker = new ArtifactChecker();
    const artifacts = await checker.check();

    state.artifacts = artifacts;
    state.currentStage = this.inferStage(artifacts);

    await StateManager.save(state);

    this.displayStatus(state);
  }

  public async run(): Promise<void> {
    console.log(chalk.blue('Running pi-mini pipeline...'));

    // Check status first
    const state = await StateManager.load();
    const checker = new ArtifactChecker();
    const artifacts = await checker.check();
    const currentStage = this.inferStage(artifacts);

    console.log(chalk.cyan(`Current inferred stage: ${currentStage}`));

    // Depending on what is needed, we could run all missing stages or just run them sequentially.
    // For a comprehensive run, let's execute stages that are missing their artifacts.
    if (!artifacts.hasPrd) {
      console.log(chalk.yellow('\n--- Running Requirement Stage ---'));
      const { RequirementStage } = await import('../stages/requirement');
      const stage = new RequirementStage();
      await stage.execute();
    }

    if (!artifacts.hasDesign) {
      console.log(chalk.yellow('\n--- Running Design Stage ---'));
      const { DesignStage } = await import('../stages/design');
      const stage = new DesignStage();
      await stage.execute();
    }

    if (!artifacts.hasSourceCode) {
      console.log(chalk.yellow('\n--- Running Development Stage ---'));
      const { DevelopmentStage } = await import('../stages/development');
      const stage = new DevelopmentStage();
      await stage.execute();
    }

    if (!artifacts.hasTests) {
      console.log(chalk.yellow('\n--- Running Testing Stage ---'));
      const { TestingStage } = await import('../stages/testing');
      const stage = new TestingStage();
      await stage.execute();
    }

    // Always run deployment at the end to generate deployment docs / check scripts
    console.log(chalk.yellow('\n--- Running Deployment Stage ---'));
    const { DeploymentStage } = await import('../stages/deployment');
    const stage = new DeploymentStage();
    await stage.execute();

    console.log(chalk.green('\n✅ Pipeline execution completed.'));
    await this.status(); // Show final status
  }

  private inferStage(artifacts: ArtifactStatus): DeliveryStage {
    if (!artifacts.hasPrd) return 'init';
    if (!artifacts.hasDesign) return 'design';
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
    console.log(`  Source Code: ${this.formatBoolean(state.artifacts.hasSourceCode)}`);
    console.log(`  Tests:       ${this.formatBoolean(state.artifacts.hasTests)}`);

    const recommendation = this.recommendNextAction(state.currentStage);
    console.log(chalk.yellow(`\n💡 Next Action: ${recommendation}\n`));
  }

  private formatBoolean(val: boolean): string {
    return val ? chalk.green('✅ Found') : chalk.red('❌ Missing');
  }
}
