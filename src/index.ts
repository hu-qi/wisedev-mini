import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import { Orchestrator } from './orchestrator';
import { RequirementStage } from './stages/requirement';
import { DesignStage } from './stages/design';
import { DevelopmentStage } from './stages/development';
import { TestingStage } from './stages/testing';
import { DeploymentStage } from './stages/deployment';

export function main() {
  const program = new Command();

  program
    .name('pi-mini')
    .description('A mini CLI tool')
    .version('1.0.0');

  program
    .command('init')
    .description('Initialize pi-mini project and state')
    .action(async () => {
      const orchestrator = new Orchestrator();
      await orchestrator.init();
    });

  program
    .command('status')
    .description('Check the current project state and next recommended actions')
    .action(async () => {
      const orchestrator = new Orchestrator();
      await orchestrator.status();
    });

  program
    .command('run')
    .description('Run the pi-mini pipeline, integrating all missing stages sequentially')
    .action(async () => {
      const orchestrator = new Orchestrator();
      await orchestrator.run();
    });

  program
    .command('requirement')
    .alias('req')
    .description('Scaffold requirement templates into docs/requirement/')
    .action(async () => {
      const stage = new RequirementStage();
      await stage.execute();
    });

  program
    .command('design')
    .alias('des')
    .description('Scaffold design templates into docs/design/')
    .action(async () => {
      const stage = new DesignStage();
      await stage.execute();
    });

  program
    .command('development')
    .alias('dev')
    .description('Scaffold Vue 3 + Vite + Mock template into root')
    .action(async () => {
      const stage = new DevelopmentStage();
      await stage.execute();
    });

  program
    .command('deployment')
    .alias('deploy')
    .description('Check scripts and generate deployment docs')
    .action(async () => {
      const stage = new DeploymentStage();
      await stage.execute();
    });

  program
    .command('testing')
    .alias('test')
    .description('Scaffold a minimal tests/ directory for stage completion')
    .action(async () => {
      const stage = new TestingStage();
      await stage.execute();
    });

  program.action(() => {
    console.log(chalk.green('Hello from pi-mini CLI!'));
    console.log(chalk.blue('TypeScript + Node.js CLI is set up successfully.\n'));
    console.log('Run `pi-mini --help` to see available commands.');
  });

  program.parse(process.argv);
}
