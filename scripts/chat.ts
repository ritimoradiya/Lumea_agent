/**
 * Terminal harness — talk to the agent with no UI in the way.
 *
 *   npm run chat
 *
 * Commands:
 *   /state              show what has been collected
 *   /company <slug>     switch tenant mid-session
 *   /companies          list available company profiles
 *   /reset              clear the conversation
 *   /quit
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { getBrain } from "../lib/brain";
import { respond } from "../lib/agent/respond";
import { progress, type Collected } from "../lib/agent/checklist";
import { getCompany, listCompanySlugs, type Company } from "../lib/company";
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
  let collected: Collected = {};

  const banner = () => {
    console.log(bold(`\n  ${company.name} — support agent`));
    console.log(dim(`  ${company.industry}`));
    console.log(
      dim(`  brain: ${brain.name}  ·  ${company.products.length} products  ·  ${company.faqs.length} FAQs`)
    );
    console.log(dim("  /state  /company <slug>  /companies  /reset  /quit\n"));
  };

  banner();

  const rl = readline.createInterface({ input, output });

  while (true) {
    const line = (await rl.question(bold("You  "))).trim();
    if (!line) continue;

    if (line === "/quit") break;

    if (line === "/reset") {
      history = [];
      collected = {};
      console.log(dim("  conversation reset\n"));
      continue;
    }

    if (line === "/state") {
      console.log(dim(`  ${JSON.stringify(collected, null, 2)}\n`));
      continue;
    }

    if (line === "/companies") {
      const slugs = listCompanySlugs();
      console.log(
        dim(
          "  " +
            slugs
              .map((s) => (s === company.slug ? green(`${s} (active)`) : s))
              .join("\n  ") +
            "\n"
        )
      );
      continue;
    }

    if (line.startsWith("/company ")) {
      const slug = line.slice("/company ".length).trim();
      try {
        company = await getCompany(slug);
        history = [];
        collected = {};
        console.log(dim("  switched tenant, conversation reset"));
        banner();
      } catch (error) {
        console.log(red(`  ✗ ${(error as Error).message}\n`));
      }
      continue;
    }

    const started = Date.now();
    process.stdout.write(cyan("Bot ") + " ");

    try {
      const result = await respond(
        { brain, company, history, collected, customerMessage: line },
        (token) => process.stdout.write(token)
      );

      const elapsed = Date.now() - started;
      collected = result.collected;
      history.push(
        { role: "user", content: line },
        { role: "assistant", content: result.reply }
      );

      const learned = Object.keys(result.learned);
      const note = [
        `${elapsed}ms`,
        `collected ${progress(collected)}`,
        learned.length ? `+${learned.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("  ·  ");

      console.log("\n" + dim(`      ${note}`));
      console.log(
        result.complete
          ? green("      ✓ all five details collected — lead ready\n")
          : ""
      );
    } catch (error) {
      console.log("\n" + red(`  ✗ ${(error as Error).message}\n`));
    }
  }

  rl.close();
  console.log(dim("\n  bye\n"));
}

main();
