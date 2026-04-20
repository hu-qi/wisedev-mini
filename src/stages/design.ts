import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export class DesignStage {
  private templatesDir = path.join(__dirname, '..', '..', 'templates', 'design');
  private targetDir = path.join(process.cwd(), 'docs', 'design');

  public async execute(): Promise<void> {
    console.log(chalk.blue('Starting Design Stage...'));

    try {
      // Check if templates exist
      if (!(await fs.pathExists(this.templatesDir))) {
        console.log(chalk.red(`Templates directory not found: ${this.templatesDir}`));
        console.log(chalk.yellow('Please ensure templates exist before running this stage.'));
        return;
      }

      // Ensure target directory exists
      await fs.ensureDir(this.targetDir);

      const files = [
        '05_data_model.md',
        '06_solution_outline.md',
        '07_detailed_design.md',
        '08_prototype_design.md',
        'openapi.yaml'
      ];

      for (const file of files) {
        const src = path.join(this.templatesDir, file);
        const dest = path.join(this.targetDir, file);

        if (await fs.pathExists(src)) {
          if (!(await fs.pathExists(dest))) {
            await fs.copy(src, dest);
            console.log(chalk.green(`✅ Scaffolded: ${file}`));
          } else {
            console.log(chalk.yellow(`⚠️ Skipped: ${file} already exists`));
          }
        } else {
          console.log(chalk.red(`❌ Template not found: ${file}`));
        }
      }

      console.log(chalk.green('\nDesign stage scaffolded successfully!'));
      console.log(chalk.cyan(`Documents are available in: ${this.targetDir}`));
    } catch (error) {
      console.error(chalk.red('Failed to execute design stage:'), error);
    }
  }
}
