import { v4 as uuidv4 } from 'uuid';
import { basename } from 'node:path';
import type Database from 'better-sqlite3';
import type { Event, Session, Project, Capsule } from '@vrrbose/shared';
import { SessionManager } from './session/manager.js';
import { GitWatcher } from './watchers/git.js';
import { FsWatcher } from './watchers/fs.js';
import { TerminalWatcher } from './watchers/terminal.js';
import { TestRunWatcher } from './watchers/test.js';
import { AiPromptWatcher } from './watchers/ai-prompt.js';
import { injectContext } from './agent/context-injector.js';
import { insertProject, getProject, insertEvent, getEvents, insertCapsule, upsertFileSummary } from './db/client.js';
import { getConfigValue, loadMergedConfig } from './config/source.js';

type WeeklyCapsuleDay = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'off';

interface ProjectEntry {
  project: Project;
  sessionManager: SessionManager;
  gitWatcher: GitWatcher;
  fsWatcher: FsWatcher;
  terminalWatcher: TerminalWatcher;
  testRunWatcher: TestRunWatcher;
  aiPromptWatcher: AiPromptWatcher | null;
  weeklyCapsuleDay: WeeklyCapsuleDay;
  weeklyCapsuleTimer: ReturnType<typeof setInterval> | null;
  lastWeeklyTriggerDate: string | null;
}

export interface ProjectStatus {
  projectId: string;
  projectPath: string;
  projectName: string;
  activeSession: Session | null;
}

export class WatcherPool {
  private entries = new Map<string, ProjectEntry>(); // projectPath → entry

  constructor(
    private db: Database.Database,
    private onBroadcast: (event: Event) => void,
  ) {}

