import path from 'path';

export function resolveInWorkspace(workspaceRoot: string, inputPath: string): string {
  const abs = path.resolve(workspaceRoot, inputPath);
  const jail = path.resolve(workspaceRoot) + path.sep;
  if (!abs.startsWith(jail)) {
    throw new Error('路径越界，已拒绝');
  }
  return abs;
}

