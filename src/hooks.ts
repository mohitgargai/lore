/**
 * Claude Code hook I/O.
 *
 * Orient: SessionStart → inject the knowledge index (titles + anchors).
 * Guard:  PreToolUse(Edit|Write) → inject the full note for the file being
 *           edited, right before the write. Advisory: it adds context, it does
 *           not block the edit.
 *
 * Both reach the model through `additionalContext`.
 */
export function sessionStartOutput(context: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
  });
}

export function preToolUseOutput(context: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: context },
  });
}

/** Read and parse the hook's stdin JSON. Returns {} on empty/invalid/TTY. */
export function readHookInput(): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve({});
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(parse(data)));
    process.stdin.on("error", () => resolve(parse(data)));
    setTimeout(() => resolve(parse(data)), 500); // safety net; resolve is idempotent
  });
}

function parse(s: string): Record<string, any> {
  if (!s.trim()) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
