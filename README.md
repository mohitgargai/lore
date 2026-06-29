# lore

Coding agents are good at reading the code in front of them. They're bad at
everything that isn't in the code: why a function that looks redundant is
actually load-bearing, which approach got tried and reverted last month, the
rule that only makes sense once you've seen three files at once. That stuff lives
in people's heads and dead PR threads, and every fresh agent session starts
without it.

lore keeps that knowledge as markdown in the repo and hands it to the agent when
it's relevant. No API key, no network calls: the agent you already run is the
intelligence.

At the start of a Claude Code session it injects a short index of what's written
down, plus a one-line instruction to record anything new it learns. Right before
an edit it injects the full note for that file. The agent reads those and writes
new notes itself, with its own tools, whenever it hits something durable and
non-obvious. That's the whole loop.

## Install

```bash
npm install -g @mohitgargai/lore
```

Or from source:

```bash
npm install
npm run build
npm link
```

## Use

In a repo you work on with Claude Code:

```bash
lore init      # creates .lore/ and wires the two hooks
lore index     # print what the agent gets at session start
```

Restart Claude Code in that repo. From then on the index loads at session start,
notes get injected before edits, and the agent records new ones as it learns, all
on its own. You can also write notes by hand: drop a markdown file in
`.lore/notes/` (the format is in `.lore/README.md` after you run init).

```bash
lore recall src/foo.ts   # the full notes anchored to a file
lore list                # note ids + anchors
lore check [base]        # flag notes whose code changed, so they get re-read
```

## What's worth a note

Only write a note if all three hold: the agent couldn't work it out from the
code, knowing it changes what the agent does, and it'll still be true next month.
Everything else is noise that rots. That's the whole discipline, and the
recording instruction holds the agent to the same bar.

Write notes as **facts, not commands**. They're injected as background context,
so the agent reasons from them; it will (correctly) ignore a note that tries to
give it orders. State the fact and the why ("renaming `x` breaks the ZEPHYR-9 job
that reads it by name"), not "always do X."

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

Two Claude Code hooks, wired by `lore init`, both keyless:

- **Orient** (`SessionStart`): returns the index (titles + anchors only, so it's
  cheap to keep in context) plus the instruction to record new knowledge, via
  `additionalContext`.
- **Guard** (`PreToolUse` on `Edit|Write`): reads the target file and returns the
  full body of any note anchored to it, via `additionalContext`. It adds context;
  it doesn't block the edit.

Capture is just the agent writing a markdown note with its own Write tool when it
learns something durable; nothing is sent anywhere by lore. `lore check` is a
cheap mechanical reminder for CI: it flags notes whose anchored files changed so
they get re-read (the agent does the semantic "is this still true" pass
in-session). Plain files, no database. Anchor matching is glob-based
(`micromatch`).

## Does it actually work?

lore is a rare-but-high-value tool: most edits it does nothing; occasionally it
prevents a real mistake. So "did it feel useful today" is the wrong test. Real
value is three factors multiplied, and any weak one kills it:

```
value = P(a relevant note exists) × P(it fires when relevant) × P(injection flips the outcome)
            coverage / capture          retrieval                  injection lift
```

`lore log` measures the middle factor: how often a note actually fired, on which
files (written to `.lore/recall-log.jsonl`, kept local and gitignored). A fire is
necessary, not sufficient; it's the denominator, and the list of fires to
hand-label as save vs noise. The first factor (does a relevant note even exist)
you track by tallying *misses*, the times the agent erred where a note should
have existed.

## License

Apache-2.0.
