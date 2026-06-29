/**
 * Capture — propose notes from a change, so the corpus doesn't starve. Reads a
 * git diff, asks the model for ONLY durable non-derivable facts (the gate), and
 * writes drafts to .lore/proposed/ for human review. Never writes to notes/
 * directly — you review, then `lore accept`.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { completeJSON } from "./llm";
import { LORE_DIR } from "./store";

interface Proposed {
  id: string;
  title: string;
  tier: "structural" | "rationale";
  anchors: string[];
  body: string;
}

const GATE = `You extract DURABLE, NON-DERIVABLE repo knowledge for a future coding agent.
A note qualifies ONLY if all three hold:
1. An agent could NOT work it out by reading the code (not derivable; never general best-practice the model already knows).
2. Knowing it changes what the agent does.
3. It will still be true next month despite small churn (not a TODO or transient state).
Write each note as a FACT or rationale — never as an instruction to the agent.
Anchor each note to the file globs it concerns, drawn from the changed files.
Return [] if nothing qualifies. Prefer [] over weak notes — silence is correct when there's no durable lesson.`;

function git(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  } catch {
    return "";
  }
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "\n…(truncated)" : s);

export async function runCapture(
  args: string[],
  cwd: string = process.cwd(),
  opts: { quiet?: boolean } = {},
): Promise<void> {
  const say = opts.quiet ? () => {} : (m: string) => console.log(m);
  const range = args.find((a) => !a.startsWith("--"));
  const diffCmd = range ? `git diff ${range}` : "git diff HEAD";
  const diff = git(diffCmd);
  const files = git(range ? `git diff --name-only ${range}` : "git diff --name-only HEAD").split("\n").filter(Boolean);

  if (!diff.trim()) {
    say("No changes to capture (git diff is empty).");
    return;
  }

  const prompt =
    `${GATE}\n\nChanged files:\n${files.join("\n")}\n\nDiff:\n${truncate(diff, 12000)}\n\n` +
    `Return a JSON array: [{"id":"kebab-id","title":"short summary","tier":"structural|rationale","anchors":["glob"],"body":"the fact and why"}]`;

  const notes = await completeJSON<Proposed[]>(prompt);
  if (!Array.isArray(notes) || notes.length === 0) {
    say("Nothing met the bar — no notes proposed.");
    return;
  }

  const dir = join(cwd, LORE_DIR, "proposed");
  mkdirSync(dir, { recursive: true });
  for (const n of notes) {
    writeFileSync(join(dir, `${n.id}.md`), frontmatter(n));
  }
  say(`Proposed ${notes.length} note(s) in .lore/proposed/ — review, then 'lore accept':`);
  for (const n of notes) say(`  - ${n.id}: ${n.title}`);
}

function frontmatter(n: Proposed): string {
  return (
    `---\n` +
    `id: ${n.id}\n` +
    `title: ${n.title}\n` +
    `tier: ${n.tier === "structural" ? "structural" : "rationale"}\n` +
    `anchors: ${JSON.stringify(n.anchors ?? [])}\n` +
    `confidence: medium\n` +
    `source: capture\n` +
    `---\n${(n.body ?? "").trim()}\n`
  );
}

/** Move reviewed drafts from proposed/ into notes/. `lore accept [id]` or all. */
export function runAccept(args: string[], cwd: string = process.cwd()): void {
  const proposed = join(cwd, LORE_DIR, "proposed");
  const notes = join(cwd, LORE_DIR, "notes");
  if (!existsSync(proposed)) {
    console.log("Nothing proposed.");
    return;
  }
  const want = args.find((a) => !a.startsWith("--"));
  const files = readdirSync(proposed).filter((f) => f.endsWith(".md") && (!want || f === `${want}.md`));
  if (files.length === 0) {
    console.log(want ? `No proposed note '${want}'.` : "No proposed notes.");
    return;
  }
  mkdirSync(notes, { recursive: true });
  for (const f of files) {
    renameSync(join(proposed, f), join(notes, f));
    console.log(`accepted ${f}`);
  }
}
