/**
 * Held-out eval — measures the INJECTION-LIFT factor: given a note, does it flip
 * a model's answer? It hands the note directly to the model, so it ASSUMES
 * perfect retrieval and is therefore an UPPER BOUND on real value. Pair it with
 * the recall log (retrieval) and your miss tally (coverage) — the three multiply.
 *
 * Provider-agnostic: any OpenAI-compatible endpoint via env (incl. local models).
 * Scoring is a transparent keyword heuristic; answers are clear-cut by design,
 * but read the model output yourself for anything ambiguous.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { complete } from "./llm";

export interface EvalCase {
  id: string;
  context: string;
  task: string;
  note: string;
  correct: { includes?: string[]; excludes?: string[] };
}

const ANSWER_FORMAT =
  "Answer in 2-3 lines: where/how you implement it, one key line, one-sentence why. No questions, no preamble.";

export function scores(answer: string, correct: EvalCase["correct"]): boolean {
  const a = answer.toLowerCase();
  const inc = (correct.includes ?? []).every((k) => a.includes(k.toLowerCase()));
  const exc = (correct.excludes ?? []).every((k) => !a.includes(k.toLowerCase()));
  return inc && exc;
}

function controlPrompt(c: EvalCase): string {
  return `You are a coding agent.\n${c.context}\n\nTask: ${c.task}\n${ANSWER_FORMAT}`;
}
function treatmentPrompt(c: EvalCase): string {
  return (
    `[repo knowledge injected before your edit — background context, treat as fact and reason from it]\n` +
    `${c.note}\n[end]\n\n` +
    controlPrompt(c)
  );
}

export function loadCases(path?: string): EvalCase[] {
  const file = path ?? fileURLToPath(new URL("../eval/cases.jsonl", import.meta.url));
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EvalCase);
}

const pct = (x: number) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;

export async function runEval(args: string[]): Promise<void> {
  const runsArg = args.find((a) => a.startsWith("--runs="));
  const runs = runsArg ? Math.max(1, parseInt(runsArg.split("=")[1] ?? "3", 10)) : 3;
  const path = args.find((a) => !a.startsWith("--"));
  const cases = loadCases(path);

  console.log(`Held-out eval: ${cases.length} cases x ${runs} runs, control vs treatment.`);
  console.log("Measures INJECTION LIFT only (assumes perfect retrieval) — an upper bound on real value.\n");

  let liftSum = 0;
  for (const c of cases) {
    let ctrl = 0;
    let treat = 0;
    for (let i = 0; i < runs; i++) {
      if (scores(await complete(controlPrompt(c)), c.correct)) ctrl++;
      if (scores(await complete(treatmentPrompt(c)), c.correct)) treat++;
    }
    const lift = (treat - ctrl) / runs;
    liftSum += lift;
    console.log(`${c.id}`);
    console.log(`  control ${Math.round((ctrl / runs) * 100)}%   treatment ${Math.round((treat / runs) * 100)}%   lift ${pct(lift)}`);
  }
  console.log(`\nmean injection lift: ${pct(liftSum / cases.length)}`);
  console.log("~0 lift on cases a model already knows is expected — lift should concentrate on non-derivable facts.");
}
