import { Router } from 'express';
import type Database from 'better-sqlite3';
import { AgentRequestSchema } from '@vrrbose/shared';
import { classifyQuery } from '../../agent/classifier.js';
import { assembleContext } from '../../agent/context-assembler.js';
import { buildPrompt } from '../../agent/prompt-builder.js';
import { formatResponse } from '../../agent/response-formatter.js';
import Anthropic from '@anthropic-ai/sdk';

const MODEL_REQUEST_TIMEOUT_MS = 45_000;
const STREAM_NEXT_TIMEOUT_MS = 45_000;

class MissingProviderConfigError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not configured');
    this.name = 'MissingProviderConfigError';
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new MissingProviderConfigError();
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function asErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function agentRouter(db: Database.Database, defaultProjectId: string): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const parsed = AgentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.message });
      return;
    }

    const { query, sessionId, format } = parsed.data;
    const projectId = (req.query['projectId'] as string) || defaultProjectId;

    try {
      const apiClient = getClient();
      const queryType = classifyQuery(query);
      const context = await assembleContext(db, projectId, queryType, sessionId);
      const prompt = buildPrompt(query, context, queryType);

      const message = await withTimeout(
        apiClient.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
        }),
        MODEL_REQUEST_TIMEOUT_MS,
        'Agent request timed out'
      );

      const rawAnswer = message.content[0]?.type === 'text' ? message.content[0].text : '';
      const answer = formatResponse(rawAnswer, queryType, format ?? 'cli');

      res.json({
        ok: true,
        data: { answer, queryType, sessionId },
      });
    } catch (err) {
      console.error('[agent] error:', err);
      if (err instanceof MissingProviderConfigError) {
        res.status(503).json({ ok: false, error: err.message });
        return;
      }
      if (err instanceof TimeoutError) {
        res.status(504).json({ ok: false, error: err.message });
        return;
      }
      res.status(500).json({ ok: false, error: 'Agent error' });
    }
  });

  // SSE streaming endpoint: GET /api/agent/stream?query=...&projectId=...&sessionId=...
  router.get('/stream', async (req, res) => {
    const query = req.query['query'] as string;
    const sessionId = req.query['sessionId'] as string | undefined;
    const projectId = (req.query['projectId'] as string) || defaultProjectId;

    if (!query?.trim()) {
      res.status(400).json({ ok: false, error: 'query required' });
      return;
    }

    try {
      const apiClient = getClient();
      const queryType = classifyQuery(query);
      const context = await assembleContext(db, projectId, queryType, sessionId);
      const prompt = buildPrompt(query, context, queryType);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const stream = apiClient.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      });

      const iterator = stream[Symbol.asyncIterator]();

      while (true) {
        const next = await withTimeout(iterator.next(), STREAM_NEXT_TIMEOUT_MS, 'Agent stream timed out');
        if (next.done) break;
        const event = next.value;
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ chunk: event.delta.text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, queryType })}\n\n`);
    } catch (err) {
      console.error('[agent] stream error:', err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: asErrorMessage(err), done: true })}\n\n`);
      } else if (err instanceof MissingProviderConfigError) {
        res.status(503).json({ ok: false, error: err.message });
      } else if (err instanceof TimeoutError) {
        res.status(504).json({ ok: false, error: err.message });
      } else {
        res.status(500).json({ ok: false, error: 'Agent stream error' });
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  return router;
}
