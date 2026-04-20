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
}

