import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import type { RunTraceEvent } from '../contracts/trace';

export class TraceReader {
  private runsDir: string;

  constructor(workspaceRoot: string) {
    this.runsDir = path.join(workspaceRoot, '.pi-mini', 'agent', 'runs');
  }

  public async readTrace(runId: string): Promise<RunTraceEvent[]> {
    const traceFile = path.join(this.runsDir, `${runId}.jsonl`);
    if (!(await fs.pathExists(traceFile))) {
      throw new Error(`Trace file not found: ${traceFile}`);
    }

    const events: RunTraceEvent[] = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(traceFile),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch (err) {
        console.warn(`Failed to parse trace line in ${runId}:`, line);
      }
    }

    return events;
  }
}
