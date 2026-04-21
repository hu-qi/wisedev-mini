import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';

export type PrototypeItem = {
  name: string;
  filePath: string;
  mtimeMs: number;
};

export function getDefaultProjectName(workspaceRoot: string): string {
  return path.basename(workspaceRoot);
}

export function getProjectPrototypeDir(workspaceRoot: string, projectName: string): string {
  return path.join(workspaceRoot, 'docs', 'prototypes', projectName);
}

export async function ensureProjectPrototypeDir(workspaceRoot: string, projectName: string): Promise<string> {
  const dir = getProjectPrototypeDir(workspaceRoot, projectName);
  await fs.ensureDir(dir);
  return dir;
}

export async function listPrototypes(projectDir: string): Promise<PrototypeItem[]> {
  if (!(await fs.pathExists(projectDir))) return [];
  const entries = await fs.readdir(projectDir);
  const items: PrototypeItem[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.html')) continue;
    if (entry.toLowerCase() === 'index.html') continue;
    const filePath = path.join(projectDir, entry);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
      items.push({
        name: entry.replace(/\.html$/i, ''),
        filePath,
        mtimeMs: stat.mtimeMs
      });
    } catch {
      continue;
    }
  }

  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return items;
}

export async function rebuildIndex(projectDir: string, projectName: string): Promise<string> {
  const items = await listPrototypes(projectDir);
  const indexPath = path.join(projectDir, 'index.html');
  const rows = items
    .map((it) => {
      const file = `${it.name}.html`;
      const ts = new Date(it.mtimeMs).toISOString().replace('T', ' ').slice(0, 19);
      return `<tr><td><a href="./${file}">${it.name}</a></td><td>${ts}</td></tr>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>原型导航 - ${projectName}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; background: #f5f6f8; color: #111; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
    .wrap { max-width: 980px; margin: 0 auto; }
    .title { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
    .sub { color: #667085; font-size: 13px; margin-bottom: 18px; }
    .card { background: #fff; border: 1px solid #e6e8ec; border-radius: 10px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #eef0f3; font-size: 13px; }
    th { color: #667085; font-weight: 600; }
    a { color: #1d4ed8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .empty { color: #667085; font-size: 13px; padding: 18px 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="title">原型导航</div>
    <div class="sub">项目：${projectName} · 路径：docs/prototypes/${projectName}/</div>
    <div class="card">
      <table>
        <thead>
          <tr><th>原型</th><th>更新时间</th></tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="2" class="empty">暂无原型。使用 pi-mini prototype new 创建。</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

  await fs.writeFile(indexPath, html, 'utf-8');
  return indexPath;
}

export async function openPath(p: string): Promise<void> {
  const platform = process.platform;
  let cmd = '';
  let args: string[] = [];

  if (platform === 'darwin') {
    cmd = 'open';
    args = [p];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', p];
  } else {
    cmd = 'xdg-open';
    args = [p];
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Open failed: ${cmd} exit ${code}`))));
  });
}

