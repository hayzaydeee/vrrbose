import { Router } from 'express';
import type Database from 'better-sqlite3';
import { AgentRequestSchema } from '@vrrbose/shared';
import { classifyQuery } from '../../agent/classifier.js';
import { assembleContext } from '../../agent/context-assembler.js';
import { buildPrompt } from '../../agent/prompt-builder.js';
import { formatResponse } from '../../agent/response-formatter.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

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
      const queryType = classifyQuery(query);
      const context = await assembleContext(db, projectId, queryType, sessionId);
      const prompt = buildPrompt(query, context, queryType);

      const message = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      });

      const rawAnswer = message.content[0]?.type === 'text' ? message.content[0].text : '';
      const answer = formatResponse(rawAnswer, queryType, format ?? 'cli');

      res.json({
        ok: true,
        data: { answer, queryType, sessionId },
      });
    } catch (err) {
      console.error('[agent] error:', err);
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

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const queryType = classifyQuery(query);
      const context = await assembleContext(db, projectId, queryType, sessionId);
      const prompt = buildPrompt(query, context, queryType);

      const stream = client.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ chunk: event.delta.text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, queryType })}\n\n`);
    } catch (err) {
      console.error('[agent] stream error:', err);
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    } finally {
      res.end();
    }
  });

  return router;
}
