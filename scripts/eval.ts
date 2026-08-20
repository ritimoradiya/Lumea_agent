/**
 * The live evaluation.
 *
 *   npm run eval              all scenarios
 *   npm run eval cold-open    just one
 *
 * Runs recorded conversations through the real model and applies the same
 * guardrails as `npm test`, plus per-turn expectations the fixtures cannot
 * check — whether the agent chose to ask or answer, and whether a detail
 * was actually captured.
 *
 * Paced deliberately. Groq's free tier allows 8,000 tokens a minute, and a
 * turn costs roughly 2,800 across the extraction and the reply. Going faster
 * does not fail loudly: the SDK retries silently and every reply appears to
 * take twenty seconds, which is how a rate limit once got mistaken for a slow
 * model. Override with PACE_MS if the budget is fresh.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { getBrain } from "../lib/brain";
import { getCompany } from "../lib/company";
import { respond } from "../lib/agent/respond";
import { emptyState, progress, type ConversationState } from "../lib/agent/checklist";
import { inspect, type Violation } from "../lib/eval/guardrails";
import { SCENARIOS, type Scenario } from "../lib/eval/scenarios";
import type { ChatMessage } from "../lib/brain";

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

const PACE = Number(process.env.PACE_MS ?? 20000);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Failure = { scenario: string; turn: number; detail: string };

async function run(
  scenario: Scenario,
  brain: Awaited<ReturnType<typeof getBrain>>,
  company: Awaited<ReturnType<typeof getCompany>>,
  first: boolean
): Promise<Failure[]> {
  console.log(bold(`\n\n─── ${scenario.id} ───`));
  console.log(dim(`${scenario.about}\n`));

  const history: ChatMessage[] = [];
  let state: ConversationState = emptyState();
  const failures: Failure[] = [];

  for (const [i, turn] of scenario.turns.entries()) {
    if (!(first && i === 0)) await pause(PACE);

    console.log(bold("\n  you   ") + turn.say);

    // Captured BEFORE the reply: a guardrail about asking for something we
    // already hold has to judge against what we held at the time.
    const knownBefore = { ...state.collected };

    const started = Date.now();
    const r = await respond({
      brain,
      company,
      history,
      state,
      customerMessage: turn.say,
    });
    const ms = Date.now() - started;

    state = r.state;
    history.push(
      { role: "user", content: turn.say },
      { role: "assistant", content: r.reply }
    );

    console.log(cyan("  agent ") + r.reply.replace(/\n/g, "\n         "));
    console.log(
      dim(`         ${r.mode} · ${progress(state.collected)} · ${ms}ms`)
    );

    /* ── the universal rules ──────────────────────────────────────── */
    const violations: Violation[] = inspect(r.reply, {
      company,
      known: knownBefore,
      said: turn.say,
    });
    for (const v of violations) {
      console.log(red(`         ✗ ${v.guardrail}: ${v.reason}`));
      failures.push({
        scenario: scenario.id,
        turn: i + 1,
        detail: `${v.guardrail} — ${v.reason}`,
      });
    }

    /* ── what this particular turn should do ──────────────────────── */
    const e = turn.expect;
    if (e?.mode && r.mode !== e.mode) {
      console.log(red(`         ✗ chose ${r.mode}, expected ${e.mode}`));
      failures.push({
        scenario: scenario.id,
        turn: i + 1,
        detail: `chose ${r.mode}, expected ${e.mode}`,
      });
    }

    if (e?.mentions && !e.mentions.pattern.test(r.reply)) {
      console.log(red(`         ✗ ${e.mentions.why}`));
      failures.push({
        scenario: scenario.id,
        turn: i + 1,
        detail: e.mentions.why,
      });
    }

    if (e?.avoids && e.avoids.pattern.test(r.reply)) {
      console.log(red(`         ✗ ${e.avoids.why}`));
      failures.push({ scenario: scenario.id, turn: i + 1, detail: e.avoids.why });
    }

    for (const field of e?.collected ?? []) {
      if (!state.collected[field]?.trim()) {
        // A missed surname is a shrug; a missed email is the whole point.
        const soft = field === "lastName" || field === "experience";
        const msg = `did not capture ${field} from "${turn.say.slice(0, 40)}…"`;
        console.log((soft ? yellow : red)(`         ${soft ? "!" : "✗"} ${msg}`));
        if (!soft) {
          failures.push({ scenario: scenario.id, turn: i + 1, detail: msg });
        }
      }
    }
  }

  console.log(dim(`\n  collected ${JSON.stringify(state.collected)}`));

  for (const field of scenario.endsWith ?? []) {
    if (!state.collected[field]?.trim()) {
      const msg = `conversation ended without ${field}`;
      console.log(red(`  ✗ ${msg}`));
      failures.push({ scenario: scenario.id, turn: 0, detail: msg });
    }
  }

  if (failures.length === 0) console.log(green("  ✓ clean"));
  return failures;
}

async function main() {
  const only = process.argv[2];
  const chosen = only
    ? SCENARIOS.filter((s) => s.id === only)
    : SCENARIOS;

  if (chosen.length === 0) {
    console.error(
      red(`\n✗ no scenario "${only}". Available: ${SCENARIOS.map((s) => s.id).join(", ")}\n`)
    );
    process.exit(1);
  }

  const brain = await getBrain();
  const company = await getCompany();
  const turns = chosen.reduce((n, s) => n + s.turns.length, 0);

  console.log(bold(`\n  ${company.name} — live evaluation`));
  console.log(
    dim(
      `  ${chosen.length} scenario(s), ${turns} turns, ~${Math.ceil(
        (turns * PACE) / 60000
      )} min at ${PACE / 1000}s pacing`
    )
  );

  const failures: Failure[] = [];
  for (const [i, scenario] of chosen.entries()) {
    failures.push(...(await run(scenario, brain, company, i === 0)));
  }

  console.log(bold("\n\n  ─── verdict ───"));
  if (failures.length === 0) {
    console.log(green(`  ✓ ${turns} turns, no violations\n`));
    process.exit(0);
  }

  console.log(red(`  ✗ ${failures.length} failure(s) across ${turns} turns\n`));
  for (const f of failures) {
    console.log(
      red(`    ${f.scenario}${f.turn ? ` turn ${f.turn}` : ""}: ${f.detail}`)
    );
  }
  console.log("");
  process.exit(1);
}

main().catch((e) => {
  console.error(red(`\n✗ ${e.message}\n`));
  process.exit(1);
});
