/**
 * Finds conversations that qualify as leads but never produced one, and
 * delivers them.
 *
 *   npm run recover            show what would be sent, send nothing
 *   npm run recover -- --send  actually send
 *
 * Needed because delivery is fire-and-forget: if it fails, or if the rules for
 * what counts as a lead change after the fact, a real conversation can sit
 * there with everything required and nothing delivered. notified_at makes this
 * safe to run repeatedly — anything already sent is skipped.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../lib/db";
import { getBrain } from "../lib/brain";
import { getCompany } from "../lib/company";
import { generateRoutine } from "../lib/agent/routine";
import {
  canWriteRoutine,
  isLeadComplete,
  REQUIRED_FIELDS,
  type Collected,
} from "../lib/agent/checklist";
import { createLeadIfNew, isLeadNotified, markLeadNotified } from "../lib/db";
import {
  sendLeadAlert,
  sendRoutineToCustomer,
  summariseForOwner,
} from "../lib/email";
import type { ChatMessage } from "../lib/brain";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

const SEND = process.argv.includes("--send");

async function main() {
  const company = await getCompany();
  const brain = await getBrain();

  const { data: convos, error } = await db()
    .from("conversations")
    .select("id, company_id, channel, channel_thread_id, collected, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  console.log(bold(`\n  ${SEND ? "SENDING" : "DRY RUN — nothing will be sent"}`));
  console.log(dim(`  required: ${REQUIRED_FIELDS.join(", ")}\n`));

  let delivered = 0;
  let skipped = 0;

  for (const c of convos ?? []) {
    const collected = (c.collected ?? {}) as Collected;
    if (!isLeadComplete(collected)) continue;

    // Create the lead row even on a dry run — it is what makes the lead
    // visible in the admin panel, and notified_at is the send record.
    const lead = await createLeadIfNew(
      c.company_id as string,
      c.id as string,
      collected
    );
    if (await isLeadNotified(lead.id)) {
      skipped++;
      continue;
    }

    const name = [collected.firstName, collected.lastName].filter(Boolean).join(" ");
    console.log(bold(`  ${name || collected.email}`) + dim(`  ${c.channel}`));
    const writable = canWriteRoutine(collected);
    console.log(
      dim(`    ${collected.email} · ${collected.description ?? "no concern given"}`)
    );

    if (!SEND) {
      console.log(
        yellow(
          writable
            ? "    would send: routine to customer + alert to owner\n"
            : "    would send: alert to owner ONLY (no concern, so no routine)\n"
        )
      );
      delivered++;
      continue;
    }

    const { data: rows } = await db()
      .from("messages")
      .select("role, body")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true });

    const history: ChatMessage[] = (rows ?? []).map((m) => ({
      role: m.role === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.body as string,
    }));

    try {
      const summary = summariseForOwner(company, history);

      // Same split as live delivery: the owner always hears, the customer only
      // gets a routine we can actually base on something.
      if (writable) {
        const routine = await generateRoutine(brain, company, collected, history);
        await sendRoutineToCustomer(company, collected, routine);
      }
      await sendLeadAlert(company, collected, summary, c.channel as string);
      await markLeadNotified(lead.id);

      console.log(
        green(writable ? "    ✓ routine and alert sent\n" : "    ✓ alert sent\n")
      );
      delivered++;
    } catch (e) {
      console.log(red(`    ✗ ${(e as Error).message}\n`));
    }
  }

  console.log(
    dim(`  ${delivered} to deliver · ${skipped} already sent\n`) +
      (SEND || delivered === 0
        ? ""
        : dim("  run  npm run recover -- --send  to send them\n"))
  );
}

main().catch((e) => {
  console.error(red(`\n✗ ${e.message}\n`));
  process.exit(1);
});
