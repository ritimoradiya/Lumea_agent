/**
 * Telegram worker — long polls for messages and answers them.
 *
 *   npm run telegram
 *
 * Long polling rather than a webhook so this runs from a laptop with nothing
 * publicly exposed. After deploying, app/api/telegram/route.ts takes over and
 * this becomes a development convenience.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import {
  extractMessage,
  getMe,
  getUpdates,
  sendMessage,
  sendTyping,
  deleteWebhook,
} from "../lib/channels/telegram";
import { handleInbound } from "../lib/handle";
import { greetingFor } from "../lib/company";
import { getCompany } from "../lib/company";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

async function main() {
  const me = await getMe();
  const company = await getCompany();

  // A webhook and long polling are mutually exclusive; clear any leftover one.
  await deleteWebhook();

  console.log(bold(`\n  @${me.username} is listening`));
  console.log(dim(`  ${company.name} · long polling, no public URL needed`));
  console.log(dim(`  open t.me/${me.username} on your phone\n`));

  let offset = 0;

  for (;;) {
    let updates;
    try {
      updates = await getUpdates(offset);
    } catch (error) {
      const message = (error as Error).message;

      /**
       * Telegram permits exactly one long poller per bot. Retrying a Conflict
       * just alternates which instance wins and neither works reliably, so
       * fail loudly with the actual remedy instead of looping on it.
       */
      if (/Conflict/i.test(message)) {
        console.error(
          red("\n  ✗ Another copy of this worker is already running.") +
            dim("\n    Telegram allows only one poller per bot.\n") +
            dim("    Stop the others with:  pkill -f scripts/telegram\n")
        );
        process.exit(1);
      }

      console.error(red(`  ✗ ${message}`));
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    for (const update of updates) {
      // Advance past this update whatever happens, or one bad message would
      // be redelivered forever.
      offset = update.update_id + 1;

      const message = extractMessage(update);
      if (!message) continue;

      console.log(bold(`\n  ${message.from}  `) + message.text);

      // /start is Telegram's convention for opening a chat, and its text is
      // not something the customer said — greet rather than answer it.
      if (message.text === "/start") {
        await sendMessage(message.chatId, greetingFor(company));
        console.log(cyan("  bot      ") + dim("(greeting)"));
        continue;
      }

      await sendTyping(message.chatId);
      const started = Date.now();

      try {
        const result = await handleInbound({
          channel: "telegram",
          threadId: String(message.chatId),
          text: message.text,
        });

        if (result.handedToHuman) {
          console.log(dim("  (a person has taken this thread over — staying quiet)"));
          continue;
        }

        await sendMessage(message.chatId, result.reply);
        console.log(cyan("  bot      ") + result.reply.replace(/\n/g, "\n           "));
        console.log(
          dim(
            `           ${Date.now() - started}ms · ${result.mode}` +
              (result.complete ? green("  ✓ lead complete") : "")
          )
        );
      } catch (error) {
        console.error(red(`  ✗ ${(error as Error).message}`));
        await sendMessage(
          message.chatId,
          "Sorry — I'm having trouble responding just now. A colleague will follow up shortly."
        );
      }
    }
  }
}

main().catch((e) => {
  console.error(red(`\n✗ ${e.message}\n`));
  process.exit(1);
});
