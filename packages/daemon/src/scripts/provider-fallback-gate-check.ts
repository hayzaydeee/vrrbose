import { createServer } from 'node:http';
import { runWithProviderFallback } from '../api/routes/agent.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  delete process.env['ANTHROPIC_API_KEY'];
  process.env['OLLAMA_MODEL'] = 'llama3';

  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/generate') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: 'fallback ok from ollama mock' }));
      return;
    }
    res.writeHead(404).end('not found');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr !== 'object') {
    throw new Error('Failed to bind mock ollama server');
  }

  process.env['OLLAMA_BASE_URL'] = `http://127.0.0.1:${addr.port}`;

  try {
    const result = await runWithProviderFallback({
      system: 'You are a test system prompt.',
      user: 'Return a short test response.',
    });

    assert(result.provider === 'ollama', `Expected ollama provider, got ${result.provider}`);
    assert(result.text.includes('fallback ok'), 'Expected fallback text from ollama mock');

    console.log('provider-fallback-gate: PASS ollama fallback path');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error('provider-fallback-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
