import { Router } from 'express';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

interface DocumentListItem {
  name: string;
  size: number;
  updatedAt: number;
  preview: string[];
}

export function documentsRouter(): Router {
  const router = Router();
  const outputDir = join(homedir(), '.vrrbose', 'output');

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
    if (safeName !== requested || !safeName.toLowerCase().endsWith('.md')) {
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
    if (safeName !== requested || !safeName.toLowerCase().endsWith('.md')) {
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

  return router;
}
