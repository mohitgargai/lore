# lore

Coding agents are good at reading the code in front of them. They're bad at
everything that isn't in the code: why a function that looks redundant is
actually load-bearing, which approach got tried and reverted last month, the
rule that only makes sense once you've seen three files at once. That stuff lives
in people's heads and dead PR threads, and every fresh agent session starts
without it.

lore keeps that knowledge as markdown in the repo and hands it to the agent when
it's relevant.

Two things happen automatically, with no API key: at session start it injects a
short index of what's written down (Orient), and right before an edit it injects
the full note for that file (Guard) — the last moment to prevent a wrong change.
Neither relies on the agent choosing to look something up.

Two more things keep the corpus alive and honest (these call an LLM — bring your
own key, local models work). At the end of each session lore **auto-captures**
notes from what just happened — biased to the moments where you corrected the
agent — and every candidate must pass a skeptical verify step before it's
written. There's no manual review: the verify *is* the approval, because a corpus
that needs someone to run a command and click accept stays empty. And `lore
check` flags a note when the code under it changed, so knowledge doesn't quietly
rot.

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
lore setup     # guided: configure the LLM key (for capture/check), then init this repo
# or, no prompts / no key:
lore init      # just creates .lore/ and wires the hooks
lore index     # print what the agent gets at session start
```

`lore setup` is the friendly start — it walks you through the LLM endpoint/key
(only needed for capture & check) and offers to init the repo. `lore init` is the
scriptable, keyless version.

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

Three Claude Code hooks, wired by `lore init`:

- **Orient** — `SessionStart` returns the index (titles + anchors only, so it's
  cheap to keep in context) via `additionalContext`.
- **Guard** — `PreToolUse` on `Edit|Write` reads the target file and returns the
  full body of any note anchored to it, via `additionalContext`. It adds context;
  it doesn't block the edit.
- **Capture** — `Stop` auto-captures new notes at session end (covered below).
  Needs an LLM; no-ops without one.

Orient and Guard are the keyless core — pure file matching, no API key. Plain
files, no database. Anchor matching is glob-based (`micromatch`).

## Capture and check (optional, bring your own LLM)

The core above needs no API key. These two do. Easiest is `lore setup`, which
configures and persists it (to `~/.config/lore/config.json`, readable only by
you). Or set env vars (which always override the saved config — handy for CI):

```bash
export LORE_LLM_BASE_URL=https://api.openai.com/v1   # or http://localhost:11434/v1 (Ollama)
export LORE_LLM_MODEL=gpt-5.4-mini                   # or a local model
export LORE_LLM_API_KEY=...                          # or OPENAI_API_KEY; omit for local
```

- **Auto-capture** runs on the `Stop` hook (wired by `lore init`): at session end
  it mines the transcript + diff for durable, non-derivable notes — biased to
  where you corrected the agent — verifies each one against the code, and writes
  the survivors to `.lore/notes/` (`source: auto`). The verify step is the only
  gate; there's no manual review. It no-ops silently until an LLM is configured.
- `lore capture [range]` runs the same pipeline on demand — handy for
  backfilling notes from a stretch of history (e.g. `lore capture main`).
- `lore check [base]` — finds notes anchored to changed files and asks the model
  whether the change makes each claim false. Prints a verdict per note and exits
  non-zero if any look stale, so it can gate a PR.

Staleness in CI — run `lore check` against the PR base:

```yaml
# not on npm yet; install (and build) straight from the repo:
- run: npm i -g github:mohitgargai/lore
- run: lore check origin/${{ github.base_ref }}
  env: { LORE_LLM_BASE_URL: ..., LORE_LLM_MODEL: ..., LORE_LLM_API_KEY: ${{ secrets.LLM_KEY }} }
```

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
