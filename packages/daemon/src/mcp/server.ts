import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type Database from 'better-sqlite3';
import { MCP_PORT } from '@vrrbose/shared';
import { getSessions, getEvents, getSession } from '../db/client.js';

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => unknown;
}

interface JsonRpcRequest {
  jsonrpc: string;
  id: unknown;
  method: string;
  params?: Record<string, unknown>;
}

export class McpServer {
  private db: Database.Database;
  private projectId: string;
  private port: number;
  private server: ReturnType<typeof createServer> | null = null;
  private tools: McpTool[];

  constructor(db: Database.Database, projectId: string, port = MCP_PORT) {
    this.db = db;
    this.projectId = projectId;
    this.port = port;
    this.tools = this.buildTools();
  }

  start(): void {
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          this.handleRequest(req.method ?? 'GET', body, res);
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[mcp] server listening on http://localhost:${this.port}`);
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }

  private respond(res: ServerResponse, id: unknown, result: unknown): void {
    res.writeHead(200);
    res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
  }

  private respondError(res: ServerResponse, id: unknown, code: number, message: string): void {
    res.writeHead(200);
    res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
  }

  private handleRequest(method: string, body: string, res: ServerResponse): void {
    if (method !== 'POST') {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const rpc = JSON.parse(body) as JsonRpcRequest;

    if (rpc.method === 'initialize') {
      this.respond(res, rpc.id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'vrrbose', version: '0.1.0' },
      });
      return;
    }

    if (rpc.method === 'tools/list') {
      this.respond(res, rpc.id, {
        tools: this.tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
      return;
    }

    if (rpc.method === 'tools/call') {
      const params = rpc.params as { name: string; arguments?: Record<string, unknown> };
      const tool = this.tools.find(t => t.name === params.name);
      if (!tool) {
        this.respondError(res, rpc.id, -32601, `Unknown tool: ${params.name}`);
        return;
      }
      const result = tool.handler(params.arguments ?? {});
      this.respond(res, rpc.id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      });
      return;
    }

    this.respondError(res, rpc.id, -32601, 'Method not found');
  }

  private buildTools(): McpTool[] {
    return [
      {
        name: 'get_context',
        description: 'Get current project context: recent sessions, commits, and activity summary',
        inputSchema: { type: 'object', properties: {}, required: [] },
        handler: () => {
          const sessions = getSessions(this.db, this.projectId, { limit: 5 });
          const events = getEvents(this.db, this.projectId, { limit: 20 });
          return { sessions, recentEvents: events };
        },
      },
      {
        name: 'get_session',
        description: 'Get a specific session by ID, or the most recent session if no ID provided',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session UUID (optional)' },
          },
        },
        handler: (input) => {
          if (input['sessionId']) {
            return getSession(this.db, String(input['sessionId']));
          }
          const sessions = getSessions(this.db, this.projectId, { limit: 1 });
          return sessions[0] ?? null;
        },
      },
      {
        name: 'get_decisions',
        description: 'Get architectural decisions inferred from commit messages (decide:, adr: prefixes)',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', description: 'Max decisions to return (default 10)' } },
        },
        handler: (input) => {
          const limit = typeof input['limit'] === 'number' ? input['limit'] : 10;
          const events = getEvents(this.db, this.projectId, { type: 'git_commit', limit: 50 });
          return events
            .filter(e => {
              const msg = String(e.payload['message'] ?? '').toLowerCase();
              return msg.startsWith('decide:') || msg.startsWith('adr:') || msg.includes('decision:');
            })
            .slice(0, limit)
            .map(e => ({
              date: new Date(e.timestamp).toISOString().slice(0, 10),
              message: e.payload['message'],
            }));
        },
      },
      {
        name: 'get_todos',
        description: 'Get open TODO/WIP items found in recent commit messages',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', description: 'Max items to return (default 10)' } },
        },
        handler: (input) => {
          const limit = typeof input['limit'] === 'number' ? input['limit'] : 10;
          const events = getEvents(this.db, this.projectId, { type: 'git_commit', limit: 50 });
          return events
            .filter(e => {
              const msg = String(e.payload['message'] ?? '').toLowerCase();
              return msg.includes('todo') || msg.includes('wip') || msg.includes('fixme');
            })
            .slice(0, limit)
            .map(e => ({
              date: new Date(e.timestamp).toISOString().slice(0, 10),
              message: e.payload['message'],
            }));
        },
      },
      {
        name: 'get_hot_files',
        description: 'Get the most frequently edited files across recent sessions',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', description: 'Max files to return (default 10)' } },
        },
        handler: (input) => {
          const limit = typeof input['limit'] === 'number' ? input['limit'] : 10;
          const events = getEvents(this.db, this.projectId, { type: 'file_save', limit: 500 });
          const counts = new Map<string, number>();
          for (const e of events) {
            const path = String(e.payload['filePath'] ?? '');
            if (path) counts.set(path, (counts.get(path) ?? 0) + 1);
          }
          return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([filePath, editCount]) => ({ filePath, editCount }));
        },
      },
    ];
  }
}
