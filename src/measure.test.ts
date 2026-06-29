import { describe, expect, it } from "vitest";
import { type LogEvent, summarizeLog } from "./log";
import { matchedFiles, parseNoteContent } from "./store";

describe("matchedFiles", () => {
  const note = parseNoteContent(`---\nid: n\nanchors: ["src/export/**", "models/asset.py"]\n---\nbody`, "n")!;
  it("returns the subset of changed files an anchor matches", () => {
    const changed = ["src/export/routes.ts", "src/auth/login.ts", "models/asset.py"];
    expect(matchedFiles(note, changed).sort()).toEqual(["models/asset.py", "src/export/routes.ts"]);
  });
  it("returns empty when nothing matches", () => {
    expect(matchedFiles(note, ["src/auth/login.ts"])).toEqual([]);
  });
});

describe("log summary", () => {
  it("reports a clear message when empty", () => {
    expect(summarizeLog([])).toMatch(/no recall events/i);
  });
  it("counts orient and guard separately and ranks notes", () => {
    const evts: LogEvent[] = [
      { ts: "2026-06-28T10:00:00Z", trigger: "orient", notes: ["a", "b"] },
      { ts: "2026-06-28T11:00:00Z", trigger: "guard", notes: ["a"], file: "src/x.ts" },
      { ts: "2026-06-28T12:00:00Z", trigger: "guard", notes: ["a"], file: "src/x.ts" },
    ];
    const out = summarizeLog(evts);
    expect(out).toContain("orient (session starts): 1");
    expect(out).toContain("guard  (note injected before an edit): 2");
    expect(out).toContain("src/x.ts");
  });
});
