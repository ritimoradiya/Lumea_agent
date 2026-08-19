/** Reproduces the partial-answer case: name given, email withheld. */
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

const TURNS = [
  "Yes I want to start my everyday skin routine and its my first time but my skin is too sensitive",
  "Riti Moradiya",
  "riti@example.com",
];

async function main() {
  const brain = await getBrain();
  const company = await getCompany();
  const history: ChatMessage[] = [];
  let state: ConversationState = emptyState();

  for (const [i, say] of TURNS.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 18000));
    console.log(bold(`\nYou    `) + say);
    const r = await respond({ brain, company, history, state, customerMessage: say });
    state = r.state;
    history.push({ role: "user", content: say }, { role: "assistant", content: r.reply });
    console.log(cyan("Lumea  ") + r.reply.replace(/\n/g, "\n       "));
    console.log(dim(`       ${r.mode} · ${progress(state.collected)} · attempts ${JSON.stringify(state.attempts)}`));
  }
  console.log(bold("\ncollected"), dim(JSON.stringify(state.collected)));
}
main();
