---
name: vrrbose-context
description: >
  Load project history, sessions, and activity from the vrrbose daemon before
  answering questions or making changes. Use this skill whenever you need to
  understand what has been built recently, what files are hot, or what
  architectural decisions have been made. Triggers on tasks involving work
  history, session retrospectives, recent activity, hot files, open TODOs, or
  architectural decisions.
license: MIT
metadata:
  author: vrrbose
  version: "1.0.0"
---

# vrrbose-context

Use the vrrbose MCP server to enrich your understanding of a project before
answering questions or making code changes. The daemon runs locally and exposes
project history through five tools.

## MCP connection

The vrrbose MCP server listens on `http://localhost:7332` (default). Connect
via stdio or HTTP/SSE depending on your client. To verify it is running:

```bash
vrrbose status
```

If the daemon is not running, start it first:

```bash
vrrbose start
```

## Available tools

### `get_context` (start here)

Returns the 5 most recent sessions and 20 most recent events. Call this first
to orient yourself in the project.

```json
{ "method": "tools/call", "params": { "name": "get_context", "arguments": {} } }
```

**Use when:** beginning any task, answering "what did I work on?", or loading
background context before reviewing code.

### `get_session`

Returns a specific session by ID, or the most recent session when called
without arguments.

```json
{ "method": "tools/call", "params": { "name": "get_session", "arguments": { "sessionId": "<uuid>" } } }
```

**Use when:** the user asks about a specific session, wants a replay, or you
need commit + file-change details for a bounded time window.

### `get_hot_files`

Returns the most frequently edited files across recent history, ranked by save
count.

```json
{ "method": "tools/call", "params": { "name": "get_hot_files", "arguments": { "limit": 10 } } }
```

**Use when:** deciding where to focus a refactor, understanding which modules
are under active development, or orienting yourself in an unfamiliar codebase.

### `get_decisions`

Returns commits prefixed with `decide:`, `adr:`, or containing `decision:` —
architectural decisions recorded in commit messages.

```json
{ "method": "tools/call", "params": { "name": "get_decisions", "arguments": { "limit": 10 } } }
```

**Use when:** the user asks why something was built a certain way, or before
proposing a significant architectural change.

### `get_todos`

Returns commits containing `TODO`, `WIP`, or `FIXME` in their messages —
open work items left in commit history.

```json
{ "method": "tools/call", "params": { "name": "get_todos", "arguments": { "limit": 10 } } }
```

**Use when:** the user asks what's left to do, or before starting a new
feature to check for known open items.

## Recommended workflow

1. **Load context first** — call `get_context` before answering any question
   about project history.
2. **Drill into sessions** — if the question is about a specific time window,
   use `get_session` with the relevant session ID from step 1.
3. **Check hot files before editing** — call `get_hot_files` to understand
   which files are actively changing; avoid touching them without reason.
4. **Check decisions before proposing changes** — call `get_decisions` to
   understand prior architectural choices.
5. **Check todos before adding features** — call `get_todos` to avoid
   duplicating work already tracked.

## CLI alternative

If MCP is unavailable, fall back to the `vrrbose ask` CLI:

```bash
vrrbose ask "What did I work on yesterday?"
vrrbose ask "Summarize this week's sessions"
vrrbose ask "What changed in the auth module?"
```

## Output interpretation

| Field | Meaning |
|-------|---------|
| `score` | Session productivity score (higher = more focused activity) |
| `fileChurn` | Lines added + deleted across the session |
| `commitCount` | Git commits landed during the session |
| `startedAt` / `endedAt` | Unix milliseconds; convert with `new Date(ms)` |

Sessions with no `endedAt` are still in progress.
