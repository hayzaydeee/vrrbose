import { readFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Event } from '@vrrbose/shared';
import { insertEvent } from '../db/client.js';

interface AiPromptWatcherOptions {
  db: Database.Database;
  projectId: string;
  onActivity: () => void;
  onEvent: (event: Event) => void;
  logPath?: string;
  pollIntervalMs?: number;
}

const SECRET_ASSIGNMENT_REDACT_RE = /\b([a-z0-9_]*?(api[_-]?key|token|secret|password|passwd|pwd))\s*=\s*([^\s]+)/ig;
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/i;

export class AiPromptWatcher {
  private opts: AiPromptWatcherOptions;
  private interval: ReturnType<typeof setInterval> | null = null;
  private byteOffset = 0;

  constructor(opts: AiPromptWatcherOptions) {
    this.opts = opts;
  }

  start(): void {
    this.resetOffset();
    this.interval = setInterval(() => this.poll(), this.opts.pollIntervalMs ?? 1000);
    console.log('[ai-prompt] watcher started');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private getLogPath(): string {
    return this.opts.logPath ?? process.env['VRRBOSE_AI_PROMPT_LOG_PATH'] ?? join(homedir(), '.vrrbose', 'ai-prompts.log');
  }

  private resetOffset(): void {
    const logPath = this.getLogPath();
    if (!existsSync(logPath)) {
      this.byteOffset = 0;
      return;
    }
    this.byteOffset = statSync(logPath).size;
  }

  private poll(): void {
    const logPath = this.getLogPath();
    if (!existsSync(logPath)) return;

    const size = statSync(logPath).size;
    if (size < this.byteOffset) this.byteOffset = 0;
    if (size === this.byteOffset) return;

    const content = readFileSync(logPath, 'utf8');
    const chunk = content.slice(this.byteOffset);
    this.byteOffset = size;

    for (const rawLine of chunk.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      this.emitPrompt(line);
    }
  }

  private emitPrompt(line: string): void {
    const now = Date.now();

    let payload: Record<string, unknown> = {
      prompt: line.slice(0, 2000),
      source: 'ai_prompt_log',
    };

    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      payload = {
        prompt: typeof parsed['prompt'] === 'string' ? this.sanitizePrompt(parsed['prompt']).slice(0, 2000) : '',
        toolCalls: Array.isArray(parsed['toolCalls']) ? parsed['toolCalls'] : [],
        files: Array.isArray(parsed['files']) ? parsed['files'] : [],
        source: parsed['source'] ?? 'ai_prompt_log',
      };
    } catch {
      // Plain text line fallback.
      payload = {
        prompt: this.sanitizePrompt(line).slice(0, 2000),
        source: 'ai_prompt_log',
      };
    }

    const event: Event = {
      id: uuidv4(),
      projectId: this.opts.projectId,
      sessionId: null,
      type: 'ai_prompt',
      timestamp: now,
      payload,
      syncStatus: 'pending',
      createdAt: now,
    };

    insertEvent(this.opts.db, event);
    this.opts.onActivity();
    this.opts.onEvent(event);
  }

  private sanitizePrompt(prompt: string): string {
    let sanitized = prompt.replace(SECRET_ASSIGNMENT_REDACT_RE, '$1=<redacted>');
    if (PRIVATE_KEY_RE.test(sanitized)) {
      sanitized = '[redacted private key material]';
    }
    return sanitized;
  }
}
