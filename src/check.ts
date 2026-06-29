/**
 * Check, keyless. Given a code change, flag the notes anchored to the changed
 * files so they get re-read. It does not judge whether a note is actually false
 * (that needs a model, and the agent does that in-session via the recording
 * instruction); this is the cheap mechanical reminder, suitable for CI. Exits
 * non-zero if any note's code changed, so it can surface on a PR.
 */
import { execFileSync } from "node:child_process";
import { loadNotes, matchedFiles } from "./store";

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  } catch {
    return "";
  }
}

export function runCheck(args: string[], cwd: string = process.cwd()): void {
  const base = args.find((a) => !a.startsWith("--"));
  const changed = git(base ? ["diff", "--name-only", base] : ["diff", "--name-only", "HEAD"])
    .split("\n")
    .filter(Boolean);

  if (changed.length === 0) {
    console.log("No changed files to check.");
    return;
  }

  const flagged = loadNotes(cwd)
    .map((n) => ({ note: n, files: matchedFiles(n, changed) }))
    .filter((x) => x.files.length > 0);

  if (flagged.length === 0) {
    console.log("No notes are anchored to the changed files.");
    return;
  }

  console.log("These notes cover code that changed. Re-read them and update any that are now wrong:\n");
  for (const { note, files } of flagged) {
    console.log(`  ${note.id}  (${files.join(", ")})`);
  }
  process.exitCode = 1;
}
