/**
 * Persistent LLM config so capture/check work without re-exporting env vars each
 * shell. Stored in the user's home (never the repo), chmod 600. Precedence:
 * environment variables override the file, so CI can stay env-only.
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface LoreConfig {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

export function configPath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "lore", "config.json");
}

/** File config, with env vars layered on top (env wins). */
export function loadConfig(): LoreConfig {
  let file: LoreConfig = {};
  try {
    file = JSON.parse(readFileSync(configPath(), "utf8"));
  } catch {
    /* no file yet */
  }
  return {
    baseUrl: process.env.LORE_LLM_BASE_URL ?? file.baseUrl,
    model: process.env.LORE_LLM_MODEL ?? file.model,
    apiKey: process.env.LORE_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? file.apiKey,
  };
}

export function saveConfig(c: LoreConfig): string {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(c, null, 2) + "\n", { mode: 0o600 });
  try {
    chmodSync(p, 0o600); // in case the file already existed with looser perms
  } catch {
    /* best effort */
  }
  return p;
}
