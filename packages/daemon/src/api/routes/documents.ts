import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

interface DocumentListItem {
  name: string;
  size: number;
  updatedAt: number;
  preview: string[];
}

interface ShareToken {
  fileName: string;
  expiresAt: number;
}

const shareTokens = new Map<string, ShareToken>();

export function documentsRouter(): Router {
  const router = Router();
  const outputDir = join(homedir(), '.vrrbose', 'output');

  function isValidName(name: string): boolean {
    return name === basename(name) && name.toLowerCase().endsWith('.md');
  }

  router.get('/', (_req, res) => {
    if (!existsSync(outputDir)) {
      res.json({ ok: true, data: [] as DocumentListItem[] });
      return;
    }

    const files = readdirSync(outputDir)
      .filter((name) => name.toLowerCase().endsWith('.md'))
      .map((name) => {
        const filePath = join(outputDir, name);
        const stats = statSync(filePath);
        const content = readFileSync(filePath, 'utf8');
        const preview = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('#'))
          .slice(0, 2);

        return {
          name,
          size: stats.size,
          updatedAt: stats.mtimeMs,
          preview,
        } satisfies DocumentListItem;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    res.json({ ok: true, data: files });
  });

  router.get('/:name', (req, res) => {
    const requested = req.params['name'] ?? '';
    const safeName = basename(requested);
    if (!isValidName(safeName) || safeName !== requested) {
      res.status(400).json({ ok: false, error: 'Invalid document name' });
      return;
    }

    const filePath = join(outputDir, safeName);
    if (!existsSync(filePath)) {
      res.status(404).json({ ok: false, error: 'Document not found' });
      return;
    }

    const content = readFileSync(filePath, 'utf8');
    res.json({ ok: true, data: { name: safeName, content } });
  });

  router.get('/:name/download', (req, res) => {
    const requested = req.params['name'] ?? '';
    const safeName = basename(requested);
    if (!isValidName(safeName) || safeName !== requested) {
      res.status(400).json({ ok: false, error: 'Invalid document name' });
      return;
    }

    const filePath = join(outputDir, safeName);
    if (!existsSync(filePath)) {
      res.status(404).json({ ok: false, error: 'Document not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(readFileSync(filePath, 'utf8'));
  });

  router.post('/:name/share', (req, res) => {
    const requested = req.params['name'] ?? '';
    const safeName = basename(requested);
    if (!isValidName(safeName) || safeName !== requested) {
      res.status(400).json({ ok: false, error: 'Invalid document name' });
      return;
    }

    const filePath = join(outputDir, safeName);
    if (!existsSync(filePath)) {
      res.status(404).json({ ok: false, error: 'Document not found' });
      return;
    }

    const body = req.body as { expiresInMinutes?: number };
    const minutes = Number.isFinite(body.expiresInMinutes)
      ? Math.max(5, Math.min(60 * 24 * 30, Math.floor(body.expiresInMinutes as number)))
      : 60;
    const expiresAt = Date.now() + minutes * 60 * 1000;
    const token = randomUUID().replace(/-/g, '');

    shareTokens.set(token, { fileName: safeName, expiresAt });

    res.json({
      ok: true,
      data: {
        token,
        expiresAt,
        sharePath: `/api/documents/share/${token}`,
      },
    });
  });

  router.get('/share/:token', (req, res) => {
    const token = req.params['token'] ?? '';
    const share = shareTokens.get(token);
    if (!share) {
      res.status(404).json({ ok: false, error: 'Share link not found' });
      return;
    }

    if (Date.now() > share.expiresAt) {
      shareTokens.delete(token);
      res.status(410).json({ ok: false, error: 'Share link expired' });
      return;
    }

    const filePath = join(outputDir, share.fileName);
    if (!existsSync(filePath)) {
      res.status(404).json({ ok: false, error: 'Document not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(readFileSync(filePath, 'utf8'));
  });

  return router;
}
