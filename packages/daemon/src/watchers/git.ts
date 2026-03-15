import { simpleGit } from 'simple-git';
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
  private git: ReturnType<typeof simpleGit>;

  constructor(opts: GitWatcherOptions) {
    this.opts = opts;
    this.git = simpleGit(opts.projectPath);
  }

  start(): void {
    void this.poll(); // immediate first poll
    this.interval = setInterval(
      () => void this.poll(),
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

  private async poll(): Promise<void> {
    try {
      await this.checkCommits();
      await this.checkBranch();
    } catch (err) {
      console.error('[git] poll error:', err);
    }
  }

  private async checkCommits(): Promise<void> {
    let hash: string;
    try {
      hash = await this.git.revparse(['HEAD']);
    } catch {
      return;
    }
    if (!hash || hash === this.lastCommitHash) {
      this.lastCommitHash = hash || this.lastCommitHash;
      return;
    }

    if (this.lastCommitHash !== null) {
      // New commit since last poll
      const log = await this.git.log({ maxCount: 1, format: { hash: '%H', message: '%s', author: '%ae', timestamp: '%at' } });
      const latest = log.latest;
      if (!latest) return;

      const diff = await this.git.diffSummary(['HEAD~1', 'HEAD']).catch(() => null);
      const stat = diff
        ? `${diff.files.length} file(s) changed, ${diff.insertions} insertion(s), ${diff.deletions} deletion(s)`
        : '';

      const event: Event = {
        id: uuidv4(),
        projectId: this.opts.projectId,
        sessionId: null,
        type: 'git_commit',
        timestamp: (latest.timestamp ? parseInt(latest.timestamp as string, 10) * 1000 : Date.now()),
        payload: {
          hash: latest.hash,
          message: latest.message,
          author: latest.author,
          stat,
        },
        syncStatus: 'pending',
        createdAt: Date.now(),
      };

      insertEvent(this.opts.db, event);
      this.opts.onActivity();
      this.opts.onEvent(event);
      console.log(`[git] commit: ${latest.message?.slice(0, 60)}`);
    }

    this.lastCommitHash = hash;
  }

  private async checkBranch(): Promise<void> {
    let branch: string;
    try {
      branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    } catch {
      return;
    }
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
