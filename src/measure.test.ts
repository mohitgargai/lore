import { describe, expect, it } from "vitest";
import { loadCases, scores } from "./eval";
import { summarizeLog, type LogEvent } from "./log";

describe("eval scoring", () => {
  it("passes when all includes present and no excludes present", () => {
    expect(scores("use db.users.update(id, {status:'deleted'})", { includes: ["status"], excludes: ["users.delete"] })).toBe(true);
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
