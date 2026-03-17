import { buildWebContractPayload } from '../agent/web-contract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const payload = buildWebContractPayload(
    'Implemented sync hardening and capture completeness with validated gates. Added fallback reliability with provider failover.',
    'METRICS',
  );

  assert(typeof payload.overview === 'string' && payload.overview.length > 0, 'overview should be populated');
  assert(payload.tabs.prose.render === true, 'prose tab should render');
  assert(payload.tabs.prose.content.length > 0, 'prose tab should have content');
  assert(Array.isArray(payload.follow_ups) && payload.follow_ups.length >= 2, 'follow_ups should include suggestions');

  console.log('web-contract-gate: PASS metadata payload structure');
}

main().catch((err) => {
  console.error('web-contract-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
