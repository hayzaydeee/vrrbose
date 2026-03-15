import { DAEMON_PORT } from '@vrrbose/shared';
import type { ApiResponse, StatusResponse, AgentResponse, Session, Event } from '@vrrbose/shared';

const BASE = `http://localhost:${DAEMON_PORT}`;

async function fetchApi<T>(path: string, opts?: RequestInit): Promise<ApiResponse<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      throw new Error('Daemon not running. Run `vrrbose start` to start it.');
    }
    throw err;
  }
  return res.json() as Promise<ApiResponse<T>>;
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
