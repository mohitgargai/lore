/**
 * lore — in-repo, agent-native tacit knowledge. (Orient slice.)
 *
 *   lore setup                guided activation: configure LLM/key, then init the repo
 *   lore init                 scaffold .lore/ + wire the hooks (no prompts)
 *   lore index                print the knowledge index (Orient injects this)
 *   lore recall <file>        print full notes anchored to <file>
 *   lore list                 list note ids + anchors
 *   lore capture [range]      propose notes from a git diff -> .lore/proposed/  (needs LLM)
 *   lore accept [id]          move reviewed drafts from proposed/ into notes/
 *   lore check [base]         flag notes whose code changed as possibly stale     (needs LLM)
 *   lore log                  summarize recall events (coverage/retrieval)
 *   lore eval [--runs=N]      held-out control-vs-treatment injection-lift eval   (needs LLM)
 *   lore hook session-start   (Orient) emit the index as JSON
 *   lore hook pre-tool-use    (Guard) emit notes for the file being edited
 *   lore hook stop            (Capture, opt-in) propose notes at session end
 */
import { runAccept, runCapture } from "./capture";
import { runCheck } from "./check";
import { runEval } from "./eval";
import { preToolUseOutput, readHookInput, sessionStartOutput } from "./hooks";
import { runInit } from "./init";
import { llmConfigured } from "./llm";
import { logEvent, readLog, summarizeLog } from "./log";
import { runSetup } from "./setup";
import { loadNotes, notesForFile, renderGuard, renderIndex } from "./store";

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
    case "setup":
      await runSetup(process.cwd());
      return;

    case "init":
      runInit(process.cwd());
      return;

    case "index": {
      const out = renderIndex(loadNotes());
      if (out) process.stdout.write(out + "\n");
      return;
    }

    case "recall": {
      const file = rest[0];
      if (!file) fail("usage: lore recall <file>");
      const notes = notesForFile(loadNotes(), file);
      if (notes.length === 0) return; // silence is fine — nothing anchored here
      process.stdout.write(notes.map((n) => `--- ${n.id} ---\n${n.body}`).join("\n\n") + "\n");
      return;
    }

    case "list": {
      for (const n of loadNotes()) console.log(`${n.id}\t${n.anchors.join(", ")}`);
      return;
    }

    case "log": {
      process.stdout.write(summarizeLog(readLog()) + "\n");
      return;
    }

    case "capture": {
      try {
        await runCapture(rest);
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
      return;
    }

    case "accept": {
      runAccept(rest);
      return;
    }

    case "check": {
      try {
        await runCheck(rest);
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
      return;
    }

    case "eval": {
      try {
        await runEval(rest);
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
      return;
    }

    case "hook": {
      const sub = rest[0];
      const input = await readHookInput();

      if (sub === "session-start") {
        const notes = loadNotes();
        logEvent({ trigger: "orient", notes: notes.map((n) => n.id) });
        process.stdout.write(sessionStartOutput(renderIndex(notes)));
        return;
      }

      if (sub === "pre-tool-use") {
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

      if (sub === "stop") {
        // Opt-in auto-capture. Silent + best-effort — must never block session end.
        if (llmConfigured()) {
          try {
            await runCapture([], process.cwd(), { quiet: true });
          } catch {
            /* capture is best-effort at session end */
          }
        }
        return;
      }

      fail(`unknown hook: ${sub ?? ""}`);
    }

    default:
      fail(
        "commands: setup | init | index | recall <file> | list | capture [range] | accept [id] | " +
          "check [base] | log | eval | hook <session-start|pre-tool-use|stop>",
      );
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
