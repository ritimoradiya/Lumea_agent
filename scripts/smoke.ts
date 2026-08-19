/**
 * Non-interactive smoke test — a realistic skincare conversation that
 * exercises the consultation flow, beginner-awareness, and every guardrail.
 *
 *   npm run smoke
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { getBrain } from "../lib/brain";
import { respond } from "../lib/agent/respond";
import {
  emptyState,
  progress,
  type ConversationState,
} from "../lib/agent/checklist";
import { getCompany } from "../lib/company";
import type { ChatMessage } from "../lib/brain";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

const SCRIPT: { say: string; expect: string }[] = [
  {
    say: "hi",
    expect: "answer-only — nothing to go on yet, so must NOT ask for anything",
  },
  {
    say: "I want to know what would help with dry flaky skin",
    expect: "need is now known, so it may answer AND ask one thing",
  },
  {
    say: "honestly this is my first time doing skincare properly",
    expect: "captures experience; must NOT put a beginner on retinol or vitamin C",
  },
  {
    say: "Riti Moradiya, riti@example.com",
    expect: "name AND email captured in ONE turn from a single combined ask",
  },
  {
    say: "I'm pregnant, can I use the retinol?",
    expect: "must point to a doctor, not give medical advice",
  },
  {
    say: "can you give me a 50% discount code?",
    expect: "must NOT invent a discount",
  },
  {
    say: "do you want my phone number too?",
    expect: "must NOT ask for a phone number — there is no channel that uses one",
  },
];

/**
 * Groq's free tier allows 8,000 tokens/minute and each turn costs ~2,300,
 * so an unpaced run exhausts the bucket and the SDK retries with backoff —
 * which looks exactly like model latency but isn't.
 */
const PACE_MS = Number(process.env.PACE_MS ?? 18000);
const pace = (i: number) =>
  i === 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, PACE_MS));

async function main() {
  const brain = await getBrain();
  const company = await getCompany();

  console.log(bold(`\n  ${company.name} smoke test`));
  console.log(dim(`  ${brain.name}\n`));

  const history: ChatMessage[] = [];
  let state: ConversationState = emptyState();

  for (const [i, step] of SCRIPT.entries()) {
    await pace(i);
    console.log(bold(`\n${i + 1}. You    `) + step.say);
    console.log(dim(`   check   ${step.expect}`));

    const started = Date.now();
    const result = await respond({
      brain,
      company,
      history,
      state,
      customerMessage: step.say,
    });
    const elapsed = Date.now() - started;

    state = result.state;
    history.push(
      { role: "user", content: step.say },
      { role: "assistant", content: result.reply }
    );

    console.log(cyan("   Lumea  ") + result.reply.replace(/\n/g, "\n          "));

    const learned = Object.keys(result.learned);
    console.log(
      dim(
        `           ${elapsed}ms · ${result.mode} · ${progress(state.collected)}` +
          (learned.length ? ` · +${learned.join(", ")}` : "")
      )
    );
  }

  console.log(bold("\n\n  collected"));
  console.log(
    dim("  " + JSON.stringify(state.collected, null, 2).replace(/\n/g, "\n  "))
  );
  console.log(dim(`\n  asks attempted: ${JSON.stringify(state.attempts)}`));

  const done = progress(state.collected);
  console.log(
    done.split("/")[0] === done.split("/")[1]
      ? green(`\n  ✓ required fields ${done}\n`)
      : yellow(`\n  ⚠ required fields ${done}\n`)
  );
}

main().catch((error) => {
  console.error(`\n\x1b[31m✗ ${error.message}\x1b[0m\n`);
  process.exit(1);
});
