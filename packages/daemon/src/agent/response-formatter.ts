import type { QueryType } from '@vrrbose/shared';

export function formatResponse(raw: string, _queryType: QueryType, format: 'cli' | 'web'): string {
  if (_queryType === 'OUT_OF_SCOPE') {
    return formatOutOfScope(raw);
  }

  if (_queryType === 'REASONING') {
    return formatReasoning(raw, format);
  }

  if (format === 'web') return raw;

  // Strip markdown for CLI plain-text output
  return raw
    .replace(/^#{1,6}\s+/gm, '')       // headings
    .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
    .replace(/\*(.*?)\*/g, '$1')       // italic
    .replace(/`{3}[\s\S]*?`{3}/g, '')  // code blocks
    .replace(/`([^`]+)`/g, '$1')       // inline code
    .trim();
}

function formatOutOfScope(raw: string): string {
  const message = raw.replace(/\s+/g, ' ').trim();
  const base = message.length > 0 ? message : 'That request is outside recorded project history.';
  return `${base} - Use Claude Code for general coding help.`;
}

function formatReasoning(raw: string, format: 'cli' | 'web'): string {
  const clean = raw
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

  const lines = clean
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const whatIKnow = lines.slice(0, 3).join(' ') || 'Recent project history indicates active implementation and validation work.';
  const tension = lines.slice(3, 5).join(' ') || 'The main tension is balancing speed of delivery with reliability and parity requirements.';
  const angleA = lines.slice(5, 7).join(' ') || 'Prioritize deterministic gates and keep feature scope aligned to checklist deliverables.';
  const angleB = lines.slice(7, 9).join(' ') || 'Preserve fallback paths and observability to reduce operational risk during rollout.';

  const formatted = [
    'What I know',
    '-----------',
    whatIKnow,
    '',
    'The tension',
    '-----------',
    tension,
    '',
    'The angles',
    '-----------',
    `1. ${angleA}`,
    `2. ${angleB}`,
    '',
    'Handoff',
    '-------',
    'Take this to Claude Code for implementation decisions beyond recorded project history.',
  ].join('\n');

  return format === 'web' ? formatted : formatted;
}