  addProject(projectPath: string): { projectId: string; projectName: string; created: boolean } {
    if (this.entries.has(projectPath)) {
      const existing = this.entries.get(projectPath)!;
      return { projectId: existing.project.id, projectName: existing.project.name, created: false };
    }

    // Get or create project record (getProject queries by root_path)
    let project = getProject(this.db, projectPath);
    let created = false;
    if (!project) {
      const name = basename(projectPath) || 'unnamed';
      project = {
        id: uuidv4(),
        name,
        type: 'other',
        stack: [],
        description: '',
        rootPath: projectPath,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      insertProject(this.db, project);
      created = true;
      console.log(`[pool] registered project: ${project.id} (${name})`);
    }

    const db = this.db;
    const projectId = project.id;
    const broadcast = this.onBroadcast;

    const sessionManager = new SessionManager(db, projectId, {
      onSessionClose: () => {
        injectContext(db, projectId, projectPath, { claudeCode: true }).catch(err =>
          console.error('[inject] context injection failed:', err)
        );
      },
    });
    sessionManager.start();

    const onEvent = (event: Event) => {
      if (event.type === 'terminal_command') {
        const command = typeof event.payload['command'] === 'string' ? event.payload['command'] : null;
        if (command) {
          testRunWatcher.handleTerminalCommand(command, event.timestamp);
        }
      }

      if (event.type === 'file_save') {
        sessionManager.updateSessionMetrics({ fileChurn: 1 });
      } else if (event.type === 'file_create' || event.type === 'file_delete') {
        sessionManager.updateSessionMetrics({ fileChurn: 3 });
      } else if (event.type === 'git_staged_diff') {
        const insertions = Number(event.payload['insertions'] ?? 0);
        const deletions = Number(event.payload['deletions'] ?? 0);
        const delta = Math.max(0, insertions + deletions);
        if (delta > 0) {
          sessionManager.updateSessionMetrics({ fileChurn: delta });
        }
      } else if (event.type === 'capsule_create') {
        this.generateCapsuleFromEvent(event);
      }

      const sessionId = sessionManager.getCurrentSessionId();
      if (sessionId) {
        db.prepare('UPDATE events SET session_id = ? WHERE id = ?').run(sessionId, event.id);
        this.updateFileSummaryCache(event, sessionId);
      }
      broadcast({ ...event, sessionId });
    };

    const mergedConfig = loadMergedConfig(projectPath);
    const stagedDiffMode = getConfigValue<'metadata_only' | 'enrich_with_ai' | 'off'>(mergedConfig, ['capture', 'staged_diffs']) ?? 'metadata_only';
    const terminalLogMode = getConfigValue<'all' | 'filtered'>(mergedConfig, ['capture', 'terminal_commands', 'log']) ?? 'all';
    const terminalFilterTrivial = getConfigValue<boolean>(mergedConfig, ['capture', 'terminal_commands', 'filter_trivial']) ?? true;
    const aiPromptCaptureEnabled = getConfigValue<boolean>(mergedConfig, ['capture', 'ai_prompts']) ?? true;
    const autoCapsuleOnMerge = getConfigValue<boolean>(mergedConfig, ['session', 'auto_capsule_on_merge']) ?? true;
    const autoCapsuleOnTag = getConfigValue<boolean>(mergedConfig, ['session', 'auto_capsule_on_tag']) ?? true;
    const weeklyCapsuleDay =
      getConfigValue<WeeklyCapsuleDay>(mergedConfig, ['session', 'weekly_capsule_day']) ??
      getConfigValue<WeeklyCapsuleDay>(mergedConfig, ['weekly_capsule_day']) ??
      'sunday';

    const gitWatcher = new GitWatcher({
      db,
      projectId,
      projectPath,
      onActivity: () => sessionManager.recordActivity(),
      onCommit: () => sessionManager.updateSessionMetrics({ commitCount: 1 }),
      onEvent,
      stagedDiffMode,
      autoCapsuleOnMerge,
      autoCapsuleOnTag,
    });

    const fsWatcher = new FsWatcher({
      db,
      projectId,
      projectPath,
      onActivity: () => sessionManager.recordActivity(),
      onEvent,
    });

    const terminalWatcher = new TerminalWatcher({
      db,
      projectId,
      onActivity: () => sessionManager.recordActivity(),
      onEvent,
      logMode: terminalLogMode,
      filterTrivial: terminalFilterTrivial,
    });

    const testRunWatcher = new TestRunWatcher({
      db,
      projectId,
      onActivity: () => sessionManager.recordActivity(),
      onEvent,
    });

    const aiPromptWatcher = aiPromptCaptureEnabled
      ? new AiPromptWatcher({
          db,
          projectId,
          onActivity: () => sessionManager.recordActivity(),
          onEvent,
        })
      : null;

    gitWatcher.start();
    fsWatcher.start();
    terminalWatcher.start();
    aiPromptWatcher?.start();

    const entry: ProjectEntry = {
      project,
      sessionManager,
      gitWatcher,
      fsWatcher,
      terminalWatcher,
      testRunWatcher,
      aiPromptWatcher,
      weeklyCapsuleDay,
      weeklyCapsuleTimer: null,
      lastWeeklyTriggerDate: null,
    };

    this.startWeeklyCapsuleSchedule(entry);
    this.entries.set(projectPath, entry);
    console.log(`[pool] watching ${projectPath} (${projectId.slice(0, 8)})`);
    return { projectId, projectName: project.name, created };
  }

  removeProject(projectPath: string): boolean {
    const entry = this.entries.get(projectPath);
    if (!entry) return false;
    entry.gitWatcher.stop();
    entry.fsWatcher.stop();
    entry.terminalWatcher.stop();
    entry.aiPromptWatcher?.stop();
    if (entry.weeklyCapsuleTimer) {
      clearInterval(entry.weeklyCapsuleTimer);
      entry.weeklyCapsuleTimer = null;
    }
    entry.sessionManager.stop();
    this.entries.delete(projectPath);
    console.log(`[pool] stopped watching ${projectPath}`);
    return true;
  }

  triggerManualCapsule(projectId: string, title?: string): boolean {
    const entry = this.findEntryByProjectId(projectId);
    if (!entry) return false;
    this.emitCapsuleTrigger(entry, 'manual', {
      title: title && title.trim().length > 0 ? title.trim() : `Manual capsule ${new Date().toISOString().slice(0, 10)}`,
    });
    return true;
  }

  getStatuses(): ProjectStatus[] {
    return Array.from(this.entries.entries()).map(([path, e]) => ({
      projectId: e.project.id,
      projectPath: path,
      projectName: e.project.name,
      activeSession: e.sessionManager.getActiveSession(),
    }));
  }

  /** Returns the active session for a given projectId (not path). */
  getActiveSessionForProject(projectId: string): Session | null {
    for (const entry of this.entries.values()) {
      if (entry.project.id === projectId) {
        return entry.sessionManager.getActiveSession();
      }
    }
    return null;
  }

  /** Returns the projectId for a given path, or null if not watched. */
  getProjectIdForPath(projectPath: string): string | null {
    return this.entries.get(projectPath)?.project.id ?? null;
  }

  stopAll(): void {
    for (const path of Array.from(this.entries.keys())) {
      this.removeProject(path);
    }
  }

  private findEntryByProjectId(projectId: string): ProjectEntry | null {
    for (const entry of this.entries.values()) {
      if (entry.project.id === projectId) return entry;
    }
    return null;
  }

  private startWeeklyCapsuleSchedule(entry: ProjectEntry): void {
    if (entry.weeklyCapsuleDay === 'off') return;

    this.checkWeeklyCapsule(entry);
    entry.weeklyCapsuleTimer = setInterval(() => {
      this.checkWeeklyCapsule(entry);
    }, 5 * 60_000);
  }

  private checkWeeklyCapsule(entry: ProjectEntry): void {
    const now = new Date();
    const today = this.dayName(now.getDay());
    if (today !== entry.weeklyCapsuleDay) return;

    const dateKey = now.toISOString().slice(0, 10);
    if (entry.lastWeeklyTriggerDate === dateKey) return;

    const recentCapsules = getEvents(this.db, entry.project.id, { type: 'capsule_create', limit: 200 });
    const alreadyCreatedToday = recentCapsules.some((event) => {
      const trigger = String(event.payload['trigger'] ?? '');
      const eventDate = new Date(event.timestamp).toISOString().slice(0, 10);
      return trigger === 'weekly' && eventDate === dateKey;
    });

    if (alreadyCreatedToday) {
      entry.lastWeeklyTriggerDate = dateKey;
      return;
    }

    this.emitCapsuleTrigger(entry, 'weekly', {
      title: `Weekly capsule ${dateKey}`,
      weekOf: dateKey,
    });
    entry.lastWeeklyTriggerDate = dateKey;
  }

  private emitCapsuleTrigger(
    entry: ProjectEntry,
    trigger: 'manual' | 'weekly',
    payload: Record<string, unknown>,
  ): void {
    const event: Event = {
      id: uuidv4(),
      projectId: entry.project.id,
      sessionId: entry.sessionManager.getCurrentSessionId(),
      type: 'capsule_create',
      timestamp: Date.now(),
      payload: {
        trigger,
        ...payload,
      },
      syncStatus: 'pending',
      createdAt: Date.now(),
    };

    insertEvent(this.db, event);
    this.generateCapsuleFromEvent(event);
    entry.sessionManager.recordActivity();
    this.onBroadcast(event);
  }

  private generateCapsuleFromEvent(event: Event): void {
    const trigger = String(event.payload['trigger'] ?? 'manual') as Capsule['trigger'];
    const title = String(event.payload['title'] ?? `${trigger} capsule`);
    const sessionId = event.sessionId;

    const recentEvents = getEvents(this.db, event.projectId, {
      ...(sessionId ? { sessionId } : {}),
      limit: 100,
    }).filter((e) => e.type !== 'capsule_create');

    const fileCounts = new Map<string, number>();
    for (const e of recentEvents) {
      const filePath = typeof e.payload['filePath'] === 'string' ? e.payload['filePath'] : null;
      if (filePath) {
        fileCounts.set(filePath, (fileCounts.get(filePath) ?? 0) + 1);
      }
      if (e.type === 'git_staged_diff' && Array.isArray(e.payload['files'])) {
        for (const file of e.payload['files'] as unknown[]) {
          if (typeof file === 'string') {
            fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
          }
        }
      }
    }

    const keyFiles = Array.from(fileCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path]) => path);

