# AGENTS.md

Pointer file for non-Claude agents. It duplicates nothing.

- Orientation, doc index, working rules and guardrails: `CLAUDE.md`
- Scope, architecture, decisions and deadline: `specs/SPIRITH_HANDOVER.md`
- Engineering conventions: the `rsodre-skills` library (https://github.com/rsodre/agent-skills),
  plugins `core`, `web`, `web3`. Claude Code loads them from `.claude/settings.json`; other agents
  symlink `plugins/<plugin>/skills/*` per that repo's AGENTS.md.
