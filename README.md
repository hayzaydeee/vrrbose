# vrrbose

**An agent that watches your code while you build.**

Vrrbose runs quietly in the background, capturing git commits, file activity, and coding sessions. Ask it anything about your work history in plain English — what you built, when, and why.

---

## Install

```bash
npm install -g vrrbose
```

Node.js 18+ required.

---

## Quick start

```bash
# 1. Create a free account
vrrbose login

# 2. Start tracking a project
cd /path/to/your/project
vrrbose init

# 3. Ask questions about your work
vrrbose ask "What did I work on yesterday?"
vrrbose ask "Summarize this week's sessions"
vrrbose ask "What changed in the auth module last Tuesday?"

# 4. Open the dashboard
vrrbose ui
```

That's it. No API keys. No infrastructure to set up.

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

## Dashboard

`vrrbose ui` opens the dashboard — locally at `http://localhost:7331/ui/` or at [app.vrrbose.dev](https://app.vrrbose.dev) when signed in — with:

- Live session view with activity scoring
- Commit and file event timeline
- Session history and metrics
- Agent chat for querying your history

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

## Troubleshooting

**Daemon not running:**
```bash
vrrbose start
vrrbose status
```

**Inspect logs:**
```bash
# macOS / Linux
tail -f ~/.vrrbose/daemon.log

# Windows PowerShell
Get-Content "$HOME/.vrrbose/daemon.log" -Wait
```

---

## Links

- Website: [vrrbose.dev](https://vrrbose.dev)
- Dashboard: [app.vrrbose.dev](https://app.vrrbose.dev)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for monorepo setup and development workflow.

---

## License

MIT
