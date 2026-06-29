/**
 * lore, in-repo, agent-native tacit knowledge for coding agents. Keyless: no API
 * key, no network calls. The agent you already run is the intelligence.
 *
 *   lore init                 scaffold .lore/ + wire the hooks
 *   lore index                print the session-start injection (instruction + index)
 *   lore recall <file>        print full notes anchored to <file>
 *   lore list                 list note ids + anchors
 *   lore check [base]         flag notes whose code changed (review them)
 *   lore log                  summarize recall events (coverage/retrieval)
 *   lore hook session-start   (Orient) emit the recording instruction + index
 *   lore hook pre-tool-use    (Guard) emit notes for the file being edited
 */
import { runCheck } from "./check";
import { preToolUseOutput, readHookInput, sessionStartOutput } from "./hooks";
import { runInit } from "./init";
import { logEvent, readLog, summarizeLog } from "./log";
import { loadNotes, notesForFile, renderGuard, renderSessionStart } from "./store";

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
    case "init":
      runInit(process.cwd());
      return;

    case "index": {
      const out = renderSessionStart(loadNotes());
      if (out) process.stdout.write(`${out}\n`);
      return;
    }

    case "recall": {
      const file = rest[0];
      if (!file) fail("usage: lore recall <file>");
      const notes = notesForFile(loadNotes(), file);
      if (notes.length === 0) return; // silence is fine, nothing anchored here
      process.stdout.write(`${notes.map((n) => `--- ${n.id} ---\n${n.body}`).join("\n\n")}\n`);
      return;
    }

    case "list": {
      for (const n of loadNotes()) console.log(`${n.id}\t${n.anchors.join(", ")}`);
      return;
    }

    case "check":
      runCheck(rest);
      return;

    case "log": {
      process.stdout.write(`${summarizeLog(readLog())}\n`);
      return;
    }

    case "hook": {
      const sub = rest[0];

      if (sub === "session-start") {
        const notes = loadNotes();
        logEvent({ trigger: "orient", notes: notes.map((n) => n.id) });
        process.stdout.write(sessionStartOutput(renderSessionStart(notes)));
        return;
      }

      if (sub === "pre-tool-use") {
        const input = await readHookInput();
        const file = input.tool_input?.file_path;
        if (typeof file === "string") {
          const notes = notesForFile(loadNotes(), file);
          if (notes.length) {
            logEvent({ trigger: "guard", file, notes: notes.map((n) => n.id) });
            process.stdout.write(preToolUseOutput(renderGuard(notes, file)));
          }
        }
        return;
      }

      return fail(`unknown hook: ${sub ?? ""}`);
    }

    default:
      fail("commands: init | index | recall <file> | list | check [base] | log | hook <session-start|pre-tool-use>");
  }
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
