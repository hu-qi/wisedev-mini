import fs from 'fs-extra';
import path from 'path';
import type { SkillManifest } from '../contracts/skill';

export class SkillManager {
  private skillsDir: string;
  private activeSkills: SkillManifest[] = [];

  constructor(baseDir: string) {
    this.skillsDir = path.join(baseDir, 'skills');
  }

  public async init(): Promise<void> {
    await fs.ensureDir(this.skillsDir);
  }

  public async loadAll(): Promise<void> {
    this.activeSkills = [];
    if (!(await fs.pathExists(this.skillsDir))) return;
    
    const dirs = await fs.readdir(this.skillsDir);
    for (const d of dirs) {
      const skillDir = path.join(this.skillsDir, d);
      const stat = await fs.stat(skillDir);
      if (!stat.isDirectory()) continue;

      const skillJsonPath = path.join(skillDir, 'skill.json');
      if (await fs.pathExists(skillJsonPath)) {
        try {
          const manifest = (await fs.readJson(skillJsonPath)) as SkillManifest;
          this.activeSkills.push(manifest);
        } catch (e) {
          console.error(`Failed to load skill ${d}:`, e);
        }
      }
    }
  }

  public getActiveSkills(): SkillManifest[] {
    return this.activeSkills;
  }

  public async installSkill(sourceDir: string): Promise<SkillManifest> {
    const skillJsonPath = path.join(sourceDir, 'skill.json');
    if (!(await fs.pathExists(skillJsonPath))) {
      throw new Error(`Invalid skill: skill.json not found in ${sourceDir}`);
    }
    
    const manifest = (await fs.readJson(skillJsonPath)) as SkillManifest;
    const targetDir = path.join(this.skillsDir, manifest.name);
    
    await fs.copy(sourceDir, targetDir, { overwrite: true });
    await this.loadAll();
    
    return manifest;
  }
}