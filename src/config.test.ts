import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, saveConfig } from "./config";

const KEYS = ["XDG_CONFIG_HOME", "LORE_LLM_BASE_URL", "LORE_LLM_MODEL", "LORE_LLM_API_KEY", "OPENAI_API_KEY"];

describe("config", () => {
  let saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved = {};
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "lore-cfg-"));
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("round-trips through the file", () => {
    saveConfig({ baseUrl: "http://x/v1", model: "m", apiKey: "k" });
    expect(loadConfig()).toEqual({ baseUrl: "http://x/v1", model: "m", apiKey: "k" });
  });

  it("env vars override the file", () => {
    saveConfig({ baseUrl: "http://file/v1", model: "filemodel", apiKey: "filekey" });
    process.env.LORE_LLM_MODEL = "envmodel";
    expect(loadConfig().model).toBe("envmodel");
    expect(loadConfig().baseUrl).toBe("http://file/v1");
  });

  it("falls back to OPENAI_API_KEY for the key", () => {
    saveConfig({ baseUrl: "http://x/v1", model: "m" });
    process.env.OPENAI_API_KEY = "oai";
    expect(loadConfig().apiKey).toBe("oai");
  });
});
