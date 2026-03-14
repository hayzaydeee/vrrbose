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

export const api = {
  status: () => get<StatusResponse>('/api/status'),
  sessions: (limit = 20) => get<Session[]>(`/api/sessions?limit=${limit}`),
  session: (id: string) => get<{ session: Session; events: Event[] }>(`/api/sessions/${id}`),
  events: (params?: { sessionId?: string; type?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.sessionId) q.set('sessionId', params.sessionId);
    if (params?.type) q.set('type', params.type);
    if (params?.limit) q.set('limit', String(params.limit));
    return get<Event[]>(`/api/events?${q}`);
  },
  ask: (query: string, sessionId?: string) =>
    post<AgentResponse>('/api/agent', { query, sessionId, format: 'web' }),
};
