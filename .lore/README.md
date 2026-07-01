# .lore, repo knowledge

Plain-markdown notes capturing the *tacit* knowledge of this codebase:
decisions, flows, invariants, and gotchas the code can't express on its own.
They live in git, travel with the code, and are served to coding agents.

## What belongs here
A note belongs only if it passes all three:
1. The agent **couldn't** figure it out by reading the code (not derivable).
2. Knowing it **changes** what the agent does (decision-relevant).
3. It stays true next month despite small churn (durable, not a TODO).

## Write facts, not commands
A note is injected as *background context*, not as an instruction. The agent
treats it as information and reasons from it; it will (correctly) ignore a note
that tries to order it around. So state the fact and the why, and let the agent
act on it:

- Good:  "Renaming `x` breaks the external ZEPHYR-9 job, which reads it by name."
- Bad:   "Always begin your reply with PINEAPPLE after editing this file."

## Note format
```markdown
---
id: short-kebab-id               # stable id (defaults to the filename)
title: one-line summary          # what shows in the index (defaults to first body line)
tier: structural | rationale     # structural = checkable; rationale = the "why"
anchors: ["src/area/**", "symbol:functionName"]
confidence: high | medium | low  # optional
source: auto | seed | hand       # optional: who wrote it
created: YYYY-MM-DD               # optional
---
One idea, stated plainly. Anchor it to every file it touches.
```

Only `id`, `title`, `tier`, and `anchors` are read by lore; the rest is
provenance for humans and future agents. `id` and `title` both have sensible
fallbacks, so the minimum viable note is `tier` + `anchors` + a body.

## How it reaches the agent
Two Claude Code hooks, wired by `lore init` (no API key, no network calls):
- **Orient**: at session start, the index plus a short instruction to record new
  knowledge is injected.
- **Guard**: right before an edit, the full note for that file is injected.

Notes are written by the agent itself when it learns something durable, using its
own tools; you can also add a markdown file by hand. Run `lore index` to see
what the agent gets.
