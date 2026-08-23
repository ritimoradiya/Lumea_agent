/**
 * Email worker — polls the Lumea inbox and answers in thread.
 *
 *   npm run email
 *
 * Connects OUT to Gmail over IMAP, so nothing needs to be publicly reachable.
 * Polls rather than pushes: Gmail push requires a Google Cloud project and
 * Pub/Sub, and a minute of latency is irrelevant for email.
 *
 * Runs forever by default, which is what you want on a laptop. Set
 * EMAIL_MAX_RUNTIME_MS to stop after a while instead — that is how the
 * scheduled GitHub Action runs it, since a job has to end for the next one
 * to start. The clock is only checked BETWEEN passes, never during one, so
 * the worker can never be cut off between sending a reply and marking the
 * mail read. That gap is the one place a duplicate reply could come from.
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

/** 0 means run forever. */
const MAX_RUNTIME_MS = Number(process.env.EMAIL_MAX_RUNTIME_MS ?? 0);

/**
 * Turn a From header into known fields.
 *
 * Display names are unreliable — often the whole address, sometimes an
 * initial, sometimes empty — so only a plausible human name is used, and the
 * surname only when there genuinely is one.
 */
function nameFrom(displayName: string, address: string) {
  const known: Record<string, string> = { email: address.toLowerCase() };

  const clean = displayName.trim();
  const looksLikeAnAddress = clean.includes("@");
  if (!clean || looksLikeAnAddress) return known;

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts[0] && parts[0].length > 1) known.firstName = parts[0];
  if (parts.length > 1) known.lastName = parts.slice(1).join(" ");
  return known;
}

async function tick() {
  const company = await getCompany();
  const messages = await fetchUnread();

  /**
   * Lead delivery is collected and awaited before this pass returns.
   *
   * The worker exits after four minutes so the next scheduled run can start,
   * and unawaited work started near that boundary is simply killed. The claim
   * stamps notified_at first, so a lost send looks delivered - which is how a
   * real lead went missing while the admin panel reported it as sent.
   */
  const pending: Promise<void>[] = [];

  for (const email of messages) {
    console.log(bold(`\n  ${email.fromName} <${email.from}>`));
    console.log(dim(`  subject: ${email.subject}`));
    console.log(`  ${email.text.replace(/\n/g, "\n  ").slice(0, 300)}`);

    const started = Date.now();
    try {
      const result = await handleInbound({
        channel: "email",
        schedule: (work) => pending.push(work()),
        // The thread root, so a whole exchange is one conversation rather
        // than a new one per message.
        threadId: email.threadRoot,
        text: email.text,
        // We already have these from the envelope. Asking someone who just
        // emailed us for their email address reads as broken.
        known: nameFrom(email.fromName, email.from),
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

  if (pending.length) {
    await Promise.allSettled(pending);
    console.log(dim(`  (${pending.length} lead delivery job(s) finished)`));
  }
}

async function main() {
  const company = await getCompany();
  console.log(bold(`\n  ${process.env.GMAIL_ADDRESS} is being watched`));
  console.log(
    dim(
      `  ${company.name} · polling every ${EVERY_MS / 1000}s · IMAP, no public URL needed` +
        (MAX_RUNTIME_MS ? ` · stopping after ${MAX_RUNTIME_MS / 1000}s` : "") +
        "\n"
    )
  );

  const deadline = MAX_RUNTIME_MS ? Date.now() + MAX_RUNTIME_MS : Infinity;

  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error(red(`  ✗ ${(error as Error).message}`));
    }

    // Checked here, between passes, so a reply is never interrupted.
    if (Date.now() + EVERY_MS >= deadline) {
      console.log(dim("\n  time is up — the next scheduled run takes over\n"));
      return;
    }

    await new Promise((r) => setTimeout(r, EVERY_MS));
  }
}

main().catch((e) => {
  console.error(red(`\n✗ ${e.message}\n`));
  process.exit(1);
});
