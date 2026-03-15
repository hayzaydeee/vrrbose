import { DAEMON_PORT } from '@vrrbose/shared';
import type { StatusResponse, Session, Event, AgentResponse } from '@vrrbose/shared';

const BASE = `http://localhost:${DAEMON_PORT}`;

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

export const api = {
  status: () => get<StatusResponse>('/api/status'),
  projects: () => get<ProjectStatus[]>('/api/projects'),
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
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/agent/stream?${q}`, { signal: ctrl.signal });
        const reader = res.body?.getReader();
        if (!reader) { onError('No response body'); return; }
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const parsed = JSON.parse(line.slice(6)) as { chunk?: string; done?: boolean; queryType?: string; error?: string };
            if (parsed.chunk) onChunk(parsed.chunk);
            if (parsed.done) onDone(parsed.queryType ?? '');
            if (parsed.error) onError(parsed.error);
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') onError(String(err));
      }
    })();
    return () => ctrl.abort();
  },
};
