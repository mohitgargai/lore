---
id: keyless-is-load-bearing
title: lore is keyless by design; the agent grows the corpus, not lore
tier: rationale
anchors: ["src/cli.ts", "src/store.ts", "symbol:renderSessionStart"]
confidence: high
source: seed
created: 2026-06-29
---
lore never calls an LLM or the network. New notes are written by the coding agent
itself, prompted by the Orient recording instruction, using its own Write tool.
This is the core promise stated in README.md and SECURITY.md ("no API key, no
network calls"). Any feature that adds an outbound call or an API key breaks that
promise and the security posture, so keep new code keyless; if intelligence is
needed, route it through the agent's own tools rather than calling out from lore.
