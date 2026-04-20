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
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      if (await fs.pathExists(skillJsonPath)) {
        try {
          const manifest = (await fs.readJson(skillJsonPath)) as SkillManifest;
          this.activeSkills.push(manifest);
        } catch (e) {
          console.error(`Failed to load skill ${d}:`, e);
        }
      } else if (await fs.pathExists(skillMdPath)) {
        // 兼容 wisedev-suite 风格的 Markdown Skill
        try {
          const mdContent = await fs.readFile(skillMdPath, 'utf-8');
          const manifest = this.parseMarkdownSkill(mdContent, d);
          this.activeSkills.push(manifest);
        } catch (e) {
          console.error(`Failed to parse markdown skill ${d}:`, e);
        }
      }
    }
  }

  private parseMarkdownSkill(content: string, dirName: string): SkillManifest {
    let name = dirName;
    let description = 'Markdown skill imported from wisedev-suite';
    
    // 尝试解析 YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const fm = frontmatterMatch[1];
      const nameMatch = fm.match(/name:\s*(.+)/);
      const descMatch = fm.match(/description:\s*['"]?([^'"]+)['"]?/);
      if (nameMatch) name = nameMatch[1].trim();
      if (descMatch) description = descMatch[1].trim();
    }

    return {
      name,
      version: '1.0.0',
      description,
      prompts: {
        systemAppend: content // 将整个 markdown 内容注入到 system prompt 中
      },
      rawMarkdown: content
    };
  }

  public getActiveSkills(): SkillManifest[] {
    return this.activeSkills;
  }

  public async installSkill(sourceDir: string): Promise<SkillManifest> {
    const skillJsonPath = path.join(sourceDir, 'skill.json');
    const skillMdPath = path.join(sourceDir, 'SKILL.md');

    if (!(await fs.pathExists(skillJsonPath)) && !(await fs.pathExists(skillMdPath))) {
      throw new Error(`Invalid skill: neither skill.json nor SKILL.md found in ${sourceDir}`);
    }
    
    let manifest: SkillManifest;
    if (await fs.pathExists(skillJsonPath)) {
      manifest = (await fs.readJson(skillJsonPath)) as SkillManifest;
    } else {
      const mdContent = await fs.readFile(skillMdPath, 'utf-8');
      manifest = this.parseMarkdownSkill(mdContent, path.basename(sourceDir));
    }

    const targetDir = path.join(this.skillsDir, manifest.name);
    
    await fs.copy(sourceDir, targetDir, { overwrite: true });
    await this.loadAll();
    
    return manifest;
  }
}