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
import { Logger } from './utils/logger';

export async function main() {
  const config = await loadConfig(process.cwd());
  const program = new Command();

  const safety = { yes: false, dryRun: false };

  const makePolicy = (): AgentPolicy => ({
    decisionFormat: 'json_only',
    maxToolCallsPerTurn: 1,
    workspaceJail: true,
    forbidNetwork: true,
    forbidGitPush: true,
    requireApproval: true,
    autoApprove: safety.yes,
    dryRun: safety.dryRun
  });

  const maskSecret = (s: string): string => {
    if (s.length <= 12) return '***';
    return `${s.slice(0, 6)}***${s.slice(-4)}`;
  };

  program
    .name('pi-mini')
    .description('A mini CLI tool')
    .version('1.0.0')
    .option('--json', 'Output in JSON format')
    .option('-q, --quiet', 'Quiet mode (suppress non-error output)')
    .option('-v, --verbose', 'Verbose mode')
    .option('-y, --yes', 'Auto-approve potentially destructive actions (write files / run shell)')
    .option('--dry-run', 'Do not write files or run shell commands during agent execution')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      Logger.setup(opts);
      safety.yes = !!opts.yes;
      safety.dryRun = !!opts.dryRun;
    });

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
      Logger.success('✅ Agent workspace initialized at .pi-mini/agent');
      if (Logger.isJson) {
        Logger.printJson({ ok: true, message: 'Agent workspace initialized' });
      }
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
      
      let lastRun = null;
      if (state?.runs?.length) {
        lastRun = state.runs[state.runs.length - 1];
      }

      if (Logger.isJson) {
        Logger.printJson({ lastRun });
      } else {
        Logger.info(chalk.blue('--- Agent State ---'));
        if (lastRun) {
          Logger.info(`LastRun: ${lastRun.runId} (${lastRun.status})`);
        } else {
          Logger.info('LastRun: (none)');
        }
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
      await orchestrator.run({ ...opts, policy: makePolicy() });
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
      const res = await runtime.ask(input, { silent: Logger.isJson || Logger.isQuiet });
      if (res.ok) {
        Logger.success(res.response);
        if (Logger.isJson) Logger.printJson(res);
      } else {
        Logger.error(res.error);
        if (Logger.isJson) Logger.printJson(res);
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
      Logger.info(chalk.blue(`Resuming agent run${runId ? ` ${runId}` : ''}...`));
      const res = await runtime.resume(runId, { silent: Logger.isJson || Logger.isQuiet });
      if (res.ok) {
        Logger.success('✅ Agent finished successfully.');
        Logger.info(res.response);
        if (Logger.isJson) Logger.printJson(res);
      } else {
        Logger.error('❌ Agent failed or stopped:');
        Logger.error(res.error);
        if (Logger.isJson) Logger.printJson(res);
        process.exitCode = 1;
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
        Logger.success('✅ Memory cleared successfully.');
        if (Logger.isJson) Logger.printJson({ ok: true, message: 'Memory cleared successfully.' });
      } else {
        Logger.warn('Memory directory not found.');
        if (Logger.isJson) Logger.printJson({ ok: false, error: 'Memory directory not found.' });
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
        if (Logger.isJson) {
          Logger.printJson([]);
        } else {
          Logger.warn('No skills installed.');
        }
      } else {
        if (Logger.isJson) {
          Logger.printJson(skills);
        } else {
          Logger.info(chalk.blue('--- Installed Skills ---'));
          skills.forEach((s) => {
            Logger.info(`- ${chalk.green(s.name)} (v${s.version})`);
            Logger.info(`  ${s.description}`);
          });
        }
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
        if (Logger.isJson) {
          Logger.printJson({ ok: true, manifest });
        } else {
          Logger.success(`✅ Successfully installed skill: ${manifest.name} (v${manifest.version})`);
        }
      } catch (err) {
        const msg = (err as Error).message;
        Logger.error(`❌ Failed to install skill: ${msg}`);
        if (Logger.isJson) Logger.printJson({ ok: false, error: msg });
        process.exitCode = 1;
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
        Logger.error(`❌ Directory not found: ${suitePath}`);
        if (Logger.isJson) Logger.printJson({ ok: false, error: `Directory not found: ${suitePath}` });
        process.exitCode = 1;
        return;
      }

      const entries = await fs.readdir(suitePath);
      let installed = 0;
      let skipped = 0;
      const installedNames: string[] = [];

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
          installedNames.push(manifest.name);
          if (!Logger.isJson) Logger.success(`✅ Installed: ${manifest.name} (v${manifest.version})`);
        } catch (e) {
          skipped += 1;
          if (!Logger.isJson) Logger.warn(`Skipped: ${entry} (${(e as Error).message})`);
        }
      }

      if (Logger.isJson) {
        Logger.printJson({ ok: true, installed, skipped, installedNames });
      } else {
        Logger.info(chalk.blue(`Done. Installed=${installed}, Skipped=${skipped}`));
      }
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
      let mdContent: string | undefined;
      if (opts.content && info.skillMdPath) {
        const maxChars = Math.max(1, parseInt(opts.maxChars ?? '4000', 10) || 4000);
        const md = await fs.readFile(info.skillMdPath, 'utf-8');
        mdContent = md.slice(0, maxChars);
      }

      if (Logger.isJson) {
        Logger.printJson({ ok: true, ...info, content: mdContent });
      } else {
        Logger.info(chalk.blue('--- Skill ---'));
        Logger.info(`Name:        ${info.manifest.name}`);
        Logger.info(`Version:     ${info.manifest.version}`);
        Logger.info(`Description: ${info.manifest.description}`);
        if (info.skillJsonPath) Logger.info(`skill.json:  ${info.skillJsonPath}`);
        if (info.skillMdPath) Logger.info(`SKILL.md:    ${info.skillMdPath}`);
        if (mdContent) {
          Logger.info(chalk.blue('\n--- SKILL.md (truncated) ---'));
          Logger.info(mdContent);
        }
      }
    });

  skillCmd
    .command('remove <name>')
    .description('Remove an installed skill')
    .option('--force', 'Skip confirmation')
    .action(async (name: string, opts: { force?: boolean }) => {
      if (!opts.force) {
        const msg = 'Refusing to remove skill without --force.';
        Logger.warn(msg);
        if (Logger.isJson) Logger.printJson({ ok: false, error: msg });
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
      if (Logger.isJson) {
        Logger.printJson({ ok: true, removed: name });
      } else {
        Logger.success(`✅ Skill removed: ${name}`);
      }
    });

  const configCmd = program.command('config').description('Manage pi-mini configuration');

  configCmd.action(async () => {
    const config = await loadConfig(process.cwd());
    const payload = {
      file: getConfigPath(process.cwd()),
      llm: config.llm
    };
    if (Logger.isJson) {
      Logger.printJson(payload);
      return;
    }
    Logger.info(chalk.blue('--- pi-mini config ---'));
    Logger.info(`File: ${payload.file}`);
    Logger.info(`Provider: ${payload.llm.provider}`);
    Logger.info(`Model:    ${payload.llm.model}`);
    Logger.info(`MaxTurns: ${payload.llm.maxTurns}`);
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
      if (Logger.isJson) {
        Logger.printJson({ ok: true, config: next });
      } else {
        Logger.success('✅ Config updated.');
      }
    });

  program
    .command('doctor')
    .description('Check environment and LLM connectivity')
    .action(async () => {
      const cfg = await loadConfig(process.cwd());
      
      const result: any = {
        config: getConfigPath(process.cwd()),
        provider: cfg.llm.provider,
        model: cfg.llm.model,
        maxTurns: cfg.llm.maxTurns,
        env: {},
        connectivity: { ok: false, message: '' }
      };

      Logger.info(chalk.blue('--- pi-mini doctor ---'));
      Logger.info(`Config:   ${result.config}`);
      Logger.info(`Provider: ${result.provider}`);
      Logger.info(`Model:    ${result.model}`);
      Logger.info(`MaxTurns: ${result.maxTurns}`);

      if (cfg.llm.provider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY ?? '';
        const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
        result.env.OPENAI_BASE_URL = baseUrl;
        result.env.OPENAI_API_KEY = apiKey ? maskSecret(apiKey) : '(missing)';
        
        Logger.info(`OPENAI_BASE_URL: ${result.env.OPENAI_BASE_URL}`);
        Logger.info(`OPENAI_API_KEY:  ${result.env.OPENAI_API_KEY}`);
        
        if (!apiKey) {
          result.connectivity = { ok: false, message: 'Missing OPENAI_API_KEY' };
          Logger.error('❌ Missing OPENAI_API_KEY');
          if (Logger.isJson) Logger.printJson(result);
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
            result.connectivity = { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
            Logger.error(`❌ LLM connectivity failed: ${result.connectivity.message}`);
            if (Logger.isJson) Logger.printJson(result);
            process.exitCode = 1;
            return;
          }
          result.connectivity = { ok: true, message: 'LLM connectivity OK (/models)' };
          Logger.success('✅ LLM connectivity OK (/models)');
        } catch (e) {
          result.connectivity = { ok: false, message: (e as Error).message };
          Logger.error(`❌ LLM connectivity failed: ${result.connectivity.message}`);
          if (Logger.isJson) Logger.printJson(result);
          process.exitCode = 1;
        }
      } else if (cfg.llm.provider === 'ollama') {
        const baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, '');
        result.env.OLLAMA_BASE_URL = baseUrl;
        Logger.info(`OLLAMA_BASE_URL: ${baseUrl}`);
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(`${baseUrl}/api/tags`, {
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timer);
          if (!res.ok) {
            const text = await res.text();
            result.connectivity = { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
            Logger.error(`❌ Ollama connectivity failed: ${result.connectivity.message}`);
            if (Logger.isJson) Logger.printJson(result);
            process.exitCode = 1;
            return;
          }
          result.connectivity = { ok: true, message: 'Ollama connectivity OK (/api/tags)' };
          Logger.success('✅ Ollama connectivity OK (/api/tags)');
        } catch (e) {
          result.connectivity = { ok: false, message: (e as Error).message };
          Logger.error(`❌ Ollama connectivity failed: ${result.connectivity.message}`);
          if (Logger.isJson) Logger.printJson(result);
          process.exitCode = 1;
        }
      } else if (cfg.llm.provider === 'mock') {
        result.connectivity = { ok: true, message: 'Provider is mock (no external connectivity required)' };
        Logger.success('✅ Provider is mock (no external connectivity required)');
      } else {
        result.connectivity = { ok: true, message: `No connectivity check for provider: ${cfg.llm.provider}` };
        Logger.warn(`No connectivity check for provider: ${cfg.llm.provider}`);
      }

      if (Logger.isJson && process.exitCode !== 1) {
        Logger.printJson(result);
      }
    });


  program
    .command('logs [runId]')
    .description('Show run traces and logs')
    .action(async (runId?: string) => {
      const { TraceReader } = await import('./agent/runtime/trace-reader');
      const reader = new TraceReader(process.cwd());

      if (!runId) {
        const path = await import('path');
        const statePath = path.join(process.cwd(), '.pi-mini', 'agent', 'state.json');
        const state = (await fs.pathExists(statePath)) ? await fs.readJson(statePath) : null;
        
        if (!state?.runs?.length) {
          Logger.info('No runs found.');
          if (Logger.isJson) Logger.printJson([]);
          return;
        }

        if (Logger.isJson) {
          Logger.printJson(state.runs);
        } else {
          Logger.info(chalk.blue('--- Recent Runs ---'));
          state.runs.slice(-10).forEach((r: any) => {
            Logger.info(`- ${r.runId} [${r.status}] (Started: ${r.startedAt})`);
          });
          Logger.info(chalk.dim('\nRun `pi-mini logs <runId>` to see details.'));
        }
        return;
      }

      try {
        const events = await reader.readTrace(runId);
        if (Logger.isJson) {
          Logger.printJson(events);
        } else {
          Logger.info(chalk.blue(`--- Trace Logs: ${runId} ---`));
          for (const ev of events) {
            Logger.info(chalk.yellow(`\n[Turn ${ev.turn}] ${ev.type} @ ${ev.ts}`));
            if (ev.type === 'prompt_input') {
              Logger.info(`User Input: ${ev.data.userInput.slice(0, 100)}...`);
            } else if (ev.type === 'llm_response') {
              Logger.info(`LLM Response length: ${ev.data.content?.length ?? 0}`);
            } else if (ev.type === 'decision') {
              Logger.info(`Decision: ${ev.data.kind}`);
              if (ev.data.kind === 'tool') {
                Logger.info(`Tool: ${ev.data.tool.name}`);
              }
            } else if (ev.type === 'tool_result') {
              Logger.info(`Result ok: ${ev.data.ok}`);
              if (!ev.data.ok) Logger.error(`Error: ${ev.data.error}`);
            } else if (ev.type === 'error') {
              Logger.error(`Error: ${ev.data.message}`);
            } else if (ev.type === 'final') {
              Logger.success(`Final: ${ev.data.response.slice(0, 200)}...`);
            }
          }
        }
      } catch (err) {
        Logger.error(`Failed to read logs: ${(err as Error).message}`);
        if (Logger.isJson) Logger.printJson({ error: (err as Error).message });
        process.exitCode = 1;
      }
    });

  program.action(() => {
    if (Logger.isJson) {
      Logger.printJson({ ok: true, message: 'pi-mini' });
      return;
    }
    Logger.success('Hello from pi-mini CLI!');
    Logger.info(chalk.blue('TypeScript + Node.js CLI is set up successfully.\n'));
    Logger.info('Run `pi-mini --help` to see available commands.');
  });

  await program.parseAsync(process.argv);
}
