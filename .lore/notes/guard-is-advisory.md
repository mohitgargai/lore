---
id: guard-is-advisory
title: Guard injects context, it never blocks an edit
tier: rationale
anchors: ["src/hooks.ts", "src/cli.ts", "symbol:preToolUseOutput", "symbol:renderGuard"]
confidence: high
source: seed
created: 2026-06-29
---
The PreToolUse (Guard) hook returns only `additionalContext`; it deliberately
never returns a permission decision, so it cannot stop or gate an edit. lore's
job is to inform the agent, not police it, so it stays useful even when a note is
stale or wrong. Do not add blocking / deny semantics to Guard: that would turn a
best-effort context feed into a gate that a bad note could wedge shut.