    const commitCount = recentEvents.filter((e) => e.type === 'git_commit').length;
    const testRunCount = recentEvents.filter((e) => e.type === 'test_run').length;
    const promptCount = recentEvents.filter((e) => e.type === 'ai_prompt').length;

    const summary = [
      `${title}.`,
      `Recent activity: ${commitCount} commit(s), ${testRunCount} test run(s), ${promptCount} AI prompt(s).`,
      keyFiles.length > 0 ? `Most active files: ${keyFiles.join(', ')}.` : 'No dominant files detected.',
    ].join(' ');

    const capsule: Capsule = {
      id: uuidv4(),
      projectId: event.projectId,
      sessionId,
      title,
      summary,
      keyFiles,
      decisions: [],
      openQuestions: [],
      createdAt: Date.now(),
      trigger,
      syncStatus: 'pending',
    };

    insertCapsule(this.db, capsule);
  }

  private updateFileSummaryCache(event: Event, sessionId: string): void {
    if (event.type === 'file_save' || event.type === 'file_create' || event.type === 'file_delete') {
      const filePath = typeof event.payload['filePath'] === 'string' ? event.payload['filePath'] : null;
      if (!filePath) return;

      upsertFileSummary(this.db, {
        projectId: event.projectId,
        sessionId,
        filePath,
        linesAdded: event.type === 'file_delete' ? 0 : 1,
        linesRemoved: event.type === 'file_delete' ? 1 : 0,
        timestamp: event.timestamp,
      });
      return;
    }

    if (event.type === 'git_staged_diff') {
      const fileStats = Array.isArray(event.payload['fileStats']) ? event.payload['fileStats'] as Array<Record<string, unknown>> : [];
      for (const fileStat of fileStats) {
        const filePath = typeof fileStat['file'] === 'string' ? fileStat['file'] : null;
        if (!filePath) continue;

        upsertFileSummary(this.db, {
          projectId: event.projectId,
          sessionId,
          filePath,
          linesAdded: Number(fileStat['insertions'] ?? 0),
          linesRemoved: Number(fileStat['deletions'] ?? 0),
          timestamp: event.timestamp,
        });
      }
    }
  }

  private dayName(day: number): WeeklyCapsuleDay {
    const names: WeeklyCapsuleDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return names[day] ?? 'sunday';
  }
}
