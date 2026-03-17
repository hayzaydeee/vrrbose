import type { QueryType } from '@vrrbose/shared';

export interface WebContractPayload {
  overview: string;
  tabs: {
    visuals: { render: boolean; type: string; data: Record<string, unknown>; caption: string };
    data: { render: boolean; type: string; content: Record<string, unknown> };
    prose: { render: boolean; content: string };
  };
  follow_ups: string[];
}

export function buildWebContractPayload(answer: string, queryType: QueryType): WebContractPayload {
  const overview = firstSentences(answer, 2);
  const followUps = followUpsFor(queryType);

  const visualsEnabled = queryType === 'METRICS' || queryType === 'RETROSPECTIVE' || queryType === 'REPLAY';
  const dataEnabled = queryType === 'METRICS' || queryType === 'RETROSPECTIVE' || queryType === 'REPLAY' || queryType === 'CAPSULE';

  return {
    overview,
    tabs: {
      visuals: {
        render: visualsEnabled,
        type: queryType === 'REPLAY' ? 'timeline' : (queryType === 'METRICS' ? 'chart' : 'timeline'),
        data: {},
        caption: visualsEnabled ? 'Visual summary generated from recent activity context.' : '',
      },
      data: {
        render: dataEnabled,
        type: queryType === 'METRICS' ? 'table' : 'json',
        content: {},
      },
      prose: {
        render: true,
        content: answer,
      },
    },
    follow_ups: followUps,
  };
}

function firstSentences(text: string, count: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No answer content available.';
  const parts = normalized.split(/(?<=[.!?])\s+/).slice(0, count);
  return parts.join(' ');
}

function followUpsFor(queryType: QueryType): string[] {
  switch (queryType) {
    case 'REPLAY':
      return ['Export session as video', 'Show key file diffs', 'Compare with previous session'];
    case 'DOCUMENT_GEN':
      return ['Export as PDF', 'Publish to Notion', 'Generate alternate tone'];
    case 'REASONING':
      return ['Take this to Claude Code', 'Show supporting events', 'Draft an ADR from this'];
    case 'METRICS':
      return ['Break down by file', 'Show weekly trend', 'Highlight regressions'];
    case 'RETROSPECTIVE':
      return ['Show commit timeline', 'Generate session summary', 'Open replay'];
    case 'CAPSULE':
      return ['Open capsule detail', 'Compare with previous capsule', 'Share capsule'];
    default:
      return ['Show related sessions', 'Open project metrics'];
  }
}
