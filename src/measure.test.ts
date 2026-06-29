import { describe, expect, it } from "vitest";
import { parseTranscript } from "./capture";
import { loadCases, scores } from "./eval";
import { extractJson } from "./llm";
import { type LogEvent, summarizeLog } from "./log";
import { matchedFiles, parseNoteContent } from "./store";

describe("eval scoring", () => {
  it("passes when all includes present and no excludes present", () => {
    expect(
      scores("use db.users.update(id, {status:'deleted'})", { includes: ["status"], excludes: ["users.delete"] }),
    ).toBe(true);
  });
  it("fails when an excluded term appears", () => {
    expect(scores("call db.users.delete(id)", { includes: ["status"], excludes: ["users.delete"] })).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(scores("Store it as UTC", { includes: ["utc"] })).toBe(true);
  });
});

describe("packaged eval cases", () => {
  it("load and are well-formed", () => {
    const cases = loadCases();
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      expect(c.id).toBeTruthy();
      expect(c.task).toBeTruthy();
      expect(c.note).toBeTruthy();
      expect(c.correct).toBeTruthy();
    }
  });
});

describe("extractJson", () => {
  it("pulls a fenced JSON array out of prose", () => {
    const out = extractJson<unknown[]>('Here you go:\n```json\n[{"id":"x"}]\n```\ndone');
    expect(out).toEqual([{ id: "x" }]);
  });
  it("pulls a bare object", () => {
    expect(extractJson<{ verdict: string }>('{"verdict":"stale","reason":"r"}').verdict).toBe("stale");
  });
  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

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

describe("parseTranscript", () => {
  it("condenses JSONL into role-tagged turns and skips junk", () => {
    const raw = [
      JSON.stringify({ message: { role: "user", content: "rename x to y" } }),
      JSON.stringify({
        type: "tool_use",
        message: { role: "assistant", content: [{ type: "text", text: "x is load-bearing" }] },
      }),
      "not json",
    ].join("\n");
    const out = parseTranscript(raw);
    expect(out).toContain("user: rename x to y");
    expect(out).toContain("assistant: x is load-bearing");
  });
  it("ignores non-message events", () => {
    expect(parseTranscript('{"type":"system"}\n')).toBe("");
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
