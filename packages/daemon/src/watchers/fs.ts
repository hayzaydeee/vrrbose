import chokidar from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Event } from '@vrrbose/shared';
import type Database from 'better-sqlite3';
import { insertEvent } from '../db/client.js';

interface FsWatcherOptions {
  db: Database.Database;
  projectId: string;
  projectPath: string;
  onActivity: () => void;
  onEvent: (event: Event) => void;
  debounceMs?: number;
}

export class FsWatcher {
  private opts: FsWatcherOptions;
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(opts: FsWatcherOptions) {
    this.opts = opts;
  }

  start(): void {
    const ignoredPatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/.next/**',
      '**/*.log',
    ];

    // Also respect .gitignore if it exists
    const gitignorePath = join(this.opts.projectPath, '.gitignore');

    this.watcher = chokidar.watch(this.opts.projectPath, {
      ignored: ignoredPatterns,
      ignoreInitial: true,
      persistent: true,
      usePolling: false,
    });

    this.watcher
      .on('add', (filePath) => this.emitEvent('file_create', filePath))
      .on('change', (filePath) => this.emitFileChange(filePath))
      .on('unlink', (filePath) => this.emitEvent('file_delete', filePath))
      .on('error', (err) => console.error('[fs] watcher error:', err));

    console.log('[fs] watcher started');
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private emitEvent(type: Event['type'], filePath: string): void {
    const relativePath = filePath.replace(this.opts.projectPath, '').replace(/^[/\\]/, '');
    const event: Event = {
      id: uuidv4(),
      projectId: this.opts.projectId,
      sessionId: null,
      type,
      timestamp: Date.now(),
      payload: { filePath: relativePath },
      syncStatus: 'pending',
      createdAt: Date.now(),
    };
    insertEvent(this.opts.db, event);
    this.opts.onActivity();
    this.opts.onEvent(event);
  }

  private emitFileChange(filePath: string): void {
    // Debounce file saves by path
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    const debounceMs = this.opts.debounceMs ?? 3000;
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.emitEvent('file_save', filePath);
    }, debounceMs);

    this.debounceTimers.set(filePath, timer);
  }
}
