# VRRBOSE

> Project configuration for the Vrrbose agent.
> This file is read on every `vrrbose` invocation. Edit it freely.
> Commit it to version control — it's part of the project's history.
>
> SECURITY: Structured YAML fields are parsed as data. Freeform text
> (standing instructions, description) is scanned for agent directives
> before being passed to the agent. Core agent behaviour cannot be
> overridden from this file. In cloned repos, run `vrrbose trust` to
> review and verify this file before it takes effect.

---

## Project

```yaml
name: my-project
type: web-app              # web-app | api | cli | library | monorepo | other
stack:
  - Node.js
  - React
  - MongoDB
description: >
  One or two sentences about what this project does and who it's for.
  The agent uses this when generating summaries, brag sheets, and capsules.
```

---

## Standing instructions

<!--
  Describe the project here — conventions, architecture, ongoing work, team structure.
  Write declarative facts about the codebase, not instructions to the agent.

  CONTENT POLICY: This section is scanned before being read by the agent.
  Lines containing agent directives ("you must", "always", "ignore", "override",
  "you are now", "generate code") will be stripped automatically and you will
  be warned. The agent's core behaviour cannot be changed from this file.

  Good things to put here:
  - Naming conventions ("we use conventional commits: feat:, fix:, chore:")
  - Architectural context ("the API and frontend are in separate repos")
  - Ongoing work ("currently migrating from REST to WebSockets")
  - Known debt ("auth.js is being refactored — treat it as unstable")
  - Team context ("solo project" or "two engineers, I own the frontend")
  - Settled decisions ("using MongoDB over PostgreSQL — decided 2026-01")
-->

- We use conventional commits (feat:, fix:, chore:, refactor:, docs:)
- Solo project

---

## Capture preferences

```yaml
capture:
  staged_diffs: metadata_only     # metadata_only | enrich_with_ai | off
  terminal_commands:
    log: all                      # all | filtered
    filter_trivial: true          # strips ls, cd, clear, pwd before summarisation
  ai_prompts: true                # requires MCP middleware (Cursor only)
  test_runs: true
  file_edits:
    debounce_minutes: 3           # flush edit session after N minutes of inactivity
```

---

## Inactivity & session settings

```yaml
session:
  inactivity_threshold_hours: 2   # trigger summarisation after N hours of no commits
  idle_keyboard_minutes: 30       # mark keyboard idle after N minutes
  auto_capsule_on_merge: true     # create time capsule when merging to main
  auto_capsule_on_tag: true       # create time capsule on version tags
  weekly_capsule_day: sunday      # monday | tuesday | ... | sunday | off
```

---

## Output preferences

```yaml
output:
  default_format: session_summary   # session_summary | weekly_digest | brag_sheet |
                                    # performance_review | cv_bullets | investor_update

  # Which outputs go where. Add multiple destinations per output type.
  destinations:
    session_summary:
      - local
    weekly_digest:
      - local
    time_capsule:
      - local
    living_readme:
      - git
    brag_sheet:
      - local

  # Where local files are written
  local_output_path: ~/.vrrbose/output/

  # Email digest settings (requires email adapter)
  email:
    enabled: false
    schedule: monday_09:00        # cron-style or human-readable
    # address configured in global ~/.vrrbose/config.yaml

  # Notion settings (requires Notion adapter)
  notion:
    enabled: false
    # database_id configured in global ~/.vrrbose/config.yaml

  # Slack settings (requires Slack adapter)
  slack:
    enabled: false
    # webhook_url configured in global ~/.vrrbose/config.yaml
```

---

## Document generation

```yaml
documents:
  # Default audience and tone hints for each output format.
  # The agent uses these when no explicit instruction is given.

  brag_sheet:
    audience: peers               # peers | manager | recruiter | public
    tone: achievement             # achievement | narrative | technical
    period: last_quarter          # last_week | last_month | last_quarter | ytd

  performance_review:
    audience: manager
    tone: impact_focused
    period: last_quarter
    # Paste your company's review template below (optional).
    # The agent will mirror this structure when generating.
    custom_template: null

  cv_bullets:
    audience: recruiter
    style: action_verb_metric     # action_verb_metric | narrative | technical
    max_bullets: 6
```

---

## Living README

```yaml
living_readme:
  enabled: false                  # set to true to activate injection zones
  review_before_commit: true      # always surface updates for review first
  consolidate_changelog: true     # group related commits into one entry
  adr_prompts: true               # prompt to log architectural decisions

  # Which injection zones are active for this project.
  # Add <!-- VRRBOSE:zone --> markers to your README to use them.
  zones:
    features: true
    api: true
    dependencies: true
    env: true
    changelog: true
```

---

## Proactive nudges

```yaml
nudges:
  enabled: true
  max_per_day: 3
  max_per_session: 1

  # Toggle individual nudge types
  session_close_summary: true
  merge_to_main_capsule: true
  monday_digest: true
  repeated_file_pattern: true     # "you've been back to X file N times..."
  stale_branch_warning: true
  coverage_drop_alert: true
  reasoning_anchor: true          # "you've returned to X with no decision on record"

  # How many days before a branch is considered stale
  stale_branch_days: 7

  # Coverage drop threshold that triggers an alert (percentage points)
  coverage_drop_threshold: 5
```

---

## Replay preferences

```yaml
replay:
  default_mode: step              # step | scan | overview
  pr_auto_attach: false           # attach replay to PRs (opt-in per repo)
  private_by_default: true        # replays require explicit share action
```

---

## Agent reasoning preferences

```yaml
reasoning:
  # Files or directories the agent should treat as architecturally significant.
  # These are loaded first in any REASONING query.
  anchor_files:
    - src/server.js
    - src/middleware/auth.js
    # - add more as needed

  # Modules the agent should know are actively unstable or in flux.
  # It will flag these when they appear in reasoning threads.
  unstable_modules: []
    # - src/legacy/

  # Decisions already made that the agent should treat as settled.
  # Prevents it from re-surfacing closed questions.
  settled_decisions:
    # - "Using MongoDB over PostgreSQL for schema flexibility"
    # - "REST for external API, WebSockets for real-time features"
```

---

## Time capsule preferences

```yaml
capsule:
  storage: private                # private (local + cloud sync) | repo (committed to .vrrbose/)
  diff_summary: true              # include "since last capsule" delta section
  max_key_files: 20               # max files included in mental model summary
  # Files always included regardless of change recency
  always_include:
    - package.json
    - src/server.js
    # - add entry points, config files, etc.
```

---

## AI pair integration

```yaml
# Controls how Vrrbose shares context with your other AI tools.

mcp_server:
  enabled: false                  # expose Vrrbose as an MCP server
  port: 7332
  # Tools allowed to connect. Unlisted clients are rejected.
  allowed_clients:
    - claude-code
    # - cursor
    # Add others as they gain MCP support

context_injection:
  # Automatically maintain context blocks in AI pair config files.
  # Vrrbose only writes inside clearly-marked VRRBOSE:context blocks.
  # Your own content in these files is never touched.
  enabled: false
  update_on:
    - session_close
    - merge_to_main
    - new_capsule

  targets:
    claude_code: true             # injects into CLAUDE.md
    cursor: false                 # injects into .cursor/rules
    copilot: false                # injects into .github/copilot-instructions.md

  include_sensitive: false        # include private capsule content in injected block
```

---

## AI model preferences

```yaml
ai:
  primary: claude                 # claude | ollama
  ollama_model: llama3            # used as fallback when primary is claude,
                                  # or as primary when set above
  show_model_indicator: true      # surface which model produced each summary
```

