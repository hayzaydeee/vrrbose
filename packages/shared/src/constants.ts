export const DAEMON_PORT = 7331;
export const MCP_PORT = 7332;
export const DAEMON_VERSION = '0.1.0';

export const EVENT_TYPES = {
  GIT_COMMIT: 'git_commit',
  GIT_BRANCH_CREATE: 'git_branch_create',
  GIT_MERGE: 'git_merge',
  GIT_TAG: 'git_tag',
  GIT_STAGED_DIFF: 'git_staged_diff',
  FILE_SAVE: 'file_save',
  FILE_CREATE: 'file_create',
  FILE_DELETE: 'file_delete',
  TEST_RUN: 'test_run',
  TERMINAL_COMMAND: 'terminal_command',
  AI_PROMPT: 'ai_prompt',
  SESSION_OPEN: 'session_open',
  SESSION_CLOSE: 'session_close',
  CAPSULE_CREATE: 'capsule_create',
} as const;

export const QUERY_TYPES = {
  RETROSPECTIVE: 'RETROSPECTIVE',
  METRICS: 'METRICS',
  DOCUMENT_GEN: 'DOCUMENT_GEN',
  REPLAY: 'REPLAY',
  CAPSULE: 'CAPSULE',
  REASONING: 'REASONING',
  CONFIG: 'CONFIG',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
} as const;

export const SESSION_DEFAULTS = {
  IDLE_THRESHOLD_HOURS: 2,
  IDLE_KEYBOARD_MINUTES: 30,
  GIT_POLL_INTERVAL_MS: 30_000,
  SCORE_WEIGHTS: {
    commitCount: 10,
    activeTimeHours: 5,
    fileChurnLines: 0.01,
  },
} as const;

export const CONTEXT_INJECTION = {
  BLOCK_START: '<!-- VRRBOSE:context -->',
  BLOCK_END: '<!-- /VRRBOSE:context -->',
  MAX_WORDS: 400,
  TARGETS: ['CLAUDE.md', '.cursor/rules', '.github/copilot-instructions.md', '.vrrbose/context.md'],
} as const;

export const TRIVIAL_COMMANDS = new Set([
  'ls', 'ls -la', 'ls -l', 'll', 'la',
  'cd', 'pwd', 'clear', 'cls', 'exit',
  'echo', 'cat', 'less', 'more', 'head', 'tail',
  'history', 'which', 'where',
]);

export const DEFAULT_CONFIG = {
  daemonPort: DAEMON_PORT,
  idleThresholdHours: SESSION_DEFAULTS.IDLE_THRESHOLD_HOURS,
  idleKeyboardMinutes: SESSION_DEFAULTS.IDLE_KEYBOARD_MINUTES,
  autoCapsuleOnMerge: true,
  autoCapsuleOnTag: true,
  weeklyCapsuleDay: 'sunday' as const,
  captureConfig: {
    stagedDiffs: 'metadata_only' as const,
    terminalCommands: { log: 'all' as const, filterTrivial: true },
    aiPrompts: true,
    testRuns: true,
    fileEdits: { debounceMinutes: 3 },
  },
  aiConfig: {
    primary: 'claude' as const,
    ollamaModel: 'llama3',
    showModelIndicator: true,
  },
} as const;
