/**
 * Provider-agnostic LLM access for capture/check/eval. Bring your own
 * OpenAI-compatible endpoint via env, OpenAI, OpenRouter, Groq, or a local
 * model (Ollama / LM Studio / vLLM). The core tool (orient/guard) needs none of
 * this; only the LLM-backed commands do.
 */
import { loadConfig } from "./config";

const SETUP_HINT =
  "No LLM endpoint configured. Run:  lore setup\n" +
  "or set env vars: LORE_LLM_BASE_URL, LORE_LLM_MODEL, LORE_LLM_API_KEY\n" +
  "(any OpenAI-compatible endpoint: OpenAI, OpenRouter, or a local Ollama model).";

export function llmConfigured(): boolean {
  const c = loadConfig();
  return !!(c.baseUrl && c.model);
}

export async function complete(prompt: string): Promise<string> {
  const { baseUrl, model, apiKey } = loadConfig();
  if (!baseUrl || !model) throw new Error(SETUP_HINT);
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey ?? ""}` },
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

export async function completeJSON<T>(prompt: string): Promise<T> {
  return extractJson<T>(await complete(prompt));
}

/**
 * Pull the first balanced JSON value out of model output. Tolerant of code
 * fences and prose around it, so we don't depend on provider-specific JSON
 * modes a local model might not support.
 */
export function extractJson<T>(text: string): T {
  const sq = text.indexOf("[");
  const cu = text.indexOf("{");
  const start = sq === -1 ? cu : cu === -1 ? sq : Math.min(sq, cu);
  if (start === -1) throw new Error("no JSON found in model output");

  const open = text[start]!;
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(text.slice(start, i + 1)) as T;
  }
  throw new Error("unbalanced JSON in model output");
}
