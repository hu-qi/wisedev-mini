import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export class DevelopmentStage {
  private templatesDir = path.join(__dirname, '..', '..', 'templates', 'vue-prototype');
  private targetDir = process.cwd();

  public async execute(): Promise<void> {
    console.log(chalk.blue('Starting Development Stage...'));

    try {
      if (!(await fs.pathExists(this.templatesDir))) {
        console.log(chalk.red(`Templates directory not found: ${this.templatesDir}`));
        console.log(chalk.yellow('Please ensure templates exist before running this stage.'));
        return;
      }

      const items = await fs.readdir(this.templatesDir);
      for (const item of items) {
        const src = path.join(this.templatesDir, item);
        const dest = path.join(this.targetDir, item);

        await fs.copy(src, dest, {
          overwrite: false,
          errorOnExist: false
        });
        console.log(chalk.green(`✅ Scaffolded: ${item}`));
      }

      console.log(chalk.green('\nDevelopment stage scaffolded successfully!'));
    } catch (error) {
      console.error(chalk.red('Failed to execute development stage:'), error);
    }
  }
}
