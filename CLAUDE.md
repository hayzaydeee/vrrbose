# VRRBOSE

Vrrbose is a developer documentation system. An agent that watches your code being built.
It captures git events, IDE events, terminal commands, and test runs -- then surfaces
that history conversationally on demand.

Stack: Node.js, Express, React, MongoDB, SQLite (local buffer), Claude API.

## gstack

Use `/browse` from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
- `/plan-ceo-review` — CEO-level plan review
- `/plan-eng-review` — Engineering plan review
- `/review` — Code review
- `/ship` — Ship a feature
- `/browse` — Web browsing (use this for all web browsing)
- `/qa` — QA testing
- `/setup-browser-cookies` — Set up browser cookies
- `/retro` — Retrospective

If gstack skills aren't working: `cd .claude/skills/gstack && ./setup`

## Architecture

- Event capture: git hooks + IDE extension API (IDE-agnostic)
- Local store: SQLite (append-heavy event log, zero infra)
- Cloud store: MongoDB (canonical store)
- AI summarisation: Claude API primary, Ollama fallback
- CLI entry point: `vrrbose` command
- Architecturally significant files: `src/server.js`, `src/middleware/auth.js`

## Conventions

- Conventional commits: feat:, fix:, chore:, refactor:, docs:
- Solo project

<!-- VRRBOSE:context -->
## Vrrbose: recent project context

### Recent sessions
- 2026-03-16: 351m, 1 commits, score 10
- 2026-03-16: 245m, 1 commits, score 10
- 2026-03-16: 120m, 0 commits, score 0

### Recent commits
- 2026-03-16: feat(sync): implement sync state management and configuration loading
- 2026-03-16: feat: update project context and enhance API error handling with timeouts
<!-- /VRRBOSE:context -->
