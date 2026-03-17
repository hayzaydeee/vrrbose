import { DAEMON_PORT } from '@vrrbose/shared';
import type { StatusResponse, Session, Event, AgentResponse } from '@vrrbose/shared';

const BASE = `http://localhost:${DAEMON_PORT}`;
const STREAM_TIMEOUT_MS = 45_000;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json() as { ok: boolean; data?: T; error?: string };
  if (!json.ok || !json.data) throw new Error(json.error ?? 'Request failed');
  return json.data;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json() as { ok: boolean; data?: T; error?: string };
  if (!json.ok || !json.data) throw new Error(json.error ?? 'Request failed');
  return json.data;
}

export interface ProjectStatus {
  projectId: string;
  projectName: string;
  projectPath: string;
  activeSession: Session | null;
}

export interface Capsule {
  id: string;
  type: 'merge' | 'tag' | 'weekly' | 'manual';
  createdAt: number;
  title: string;
  summary?: string;
  branch?: string;
  tag?: string;
  fileCount?: number;
}

export interface GeneratedDocument {
  name: string;
  size: number;
  updatedAt: number;
  preview: string[];
}

export interface NotionDestinationConfig {
  enabled: boolean;
  workspaceName: string | null;
  databaseId: string | null;
  tokenMasked: string | null;
}

export const api = {
  status: () => get<StatusResponse>('/api/status'),
  projects: () => get<ProjectStatus[]>('/api/projects'),
  capsules: () => get<Capsule[]>('/api/capsules').catch(() => [] as Capsule[]),
  documents: () => get<GeneratedDocument[]>('/api/documents').catch(() => [] as GeneratedDocument[]),
  document: (name: string) => get<{ name: string; content: string }>(`/api/documents/${encodeURIComponent(name)}`),
  sessions: (limit = 20) => get<Session[]>(`/api/sessions?limit=${limit}`),
  session: (id: string) => get<{ session: Session; events: Event[] }>(`/api/sessions/${id}`),
  events: (params?: { sessionId?: string; type?: string; limit?: number; projectId?: string }) => {
    const q = new URLSearchParams();
    if (params?.sessionId) q.set('sessionId', params.sessionId);
    if (params?.type) q.set('type', params.type);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.projectId) q.set('projectId', params.projectId);
    return get<Event[]>(`/api/events?${q}`);
  },
  ask: (query: string, sessionId?: string, projectId?: string) =>
    post<AgentResponse>('/api/agent' + (projectId ? `?projectId=${projectId}` : ''), { query, sessionId, format: 'web' }),
  generateDocument: (query: string, sessionId?: string, projectId?: string) =>
    post<AgentResponse>('/api/agent' + (projectId ? `?projectId=${projectId}` : ''), { query, sessionId, format: 'web' }),
  documentDownloadUrl: (name: string) => `${BASE}/api/documents/${encodeURIComponent(name)}/download`,
  notionDestination: () => get<NotionDestinationConfig>('/api/destinations/notion'),
  updateNotionDestination: (payload: { enabled?: boolean; workspaceName?: string; databaseId?: string; token?: string }) =>
    post<NotionDestinationConfig>('/api/destinations/notion', payload),
  testNotionDestination: () => post<{ reachable: boolean; message: string }>('/api/destinations/notion/test', {}),
  askStream: (
    query: string,
    projectId: string | undefined,
    onChunk: (chunk: string) => void,
    onDone: (queryType: string) => void,
    onError: (err: string) => void,
  ): (() => void) => {
    const q = new URLSearchParams({ query });
    if (projectId) q.set('projectId', projectId);
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      const timer = setTimeout(() => ctrl.abort(), STREAM_TIMEOUT_MS);
      let terminalEventSeen = false;
      try {
        const res = await fetch(`${BASE}/api/agent/stream?${q}`, { signal: ctrl.signal });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          const reason = body.trim() ? `: ${body.trim().slice(0, 240)}` : '';
          onError(`Agent stream failed (${res.status}${reason})`);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) { onError('No response body'); return; }
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (!terminalEventSeen && !cancelled) {
              onError('Agent stream ended unexpectedly before completion.');
            }
            break;
          }
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            let parsed: { chunk?: string; done?: boolean; queryType?: string; error?: string };
            try {
              parsed = JSON.parse(line.slice(6)) as { chunk?: string; done?: boolean; queryType?: string; error?: string };
            } catch {
              onError('Received malformed agent stream payload.');
              return;
            }

            if (parsed.chunk) onChunk(parsed.chunk);
            if (parsed.done) {
              terminalEventSeen = true;
              onDone(parsed.queryType ?? '');
              return;
            }
            if (parsed.error) {
              terminalEventSeen = true;
              onError(parsed.error);
              return;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          if (!cancelled) onError('Agent request timed out.');
          return;
        }
        onError(String(err));
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  },
};
