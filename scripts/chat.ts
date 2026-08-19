/**
 * Terminal harness — talk to the Lumea agent with no UI in the way.
 *
 *   npm run chat
 *
 * Commands:  /state   /reset   /quit
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { getBrain } from "../lib/brain";
import { respond } from "../lib/agent/respond";
import { emptyState, progress, type ConversationState } from "../lib/agent/checklist";
import { getCompany, greetingFor, type Company } from "../lib/company";
import type { ChatMessage } from "../lib/brain";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

async function main() {
  let brain;
  let company: Company;

  try {
    brain = await getBrain();
    company = await getCompany();
  } catch (error) {
    console.error(red(`\n✗ ${(error as Error).message}\n`));
    process.exit(1);
  }

  let history: ChatMessage[] = [];
  let state: ConversationState = emptyState();

  console.log(bold(`\n  ${company.name} — support agent`));
  console.log(
    dim(
      `  brain: ${brain.name}  ·  ${company.products.length} products  ·  ${company.faqs.length} FAQs`
    )
  );
  console.log(dim("  /state  /reset  /quit\n"));
  console.log(cyan("Lumea") + "  " + greetingFor(company) + "\n");

  const rl = readline.createInterface({ input, output });

  while (true) {
    const line = (await rl.question(bold("You    "))).trim();
    if (!line) continue;

    if (line === "/quit") break;

    if (line === "/reset") {
      history = [];
      state = emptyState();
      console.log(dim("  conversation reset\n"));
      continue;
    }

    if (line === "/state") {
      console.log(dim(`  ${JSON.stringify(state, null, 2)}\n`));
      continue;
    }

    const started = Date.now();
    process.stdout.write(cyan("Lumea") + "  ");

    try {
      const result = await respond(
        { brain, company, history, state, customerMessage: line },
        (token) => process.stdout.write(token)
      );

      const elapsed = Date.now() - started;
      state = result.state;
      history.push(
        { role: "user", content: line },
        { role: "assistant", content: result.reply }
      );

      const learned = Object.keys(result.learned);
      const note = [
        `${elapsed}ms`,
        result.mode,
        `collected ${progress(state.collected)}`,
        learned.length ? `+${learned.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("  ·  ");

      console.log("\n" + dim(`       ${note}`));
      if (result.complete) {
        console.log(green("       ✓ all five details collected — lead ready"));
      }
      console.log("");
    } catch (error) {
      console.log("\n" + red(`  ✗ ${(error as Error).message}\n`));
    }
  }

  rl.close();
  console.log(dim("\n  bye\n"));
}

main();
