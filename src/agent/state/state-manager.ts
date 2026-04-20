import fs from 'fs-extra';
import path from 'path';
import type { ProjectState } from '../contracts/state';

export class AgentStateManager {
  private statePath: string;

  public constructor(private baseDir: string, private workspaceRoot: string) {
    this.statePath = path.join(baseDir, 'state.json');
  }

  public async init(): Promise<ProjectState> {
    await fs.ensureDir(path.dirname(this.statePath));
    const initial: ProjectState = {
      version: 1,
      workspaceRoot: this.workspaceRoot,
      stage: 'INIT',
      artifacts: {},
      runs: []
    };
    await fs.writeJson(this.statePath, initial, { spaces: 2 });
    return initial;
  }

  public async load(): Promise<ProjectState> {
    if (!(await fs.pathExists(this.statePath))) {
      return this.init();
    }
    const data = (await fs.readJson(this.statePath)) as ProjectState;
    return {
      version: 1,
      workspaceRoot: this.workspaceRoot,
      stage: data.stage ?? 'INIT',
      artifacts: data.artifacts ?? {},
      runs: data.runs ?? [],
      currentGoal: data.currentGoal
    };
  }

  public async save(state: ProjectState): Promise<void> {
    await fs.ensureDir(path.dirname(this.statePath));
    await fs.writeJson(this.statePath, state, { spaces: 2 });
  }

  public async syncState(state: ProjectState): Promise<void> {
    const checkFile = async (subPath: string) => {
      const fullPath = path.join(this.workspaceRoot, subPath);
      return (await fs.pathExists(fullPath)) ? fullPath : null;
    };

    const prdPath = await checkFile('docs/requirement/01_prd.md');
    if (prdPath) state.artifacts.PRD = { path: prdPath, updatedAt: new Date().toISOString() };

    const designPath = await checkFile('docs/design/06_solution_outline.md');
    if (designPath) state.artifacts.DESIGN = { path: designPath, updatedAt: new Date().toISOString() };

    const packageJsonPath = await checkFile('package.json');
    if (packageJsonPath) state.artifacts.SOURCE_CODE = { path: packageJsonPath, updatedAt: new Date().toISOString() };

    const testPath = await checkFile('tests/smoke.spec.ts');
    if (testPath) state.artifacts.TESTS = { path: testPath, updatedAt: new Date().toISOString() };

    // Update stage based on artifacts
    if (state.artifacts.TESTS) {
      state.stage = 'DEPLOYMENT';
    } else if (state.artifacts.SOURCE_CODE) {
      state.stage = 'TESTING';
    } else if (state.artifacts.DESIGN) {
      state.stage = 'DEVELOPMENT';
    } else if (state.artifacts.PRD) {
      state.stage = 'DESIGN';
    } else {
      state.stage = 'REQUIREMENT';
    }
  }
}

