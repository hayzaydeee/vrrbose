import type { QueryType } from '@vrrbose/shared';

interface ClassifyRule {
  type: QueryType;
  patterns: RegExp[];
}

const RULES: ClassifyRule[] = [
  {
    type: 'METRICS',
    patterns: [
      /how (many|much|long|often)/i,
      /count|total|number of|stats|statistics|metrics/i,
      /lines (of code|changed|added|removed)/i,
      /commits? (this|last|per|today|week|month)/i,
      /time (spent|working|coding)/i,
      /files?.*(touch|edit|change|modify|most|frequent)/i,
      /(touch|edit|change|modify).+files?/i,
      /most (active|edited|touched|changed|modified)/i,
      /active (files?|days?|hours?)/i,
    ],
  },
  {
    type: 'RETROSPECTIVE',
    patterns: [
      /what did i (work|do|build|change|fix|implement)/i,
      /what (was|were|happened)/i,
      /show me (what|my|the)/i,
      /history|log|recent|last (session|day|week|month)/i,
      /summarize|summarise|recap|overview/i,
      /earliest|first (session|commit|event)/i,
      /tell me about.*(session|commit|day|week)/i,
      /what('s| is| was) (in |the )?(session|first|last|earliest)/i,
    ],
  },
  {
    type: 'DOCUMENT_GEN',
    patterns: [
      /generate|write|create|draft|produce/i,
      /brag sheet|performance review|cv|resume|bullet/i,
      /weekly digest|digest|report/i,
      /investor update|announcement/i,
      /readme|documentation/i,
    ],
  },
  {
    type: 'REPLAY',
    patterns: [
      /replay|walk(through| me through)|step.by.step/i,
      /how (was|did) .+ built/i,
      /show (me )?the (story|journey|process|timeline)/i,
    ],
  },
  {
    type: 'CAPSULE',
    patterns: [
      /capsule|snapshot|milestone|version/i,
      /save|archive|capture (this|current)/i,
      /time capsule/i,
    ],
  },
  {
    type: 'REASONING',
    patterns: [
      /why (did|was|is|are)/i,
      /decision|rationale|reason|because/i,
      /architecture|design choice|trade.?off/i,
      /should i|what.s the best|recommend/i,
    ],
  },
  {
    type: 'CONFIG',
    patterns: [
      /config|setting|preference|enable|disable|turn (on|off)/i,
      /how do i (set|change|configure|update)/i,
    ],
  },
];

export function classifyQuery(query: string): QueryType {
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(query))) {
      return rule.type;
    }
  }
  return 'OUT_OF_SCOPE';
}
