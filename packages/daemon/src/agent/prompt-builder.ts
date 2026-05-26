import type { QueryType } from '@vrrbose/shared';
import type { AssembledContext } from './context-assembler.js';

export interface BuiltPrompt {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `You are Vrrbose, a developer archivist. 
You have been quietly watching a software project grow — recording commits, file edits, terminal activity, and test runs. 
You answer questions about this history with precision and context.

Today's date is ${new Date().toISOString().slice(0, 10)}. All session and event data is real and current — 
do not treat any dates as "in the future".

Tone: concise, informative, never filler. Lead with the answer. Avoid hedging.
Format: plain text for CLI responses. Use bullet lists for enumerations. Use ISO dates.
Scope: only answer based on the provided context. If the context is insufficient, say so clearly — 
but do not claim data is unavailable if it appears in the context block below.`;

const TYPE_HINTS: Record<QueryType, string> = {
  RETROSPECTIVE: 'Summarise what happened in the session(s) provided. Focus on commits, file changes, and notable patterns.',
  METRICS: 'Report concrete numbers. Format quantities clearly. Highlight outliers.',
  DOCUMENT_GEN: 'Generate the requested document using the provided history. Follow the requested format and audience.',
  REPLAY: 'Walk through the provided events step by step, explaining what was built and in what order.',
  CAPSULE: 'Summarise the key decisions, files, and open questions for the provided period.',
  REASONING: 'Explain the architectural decisions and reasoning evident from the history.',
  CONFIG: 'Provide configuration guidance based on the current settings.',
  OUT_OF_SCOPE: 'Explain briefly that this query is outside the scope of recorded project history.',
};

export function buildPrompt(query: string, context: AssembledContext, queryType: QueryType): BuiltPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: `## Query type: ${queryType}
${TYPE_HINTS[queryType]}

## Project context
${context.raw || '(no context available)'}

## Query
${query}`,
  };
}
