/**
 * Check — the keep-it-true piece. Given a code change, find notes anchored to the
 * changed files and ask the model whether the change makes each note's claim
 * false. Prints a verdict per note; exits non-zero if any look stale, so it can
 * gate a PR. This is the one thing a flat doc / CLAUDE.md can't do for you.
 */
import { execFileSync } from "node:child_process";
import { completeJSON } from "./llm";
import { loadNotes, matchedFiles, type Note } from "./store";

interface Verdict {
  verdict: "supported" | "stale" | "unclear";
  reason: string;
}

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  } catch {
    return "";
  }
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s);

export async function runCheck(args: string[], cwd: string = process.cwd()): Promise<void> {
  const base = args.find((a) => !a.startsWith("--"));
  const changed = git(base ? ["diff", "--name-only", base] : ["diff", "--name-only", "HEAD"])
    .split("\n")
    .filter(Boolean);

  if (changed.length === 0) {
    console.log("No changed files to check.");
    return;
  }

  const notes = loadNotes(cwd).filter((n) => matchedFiles(n, changed).length > 0);
  if (notes.length === 0) {
    console.log("No notes are anchored to the changed files — nothing to check.");
    return;
  }

  console.log(`Checking ${notes.length} note(s) against the change...\n`);
  let stale = 0;
  for (const n of notes) {
    const v = await judge(n, changed, base);
    if (v.verdict === "stale") stale++;
    const tag = v.verdict === "stale" ? "STALE  " : v.verdict === "unclear" ? "unclear" : "ok     ";
    console.log(`[${tag}] ${n.id} — ${v.reason}`);
  }

  if (stale > 0) {
    console.log(`\n${stale} note(s) may be stale — review and update or retire them.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll touched notes still supported by the code.");
  }
}

async function judge(note: Note, changed: string[], base?: string): Promise<Verdict> {
  const files = [...new Set(matchedFiles(note, changed))];
  const range = base ?? "HEAD";
  const diff = git(["diff", range, "--", ...files]);
  const prompt =
    `A repo-knowledge note and a code change. Decide whether the change makes the note's claim FALSE.\n\n` +
    `NOTE:\n${note.body}\n\nDIFF:\n${truncate(diff, 8000)}\n\n` +
    `Return JSON {"verdict":"supported|stale|unclear","reason":"one short line"}. ` +
    `"stale" only if the change clearly contradicts the note; "unclear" if you can't tell.`;
  return completeJSON<Verdict>(prompt);
}
