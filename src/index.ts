import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import { Orchestrator } from './orchestrator';
import { RequirementStage } from './stages/requirement';
import { DesignStage } from './stages/design';
import { DevelopmentStage } from './stages/development';
import { TestingStage } from './stages/testing';
import { DeploymentStage } from './stages/deployment';
import { createProvider } from './agent/providers';
import { AgentRuntime } from './agent/runtime/agent-runtime';
import type { AgentPolicy } from './agent/contracts/tool';

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

  const agent = program.command('agent').description('AI Agent capabilities (P0)');

  agent
    .command('init')
    .description('Initialize agent workspace (.pi-mini/agent)')
    .option('--provider <provider>', 'openai|mock')
    .option('--model <model>', 'model name', 'gpt-4o-mini')
    .action(async (opts: { provider?: string; model: string }) => {
      const policy: AgentPolicy = {
        decisionFormat: 'json_only',
        maxToolCallsPerTurn: 1,
        workspaceJail: true,
        forbidNetwork: true,
        forbidGitPush: true
      };
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(opts.provider),
        model: opts.model,
        maxTurns: 8,
        policy
      });
      await runtime.init();
      console.log(chalk.green('✅ Agent workspace initialized at .pi-mini/agent'));
    });

  agent
    .command('status')
    .description('Show agent state and last runs')
    .action(async () => {
      const policy: AgentPolicy = {
        decisionFormat: 'json_only',
        maxToolCallsPerTurn: 1,
        workspaceJail: true,
        forbidNetwork: true,
        forbidGitPush: true
      };
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider('mock'),
        model: 'gpt-4o-mini',
        maxTurns: 1,
        policy
      });
      const info = await runtime.status();
      const statePath = info.statePath;
      const state = (await fs.pathExists(statePath)) ? await fs.readJson(statePath) : null;
      console.log(chalk.blue('--- Agent State ---'));
      console.log(`BaseDir: ${info.baseDir}`);
      console.log(`State:   ${statePath}`);
      if (state?.runs?.length) {
        const last = state.runs[state.runs.length - 1];
        console.log(`LastRun: ${last.runId} (${last.status})`);
      } else {
        console.log('LastRun: (none)');
      }
    });

  agent
    .command('ask <input>')
    .description('Run agent loop for a task')
    .option('--provider <provider>', 'openai|mock')
    .option('--model <model>', 'model name', 'gpt-4o-mini')
    .option('--max-turns <n>', 'max loop turns', '8')
    .action(async (input: string, opts: { provider?: string; model: string; maxTurns: string }) => {
      const policy: AgentPolicy = {
        decisionFormat: 'json_only',
        maxToolCallsPerTurn: 1,
        workspaceJail: true,
        forbidNetwork: true,
        forbidGitPush: true
      };
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(opts.provider),
        model: opts.model,
        maxTurns: Math.max(1, Number(opts.maxTurns) || 8),
        policy
      });
      const res = await runtime.ask(input);
      if (res.ok) {
        console.log(chalk.green(res.response));
      } else {
        console.error(chalk.red(res.error));
        process.exitCode = 1;
      }
    });

  program.action(() => {
    console.log(chalk.green('Hello from pi-mini CLI!'));
    console.log(chalk.blue('TypeScript + Node.js CLI is set up successfully.\n'));
    console.log('Run `pi-mini --help` to see available commands.');
  });

  program.parse(process.argv);
}
