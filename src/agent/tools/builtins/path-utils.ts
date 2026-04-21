import path from 'path';

export function resolveInWorkspace(workspaceRoot: string, inputPath: string): string {
  const abs = path.resolve(workspaceRoot, inputPath);
  const jail = path.resolve(workspaceRoot);
  // Allow the root directory itself or anything inside it
  if (abs !== jail && !abs.startsWith(jail + path.sep)) {
    throw new Error('路径越界，已拒绝');
  }
  return abs;
}

