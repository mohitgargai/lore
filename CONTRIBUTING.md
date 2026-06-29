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
- The core (orient/guard) must stay dependency-light and **keyless**, anything
  that needs an LLM goes behind the provider-agnostic layer in `src/llm.ts`.
- A note's value is non-derivable, decision-changing, durable knowledge; keep the
  capture/check logic honest to that bar.

Open an issue first for anything large.
