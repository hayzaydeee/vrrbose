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
  onCommit?: () => void;
  onEvent: (event: Event) => void;
  pollIntervalMs?: number;
  stagedDiffMode?: 'metadata_only' | 'enrich_with_ai' | 'off';
  autoCapsuleOnMerge?: boolean;
  autoCapsuleOnTag?: boolean;
}

export class GitWatcher {
  private opts: GitWatcherOptions;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastCommitHash: string | null = null;
  private currentBranch: string | null = null;
  private lastStagedSignature: string | null = null;
  private lastTagAtHead: string | null = null;
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
      await this.checkStagedDiff();
      await this.checkTagAtHead();
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
      this.opts.onCommit?.();
      this.opts.onEvent(event);
      console.log(`[git] commit: ${latest.message?.slice(0, 60)}`);

      if (latest.message?.toLowerCase().startsWith('merge ')) {
        this.emitSimpleEvent('git_merge', { hash: latest.hash, message: latest.message });
        if (this.opts.autoCapsuleOnMerge ?? true) {
          this.emitSimpleEvent('capsule_create', { trigger: 'merge', hash: latest.hash, title: `Merge capsule ${latest.hash.slice(0, 8)}` });
        }
      }
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

  private async checkStagedDiff(): Promise<void> {
    if ((this.opts.stagedDiffMode ?? 'metadata_only') === 'off') return;

    const summary = await this.git.diffSummary(['--staged']).catch(() => null);
    if (!summary) return;

    const fileStats = summary.files.map((f) => ({
      file: f.file,
      insertions: typeof (f as { insertions?: unknown }).insertions === 'number'
        ? (f as { insertions: number }).insertions
        : 0,
      deletions: typeof (f as { deletions?: unknown }).deletions === 'number'
        ? (f as { deletions: number }).deletions
        : 0,
    }));

    const signature = JSON.stringify({
      files: fileStats,
      insertions: summary.insertions,
      deletions: summary.deletions,
    });

    if (signature === this.lastStagedSignature) return;
    this.lastStagedSignature = signature;

    if (summary.files.length === 0 && summary.insertions === 0 && summary.deletions === 0) {
      return;
    }

    const payload: Record<string, unknown> = {
      files: summary.files.map((f) => f.file),
      fileStats,
      insertions: summary.insertions,
      deletions: summary.deletions,
      mode: this.opts.stagedDiffMode ?? 'metadata_only',
    };

    if ((this.opts.stagedDiffMode ?? 'metadata_only') === 'enrich_with_ai') {
      payload['context'] = 'staged diff captured; AI enrichment pending';
    }

    this.emitSimpleEvent('git_staged_diff', payload);
  }

  private async checkTagAtHead(): Promise<void> {
    let tag = '';
    try {
      tag = await this.git.raw(['describe', '--tags', '--exact-match']).then((v) => v.trim());
    } catch {
      tag = '';
    }

    if (!tag || tag === this.lastTagAtHead) {
      this.lastTagAtHead = tag || this.lastTagAtHead;
      return;
    }

    this.lastTagAtHead = tag;
    this.emitSimpleEvent('git_tag', { tag });
    if (this.opts.autoCapsuleOnTag ?? true) {
      this.emitSimpleEvent('capsule_create', { trigger: 'tag', tag, title: `Tag capsule ${tag}` });
    }
  }

  private emitSimpleEvent(type: Event['type'], payload: Record<string, unknown>): void {
    const event: Event = {
      id: uuidv4(),
      projectId: this.opts.projectId,
      sessionId: null,
      type,
      timestamp: Date.now(),
      payload,
      syncStatus: 'pending',
      createdAt: Date.now(),
    };

    insertEvent(this.opts.db, event);
    this.opts.onActivity();
    this.opts.onEvent(event);
  }
}
