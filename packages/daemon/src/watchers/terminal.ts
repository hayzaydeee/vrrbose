import { readFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Event } from '@vrrbose/shared';
import { TRIVIAL_COMMANDS } from '@vrrbose/shared';
import { insertEvent } from '../db/client.js';

interface TerminalWatcherOptions {
  db: Database.Database;
  projectId: string;
  onActivity: () => void;
  onEvent: (event: Event) => void;
  logPath?: string;
  pollIntervalMs?: number;
  logMode?: 'all' | 'filtered';
  filterTrivial?: boolean;
}

const SECRET_ASSIGNMENT_TEST_RE = /\b([a-z0-9_]*?(api[_-]?key|token|secret|password|passwd|pwd))\s*=\s*([^\s]+)/i;
const SECRET_ASSIGNMENT_REDACT_RE = /\b([a-z0-9_]*?(api[_-]?key|token|secret|password|passwd|pwd))\s*=\s*([^\s]+)/ig;
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/i;

export class TerminalWatcher {
  private opts: TerminalWatcherOptions;
  private interval: ReturnType<typeof setInterval> | null = null;
  private byteOffset = 0;

  constructor(opts: TerminalWatcherOptions) {
    this.opts = opts;
  }

  start(): void {
    this.resetOffset();
    this.interval = setInterval(() => this.poll(), this.opts.pollIntervalMs ?? 1000);
    console.log('[terminal] watcher started');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private getLogPath(): string {
    return this.opts.logPath ?? process.env['VRRBOSE_TERMINAL_LOG_PATH'] ?? join(homedir(), '.vrrbose', 'terminal.log');
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
    if (size < this.byteOffset) {
      this.byteOffset = 0;
    }
    if (size === this.byteOffset) return;

    const content = readFileSync(logPath, 'utf8');
    const chunk = content.slice(this.byteOffset);
    this.byteOffset = size;

    for (const rawLine of chunk.split(/\r?\n/)) {
      const command = rawLine.trim();
      if (!command) continue;
      if (!this.shouldCapture(command)) continue;
      this.emitCommand(command);
    }
  }

  private shouldCapture(command: string): boolean {
    if (this.isSensitive(command)) return false;
    if (this.opts.logMode !== 'filtered') return true;
    if (!this.opts.filterTrivial) return true;

    const normalized = command.toLowerCase().replace(/\s+/g, ' ').trim();
    if (TRIVIAL_COMMANDS.has(normalized)) return false;

    const base = normalized.split(' ')[0] ?? normalized;
    return !TRIVIAL_COMMANDS.has(base);
  }

  private isSensitive(command: string): boolean {
    const normalized = command.toLowerCase();
    if (PRIVATE_KEY_RE.test(command)) return true;
    if (SECRET_ASSIGNMENT_TEST_RE.test(command)) return true;
    if (normalized.includes('authorization: bearer ')) return true;
    if (normalized.includes(' setx ') && /(token|secret|password|api[_-]?key)/i.test(command)) return true;
    return false;
  }

  private sanitizeCommand(command: string): string {
    return command.replace(SECRET_ASSIGNMENT_REDACT_RE, '$1=<redacted>');
  }

  private emitCommand(command: string): void {
    const now = Date.now();
    const sanitizedCommand = this.sanitizeCommand(command);
    const event: Event = {
      id: uuidv4(),
      projectId: this.opts.projectId,
      sessionId: null,
      type: 'terminal_command',
      timestamp: now,
      payload: { command: sanitizedCommand, source: 'terminal_log' },
      syncStatus: 'pending',
      createdAt: now,
    };

    insertEvent(this.opts.db, event);
    this.opts.onActivity();
    this.opts.onEvent(event);
  }
}
