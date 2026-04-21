import chalk from 'chalk';

export const Logger = {
  isJson: false,
  isQuiet: false,
  isVerbose: false,

  setup(opts: { json?: boolean; quiet?: boolean; verbose?: boolean }) {
    this.isJson = !!opts.json;
    this.isQuiet = !!opts.quiet;
    this.isVerbose = !!opts.verbose;
  },

  info(msg: string) {
    if (this.isJson || this.isQuiet) return;
    console.log(msg);
  },

  success(msg: string) {
    if (this.isJson || this.isQuiet) return;
    console.log(chalk.green(msg));
  },

  warn(msg: string) {
    if (this.isJson || this.isQuiet) return;
    console.log(chalk.yellow(msg));
  },

  error(msg: string) {
    if (this.isJson) return;
    console.error(chalk.red(msg));
  },

  verbose(msg: string) {
    if (this.isJson || this.isQuiet || !this.isVerbose) return;
    console.log(chalk.dim(msg));
  },

  printJson(data: any) {
    if (this.isJson) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
};
