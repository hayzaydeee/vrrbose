// Core entity interfaces for Vrrbose

export type EventType =
  | 'git_commit'
  | 'git_branch_create'
  | 'git_merge'
  | 'git_tag'
  | 'git_staged_diff'
  | 'file_save'
  | 'file_create'
  | 'file_delete'
  | 'test_run'
  | 'terminal_command'
  | 'ai_prompt'
  | 'session_open'
  | 'session_close'
  | 'capsule_create';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface Event {
  id: string;                    // UUID
  projectId: string;
  sessionId: string | null;
  type: EventType;
  timestamp: number;             // Unix ms
  payload: Record<string, unknown>;
  syncStatus: SyncStatus;
  createdAt: number;
}

export interface Session {
  id: string;                    // UUID
  projectId: string;
  startedAt: number;             // Unix ms
  endedAt: number | null;
  idleThresholdMs: number;
  score: number | null;
  commitCount: number;
  fileChurn: number;             // lines changed
  activeTimeMs: number;
  summary: string | null;
  syncStatus: SyncStatus;
}

export interface FileSummary {
  id: string;
  projectId: string;
  sessionId: string;
  filePath: string;
  editCount: number;
  linesAdded: number;
  linesRemoved: number;
  firstEditAt: number;
  lastEditAt: number;
}

export interface Capsule {
  id: string;
  projectId: string;
  sessionId: string | null;
  title: string;
  summary: string;
  keyFiles: string[];
  decisions: string[];
  openQuestions: string[];
  createdAt: number;
  trigger: 'manual' | 'merge' | 'tag' | 'weekly';
  syncStatus: SyncStatus;
}

export interface Project {
  id: string;
  name: string;
  type: 'web-app' | 'api' | 'cli' | 'library' | 'monorepo' | 'other';
  stack: string[];
  description: string;
  rootPath: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface Config {
  projectId: string;
  daemonPort: number;
  idleThresholdHours: number;
  idleKeyboardMinutes: number;
  autoCapsuleOnMerge: boolean;
  autoCapsuleOnTag: boolean;
  weeklyCapsuleDay: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'off';
  captureConfig: CaptureConfig;
  aiConfig: AIConfig;
}

export interface CaptureConfig {
  stagedDiffs: 'metadata_only' | 'enrich_with_ai' | 'off';
  terminalCommands: { log: 'all' | 'filtered'; filterTrivial: boolean };
  aiPrompts: boolean;
  testRuns: boolean;
  fileEdits: { debounceMinutes: number };
}

export interface AIConfig {
  primary: 'claude' | 'ollama';
  ollamaModel: string;
  showModelIndicator: boolean;
}

// API response shapes
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface StatusResponse {
  daemon: 'running';
  version: string;
  uptime: number;
  activeSession: Session | null;
  projectId: string;
  eventCount: number;
  sessionCount: number;
}

export interface AgentRequest {
  query: string;
  sessionId?: string;
  format?: 'cli' | 'web';
}

export interface AgentResponse {
  answer: string;
  queryType: QueryType;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export type QueryType =
  | 'RETROSPECTIVE'
  | 'METRICS'
  | 'DOCUMENT_GEN'
  | 'REPLAY'
  | 'CAPSULE'
  | 'REASONING'
  | 'CONFIG'
  | 'OUT_OF_SCOPE';
