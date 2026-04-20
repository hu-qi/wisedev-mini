export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  prompts?: {
    systemAppend?: string;
    userAppend?: string;
  };
}