import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export class DeploymentStage {
  private targetDir = process.cwd();

  public async execute(): Promise<void> {
    console.log(chalk.blue('Starting Deployment Stage...'));

    try {
      const packageJsonPath = path.join(this.targetDir, 'package.json');
      if (!(await fs.pathExists(packageJsonPath))) {
        console.log(chalk.red('❌ package.json not found in the root directory.'));
        return;
      }

      const pkg = await fs.readJson(packageJsonPath);
      const scripts = pkg.scripts || {};

      const requiredScripts = ['dev', 'build', 'preview'];
      let allScriptsExist = true;

      for (const script of requiredScripts) {
        if (!scripts[script]) {
          console.log(chalk.red(`❌ Missing script in package.json: ${script}`));
          allScriptsExist = false;
        } else {
          console.log(chalk.green(`✅ Script found: ${script}`));
        }
      }

      if (!allScriptsExist) {
        console.log(chalk.yellow('⚠️ Please ensure all required scripts exist before generating deployment docs.'));
        return;
      }

      // Generate .env.mock
      const envMockPath = path.join(this.targetDir, '.env.mock');
      if (!(await fs.pathExists(envMockPath))) {
        await fs.writeFile(envMockPath, 'VITE_MOCK_ENABLE=true\n');
        console.log(chalk.green('✅ Generated: .env.mock'));
      } else {
        console.log(chalk.yellow(`⚠️ Skipped: .env.mock already exists`));
      }

      // Generate docs/deployment/09_deploy_guide.md
      const docsDir = path.join(this.targetDir, 'docs', 'deployment');
      await fs.ensureDir(docsDir);

      const deployGuidePath = path.join(docsDir, '09_deploy_guide.md');
      if (!(await fs.pathExists(deployGuidePath))) {
        const deployGuideContent = `# Deployment Guide

## Scripts

- **dev**: \`npm run dev\` - Start development server
- **build**: \`npm run build\` - Build for production
- **preview**: \`npm run preview\` - Locally preview production build

## Environment Variables

- \`.env.mock\`: Used to enable mock server.

## Deployment Steps

1. Install dependencies: \`npm install\`
2. Build the project: \`npm run build\`
3. Deploy the \`dist\` folder to your web server.
`;
        await fs.writeFile(deployGuidePath, deployGuideContent);
        console.log(chalk.green('✅ Generated: docs/deployment/09_deploy_guide.md'));
      } else {
        console.log(chalk.yellow('⚠️ Skipped: docs/deployment/09_deploy_guide.md already exists'));
      }

      console.log(chalk.green('\nDeployment stage completed successfully!'));
    } catch (error) {
      console.error(chalk.red('Failed to execute deployment stage:'), error);
    }
  }
}
