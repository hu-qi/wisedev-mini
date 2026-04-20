import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { DeliveryState } from './types';

const STATE_DIR = path.join(process.cwd(), '.pi-mini');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

export const defaultState: DeliveryState = {
  currentStage: 'init',
  artifacts: {
    hasPrd: false,
    hasDesign: false,
    hasSourceCode: false,
    hasTests: false,
  },
  lastUpdated: new Date().toISOString(),
};

export class StateManager {
  static async load(): Promise<DeliveryState> {
    try {
      if (existsSync(STATE_FILE)) {
        const fileContent = await fs.readFile(STATE_FILE, 'utf-8');
        const data = JSON.parse(fileContent);
        return { ...defaultState, ...data };
      }
    } catch (error) {
      console.error('Failed to load state, returning default.', error);
    }
    return defaultState;
  }

  static async save(state: DeliveryState): Promise<void> {
    try {
      if (!existsSync(STATE_DIR)) {
        await fs.mkdir(STATE_DIR, { recursive: true });
      }
      state.lastUpdated = new Date().toISOString();
      await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save state.', error);
    }
  }
}
