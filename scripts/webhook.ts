/**
 * Point Telegram at the deployed site instead of polling from a laptop.
 *
 *   npm run webhook -- https://lumea-agent.netlify.app
 *   npm run webhook -- --off        back to local polling
 *
 * Telegram allows a webhook OR getUpdates, never both. Registering one stops
 * `npm run telegram` working, which is the point: the deployed site takes over
 * and the channel no longer depends on anything running locally.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { deleteWebhook, getMe, setWebhook } from "../lib/channels/telegram";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const me = await getMe();

  if (args.includes("--off")) {
    await deleteWebhook();
    console.log(green(`\n  ✓ webhook removed from @${me.username}`));
    console.log(dim("    `npm run telegram` will work again\n"));
    return;
  }

  const base = args[0];
  if (!base?.startsWith("https://")) {
    console.error(
      red("\n  ✗ Give the deployed base URL, e.g.\n") +
        dim("    npm run webhook -- https://lumea-agent.netlify.app\n")
    );
    process.exit(1);
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      red("\n  ✗ TELEGRAM_WEBHOOK_SECRET is not set in .env.local.\n") +
        dim("    Telegram echoes it back on every request; without it anyone\n") +
        dim("    who guessed the URL could inject messages.\n")
    );
    process.exit(1);
  }

  const url = `${base.replace(/\/$/, "")}/api/telegram`;
  await setWebhook(url, secret);

  console.log(green(`\n  ✓ @${me.username} now posts to ${url}`));
  console.log(dim("    The deployed site answers; no local worker needed."));
  console.log(dim("    Stop any running `npm run telegram` — it will conflict.\n"));
}

main().catch((e) => {
  console.error(red(`\n✗ ${e.message}\n`));
  process.exit(1);
});
