/**
 * The free test suite.
 *
 *   npm test
 *
 * No API key, no network, no tokens, under a second. Every guardrail is
 * checked against recorded replies in both directions: it must catch every
 * bad one and clear every good one.
 *
 * This is deliberately the suite that runs on every push. `npm run eval`
 * puts the same guardrails in front of the live model, which costs tokens
 * and so runs on request.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { GUARDRAILS, inspect, sentenceCount } from "../lib/eval/guardrails";
import { FIXTURES } from "../lib/eval/fixtures";
import { getCompany } from "../lib/company";
import { findEmailIn, findPhoneIn } from "../lib/agent/extract";
import {
  ASKS,
  askLabel,
  merge,
  nextAsk,
  isLeadComplete,
  progress,
  REQUIRED_FIELDS,
} from "../lib/agent/checklist";

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(red(`  ✗ ${name}`) + (detail ? dim(`\n      ${detail}`) : ""));
  }
}

async function main() {
  const company = await getCompany();

  /* ── 1. guardrails against recorded replies ─────────────────────── */
  console.log(bold("\n  guardrails"));

  for (const f of FIXTURES) {
    const fired = inspect(f.reply, {
      company,
      known: f.known,
      said: f.said,
    }).map((v) => v.guardrail);
    const expected = [...f.trips].sort();
    const actual = [...fired].sort();

    const missed = expected.filter((id) => !actual.includes(id));
    const spurious = actual.filter((id) => !expected.includes(id));

    check(
      f.name,
      missed.length === 0 && spurious.length === 0,
      [
        missed.length ? `did not catch: ${missed.join(", ")}` : "",
        spurious.length ? `false positive: ${spurious.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    );
  }

  /* ── 2. every guardrail is actually exercised ───────────────────── */
  console.log(bold("\n  coverage"));
  const exercised = new Set(FIXTURES.flatMap((f) => f.trips));
  for (const g of GUARDRAILS) {
    check(
      `${g.id} has a fixture that trips it`,
      exercised.has(g.id),
      "a guardrail nothing tests is a guardrail nobody knows is broken"
    );
  }

  /* ── 3. sentence counting ───────────────────────────────────────── */
  console.log(bold("\n  sentence counting"));
  const SENTENCES: [string, number][] = [
    ["One sentence.", 1],
    ["Two things. And another.", 2],
    ["No trailing period", 1],
    ["Costs $24.50 in total.", 1],
    ["Use it e.g. at night.", 1],
    ["Wait... then apply.", 2],
    ["Really? Yes! Fine.", 3],
  ];
  for (const [text, want] of SENTENCES) {
    const got = sentenceCount(text);
    check(`"${text}" is ${want}`, got === want, got !== want ? `got ${got}` : "");
  }

  /* ── 4. the checklist, which is what stops loops ────────────────── */
  console.log(bold("\n  checklist"));

  check(
    "contact is asked for first",
    ASKS[0].id === "contact",
    "otherwise wrap-up arrives before we ever have an address"
  );

  check(
    "nothing outstanding once every ask is satisfied",
    nextAsk(
      {
        firstName: "P",
        email: "p@e.com",
        description: "dry",
        experience: "first time",
      },
      {}
    ) === null
  );

  check(
    "an exhausted ask is skipped rather than repeated forever",
    nextAsk({}, { contact: 3, concern: 2, experience: 2 }) === null,
    "this is the loop guard"
  );

  const contact = ASKS[0];
  check(
    "a half-answered ask asks only for the missing half",
    askLabel(contact, { firstName: "Priya" }) ===
      contact.partialLabels?.email,
    `got "${askLabel(contact, { firstName: "Priya" })}"`
  );

  check(
    "an untouched ask uses its full phrasing",
    askLabel(contact, {}) === contact.label
  );

  check(
    "first write wins, so a later guess cannot overwrite identity",
    merge({ firstName: "Priya" }, { firstName: "Someone" }).firstName === "Priya"
  );

  check(
    "a follow-up question cannot rewrite the stated concern",
    merge({ description: "dry skin" }, { description: "asks about retinol" })
      .description === "dry skin",
    "a real conversation was rewritten this way"
  );

  check(
    "a blank incoming value never erases what we have",
    merge({ email: "p@e.com" }, { email: "   " }).email === "p@e.com"
  );

  check(
    "a lead completes without the optional fields",
    isLeadComplete({ firstName: "P", email: "p@e.com", description: "dry" }),
    "experience once blocked leads it had no business blocking"
  );

  check(
    "a lead is not complete without an address",
    !isLeadComplete({ firstName: "P", description: "dry" })
  );

  check(
    "an address and a concern is a lead, with no name",
    isLeadComplete({ email: "p@e.com", description: "oily skin" }),
    "real: this person was promised a routine and got nothing"
  );

  check(
    "an address and a name is a lead, with no concern",
    isLeadComplete({ email: "p@e.com", firstName: "Raksha" }),
    "real: Raksha was promised a routine and got nothing"
  );

  check(
    "an address alone is not yet a lead",
    !isLeadComplete({ email: "p@e.com" }),
    "otherwise every inbound email is a lead before they have said anything"
  );

  check(
    "progress reads out of two, not out of every field",
    progress({ email: "p@e.com", description: "dry" }) === "2/2",
    `got ${progress({ email: "p@e.com", description: "dry" })}`
  );

  check(
    "phone is never required",
    !REQUIRED_FIELDS.includes("phone"),
    "there is no channel that could use it"
  );

  /* ── 5. extraction, on the shapes that have caused bugs ─────────── */
  console.log(bold("\n  extraction"));

  const EXTRACTION: [string, "phone" | "email", string | null][] = [
    // Real. This address was stored as the email AND as the phone number,
    // because its local part is ten bare digits.
    ["my email is 1032201220@tcetmumbai.in", "phone", null],
    ["1032201220@tcetmumbai.in", "email", "1032201220@tcetmumbai.in"],
    // A genuine number alongside an address must still be found.
    ["riti@example.com, call me on 555 371 2263", "phone", "555 371 2263"],
    ["+1 (551) 371-2263", "phone", "+1 (551) 371-2263"],
    // Real. A millisecond timestamp from an email header, once stored as a
    // customer's phone number.
    ["1787242617119", "phone", null],
    ["hello there", "phone", null],
  ];

  for (const [text, field, want] of EXTRACTION) {
    // The finders return undefined for "not found"; the table says null.
    const got =
      (field === "email" ? findEmailIn(text) : findPhoneIn(text)) ?? null;
    check(
      `${field} of "${text.slice(0, 42)}" is ${want ?? "nothing"}`,
      got === want,
      got !== want ? `got ${got ?? "nothing"}` : ""
    );
  }

  /* ── 6. the catalogue the agent is allowed to talk about ────────── */
  console.log(bold("\n  catalogue"));

  check("every product has a price", company.products.every((p) => p.price));
  check(
    "product ids are unique",
    new Set(company.products.map((p) => p.id)).size === company.products.length
  );
  check("there are FAQs to answer from", company.faqs.length > 0);
  check(
    "a contact route exists for handing off",
    Boolean(company.contact?.email)
  );

  /* ── verdict ────────────────────────────────────────────────────── */
  const total = passed + failures.length;
  console.log("");
  if (failures.length === 0) {
    console.log(green(`  ✓ ${total} checks passed\n`));
    process.exit(0);
  }
  console.log(red(`  ✗ ${failures.length} of ${total} failed\n`));
  for (const f of failures) console.log(red(`    ${f}`));
  console.log("");
  process.exit(1);
}

main().catch((e) => {
  console.error(red(`\n✗ ${e.message}\n`));
  process.exit(1);
});
