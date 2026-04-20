export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  prompts?: {
    systemAppend?: string;
    userAppend?: string;
  };
  // 支持纯 Markdown 格式的 Skill 描述（兼容 wisedev-suite 风格）
  rawMarkdown?: string;
}