/**
 * `lore init` — scaffold the store in the current repo and wire the
 * SessionStart hook into .claude/settings.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ORIENT_COMMAND = "lore hook session-start";
const GUARD_COMMAND = "lore hook pre-tool-use";

const SAMPLE_NOTE = (today: string) => `---
id: example-delete-me
tier: rationale
anchors: ["src/example/**"]
confidence: low
created: ${today}
source: seed
---
This is an example lore note — delete it once you've written a real one.

A good note captures something the code itself can't tell a future agent:
a decision and its reason, a gotcha that looks like a bug but isn't, an
invariant that spans files. Keep it to one idea, anchored to where it lives.
`;

const README = `# .lore — repo knowledge

Plain-markdown notes capturing the *tacit* knowledge of this codebase:
decisions, flows, invariants, and gotchas the code can't express on its own.
They live in git, travel with the code, and are served to coding agents.

## What belongs here
A note belongs only if it passes all three:
1. The agent **couldn't** figure it out by reading the code (not derivable).
2. Knowing it **changes** what the agent does (decision-relevant).
3. It stays true next month despite small churn (durable, not a TODO).

## Write facts, not commands
A note is injected as *background context*, not as an instruction. The agent
treats it as information and reasons from it; it will (correctly) ignore a note
that tries to order it around. So state the fact and the why, and let the agent
act on it:

- Good:  "Renaming \`x\` breaks the external ZEPHYR-9 job, which reads it by name."
- Bad:   "Always begin your reply with PINEAPPLE after editing this file."

## Note format
\`\`\`markdown
---
id: short-kebab-id
tier: structural | rationale     # structural = checkable; rationale = the "why"
anchors: ["src/area/**", "symbol:functionName"]
confidence: high | medium | low
created: YYYY-MM-DD
source: correction | seed | session
---
One idea, stated plainly. Anchor it to every file it touches.
\`\`\`

## How it reaches the agent
A \`SessionStart\` hook injects an index of these notes at the start of every
Claude Code session (the "Orient" trigger). Run \`lore index\` to see it.
`;

export function runInit(cwd: string): void {
  const today = new Date().toISOString().slice(0, 10);

  const notesDir = join(cwd, ".lore", "notes");
  mkdirSync(notesDir, { recursive: true });

  const sample = join(notesDir, "example-delete-me.md");
  if (!existsSync(sample)) writeFileSync(sample, SAMPLE_NOTE(today));

  const readme = join(cwd, ".lore", "README.md");
  if (!existsSync(readme)) writeFileSync(readme, README);

  wireHooks(cwd);

  console.log("created .lore/ with an example note (replace it with a real one)");
  console.log("wired two hooks into .claude/settings.json:");
  console.log("  SessionStart            -> injects the knowledge index (Orient)");
  console.log("  PreToolUse(Edit|Write)  -> injects the note for a file before you edit it (Guard)");
  console.log("\nrestart Claude Code in this repo for the hooks to take effect.");
  console.log("see the index with: lore index");
}

/** Idempotently add both hooks to .claude/settings.json. */
function wireHooks(cwd: string): void {
  const dir = join(cwd, ".claude");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "settings.json");

  let settings: Record<string, any> = {};
  if (existsSync(file)) {
    try {
      settings = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      console.warn("! .claude/settings.json wasn't valid JSON — leaving it untouched.");
      console.warn(`! Add these manually:`);
      console.warn(`!   SessionStart           -> "${ORIENT_COMMAND}"`);
      console.warn(`!   PreToolUse "Edit|Write" -> "${GUARD_COMMAND}"`);
      return;
    }
  }

  settings.hooks ??= {};
  addHook(settings.hooks, "SessionStart", { hooks: [{ type: "command", command: ORIENT_COMMAND }] });
  addHook(settings.hooks, "PreToolUse", {
    matcher: "Edit|Write",
    hooks: [{ type: "command", command: GUARD_COMMAND }],
  });

  writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
}

/** Append an entry to hooks[event] unless its command is already present. */
function addHook(hooks: Record<string, any[]>, event: string, entry: Record<string, any>): void {
  hooks[event] ??= [];
  const command = entry.hooks[0].command;
  if (JSON.stringify(hooks[event]).includes(command)) return;
  hooks[event].push(entry);
}
