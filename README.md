# vrrbose

> **This package is deprecated.** A new release is coming May 1, 2026.

---

**An agent that watches your code while you build.**

Vrrbose runs quietly in the background, capturing git commits, file activity, and coding sessions. Ask it anything about your work history in plain English — what you built, when, and why.

---

## Install

```bash
npm install -g vrrbose
```

Node.js 18+ required.

---

## What it captures

- **Git events** — commits, branch switches, merges
- **File activity** — creates, saves, deletes, hot files
- **Sessions** — automatic grouping of activity into focus sessions with scoring and metrics
- **Timeline** — full chronological history queryable by natural language

All activity is stored locally first, then synced to your account for access across machines and persistent history.

---

## CLI reference

```
vrrbose login              Sign in or create a free account
vrrbose init               Start tracking the current project
vrrbose start              Start the background daemon manually
vrrbose stop               Stop the daemon
vrrbose status             Show daemon and project status
vrrbose ask <query>        Ask a question about your work history
vrrbose replay [session]   Replay a session timeline
vrrbose ui                 Open the web dashboard
```

Add `--json` to any command for machine-readable output.

---

## How it works

Vrrbose runs a lightweight daemon process that watches your project for git and filesystem events. Events are buffered locally in SQLite, grouped into sessions, and synced to the cloud. The agent endpoint uses your session history as context to answer questions about your work.

```
your project
     │
     ▼
 daemon (local)
  ├─ git watcher
  ├─ filesystem watcher
  ├─ session manager
  └─ SQLite buffer (~/.vrrbose/vrrbose.db)
     │
     ▼
 vrrbose cloud
  ├─ event store
  ├─ session history
  └─ AI agent (no API key needed)
```

---

## Privacy

- Activity is captured locally before any sync occurs.
- Only events from explicitly initialized projects are tracked.
- You can stop tracking a project at any time with `vrrbose init --remove`.
- Local data lives at `~/.vrrbose/` and can be deleted at any time.

---

## License

MIT
