---
id: hooks-must-fail-open
title: Hook code must fail open, never hang or throw
tier: rationale
anchors: ["src/hooks.ts", "src/log.ts", "symbol:readHookInput", "symbol:logEvent"]
confidence: high
source: seed
created: 2026-06-29
---
Everything on the hook path must degrade to "no context" rather than block. A
hook that hangs or throws freezes or breaks every Claude Code turn in the user's
repo, which is far worse than lore adding nothing. That is why `readHookInput`
has a 500ms `setTimeout` safety net and resolves `{}` on empty/invalid/TTY
stdin, and why `logEvent` swallows every exception. Don't "clean up" these by
removing the timeout or letting errors propagate; the defensiveness is the point.
