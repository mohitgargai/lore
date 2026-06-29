# Contributing

Thanks for taking a look.

## Dev setup

```bash
npm install
npm run build
npm link        # puts `lore` on your PATH
```

## Before opening a PR

```bash
npm run typecheck
npm test
npm run build
```

## Ground rules

- Keep changes small and focused.
- lore is **keyless and makes no network calls.** Keep it that way: the agent in
  the session is the intelligence.
- A note's value is non-derivable, decision-changing, durable knowledge; keep the
  recording instruction and check honest to that bar.

Open an issue first for anything large.
