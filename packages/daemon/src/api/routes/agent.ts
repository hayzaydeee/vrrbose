import { Router } from 'express';
import type Database from 'better-sqlite3';
import { AgentRequestSchema } from '@vrrbose/shared';
import { classifyQuery } from '../../agent/classifier.js';
import { assembleContext } from '../../agent/context-assembler.js';
import { buildPrompt } from '../../agent/prompt-builder.js';
import { formatResponse } from '../../agent/response-formatter.js';
import Anthropic from '@anthropic-ai/sdk';

export function agentRouter(db: Database.Database, projectId: string): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const parsed = AgentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.message });
      return;
    }

    const { query, sessionId, format } = parsed.data;

    try {
      const queryType = classifyQuery(query);
      const context = await assembleContext(db, projectId, queryType, sessionId);
      const prompt = buildPrompt(query, context, queryType);

      const client = new Anthropic();
      const message = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      });

      const rawAnswer = message.content[0]?.type === 'text' ? message.content[0].text : '';
      const answer = formatResponse(rawAnswer, queryType, format ?? 'cli');

      res.json({
        ok: true,
        data: {
          answer,
          queryType,
          sessionId,
        },
      });
    } catch (err) {
      console.error('[agent] error:', err);
      res.status(500).json({ ok: false, error: 'Agent error' });
    }
  });

  return router;
}
