import type { QueryType } from '@vrrbose/shared';

export function formatResponse(raw: string, _queryType: QueryType, format: 'cli' | 'web'): string {
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
