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

export async function main() {
  const config = await loadConfig(process.cwd());
  const program = new Command();

  const makePolicy = (): AgentPolicy => ({
    decisionFormat: 'json_only',
    maxToolCallsPerTurn: 1,
    workspaceJail: true,
    forbidNetwork: true,
    forbidGitPush: true
  });

  const maskSecret = (s: string): string => {
    if (s.length <= 12) return '***';
    return `${s.slice(0, 6)}***${s.slice(-4)}`;
  };

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
      const policy = makePolicy();
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
      const policy = makePolicy();
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
    .option('--provider <name>', `LLM Provider (openai, mock, ollama) [default: ${config.llm.provider}]`)
    .option('--model <name>', `Model name [default: ${config.llm.model}]`)
    .option('--max-turns <number>', `Max turns for this run loop [default: ${config.llm.maxTurns}]`)
    .option('--mode <mode>', 'Run mode (auto, interactive) [default: auto]')
    .action(async (opts: { provider?: string; model?: string; maxTurns?: string; mode?: string }) => {
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
    .option('--provider <name>', `LLM Provider (openai, mock, ollama) [default: ${config.llm.provider}]`)
    .option('--model <name>', `Model name [default: ${config.llm.model}]`)
    .option('--max-turns <number>', `Max turns for this run loop [default: ${config.llm.maxTurns}]`)
    .action(async (input: string, opts: { provider?: string; model: string; maxTurns: string }) => {
      const config = await loadConfig(process.cwd());
      const policy = makePolicy();
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
    .option('--provider <name>', `LLM Provider (openai, mock, ollama) [default: ${config.llm.provider}]`)
    .option('--model <name>', `Model name [default: ${config.llm.model}]`)
    .option('--max-turns <number>', `Max turns for this run loop [default: ${config.llm.maxTurns}]`)
    .action(async (runId: string | undefined, options: { provider?: string; model?: string; maxTurns?: string }) => {
      const config = await loadConfig(process.cwd());
      const policy = makePolicy();
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
      const policy = makePolicy();
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(config.llm.provider),
        model: config.llm.model,
        maxTurns: config.llm.maxTurns,
        policy
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
      const policy = makePolicy();
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(config.llm.provider),
        model: config.llm.model,
        maxTurns: config.llm.maxTurns,
        policy
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

  skillCmd
    .command('install-suite <dir>')
    .description('Install all skills found in a suite directory (scan first-level subdirectories)')
    .action(async (dir: string) => {
      const config = await loadConfig(process.cwd());
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(config.llm.provider),
        model: config.llm.model,
        maxTurns: config.llm.maxTurns,
        policy: makePolicy()
      });
      await runtime.init();

      const path = await import('path');
      const suitePath = path.resolve(process.cwd(), dir);
      if (!(await fs.pathExists(suitePath))) {
        console.error(chalk.red(`❌ Directory not found: ${suitePath}`));
        process.exitCode = 1;
        return;
      }

      const entries = await fs.readdir(suitePath);
      let installed = 0;
      let skipped = 0;

      for (const entry of entries) {
        const p = path.join(suitePath, entry);
        let stat: import('fs').Stats;
        try {
          stat = await fs.stat(p);
        } catch {
          skipped += 1;
          continue;
        }
        if (!stat.isDirectory()) {
          skipped += 1;
          continue;
        }
        const hasSkillJson = await fs.pathExists(path.join(p, 'skill.json'));
        const hasSkillMd = await fs.pathExists(path.join(p, 'SKILL.md'));
        if (!hasSkillJson && !hasSkillMd) {
          skipped += 1;
          continue;
        }
        try {
          const manifest = await runtime.getSkillManager().installSkill(p);
          installed += 1;
          console.log(chalk.green(`✅ Installed: ${manifest.name} (v${manifest.version})`));
        } catch (e) {
          skipped += 1;
          console.log(chalk.yellow(`Skipped: ${entry} (${(e as Error).message})`));
        }
      }

      console.log(chalk.blue(`Done. Installed=${installed}, Skipped=${skipped}`));
    });

  skillCmd
    .command('show <name>')
    .description('Show skill details and installed file locations')
    .option('--content', 'Print skill markdown content (if available)')
    .option('--max-chars <number>', 'Max chars of content to print', '4000')
    .action(async (name: string, opts: { content?: boolean; maxChars?: string }) => {
      const config = await loadConfig(process.cwd());
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(config.llm.provider),
        model: config.llm.model,
        maxTurns: config.llm.maxTurns,
        policy: makePolicy()
      });
      await runtime.init();
      const info = await runtime.getSkillManager().getSkillFiles(name);
      console.log(chalk.blue('--- Skill ---'));
      console.log(`Name:        ${info.manifest.name}`);
      console.log(`Version:     ${info.manifest.version}`);
      console.log(`Description: ${info.manifest.description}`);
      if (info.skillJsonPath) console.log(`skill.json:  ${info.skillJsonPath}`);
      if (info.skillMdPath) console.log(`SKILL.md:    ${info.skillMdPath}`);
      if (opts.content && info.skillMdPath) {
        const maxChars = Math.max(1, parseInt(opts.maxChars ?? '4000', 10) || 4000);
        const md = await fs.readFile(info.skillMdPath, 'utf-8');
        console.log(chalk.blue('\n--- SKILL.md (truncated) ---'));
        console.log(md.slice(0, maxChars));
      }
    });

  skillCmd
    .command('remove <name>')
    .description('Remove an installed skill')
    .option('--force', 'Skip confirmation')
    .action(async (name: string, opts: { force?: boolean }) => {
      if (!opts.force) {
        console.log(chalk.yellow('Refusing to remove skill without --force.'));
        process.exitCode = 1;
        return;
      }
      const config = await loadConfig(process.cwd());
      const runtime = new AgentRuntime({
        workspaceRoot: process.cwd(),
        provider: createProvider(config.llm.provider),
        model: config.llm.model,
        maxTurns: config.llm.maxTurns,
        policy: makePolicy()
      });
      await runtime.init();
      await runtime.getSkillManager().removeSkill(name);
      console.log(chalk.green(`✅ Skill removed: ${name}`));
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

  program
    .command('doctor')
    .description('Check environment and LLM connectivity')
    .action(async () => {
      const cfg = await loadConfig(process.cwd());
      console.log(chalk.blue('--- pi-mini doctor ---'));
      console.log(`Config:   ${getConfigPath(process.cwd())}`);
      console.log(`Provider: ${cfg.llm.provider}`);
      console.log(`Model:    ${cfg.llm.model}`);
      console.log(`MaxTurns: ${cfg.llm.maxTurns}`);

      if (cfg.llm.provider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY ?? '';
        const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
        console.log(`OPENAI_BASE_URL: ${baseUrl}`);
        console.log(`OPENAI_API_KEY:  ${apiKey ? maskSecret(apiKey) : '(missing)'}`);
        if (!apiKey) {
          console.log(chalk.red('❌ Missing OPENAI_API_KEY'));
          process.exitCode = 1;
          return;
        }
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(`${baseUrl}/models`, {
            method: 'GET',
            signal: controller.signal,
            headers: { Authorization: `Bearer ${apiKey}` }
          });
          clearTimeout(timer);
          if (!res.ok) {
            const text = await res.text();
            console.log(chalk.red(`❌ LLM connectivity failed: ${res.status} ${text.slice(0, 200)}`));
            process.exitCode = 1;
            return;
          }
          console.log(chalk.green('✅ LLM connectivity OK (/models)'));
        } catch (e) {
          console.log(chalk.red(`❌ LLM connectivity failed: ${(e as Error).message}`));
          process.exitCode = 1;
        }
      } else if (cfg.llm.provider === 'ollama') {
        const baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, '');
        console.log(`OLLAMA_BASE_URL: ${baseUrl}`);
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(`${baseUrl}/api/tags`, { method: 'GET', signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) {
            const text = await res.text();
            console.log(chalk.red(`❌ Ollama connectivity failed: ${res.status} ${text.slice(0, 200)}`));
            process.exitCode = 1;
            return;
          }
          console.log(chalk.green('✅ Ollama connectivity OK (/api/tags)'));
        } catch (e) {
          console.log(chalk.red(`❌ Ollama connectivity failed: ${(e as Error).message}`));
          process.exitCode = 1;
        }
      } else if (cfg.llm.provider === 'mock') {
        console.log(chalk.green('✅ Provider is mock (no external connectivity required)'));
      }
    });

  program.action(() => {
    console.log(chalk.green('Hello from pi-mini CLI!'));
    console.log(chalk.blue('TypeScript + Node.js CLI is set up successfully.\n'));
    console.log('Run `pi-mini --help` to see available commands.');
  });

  await program.parseAsync(process.argv);
}
