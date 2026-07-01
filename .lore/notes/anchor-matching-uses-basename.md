---
id: anchor-matching-uses-basename
title: Anchors match basename as well as full path (by design)
tier: structural
anchors: ["src/store.ts", "symbol:notesForFile", "symbol:matchedFiles"]
confidence: high
source: seed
created: 2026-06-29
---
`notesForFile` and `matchedFiles` test each glob anchor against BOTH the
repo-relative path and the file's basename. That is deliberate so bare-filename
and extension anchors (`asset.py`, `*.test.ts`) match without the author needing
the full path. Narrowing this to path-only matching would silently stop those
anchors from firing. `symbol:` anchors are intentionally skipped by file matching
(they exist for humans and future symbol indexing, not glob matching).
