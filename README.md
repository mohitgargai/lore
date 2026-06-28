# lore

Coding agents are good at reading the code in front of them. They're bad at
everything that isn't in the code: why a function that looks redundant is
actually load-bearing, which approach got tried and reverted last month, the
rule that only makes sense once you've seen three files at once. That stuff lives
in people's heads and dead PR threads, and every fresh agent session starts
without it.

lore keeps that knowledge as markdown in the repo and hands it to the agent when
it's relevant.

Two things happen automatically. At the start of a Claude Code session it injects
a short index of what's been written down, so the agent knows where the landmines
are before it touches anything. And right before the agent edits a file, it
injects the full note for that file, at the last moment where it can still
prevent a wrong change. Neither relies on the agent deciding to look something up.

One more trigger is planned but not built: flagging a note when the code under it
changes, so the knowledge doesn't quietly rot. I'd rather ship what's useful and
live with it before adding that.

## Install

Not on npm yet. Clone and link it:

```bash
npm install
npm run build
npm link
```

## Use

In a repo you work on with Claude Code:

```bash
lore init      # creates .lore/ and adds the two hooks
lore index     # print what the agent gets at session start
```

Restart Claude Code in that repo. The index loads at session start, and notes
get injected before edits, on their own. Write notes by dropping markdown files
in `.lore/notes/`; the format is in `.lore/README.md` after you run init.

```bash
lore recall src/foo.ts   # the full notes anchored to a file
lore list
```

## What's worth a note

Only write a note if all three hold: the agent couldn't work it out from the
code, knowing it changes what the agent does, and it'll still be true next month.
Everything else is noise that rots. That's the whole discipline.

Write notes as **facts, not commands**. They're injected as background context,
so the agent reasons from them; it will (correctly) ignore a note that tries to
give it orders. State the fact and the why — "renaming `x` breaks the ZEPHYR-9
job that reads it by name" — not "always do X."

```markdown
---
id: export-rate-limit
tier: rationale
anchors: ["src/export/**"]
---
Rate limiting for exports goes at enqueue, not the request handler, because
exports run async through the job queue. A limiter in middleware/ throttles the
wrong thing (tried that, reverted it).
```

## How it works

Two Claude Code hooks, both feeding the model through `additionalContext`:

- `SessionStart` runs `lore hook session-start` and returns the index (titles +
  anchors only, so it's cheap to keep in context).
- `PreToolUse` on `Edit|Write` runs `lore hook pre-tool-use`, reads the file path
  from the tool input, and returns the full body of any note anchored to it. It
  adds context; it doesn't block the edit.

Plain files, no database. Anchor matching is glob-based (`micromatch`).

## Does it actually work?

lore is a rare-but-high-value tool: most edits it does nothing; occasionally it
prevents a real mistake. So "did it feel useful today" is the wrong test. Real
value is three factors multiplied, and any weak one kills it:

```
value = P(a relevant note exists) × P(it fires when relevant) × P(injection flips the outcome)
            coverage / capture          retrieval                  injection lift
```

Two commands measure the automatable factors:

- `lore log` — **retrieval/coverage.** How often a note actually fired, on which
  files. A fire is necessary, not sufficient: it's the denominator and the list
  of fires to hand-label as save vs noise. Written to `.lore/recall-log.jsonl`
  (kept local, gitignored).
- `lore eval [--runs=N]` — **injection lift.** Runs each held-out case twice
  (no note vs note injected) and reports the lift. It hands the note to the
  model directly, so it *assumes perfect retrieval* — read the number as an
  upper bound. Bring your own OpenAI-compatible endpoint via env
  (`LORE_LLM_BASE_URL` / `LORE_LLM_MODEL` / `LORE_LLM_API_KEY`); a local model
  works. Near-zero lift on cases a model already knows is expected and honest —
  lift should concentrate on non-derivable facts.

The third factor (does a relevant note even exist) is the capture gap: track it
by tallying *misses* — times the agent erred where a note should have existed.

## License

Apache-2.0.
