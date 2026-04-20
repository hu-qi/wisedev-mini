import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export class TestingStage {
  private targetDir = process.cwd();

  public async execute(): Promise<void> {
    console.log(chalk.blue('Starting Testing Stage...'));

    try {
      const testsDir = path.join(this.targetDir, 'tests');
      await fs.ensureDir(testsDir);

      const smokeTestPath = path.join(testsDir, 'smoke.spec.ts');
      if (!(await fs.pathExists(smokeTestPath))) {
        const testContent = `import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../src/App.vue';

describe('App.vue', () => {
  it('renders correctly', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('pi-mini Prototype');
  });
});
`;
        await fs.writeFile(smokeTestPath, testContent, { encoding: 'utf-8' });
        console.log(chalk.green('✅ Scaffolded: tests/smoke.spec.ts'));
      } else {
        console.log(chalk.yellow('⚠️ Skipped: tests/smoke.spec.ts already exists'));
      }

      console.log(chalk.green('\nTesting stage scaffolded successfully!'));
    } catch (error) {
      console.error(chalk.red('Failed to execute testing stage:'), error);
    }
  }
}
