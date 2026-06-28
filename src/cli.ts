/**
 * lore — in-repo, agent-native tacit knowledge. (Orient slice.)
 *
 *   lore init                 scaffold .lore/ + wire the hooks
 *   lore index                print the knowledge index (Orient injects this)
 *   lore recall <file>        print full notes anchored to <file>
 *   lore list                 list note ids + anchors
 *   lore hook session-start   (Orient) emit the index as JSON
 *   lore hook pre-tool-use    (Guard) emit notes for the file being edited
 */
import { preToolUseOutput, readHookInput, sessionStartOutput } from "./hooks";
import { runInit } from "./init";
import { loadNotes, notesForFile, renderGuard, renderIndex } from "./store";

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
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

    case "hook": {
      const sub = rest[0];
      const input = await readHookInput();

      if (sub === "session-start") {
        process.stdout.write(sessionStartOutput(renderIndex(loadNotes())));
        return;
      }

      if (sub === "pre-tool-use") {
        const file = input.tool_input?.file_path;
        if (typeof file === "string") {
          const ctx = renderGuard(notesForFile(loadNotes(), file), file);
          if (ctx) process.stdout.write(preToolUseOutput(ctx));
        }
        return;
      }

      fail(`unknown hook: ${sub ?? ""}`);
    }

    default:
      fail("commands: init | index | recall <file> | list | hook session-start");
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
