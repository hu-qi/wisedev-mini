export type Stage =
  | 'INIT'
  | 'REQUIREMENT'
  | 'DESIGN'
  | 'DEVELOPMENT'
  | 'TESTING'
  | 'DEPLOYMENT'
  | 'DONE';

export type ArtifactKey =
  | 'PRD'
  | 'DESIGN'
  | 'SOURCE_CODE'
  | 'TESTS'
  | 'DEPLOY_GUIDE'
  | 'OPENAPI'
  | 'DATA_MODEL';

export type ProjectState = {
  version: 1;
  workspaceRoot: string;
  stage: Stage;
  currentGoal?: string;
  artifacts: Partial<Record<ArtifactKey, { path: string; updatedAt: string }>>;
  runs: Array<{ runId: string; startedAt: string; finishedAt?: string; status: 'RUNNING' | 'DONE' | 'ERROR' }>;
};

