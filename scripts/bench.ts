/**
 * Benchmarks the candidate Groq models on latency and extraction, using
 * the same three turns for each so the numbers are comparable.
 *
 *   npm run bench
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { GroqBrain } from "../lib/brain/groq";
import { respond } from "../lib/agent/respond";
import { progress, type Collected } from "../lib/agent/checklist";
import { getCompany } from "../lib/company";
import type { ChatMessage } from "../lib/brain";

const CANDIDATES = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];

const TURNS = [
  "hi, do you have anything for sensitive skin?",
  "I'm Riti Moradiya, my email is riti@example.com",
  "do you ship to Antarctica?",
  "I'm pregnant, can I use the retinol?",
  "can you give me a 50% discount code?",
  "sure, +1 617 555 0142. I need a routine for dry skin",
];

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;


/**
 * Groq's free tier allows 8,000 tokens/minute and each turn costs ~2,300,
 * so an unpaced run exhausts the bucket by turn 4 and the SDK silently
 * retries with backoff — which looks exactly like model latency but isn't.
 * The pause keeps these numbers honest.
 */
const PACE_MS = Number(process.env.PACE_MS ?? 18000);
const pace = (i: number) =>
  i === 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, PACE_MS));

async function main() {
  const company = await getCompany();
  const results: { model: string; times: number[]; collected: string; error?: string }[] = [];

  for (const model of CANDIDATES) {
    process.env.GROQ_MODEL = model;
    const brain = new GroqBrain();
    const history: ChatMessage[] = [];
    let collected: Collected = {};
    const times: number[] = [];

    process.stdout.write(dim(`  ${model} `));

    try {
      for (const [ti, turn] of TURNS.entries()) {
        await pace(ti);
        const t = Date.now();
        const r = await respond({ brain, company, history, collected, customerMessage: turn });
        times.push(Date.now() - t);
        collected = r.collected;
        history.push({ role: "user", content: turn }, { role: "assistant", content: r.reply });
        process.stdout.write(".");
      }
      results.push({ model, times, collected: progress(collected) });
      console.log(" done");
    } catch (error) {
      results.push({ model, times, collected: progress(collected), error: (error as Error).message });
      console.log(red(" failed"));
    }
  }

  console.log(bold("\n  model                       t1     t2     t3     t4     t5     t6     MAX   fields"));
  console.log(dim("  " + "─".repeat(84)));

  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.model.padEnd(24)} ${red(r.error.slice(0, 40))}`);
      continue;
    }
    const max = Math.max(...r.times);
    const cells = r.times.map((t) => `${t}ms`.padStart(7)).join("");
    const flag = max < 3000 ? green(`${max}ms`.padStart(7)) : red(`${max}ms`.padStart(7));
    const ok = r.collected === "5/5" ? green(r.collected) : r.collected;
    console.log(`  ${r.model.padEnd(24)}${cells} ${flag}   ${ok}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(red(`\n✗ ${e.message}\n`));
  process.exit(1);
});
