import { z } from 'zod';

export const EventTypeSchema = z.enum([
  'git_commit',
  'git_branch_create',
  'git_merge',
  'git_tag',
  'git_staged_diff',
  'file_save',
  'file_create',
  'file_delete',
  'test_run',
  'terminal_command',
  'ai_prompt',
  'session_open',
  'session_close',
  'capsule_create',
]);

export const SyncStatusSchema = z.enum(['pending', 'synced', 'failed']);

export const EventSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  sessionId: z.string().uuid().nullable(),
  type: EventTypeSchema,
  timestamp: z.number().int().positive(),
  payload: z.record(z.unknown()),
  syncStatus: SyncStatusSchema,
  createdAt: z.number().int().positive(),
});

export const SessionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  startedAt: z.number().int().positive(),
  endedAt: z.number().int().positive().nullable(),
  idleThresholdMs: z.number().int().positive(),
  score: z.number().nullable(),
  commitCount: z.number().int().min(0),
  fileChurn: z.number().int().min(0),
  activeTimeMs: z.number().int().min(0),
  summary: z.string().nullable(),
  syncStatus: SyncStatusSchema,
});

export const CapsuleSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  sessionId: z.string().uuid().nullable(),
  title: z.string().min(1),
  summary: z.string(),
  keyFiles: z.array(z.string()),
  decisions: z.array(z.string()),
  openQuestions: z.array(z.string()),
  createdAt: z.number().int().positive(),
  trigger: z.enum(['manual', 'merge', 'tag', 'weekly']),
  syncStatus: SyncStatusSchema,
});

export const AgentRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
  format: z.enum(['cli', 'web']).optional().default('cli'),
});

export const CaptureConfigSchema = z.object({
  stagedDiffs: z.enum(['metadata_only', 'enrich_with_ai', 'off']),
  terminalCommands: z.object({
    log: z.enum(['all', 'filtered']),
    filterTrivial: z.boolean(),
  }),
  aiPrompts: z.boolean(),
  testRuns: z.boolean(),
  fileEdits: z.object({ debounceMinutes: z.number().int().min(1) }),
});

export const ConfigSchema = z.object({
  projectId: z.string(),
  daemonPort: z.number().int().min(1024).max(65535),
  idleThresholdHours: z.number().positive(),
  idleKeyboardMinutes: z.number().int().positive(),
  autoCapsuleOnMerge: z.boolean(),
  autoCapsuleOnTag: z.boolean(),
  weeklyCapsuleDay: z.enum([
    'sunday','monday','tuesday','wednesday','thursday','friday','saturday','off',
  ]),
  captureConfig: CaptureConfigSchema,
  aiConfig: z.object({
    primary: z.enum(['claude', 'ollama']),
    ollamaModel: z.string(),
    showModelIndicator: z.boolean(),
  }),
});
