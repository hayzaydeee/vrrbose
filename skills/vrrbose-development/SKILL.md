---
name: vrrbose-development
description: >
  Guidelines for contributing to the vrrbose codebase — a developer
  documentation system that captures git events, file activity, and sessions,
  then surfaces history conversationally. Use this skill when writing,
  reviewing, or refactoring vrrbose source code to ensure changes stay
  consistent with the architecture, data flow, and conventions of the project.
license: MIT
metadata:
  author: vrrbose
  version: "1.0.0"
---

# vrrbose-development

Rules for working in the vrrbose monorepo. Follow these when writing or
reviewing any code in this codebase.

## Architecture (CRITICAL)

### arch-1: Understand the data flow before changing it

```
project fs / git
      │
      ▼
daemon (local)          ← packages/daemon
  ├─ watchers           ← src/watchers/
  ├─ session manager    ← src/session/
  ├─ SQLite buffer      ← ~/.vrrbose/vrrbose.db
  ├─ agent (Claude)     ← src/agent/
  ├─ MCP server         ← src/mcp/server.ts
  └─ sync worker        ← src/sync/worker.ts
      │
      ▼
vrrbose cloud API       ← packages/api
      │
      ▼
web dashboard           ← packages/web
```

Events flow one-way: capture → SQLite buffer → cloud sync. Never write events
directly to cloud; always go through the local buffer.

### arch-2: SQLite is the source of truth for the daemon

The daemon reads and writes only to the local SQLite database
(`~/.vrrbose/vrrbose.db`). The cloud sync worker (`src/sync/worker.ts`) is a
background flush job — it does not block event capture.

### arch-3: Architecturally significant files require extra care

Changes to `packages/daemon/src/agent/` and `packages/daemon/src/mcp/server.ts`
affect the AI response quality and the MCP interface. Test manually after
editing these files.

### arch-4: Shared types live in `packages/shared`

All cross-package types, constants, and schemas are in `packages/shared/src/`.
Do not duplicate type definitions across packages.

### arch-5: The CLI is a thin client

`packages/cli` only communicates with the daemon over HTTP. It must not import
from `packages/daemon` directly. Use `@vrrbose/shared` for shared constants.

## Event system (HIGH)

### event-1: Use the canonical event types from `@vrrbose/shared`

All event `type` strings are defined in `packages/shared/src/types.ts`. Do not
introduce new event types without adding them there first.

### event-2: Event payloads must be JSON-serialisable plain objects

Watchers (`src/watchers/`) emit events with plain object payloads. No class
instances, no circular references, no Buffers.

### event-3: Watchers must be non-blocking

Filesystem and git watchers run in the background. Any I/O inside a watcher
must be async. Never block the event loop waiting for a watcher.

### event-4: Session boundaries are managed by the session manager only

Do not start or end sessions from watchers or routes. Only
`src/session/manager.ts` may transition session state.

## AI agent (HIGH)

### agent-1: Context assembly is separate from prompt building

`src/agent/context-assembler.ts` fetches and formats raw history.
`src/agent/prompt-builder.ts` wraps it in the system/user prompt structure.
Keep these concerns separate.

### agent-2: Respect the MAX_WORDS context budget

Context passed to Claude is capped at `CONTEXT_INJECTION.MAX_WORDS` (defined
in `@vrrbose/shared`). Do not bypass truncation in `context-assembler.ts`.

### agent-3: Query type determines context shape

The `QueryType` enum (`RETROSPECTIVE`, `METRICS`, `REPLAY`, etc.) controls
which data is assembled. Add a new query type in `@vrrbose/shared` before
handling it in the assembler and prompt builder.

### agent-4: Ollama is the fallback, Claude is primary

The AI client must try the configured primary provider first. Only fall back to
Ollama if the primary call fails. Do not make both calls in parallel.

## MCP server (MEDIUM)

### mcp-1: All MCP tools must return JSON-serialisable values

Tool handlers return plain objects or arrays. The MCP server wraps responses in
`{ content: [{ type: "text", text: JSON.stringify(result) }] }`.

### mcp-2: Add new MCP tools to `buildTools()` in `src/mcp/server.ts`

Each tool needs: `name`, `description`, `inputSchema` (JSON Schema), and
`handler`. Follow the existing pattern.

### mcp-3: The MCP server runs on a separate port from the daemon API

Daemon API: `DAEMON_PORT` (default 7331). MCP server: `MCP_PORT` (default
7332). Do not conflate them.

## Commit conventions (MEDIUM)

### commit-1: Use conventional commits

All commits must use a type prefix:

| Prefix | Use for |
|--------|---------|
| `feat:` | new user-visible feature |
| `fix:` | bug fix |
| `chore:` | tooling, deps, config |
| `refactor:` | code change with no behaviour change |
| `docs:` | documentation only |

### commit-2: Use `decide:` or `adr:` for architectural decisions

When a commit encodes an architectural decision, prefix the message with
`decide:` or `adr:`. The vrrbose agent surfaces these via `get_decisions`.

```
decide: use SQLite as local buffer instead of flat JSON files
```

### commit-3: Mark incomplete work with `WIP` in the commit message

The vrrbose agent surfaces these via `get_todos`. Remove the `WIP` marker when
the work is complete.

## Testing and quality (MEDIUM)

### quality-1: Build shared before other packages

`packages/shared` must be built before `packages/daemon`, `packages/cli`, or
`packages/web`. The workspace is ordered in `pnpm-workspace.yaml`.

### quality-2: TypeScript strict mode is enabled

The root `tsconfig.base.json` enables `strict`. Do not disable strict checks
or use `@ts-ignore` without a comment explaining why.

### quality-3: Use `pnpm` for all package operations

This is a pnpm workspace. Do not use `npm` or `yarn`. Run `pnpm -w <command>`
for workspace-level operations.

## Package boundaries (LOW)

### boundary-1: `packages/web` must not import from `packages/daemon`

The web package is a Next.js app that communicates with the daemon via HTTP.
Direct imports would couple the frontend build to the daemon's native
dependencies (e.g. `better-sqlite3`).

### boundary-2: `packages/api` is the cloud API, not the daemon API

`packages/api` is the Express server deployed to `api.vrrbose.dev`.
`packages/daemon` exposes a separate local HTTP API. Do not conflate them.

### boundary-3: Keep `packages/shared` dependency-free

`packages/shared` must have no runtime dependencies beyond Node.js built-ins.
It is imported by all other packages; adding heavy deps here bloats everything.
