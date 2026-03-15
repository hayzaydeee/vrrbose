# vrrbose agent skills

Packaged instructions that extend AI coding agent capabilities for the vrrbose
ecosystem. Each skill lives in its own directory with a `SKILL.md` file.

## Available skills

| Skill | Description |
|-------|-------------|
| [`vrrbose-context`](./vrrbose-context/SKILL.md) | Load project history from the vrrbose daemon before answering questions or making changes |
| [`vrrbose-development`](./vrrbose-development/SKILL.md) | Guidelines for contributing to the vrrbose codebase |

## Installation

### Claude Code

Copy a skill to your Claude Code skills directory:

```bash
cp -r skills/vrrbose-context ~/.claude/skills/
cp -r skills/vrrbose-development ~/.claude/skills/
```

Or reference the `SKILL.md` directly in your project's `CLAUDE.md`:

```markdown
See [skills/vrrbose-context/SKILL.md](skills/vrrbose-context/SKILL.md) for MCP context-loading instructions.
```

### Other agents

Paste the contents of a `SKILL.md` file into your agent's system prompt or
context window.

## Skill format

Skills follow the [Agent Skills format](https://github.com/vercel-labs/agent-skills):

```
skills/{skill-name}/
├── SKILL.md        ← agent instructions (frontmatter + markdown)
└── scripts/        ← optional automation helpers
```

`SKILL.md` frontmatter fields:

| Field | Description |
|-------|-------------|
| `name` | Kebab-case skill identifier |
| `description` | When and why to apply this skill |
| `license` | License (MIT) |
| `metadata.author` | Author |
| `metadata.version` | Semver version |
