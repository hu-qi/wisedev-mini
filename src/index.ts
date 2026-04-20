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
import { loadConfig, saveConfig, getConfigPath } from './config/config-manager';

export function main() {
  const program = new Command();

  program
    .name('pi-mini')
    .description('A mini CLI tool')
    .version('1.0.0');

  program
    .command('init')
    .description('Initialize pi-mini project and agent state')
    .action(async () => {
      const orchestrator = new Orchestrator();
      await orchestrator.init();
      const config = await loadConfig(process.cwd());
      await saveConfig(process.cwd(), config);
      const policy: AgentPolicy = {
        decisionFormat: 'json_only',
        maxToolCallsPerTurn: 1,
        workspaceJail: true,
        forbidNetwork: true,
        forbidGitPush: true
      };
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(config.llm.provider),
        model: config.llm.model,
        maxTurns: config.llm.maxTurns,
        policy
      });
      await runtime.init();
      console.log(chalk.green('✅ Agent workspace initialized at .pi-mini/agent'));
    });

  program
    .command('status')
    .description('Check the current project state and agent status')
    .action(async () => {
      const orchestrator = new Orchestrator();
      await orchestrator.status();

      const config = await loadConfig(process.cwd());
      const policy: AgentPolicy = {
        decisionFormat: 'json_only',
        maxToolCallsPerTurn: 1,
        workspaceJail: true,
        forbidNetwork: true,
        forbidGitPush: true
      };
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(config.llm.provider),
        model: config.llm.model,
        maxTurns: config.llm.maxTurns,
        policy
      });
      const info = await runtime.status();
      const statePath = info.statePath;
      const state = (await fs.pathExists(statePath)) ? await fs.readJson(statePath) : null;
      console.log(chalk.blue('--- Agent State ---'));
      if (state?.runs?.length) {
        const last = state.runs[state.runs.length - 1];
        console.log(`LastRun: ${last.runId} (${last.status})`);
      } else {
        console.log('LastRun: (none)');
      }
    });

  program
    .command('run')
    .description('Run the pi-mini pipeline, integrating all missing stages sequentially')
    .option('--provider <name>', 'LLM Provider (openai, mock, ollama)')
    .option('--model <name>', 'Model name')
    .option('--max-turns <number>', 'Max turns for this run loop')
    .action(async (opts: { provider?: string; model?: string; maxTurns?: string }) => {
      const orchestrator = new Orchestrator();
      await orchestrator.run(opts);
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

  program
    .command('ask <input>')
    .description('Run agent loop for a specific task or question')
    .option('--provider <name>', 'LLM Provider (openai, mock, ollama)')
    .option('--model <name>', 'Model name')
    .option('--max-turns <number>', 'Max turns for this run loop')
    .action(async (input: string, opts: { provider?: string; model: string; maxTurns: string }) => {
      const config = await loadConfig(process.cwd());
      const policy: AgentPolicy = {
        decisionFormat: 'json_only',
        maxToolCallsPerTurn: 1,
        workspaceJail: true,
        forbidNetwork: true,
        forbidGitPush: true
      };
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(opts.provider ?? config.llm.provider),
        model: opts.model ?? config.llm.model,
        maxTurns: Math.max(1, Number(opts.maxTurns ?? config.llm.maxTurns) || 8),
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

  program
    .command('resume [runId]')
    .description('Resume an unfinished agent run')
    .option('--provider <name>', 'LLM Provider (openai, mock, ollama)')
    .option('--model <name>', 'Model name')
    .option('--max-turns <number>', 'Max turns for this run loop')
    .action(async (runId: string | undefined, options: { provider?: string; model?: string; maxTurns?: string }) => {
      const config = await loadConfig(process.cwd());
      const policy: AgentPolicy = {
        decisionFormat: 'json_only',
        maxToolCallsPerTurn: 1,
        workspaceJail: true,
        forbidNetwork: true,
        forbidGitPush: true
      };
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(options.provider ?? config.llm.provider),
        model: options.model ?? config.llm.model,
        maxTurns: parseInt(options.maxTurns ?? String(config.llm.maxTurns), 10),
        policy
      });
      console.log(chalk.blue(`Resuming agent run${runId ? ` ${runId}` : ''}...`));
      const res = await runtime.resume(runId);
      if (res.ok) {
        console.log(chalk.green('✅ Agent finished successfully.'));
        console.log(res.response);
      } else {
        console.log(chalk.red('❌ Agent failed or stopped:'));
        console.log(res.error);
      }
    });

  const memoryCmd = program.command('memory').description('Manage agent memory');
  memoryCmd
    .command('clear')
    .description('Clear agent memory (short/long)')
    .action(async () => {
      const fs = await import('fs-extra');
      const path = await import('path');
      const memoryDir = path.join(process.cwd(), '.pi-mini', 'agent', 'memory');
      if (await fs.pathExists(memoryDir)) {
        await fs.emptyDir(memoryDir);
        console.log(chalk.green('✅ Memory cleared successfully.'));
      } else {
        console.log(chalk.yellow('Memory directory not found.'));
      }
    });

  const skillCmd = program.command('skill').description('Manage agent skills');
  skillCmd
    .command('list')
    .description('List installed skills')
    .action(async () => {
      const config = await loadConfig(process.cwd());
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(config.llm.provider),
        model: config.llm.model,
        maxTurns: config.llm.maxTurns,
        policy: {
          decisionFormat: 'json_only',
          maxToolCallsPerTurn: 1,
          workspaceJail: true,
          forbidNetwork: true,
          forbidGitPush: true
        }
      });
      await runtime.init();
      const skills = runtime.getSkillManager().getActiveSkills();
      if (skills.length === 0) {
        console.log(chalk.yellow('No skills installed.'));
      } else {
        console.log(chalk.blue('--- Installed Skills ---'));
        skills.forEach(s => {
          console.log(`- ${chalk.green(s.name)} (v${s.version})`);
          console.log(`  ${s.description}`);
        });
      }
    });

  skillCmd
    .command('install <dir>')
    .description('Install a skill from a local directory')
    .action(async (dir: string) => {
      const config = await loadConfig(process.cwd());
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(config.llm.provider),
        model: config.llm.model,
        maxTurns: config.llm.maxTurns,
        policy: {
          decisionFormat: 'json_only',
          maxToolCallsPerTurn: 1,
          workspaceJail: true,
          forbidNetwork: true,
          forbidGitPush: true
        }
      });
      await runtime.init();
      try {
        const path = await import('path');
        const sourcePath = path.resolve(process.cwd(), dir);
        const manifest = await runtime.getSkillManager().installSkill(sourcePath);
        console.log(chalk.green(`✅ Successfully installed skill: ${manifest.name} (v${manifest.version})`));
      } catch (err) {
        console.error(chalk.red('❌ Failed to install skill:'), (err as Error).message);
      }
    });

  const configCmd = program.command('config').description('Manage pi-mini configuration');

  configCmd.action(async () => {
    const config = await loadConfig(process.cwd());
    console.log(chalk.blue('--- pi-mini config ---'));
    console.log(`File: ${getConfigPath(process.cwd())}`);
    console.log(`Provider: ${config.llm.provider}`);
    console.log(`Model:    ${config.llm.model}`);
    console.log(`MaxTurns: ${config.llm.maxTurns}`);
  });

  configCmd
    .command('set')
    .description('Update pi-mini configuration')
    .option('--provider <name>', 'LLM Provider (openai, mock, ollama)')
    .option('--model <name>', 'Model name')
    .option('--max-turns <number>', 'Max turns')
    .action(async (opts: { provider?: string; model?: string; maxTurns?: string }) => {
      const current = await loadConfig(process.cwd());
      const next = {
        llm: {
          provider: opts.provider ?? current.llm.provider,
          model: opts.model ?? current.llm.model,
          maxTurns: opts.maxTurns ? Math.max(1, parseInt(opts.maxTurns, 10)) : current.llm.maxTurns
        }
      };
      await saveConfig(process.cwd(), next);
      console.log(chalk.green('✅ Config updated.'));
    });

  program.action(() => {
    console.log(chalk.green('Hello from pi-mini CLI!'));
    console.log(chalk.blue('TypeScript + Node.js CLI is set up successfully.\n'));
    console.log('Run `pi-mini --help` to see available commands.');
  });

  program.parse(process.argv);
}
