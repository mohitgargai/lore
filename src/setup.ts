/**
 * `lore setup` — guided activation. Configures the LLM endpoint/key for
 * capture & check (persisted to a home-dir config), validates it, and offers to
 * activate lore in the current repo. The orient/guard core needs none of this.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { loadConfig, saveConfig } from "./config";
import { runInit } from "./init";
import { complete } from "./llm";

// We pick a balanced default model per hosted provider — capture/verify
// precision is what matters, and the calls are small, so this isn't the place to
// cheap out. Local/custom can't be known, so those are asked. Always overridable
// via LORE_LLM_MODEL.
const PRESETS: Record<string, { baseUrl: string; model?: string }> = {
  "1": { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  "2": { baseUrl: "http://localhost:11434/v1" }, // local: model is whatever you've pulled
  "3": { baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-6" },
};

export async function runSetup(cwd: string = process.cwd()): Promise<void> {
  if (!stdin.isTTY) {
    console.log(
      "lore setup is interactive — run it in a terminal.\n" +
        "Or configure env vars: LORE_LLM_BASE_URL, LORE_LLM_MODEL, LORE_LLM_API_KEY.",
    );
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    console.log("Set up lore's LLM access for capture & check.");
    console.log("(The session index and pre-edit guard need no key — this is only for the LLM-backed commands.)\n");

    const existing = loadConfig();

    console.log("Provider:");
    console.log("  1) OpenAI");
    console.log("  2) Ollama (local, free)");
    console.log("  3) Anthropic (OpenAI-compatible endpoint)");
    console.log("  4) custom");
    const choice = (await rl.question("Choose [1-4] (default 1): ")).trim() || "1";

    const preset = PRESETS[choice];
    const local = choice === "2";

    let baseUrl = preset?.baseUrl ?? "";
    if (!baseUrl) {
      baseUrl =
        (await rl.question(`Base URL${existing.baseUrl ? ` [${existing.baseUrl}]` : ""}: `)).trim() ||
        existing.baseUrl ||
        "";
    }

    // Hosted providers: we choose the model. Local/custom: we have to ask.
    let model = preset?.model ?? "";
    if (model) {
      console.log(`Model: ${model}  (chosen for this provider; override anytime with LORE_LLM_MODEL)`);
    } else {
      const hint = local ? " (a model you've pulled, e.g. llama3.1)" : "";
      model =
        (await rl.question(`Model${hint}${existing.model ? ` [${existing.model}]` : ""}: `)).trim() ||
        existing.model ||
        "";
    }
    const keyPrompt = `API key${local ? " (optional for local)" : ""}${existing.apiKey ? " [keep existing]" : ""}: `;
    const apiKey = (await rl.question(keyPrompt)).trim() || existing.apiKey || "";

    if (!baseUrl || !model) {
      console.log("\nBase URL and model are required — nothing saved.");
      return;
    }

    const path = saveConfig({ baseUrl, model, apiKey });
    console.log(`\nSaved to ${path} (readable only by you). Env vars still override it.`);

    stdout.write("Testing the endpoint... ");
    try {
      await complete("Reply with exactly: ok");
      console.log("ok");
    } catch (e) {
      console.log("failed");
      console.log(`  ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      console.log("  (config saved anyway — fix the endpoint/key and re-run lore setup)");
    }

    if (!existsSync(join(cwd, ".lore"))) {
      const yes = (await rl.question("\nActivate lore in this repo now (lore init)? [Y/n]: ")).trim().toLowerCase();
      if (yes === "" || yes === "y" || yes === "yes") {
        console.log("");
        runInit(cwd);
      }
    }

    console.log("\nDone. capture & check are ready — try: lore capture");
  } finally {
    rl.close();
  }
}
