# Security

## What lore does (and doesn't)

lore makes **no network calls and needs no API key.** It reads and writes plain
markdown notes under `.lore/` in your repo, and appends a local recall log
(`.lore/recall-log.jsonl`, which is gitignored). The intelligence is the coding
agent you already run; lore only feeds it text from your own repo through Claude
Code hooks.

Nothing about your code leaves your machine because of lore. (Whatever your agent
itself sends to its provider is governed by that agent, not by lore.)

## Reporting a vulnerability

Please open a GitHub security advisory (Security > Report a vulnerability) rather
than a public issue, so it can be handled before disclosure.
