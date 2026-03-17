import { formatResponse } from '../agent/response-formatter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const outOfScope = formatResponse('This request is outside tracked project history.', 'OUT_OF_SCOPE', 'cli');
  assert(!outOfScope.includes('\n'), 'OUT_OF_SCOPE response should be one line for CLI');
  assert(outOfScope.includes('Claude Code'), 'OUT_OF_SCOPE response should include tool redirect');

  const reasoningInput = [
    'We changed sync retry logic to improve reliability.',
    'Tradeoffs included added state persistence complexity.',
    'Option A: keep fixed intervals.',
    'Option B: use exponential backoff with jitter.',
    '```ts',
    'const x = 1;',
    '```',
  ].join('\n');

  const reasoning = formatResponse(reasoningInput, 'REASONING', 'cli');
  assert(reasoning.includes('What I know'), 'REASONING output should include What I know section');
  assert(reasoning.includes('The tension'), 'REASONING output should include The tension section');
  assert(reasoning.includes('The angles'), 'REASONING output should include The angles section');
  assert(reasoning.includes('Handoff'), 'REASONING output should include Handoff section');
  assert(!reasoning.includes('```'), 'REASONING output must not include code blocks');

  console.log('response-contract-gate: PASS reasoning and out-of-scope formatting');
}

main().catch((err) => {
  console.error('response-contract-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
