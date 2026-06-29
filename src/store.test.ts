import { describe, expect, it } from "vitest";
import { type Note, notesForFile, parseNoteContent, renderGuard, renderIndex } from "./store";

const RAW = `---
id: export-async-ratelimit
tier: rationale
anchors: ["src/export/**", "symbol:enqueueExport"]
confidence: high
---
Rate limiting for exports must be applied at enqueue, not the request handler.
`;

describe("parseNoteContent", () => {
  it("reads frontmatter and uses the first body line as the title", () => {
    const note = parseNoteContent(RAW, "fallback")!;
    expect(note.id).toBe("export-async-ratelimit");
    expect(note.tier).toBe("rationale");
    expect(note.anchors).toEqual(["src/export/**", "symbol:enqueueExport"]);
    expect(note.title).toMatch(/^Rate limiting for exports/);
  });

  it("rejects empty notes", () => {
    expect(parseNoteContent("---\nid: x\n---\n", "x")).toBeNull();
  });
});

describe("notesForFile", () => {
  const notes: Note[] = [parseNoteContent(RAW, "x")!];
  it("matches a glob anchor (relative path)", () => {
    expect(notesForFile(notes, "src/export/handler.ts").map((n) => n.id)).toContain("export-async-ratelimit");
  });
  it("matches when given an absolute path under cwd", () => {
    const abs = `${process.cwd()}/src/export/handler.ts`;
    expect(notesForFile(notes, abs).map((n) => n.id)).toContain("export-async-ratelimit");
  });
  it("ignores unrelated files", () => {
    expect(notesForFile(notes, "src/auth/login.ts")).toEqual([]);
  });
  it("never matches on symbol anchors alone", () => {
    const symOnly: Note[] = [{ ...notes[0]!, anchors: ["symbol:enqueueExport"] }];
    expect(notesForFile(symOnly, "src/export/handler.ts")).toEqual([]);
  });
});

describe("renderIndex", () => {
  it("is empty when there are no notes", () => {
    expect(renderIndex([])).toBe("");
  });
  it("lists titles with anchors", () => {
    const out = renderIndex([parseNoteContent(RAW, "x")!]);
    expect(out).toContain("Repo knowledge (lore)");
    expect(out).toContain("`src/export/**`");
  });
});

describe("renderGuard", () => {
  it("is empty when nothing is anchored to the file", () => {
    expect(renderGuard([], "src/export/handler.ts")).toBe("");
  });
  it("includes the file and the full note body", () => {
    const out = renderGuard([parseNoteContent(RAW, "x")!], "src/export/handler.ts");
    expect(out).toContain("src/export/handler.ts");
    expect(out).toContain("applied at enqueue");
  });
});
