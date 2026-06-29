/**
 * Recall logging — measures the RETRIEVAL factor: how often a note actually
 * fires, on which files. A fire is necessary, not sufficient — this is the
 * denominator and the substrate for hand-labeling saves, not a value metric.
 *
 * Best-effort and append-only. Logging must NEVER break a hook.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORE_DIR, LORE_GITIGNORE } from "./store";

const LOG_NAME = "recall-log.jsonl";

export interface LogEvent {
  ts: string;
  trigger: "orient" | "guard";
  notes: string[];
  file?: string;
}

export function logEvent(ev: Omit<LogEvent, "ts">, cwd: string = process.cwd()): void {
  try {
    const dir = join(cwd, LORE_DIR);
    if (!existsSync(dir)) return;
    ensureGitignored(dir);
    appendFileSync(join(dir, LOG_NAME), JSON.stringify({ ts: new Date().toISOString(), ...ev }) + "\n");
  } catch {
    /* a hook must keep working even if logging fails */
  }
}

/** Keep the log local — it's per-developer telemetry, not shared knowledge. */
function ensureGitignored(dir: string): void {
  const gi = join(dir, ".gitignore");
  try {
    if (!existsSync(gi)) writeFileSync(gi, LORE_GITIGNORE);
  } catch {
    /* ignore */
  }
}

export function readLog(cwd: string = process.cwd()): LogEvent[] {
  const f = join(cwd, LORE_DIR, LOG_NAME);
  if (!existsSync(f)) return [];
  const out: LogEvent[] = [];
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as LogEvent);
    } catch {
      /* skip a corrupt line */
    }
  }
  return out;
}

export function summarizeLog(events: LogEvent[]): string {
  if (events.length === 0) return "No recall events logged yet. (Hooks log here once they fire in a session.)";

  const guard = events.filter((e) => e.trigger === "guard");
  const orient = events.filter((e) => e.trigger === "orient");
  const byNote = tally(guard.flatMap((e) => e.notes));
  const byFile = tally(guard.map((e) => e.file).filter((f): f is string => !!f));

  const out: string[] = [];
  out.push(`recall log: ${events.length} events  (${events[0]!.ts.slice(0, 10)} → ${events.at(-1)!.ts.slice(0, 10)})`);
  out.push(`  orient (session starts): ${orient.length}`);
  out.push(`  guard  (note injected before an edit): ${guard.length}`);
  if (byNote.length) {
    out.push("  notes that fired:");
    for (const [n, c] of byNote) out.push(`    ${String(c).padStart(3)}×  ${n}`);
  }
  if (byFile.length) {
    out.push("  files that triggered guard:");
    for (const [f, c] of byFile) out.push(`    ${String(c).padStart(3)}×  ${f}`);
  }
  out.push("");
  out.push("Coverage only: a fire is necessary, not sufficient. Review fires to label real saves vs noise.");
  return out.join("\n");
}

function tally(items: string[]): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
}
