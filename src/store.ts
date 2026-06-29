/**
 * The store: plain markdown notes under `.lore/notes/`, each with YAML
 * frontmatter. No database, the corpus is small and lives in git.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import mm from "micromatch";

export type Tier = "structural" | "rationale";

export interface Note {
  id: string;
  title: string; // one-line summary shown in the index
  tier: Tier;
  anchors: string[]; // globs ("src/export/**") or "symbol:foo"
  confidence: string;
  body: string;
}

export const LORE_DIR = ".lore";
export const NOTES_DIR = join(LORE_DIR, "notes");

/** Local-only artifacts kept out of git (per-developer telemetry). */
export const LORE_GITIGNORE = "recall-log.jsonl\n";

/** Parse one note from its raw file contents. Pure, easy to test. */
export function parseNoteContent(raw: string, fallbackId: string): Note | null {
  const { data, content } = matter(raw);
  const body = content.trim();
  if (!body) return null;
  const firstLine = body.split("\n").find((l) => l.trim());
  return {
    id: String(data.id ?? fallbackId),
    title: String(data.title ?? firstLine ?? fallbackId).trim(),
    tier: data.tier === "structural" ? "structural" : "rationale",
    anchors: Array.isArray(data.anchors) ? data.anchors.map(String) : [],
    confidence: String(data.confidence ?? "unknown"),
    body,
  };
}

/** Load every note in `<cwd>/.lore/notes/`. Missing dir → no notes. */
export function loadNotes(cwd: string = process.cwd()): Note[] {
  const dir = join(cwd, NOTES_DIR);
  if (!existsSync(dir)) return [];
  const notes: Note[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const note = parseNoteContent(readFileSync(join(dir, f), "utf8"), f.replace(/\.md$/, ""));
    if (note) notes.push(note);
  }
  return notes;
}

/** Notes whose file-glob anchors match `file` (symbol anchors are ignored here). */
export function notesForFile(notes: Note[], file: string, cwd: string = process.cwd()): Note[] {
  const rel = file.startsWith(cwd) ? file.slice(cwd.length).replace(/^\/+/, "") : file;
  return notes.filter((n) =>
    n.anchors.some((a) => !a.startsWith("symbol:") && (mm.isMatch(rel, a) || mm.isMatch(basename(rel), a))),
  );
}

/** Of `files`, the subset matched by this note's glob anchors (symbols ignored). */
export function matchedFiles(note: Note, files: string[]): string[] {
  return files.filter((f) =>
    note.anchors.some((a) => !a.startsWith("symbol:") && (mm.isMatch(f, a) || mm.isMatch(basename(f), a))),
  );
}

/**
 * The Orient index: a compact map of repo knowledge, cheap to keep in context.
 * Titles + where each note lives, not the full bodies. The agent pulls the
 * full note with `lore recall <file>` before touching a listed area.
 */
export function renderIndex(notes: Note[]): string {
  if (notes.length === 0) return "";
  const lines = notes.map((n) => {
    const where = n.anchors.length ? ` (\`${n.anchors.join("`, `")}\`)` : "";
    return `- **${n.title}**${where}`;
  });
  return [
    "## Repo knowledge (lore)",
    "",
    "Tacit context the code can't show: decisions, gotchas, invariants from past sessions.",
    "Treat these as hints, not gospel; verify against the current code.",
    "",
    ...lines,
    "",
    "_Before editing a listed area, run `lore recall <file>` for the full note._",
  ].join("\n");
}

/**
 * What the SessionStart hook injects: the standing instruction to record notes
 * (this is how the corpus grows, keylessly, the agent writes them itself with its
 * own tools) followed by the current index.
 */
export function renderSessionStart(notes: Note[]): string {
  const instruction = [
    "## Recording repo knowledge (lore)",
    "",
    "When you learn something about THIS repo that the code itself can't show (a",
    "decision and why, a gotcha that looks wrong but is load-bearing, a hidden cross-file",
    "or cross-system coupling, or something the user just corrected you on), record it:",
    "write `.lore/notes/<kebab-id>.md` with frontmatter (`id`, `title`, `tier:",
    "structural|rationale`, `anchors: [globs it concerns]`, `source: auto`) and a one to",
    "three sentence body stating the fact. The bar: durable, not derivable from the code,",
    "and decision-changing; skip anything obvious from reading the code. State facts, not",
    "instructions. If an existing note is now wrong, fix it.",
  ].join("\n");
  const index = renderIndex(notes);
  return index ? `${instruction}\n\n${index}` : instruction;
}

/**
 * Guard context: the full bodies of notes anchored to a file the agent is about
 * to edit. Injected by the PreToolUse hook, at the last moment before the write.
 */
export function renderGuard(notes: Note[], file: string): string {
  if (notes.length === 0) return "";
  return [
    `About to edit \`${file}\`. Repo knowledge (lore) for this area, from past work.`,
    "Hints, not gospel; verify against the current code:",
    "",
    notes.map((n) => n.body).join("\n\n"),
  ].join("\n");
}
