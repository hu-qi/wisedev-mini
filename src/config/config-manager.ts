import fs from 'fs-extra';
import path from 'path';

export type PiMiniConfig = {
  presetsDir?: string;
  llm: {
    provider: string;
    model: string;
    maxTurns: number;
  };
};

export function defaultConfig(): PiMiniConfig {
  return {
    presetsDir: '',
    llm: {
      provider: 'openai',
      model: 'gpt-4o',
      maxTurns: 8
    }
  };
}

export function getConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.pi-mini', 'config.json');
}

export async function loadConfig(workspaceRoot: string): Promise<PiMiniConfig> {
  const cfgPath = getConfigPath(workspaceRoot);
  const base = defaultConfig();

  let fileCfg: Partial<PiMiniConfig> = {};
  if (await fs.pathExists(cfgPath)) {
    try {
      fileCfg = (await fs.readJson(cfgPath)) as Partial<PiMiniConfig>;
    } catch {
      fileCfg = {};
    }
  }

  const merged: PiMiniConfig = {
    presetsDir: fileCfg.presetsDir ?? base.presetsDir,
    llm: {
      provider: fileCfg.llm?.provider ?? base.llm.provider,
      model: fileCfg.llm?.model ?? base.llm.model,
      maxTurns: typeof fileCfg.llm?.maxTurns === 'number' ? fileCfg.llm.maxTurns : base.llm.maxTurns
    }
  };

  const envProvider = process.env.PI_MINI_PROVIDER;
  const envModel = process.env.PI_MINI_MODEL;
  const envMaxTurns = process.env.PI_MINI_MAX_TURNS;

  if (envProvider) merged.llm.provider = envProvider;
  if (envModel) merged.llm.model = envModel;
  if (envMaxTurns) {
    const n = parseInt(envMaxTurns, 10);
    if (!Number.isNaN(n) && n > 0) merged.llm.maxTurns = n;
  }

  return merged;
}

export async function saveConfig(workspaceRoot: string, config: PiMiniConfig): Promise<void> {
  const cfgPath = getConfigPath(workspaceRoot);
  await fs.ensureDir(path.dirname(cfgPath));
  await fs.writeJson(cfgPath, config, { spaces: 2 });
}

