/**
 * Checks every external dependency before we rely on it.
 *
 *   npm run verify
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { verifyMailer } from "../lib/email";
import { db } from "../lib/db";
import { getCompany } from "../lib/company";
import { getBrain } from "../lib/brain";
import { getMe } from "../lib/channels/telegram";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

async function check(label: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    console.log(`  ${green("✓")} ${label}${detail ? dim(`  ${detail}`) : ""}`);
    return true;
  } catch (error) {
    console.log(`  ${red("✗")} ${label}\n      ${red((error as Error).message)}`);
    return false;
  }
}

async function main() {
  console.log("");
  const results = [
    await check("company profile", async () => {
      const c = await getCompany();
      return `${c.name} · ${c.products.length} products · ${c.faqs.length} FAQs`;
    }),
    await check("brain", async () => (await getBrain()).name),
    await check("supabase tables", async () => {
      const { error } = await db().from("companies").select("id").limit(1);
      if (error) throw new Error(error.message);
      const tables = [
        "companies",
        "company_products",
        "company_faqs",
        "contacts",
        "conversations",
        "messages",
        "leads",
      ];
      for (const t of tables) {
        const { error: e } = await db().from(t).select("*").limit(0);
        if (e) throw new Error(`table "${t}": ${e.message}`);
      }
      return `all ${tables.length} tables present`;
    }),
    await check("gmail smtp", async () => {
      await verifyMailer();
      return process.env.GMAIL_ADDRESS ?? "";
    }),
    await check("telegram bot", async () => {
      const me = await getMe();
      return `@${me.username}`;
    }),
  ];

  const failed = results.filter((r) => !r).length;
  console.log(
    failed === 0
      ? green("\n  everything ready\n")
      : red(`\n  ${failed} check(s) failed\n`)
  );
  process.exit(failed === 0 ? 0 : 1);
}

main();
