/**
 * End-to-end test through the real persistence path.
 *
 *   EMAIL_DRY_RUN=1 npm run e2e      log the emails, send nothing
 *   npm run e2e                      actually send
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { handleInbound } from "../lib/handle";
import { db } from "../lib/db";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

const TEST_EMAIL = process.env.E2E_CUSTOMER_EMAIL ?? "riti150802@gmail.com";

const TURNS = [
  "hi, my skin is really dry and flaky and quite sensitive",
  "this is my first time doing skincare properly",
  `Riti Moradiya, ${TEST_EMAIL}`,
];

async function main() {
  // A fresh thread each run so we always exercise the create path.
  const threadId = `e2e-${Date.now()}`;
  console.log(bold(`\n  end-to-end · thread ${threadId}`));
  console.log(
    dim(`  email mode: ${process.env.EMAIL_DRY_RUN === "1" ? "DRY RUN" : "LIVE"}\n`)
  );

  for (const text of TURNS) {
    console.log(bold("\nYou    ") + text);
    const started = Date.now();
    const r = await handleInbound({ channel: "web", threadId, text });
    console.log(cyan("Lumea  ") + r.reply.replace(/\n/g, "\n       "));
    console.log(
      dim(`       ${Date.now() - started}ms · ${r.mode} · complete=${r.complete}`)
    );
    await new Promise((res) => setTimeout(res, 18000));
  }

  // Let the fire-and-forget delivery finish.
  console.log(dim("\n  waiting for lead delivery…"));
  await new Promise((res) => setTimeout(res, 20000));

  console.log(bold("\n  what landed in the database"));

  const { data: convo } = await db()
    .from("conversations")
    .select("id, channel, status, collected, attempts, last_ask_id")
    .eq("channel_thread_id", threadId)
    .single();
  console.log(dim("  conversation " + JSON.stringify(convo, null, 2).replace(/\n/g, "\n  ")));

  const { count: messageCount } = await db()
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", convo!.id);
  console.log(dim(`\n  messages: ${messageCount}`));

  const { data: lead } = await db()
    .from("leads")
    .select("first_name, last_name, email, phone, description, experience, notified_at")
    .eq("conversation_id", convo!.id)
    .maybeSingle();
  console.log(dim("\n  lead " + JSON.stringify(lead, null, 2).replace(/\n/g, "\n  ")));

  console.log(
    lead?.notified_at
      ? green("\n  ✓ lead created and notified\n")
      : dim("\n  lead not yet notified\n")
  );
}

main().catch((e) => {
  console.error(`\n\x1b[31m✗ ${e.message}\x1b[0m\n`);
  process.exit(1);
});
