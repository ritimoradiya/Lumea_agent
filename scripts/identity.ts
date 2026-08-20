/**
 * Proves cross-channel identity: the same person, recognised on a second
 * channel days later.
 *
 *   npm run identity
 *
 * Two separate conversations on two different channels. The second one only
 * ever supplies an email address, and the agent should already know the name
 * — and must not ask for it again.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { handleInbound } from "../lib/handle";
import { db, recogniseByEmail } from "../lib/db";
import { getCompany } from "../lib/company";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

const stamp = Date.now();
const EMAIL = `identity-test-${stamp}@example.com`;
const PACE = Number(process.env.PACE_MS ?? 18000);

async function say(
  channel: "web" | "telegram" | "email",
  threadId: string,
  text: string,
  /** What the transport already knows, as an email envelope supplies it. */
  known?: Record<string, string>
) {
  console.log(bold(`\n  ${channel}  `) + text);
  const r = await handleInbound({ channel, threadId, text, known });
  console.log(cyan("  agent ") + " " + r.reply.replace(/\n/g, "\n          "));
  console.log(
    dim(
      `          ${r.mode}` +
        (r.recognised ? green("  ← recognised from a previous conversation") : "")
    )
  );
  return r;
}

async function main() {
  const company = await getCompany();
  console.log(bold(`\n  ${company.name} — cross-channel identity`));
  console.log(dim(`  test address: ${EMAIL}\n`));

  // ── Conversation one: the website. They introduce themselves. ──────
  console.log(bold("\n─── first visit, on the website ───"));
  const web = `web-identity-${stamp}`;
  await say("web", web, "my skin is dry and flaky");
  await new Promise((r) => setTimeout(r, PACE));
  await say("web", web, `I'm Priya Raman, ${EMAIL}`);

  // ── Conversation two: Telegram. Email only, no name. ──────────────
  console.log(bold("\n\n─── days later, on Telegram ───"));
  await new Promise((r) => setTimeout(r, PACE));
  const tg = `identity-tg-${stamp}`;
  await say("telegram", tg, "hi, any advice for winter?");
  await new Promise((r) => setTimeout(r, PACE));
  const second = await say("telegram", tg, `my email is ${EMAIL}`);

  /**
   * ── Conversation three: a reply that arrives by email ──────────────
   *
   * The case that was broken. An email carries the address in its envelope,
   * so it is never "newly learned" - which is exactly the condition
   * recognition used to require, so email conversations were never
   * recognised at all. A customer who had described his skin on the website
   * replied to his routine an hour later and was treated as a stranger.
   */
  console.log(bold("\n\n─── a reply arrives by email, on its own thread ───"));
  await new Promise((r) => setTimeout(r, PACE));
  const byEmail = await say(
    "email",
    `<reply-${stamp}@mail.example>`,
    "This is perfect, thank you!",
    { email: EMAIL, firstName: "Priya", lastName: "Raman" }
  );

  const carriedConcern = Boolean(byEmail.collected.description?.trim());

  // ── What the database believes ─────────────────────────────────────
  console.log(bold("\n\n  what the database knows"));
  const { data: co } = await db().from("companies").select("id").eq("slug", company.slug).single();
  const contact = await recogniseByEmail(co!.id as string, EMAIL);

  if (!contact) {
    console.log(red("  ✗ no contact record was created\n"));
    process.exit(1);
  }

  console.log(dim(`  contact       ${JSON.stringify(contact.known)}`));
  console.log(dim(`  conversations ${contact.priorConversations} linked to this person`));

  const knewName = Boolean(second.collected.firstName);
  const askedAgain = /your name|may i have your name|who am i/i.test(second.reply);

  console.log("");
  console.log(
    knewName
      ? green(`  ✓ knew them as ${second.collected.firstName} on Telegram without being told`)
      : red("  ✗ did not carry the name across channels")
  );
  console.log(
    askedAgain
      ? red("  ✗ asked for a name it already had")
      : green("  ✓ did not ask for the name again")
  );
  console.log(
    contact.priorConversations >= 2
      ? green(`  ✓ every conversation linked to one person`)
      : red(`  ✗ only ${contact.priorConversations} conversation linked`)
  );
  console.log(
    carriedConcern
      ? green(`  ✓ the email reply already knew "${byEmail.collected.description}"`)
      : red("  ✗ an email reply learned nothing — recognition did not fire")
  );
  console.log("");

  process.exit(knewName && !askedAgain && carriedConcern ? 0 : 1);
}

main().catch((e) => {
  console.error(red(`\n✗ ${e.message}\n`));
  process.exit(1);
});
