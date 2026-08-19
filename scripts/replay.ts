/**
 * Replays the exact conversation that exposed the "promised to email with no
 * email address" bug, so it cannot come back unnoticed.
 *
 *   npm run replay
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { getBrain } from "../lib/brain";
import { respond } from "../lib/agent/respond";
import { emptyState, progress, type ConversationState } from "../lib/agent/checklist";
import { getCompany } from "../lib/company";
import type { ChatMessage } from "../lib/brain";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

const TURNS = [
  "Hello",
  "yes can you please suggest best Lumea products",
  "I want glowing skin and right now my skin is oily in T area and dry in rest of the areas and my skin is too sensitive",
  "building from scratch",
  "okay",
];

/**
 * Detecting the bug by regex alone kept misfiring: "may I have your email so
 * we can send you a routine?" contains the words of a promise but is plainly
 * a request. So test for both — a promise only counts as a violation when the
 * same reply is NOT also asking for the address.
 */
const PROMISES_EMAIL =
  /\b(?:we|i|they|a colleague|a teammate|someone)\b[^.?!]{0,30}\b(?:will |'ll |can |going to )?(?:email|send)\b/i;

const ASKS_FOR_EMAIL =
  /\b(?:may i|might i|could i|can i|could you|can you|would you|what(?:'s| is)|share|provide|have)\b[^.?!]{0,60}\b(?:e-?mail|address)\b/i;

function promisesEmailWithoutHavingOne(reply: string, email?: string): boolean {
  if (email?.trim()) return false;
  return PROMISES_EMAIL.test(reply) && !ASKS_FOR_EMAIL.test(reply);
}

async function main() {
  const brain = await getBrain();
  const company = await getCompany();
  const history: ChatMessage[] = [];
  let state: ConversationState = emptyState();
  const violations: string[] = [];

  for (const [i, say] of TURNS.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 18000));
    console.log(bold(`\nYou    `) + say);

    const r = await respond({ brain, company, history, state, customerMessage: say });
    state = r.state;
    history.push({ role: "user", content: say }, { role: "assistant", content: r.reply });

    console.log(cyan("Lumea  ") + r.reply.replace(/\n/g, "\n       "));
    console.log(dim(`       ${r.mode} · ${progress(state.collected)} · asked ${JSON.stringify(state.attempts)}`));

    // The regression: promising email without holding an address.
    if (promisesEmailWithoutHavingOne(r.reply, state.collected.email)) {
      violations.push(`turn ${i + 1}: promised email with no address on file`);
      console.log(red("       ✗ promised email with no address on file"));
    }
  }

  console.log(bold("\ncollected"), dim(JSON.stringify(state.collected)));
  console.log(
    violations.length === 0
      ? green("\n✓ no email promised without an address\n")
      : red(`\n✗ ${violations.length} violation(s):\n  ${violations.join("\n  ")}\n`)
  );
  process.exit(violations.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(red(`\n✗ ${e.message}\n`)); process.exit(1); });
