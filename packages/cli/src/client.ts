import { DAEMON_PORT } from '@vrrbose/shared';
import type { ApiResponse, StatusResponse, AgentResponse, Session, Event } from '@vrrbose/shared';

const BASE = `http://localhost:${DAEMON_PORT}`;
const REQUEST_TIMEOUT_MS = 30_000;

async function fetchApi<T>(path: string, opts?: RequestInit): Promise<ApiResponse<T>> {
  let res: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      ...opts,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out waiting for daemon response.');
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      throw new Error('Daemon not running. Run `vrrbose start` to start it.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const reason = body.trim() ? ` ${body.trim().slice(0, 240)}` : '';
    throw new Error(`Daemon request failed (${res.status}${reason ? `:${reason}` : ''})`);
  }

  try {
    return await res.json() as ApiResponse<T>;
  } catch {
    throw new Error('Daemon returned an invalid JSON response.');
  }
}

export async function getStatus(): Promise<StatusResponse> {
  const result = await fetchApi<StatusResponse>('/api/status');
  if (!result.ok || !result.data) throw new Error(result.error ?? 'No status data to show');
  return result.data;
}

export async function getSessions(limit = 20): Promise<Session[]> {
  const result = await fetchApi<Session[]>(`/api/sessions?limit=${limit}`);
  if (!result.ok || !result.data) throw new Error(result.error ?? 'Failed to get sessions');
  return result.data;
}

export async function getSession(id: string): Promise<{ session: Session; events: Event[] }> {
  const result = await fetchApi<{ session: Session; events: Event[] }>(`/api/sessions/${id}`);
  if (!result.ok || !result.data) throw new Error(result.error ?? 'Session not found');
  return result.data;
}

export async function registerProject(projectPath: string): Promise<{ projectId: string; projectName: string; created: boolean; projectPath: string }> {
  const result = await fetchApi<{ projectId: string; projectName: string; created: boolean; projectPath: string }>('/api/projects/register', {
    method: 'POST',
    body: JSON.stringify({ path: projectPath }),
  });
  if (!result.ok || !result.data) throw new Error(result.error ?? 'Failed to register project');
  return result.data;
}

export async function askAgent(query: string, format: 'cli' | 'web' = 'cli'): Promise<AgentResponse> {
  const result = await fetchApi<AgentResponse>('/api/agent', {
    method: 'POST',
    body: JSON.stringify({ query, format }),
  });
  if (!result.ok || !result.data) throw new Error(result.error ?? 'Agent error');
  return result.data;
}
