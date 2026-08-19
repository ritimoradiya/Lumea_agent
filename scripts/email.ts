/**
 * Email worker — polls the Lumea inbox and answers in thread.
 *
 *   npm run email
 *
 * Connects OUT to Gmail over IMAP, so nothing needs to be publicly reachable.
 * Polls rather than pushes: Gmail push requires a Google Cloud project and
 * Pub/Sub, and a minute of latency is irrelevant for email.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { fetchUnread, markHandled, replyToEmail } from "../lib/channels/email";
import { handleInbound } from "../lib/handle";
import { getCompany } from "../lib/company";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

const EVERY_MS = Number(process.env.EMAIL_POLL_MS ?? 30000);

async function tick() {
  const company = await getCompany();
  const messages = await fetchUnread();

  for (const email of messages) {
    console.log(bold(`\n  ${email.fromName} <${email.from}>`));
    console.log(dim(`  subject: ${email.subject}`));
    console.log(`  ${email.text.replace(/\n/g, "\n  ").slice(0, 300)}`);

    const started = Date.now();
    try {
      const result = await handleInbound({
        channel: "email",
        // The thread root, so a whole exchange is one conversation rather
        // than a new one per message.
        threadId: email.threadRoot,
        text: email.text,
      });

      if (result.handedToHuman) {
        console.log(dim("  (a person has taken this thread over — staying quiet)"));
        // Still mark it read: a person is dealing with it, and leaving it
        // unread would make the worker answer it on the next tick.
        await markHandled(email.uid);
        continue;
      }

      await replyToEmail(email, result.reply, company.name);
      // Only now is it safe to mark read — the customer has their answer.
      await markHandled(email.uid);
      console.log(cyan("\n  replied  ") + result.reply.replace(/\n/g, "\n           "));
      console.log(
        dim(`           ${Date.now() - started}ms · ${result.mode}`) +
          (result.complete ? green("  ✓ lead complete") : "")
      );
    } catch (error) {
      // Left unread on purpose, so the next tick tries again rather than
      // dropping the customer's email.
      console.error(red(`  ✗ ${(error as Error).message} — leaving unread to retry`));
    }
  }
}

async function main() {
  const company = await getCompany();
  console.log(bold(`\n  ${process.env.GMAIL_ADDRESS} is being watched`));
  console.log(dim(`  ${company.name} · polling every ${EVERY_MS / 1000}s · IMAP, no public URL needed\n`));

  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error(red(`  ✗ ${(error as Error).message}`));
    }
    await new Promise((r) => setTimeout(r, EVERY_MS));
  }
}

main().catch((e) => {
  console.error(red(`\n✗ ${e.message}\n`));
  process.exit(1);
});
