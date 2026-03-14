import { execSync } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import type { Event } from '@vrrbose/shared';
import { SESSION_DEFAULTS } from '@vrrbose/shared';
import type Database from 'better-sqlite3';
import { insertEvent } from '../db/client.js';

interface GitWatcherOptions {
  db: Database.Database;
  projectId: string;
  projectPath: string;
  onActivity: () => void;
  onEvent: (event: Event) => void;
  pollIntervalMs?: number;
}

export class GitWatcher {
  private opts: GitWatcherOptions;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastCommitHash: string | null = null;
  private currentBranch: string | null = null;

  constructor(opts: GitWatcherOptions) {
    this.opts = opts;
  }

  start(): void {
    this.poll(); // immediate first poll
    this.interval = setInterval(
      () => this.poll(),
      this.opts.pollIntervalMs ?? SESSION_DEFAULTS.GIT_POLL_INTERVAL_MS
    );
    console.log('[git] watcher started');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private exec(cmd: string): string {
    try {
      return execSync(cmd, { cwd: this.opts.projectPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
      return '';
    }
  }

  private poll(): void {
    try {
      this.checkCommits();
      this.checkBranch();
    } catch (err) {
      console.error('[git] poll error:', err);
    }
  }

  private checkCommits(): void {
    const hash = this.exec('git rev-parse HEAD');
    if (!hash || hash === this.lastCommitHash) return;

    if (this.lastCommitHash !== null) {
      // New commit since last poll
      const log = this.exec(`git log --format="%H|%s|%ae|%at" -1`);
      const [commitHash, message, author, tsStr] = log.split('|');
      const stat = this.exec('git diff --stat HEAD~1 HEAD 2>/dev/null || echo ""');

      const event: Event = {
        id: uuidv4(),
        projectId: this.opts.projectId,
        sessionId: null, // filled in by daemon entry point
        type: 'git_commit',
        timestamp: (tsStr ? parseInt(tsStr, 10) * 1000 : Date.now()),
        payload: {
          hash: commitHash,
          message,
          author,
          stat,
        },
        syncStatus: 'pending',
        createdAt: Date.now(),
      };

      insertEvent(this.opts.db, event);
      this.opts.onActivity();
      this.opts.onEvent(event);
      console.log(`[git] commit: ${message?.slice(0, 60)}`);
    }

    this.lastCommitHash = hash;
  }

  private checkBranch(): void {
    const branch = this.exec('git rev-parse --abbrev-ref HEAD');
    if (!branch) return;

    if (this.currentBranch !== null && branch !== this.currentBranch) {
      const event: Event = {
        id: uuidv4(),
        projectId: this.opts.projectId,
        sessionId: null,
        type: 'git_branch_create',
        timestamp: Date.now(),
        payload: { from: this.currentBranch, to: branch },
        syncStatus: 'pending',
        createdAt: Date.now(),
      };

      insertEvent(this.opts.db, event);
      this.opts.onActivity();
      this.opts.onEvent(event);
      console.log(`[git] branch changed: ${this.currentBranch} → ${branch}`);
    }

    this.currentBranch = branch;
  }
}
