/**
 * Auto-capture, fully automatic, no human in the loop. Triggered at session end
 * (the Stop hook), it mines the session for durable, non-derivable notes, biased
 * to the high-signal moments (the user corrected the agent, or a non-obvious
 * constraint caused rework). Each candidate then passes a skeptical verify step;
 * that verify IS the approval. Survivors are written straight to .lore/notes/.
 *
 * There is no manual review: a corpus that needs someone to run a command and
 * click accept stays empty. Precision comes from corrections-bias + verify, not
 * from a human gate. Needs an LLM (provider-agnostic; see llm.ts).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { completeJSON } from "./llm";
import { LORE_DIR, loadNotes } from "./store";

interface Candidate {
  id: string;
  title: string;
  tier: "structural" | "rationale";
  anchors: string[];
  body: string;
}

interface Verdict {
  keep: boolean;
  confidence: "high" | "medium" | "low";
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

/** Condense a Claude Code transcript (JSONL) into a role-tagged tail. Best-effort. */
export function parseTranscript(raw: string, maxChars = 8000): string {
  const turns: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let ev: Record<string, any>;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = ev.message ?? ev;
    const role = msg?.role;
    if (role !== "user" && role !== "assistant") continue;
    const text = textOf(msg.content);
    if (text.trim()) turns.push(`${role}: ${text.trim()}`);
  }
  const joined = turns.join("\n");
  return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === "string" ? b : b?.type === "text" ? (b.text ?? "") : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

const GATE = `Extract DURABLE, NON-DERIVABLE repo knowledge for a future coding agent.
Bias hard to the high-signal moments: where the USER CORRECTED or redirected the agent, or where a non-obvious constraint/gotcha caused a mistake or rework. Ignore routine, derivable, or transient changes.
A note qualifies ONLY if all three hold:
1. An agent could NOT work it out by reading the code (never general best-practice).
2. Knowing it changes what the agent does.
3. It will still be true next month.
Write each note as a FACT/rationale, never an instruction. Anchor to the file globs it concerns.
Return [] if nothing qualifies, silence is correct when there's no durable lesson.`;

export async function runCapture(
  args: string[],
  cwd: string = process.cwd(),
  opts: { quiet?: boolean; transcriptPath?: string } = {},
): Promise<void> {
  const say = opts.quiet ? () => {} : (m: string) => console.log(m);
  const range = args.find((a) => !a.startsWith("--"));

  const diff = git(range ? ["diff", range] : ["diff", "HEAD"]);
  const files = git(range ? ["diff", "--name-only", range] : ["diff", "--name-only", "HEAD"])
    .split("\n")
    .filter(Boolean);

  let transcript = "";
  if (opts.transcriptPath) {
    try {
      transcript = parseTranscript(readFileSync(opts.transcriptPath, "utf8"));
    } catch {
      /* no/unreadable transcript, fall back to diff only */
    }
  }

  if (!diff.trim() && !transcript.trim()) {
    say("Nothing to capture.");
    return;
  }

  const existingTitles = loadNotes(cwd).map((n) => n.title);
  const extractPrompt =
    `${GATE}\n\n` +
    (existingTitles.length ? `Already captured (do NOT repeat):\n${existingTitles.join("\n")}\n\n` : "") +
    (transcript ? `Session transcript (tail):\n${transcript}\n\n` : "") +
    `Changed files:\n${files.join("\n")}\n\nDiff:\n${truncate(diff, 8000)}\n\n` +
    `Return a JSON array: [{"id":"kebab-id","title":"short","tier":"structural|rationale","anchors":["glob"],"body":"fact and why"}]`;

  const candidates = await completeJSON<Candidate[]>(extractPrompt);
  if (!Array.isArray(candidates) || candidates.length === 0) {
    say("Nothing met the bar.");
    return;
  }

  const notesDir = join(cwd, LORE_DIR, "notes");
  mkdirSync(notesDir, { recursive: true });

  let written = 0;
  for (const c of candidates) {
    const path = join(notesDir, `${c.id}.md`);
    if (existsSync(path)) continue; // dedup by id

    const verdict = await verify(c, diff);
    if (!verdict.keep) {
      say(`  skip ${c.id}, ${verdict.reason}`);
      continue;
    }
    writeFileSync(path, frontmatter(c, verdict.confidence));
    written++;
    say(`  + ${c.id} (${verdict.confidence}): ${c.title}`);
  }
  say(written ? `Captured ${written} note(s) into .lore/notes/.` : "Nothing passed verification.");
}

/** The skeptical second pass that replaces human approval. */
async function verify(c: Candidate, diff: string): Promise<Verdict> {
  const prompt =
    `Act as a skeptical senior engineer reviewing a candidate repo-knowledge note.\n` +
    `Keep it ONLY if it is a real, durable, NON-derivable fact about THIS codebase, not generic ` +
    `best-practice, not transient, not already obvious from the code, and consistent with the change below.\n\n` +
    `NOTE: ${c.body}\n\nCHANGE:\n${truncate(diff, 6000)}\n\n` +
    `Return {"keep": boolean, "confidence": "high|medium|low", "reason": "one short line"}. Default keep=false if unsure.`;
  try {
    return await completeJSON<Verdict>(prompt);
  } catch {
    return { keep: false, confidence: "low", reason: "verification failed" };
  }
}

function frontmatter(c: Candidate, confidence: string): string {
  return (
    `---\n` +
    `id: ${c.id}\n` +
    `title: ${c.title}\n` +
    `tier: ${c.tier === "structural" ? "structural" : "rationale"}\n` +
    `anchors: ${JSON.stringify(c.anchors ?? [])}\n` +
    `confidence: ${confidence}\n` +
    `source: auto\n` +
    `---\n${(c.body ?? "").trim()}\n`
  );
}
