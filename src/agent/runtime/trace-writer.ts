import fs from 'fs-extra';
import path from 'path';
import type { RunTraceEvent } from '../contracts/trace';

export class TraceWriter {
  private filePath: string;

  public constructor(private baseDir: string, private runId: string) {
    this.filePath = path.join(baseDir, 'runs', `${runId}.jsonl`);
  }

  public async init(): Promise<void> {
    await fs.ensureDir(path.dirname(this.filePath));
    await fs.ensureFile(this.filePath);
  }

  public async append(event: RunTraceEvent): Promise<void> {
    await fs.appendFile(this.filePath, JSON.stringify(event) + '\n', { encoding: 'utf-8' });
  }
}

