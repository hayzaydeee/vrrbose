import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Event } from '@vrrbose/shared';
import { insertEvent } from '../db/client.js';

interface TestRunWatcherOptions {
  db: Database.Database;
  projectId: string;
  onActivity: () => void;
  onEvent: (event: Event) => void;
}

export class TestRunWatcher {
  private opts: TestRunWatcherOptions;

  constructor(opts: TestRunWatcherOptions) {
    this.opts = opts;
  }

  handleTerminalCommand(command: string, timestamp = Date.now()): void {
    const normalized = command.toLowerCase().replace(/\s+/g, ' ').trim();
    const runner = detectRunner(normalized);
    if (!runner) return;

    const event: Event = {
      id: uuidv4(),
      projectId: this.opts.projectId,
      sessionId: null,
      type: 'test_run',
      timestamp,
      payload: {
        runner,
        command,
        status: 'started',
      },
      syncStatus: 'pending',
      createdAt: Date.now(),
    };

    insertEvent(this.opts.db, event);
    this.opts.onActivity();
    this.opts.onEvent(event);
  }
}

function detectRunner(command: string): string | null {
  if (command.includes('vitest')) return 'vitest';
  if (command.includes('jest')) return 'jest';
  if (command.includes('pytest') || command.includes(' py.test')) return 'pytest';
  if (command.startsWith('go test') || command.includes(' go test')) return 'go-test';
  if (command.startsWith('cargo test') || command.includes(' cargo test')) return 'cargo-test';

  const scriptBased = [
    'npm test',
    'pnpm test',
    'yarn test',
    'bun test',
    'npm run test',
    'pnpm run test',
    'yarn run test',
    'bun run test',
  ];

  for (const marker of scriptBased) {
    if (command.startsWith(marker)) return 'test-script';
  }

  return null;
}
