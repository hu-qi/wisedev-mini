import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ArtifactStatus } from './types';

export class ArtifactChecker {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  public async check(): Promise<ArtifactStatus> {
    const hasPrd = this.checkAnyExists(['docs/requirement/01_prd.md', 'docs/requirements.md']);
    const hasDesign = this.checkAnyExists(['docs/design/06_solution_outline.md', 'docs/architecture.md']);
    const hasPrototype = await this.checkPrototypeExists();
    const hasSourceCode = await this.hasTsFiles(path.join(this.rootDir, 'src'));
    const hasTests = await this.checkTestFiles();

    return { hasPrd, hasDesign, hasPrototype, hasSourceCode, hasTests };
  }

  private async checkPrototypeExists(): Promise<boolean> {
    const protoDir = path.join(this.rootDir, 'docs', 'prototypes');
    if (!existsSync(protoDir)) return false;
    try {
      const projects = await fs.readdir(protoDir, { withFileTypes: true });
      for (const project of projects) {
        if (project.isDirectory()) {
          const projectPath = path.join(protoDir, project.name);
          const files = await fs.readdir(projectPath);
          // If there's any .html file (like index.html or others), consider prototype exists
          if (files.some(f => f.endsWith('.html'))) return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  private checkAnyExists(relativePaths: string[]): boolean {
    for (const relPath of relativePaths) {
      if (existsSync(path.join(this.rootDir, relPath))) {
        return true;
      }
    }
    return false;
  }

  private async hasTsFiles(dir: string): Promise<boolean> {
    if (!existsSync(dir)) return false;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (await this.hasTsFiles(path.join(dir, entry.name))) return true;
        } else if (
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.test.ts') &&
          !entry.name.endsWith('.spec.ts')
        ) {
          return true;
        }
      }
    } catch (err) {
      // Ignore read errors
    }
    return false;
  }

  private async checkTestFiles(): Promise<boolean> {
    if (existsSync(path.join(this.rootDir, 'tests'))) return true;
    if (existsSync(path.join(this.rootDir, '__tests__'))) return true;
    return await this.hasTestSuffixFiles(path.join(this.rootDir, 'src'));
  }

  private async hasTestSuffixFiles(dir: string): Promise<boolean> {
    if (!existsSync(dir)) return false;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (await this.hasTestSuffixFiles(path.join(dir, entry.name))) return true;
        } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
          return true;
        }
      }
    } catch (err) {
      // Ignore read errors
    }
    return false;
  }
}
