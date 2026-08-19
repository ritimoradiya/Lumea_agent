/**
 * Diagnoses whether reply latency is model reasoning or Groq rate
 * limiting, by reading the rate-limit headers Groq returns.
 *
 *   npx tsx scripts/diag.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

const KEY = process.env.GROQ_API_KEY!;
const MODEL = process.env.GROQ_MODEL!;

async function call(label: string, prompt: string) {
  const t = Date.now();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 160,
      reasoning_effort: "low",
    }),
  });
  const ms = Date.now() - t;
  const h = res.headers;
  const body: any = await res.json();

  console.log(`\n${label}  →  ${ms}ms   HTTP ${res.status}`);
  console.log(`  reqs left:   ${h.get("x-ratelimit-remaining-requests")} / ${h.get("x-ratelimit-limit-requests")}`);
  console.log(`  tokens left: ${h.get("x-ratelimit-remaining-tokens")} / ${h.get("x-ratelimit-limit-tokens")}`);
  console.log(`  token reset: ${h.get("x-ratelimit-reset-tokens")}`);
  if (h.get("retry-after")) console.log(`  ⚠ retry-after: ${h.get("retry-after")}`);
  if (res.status !== 200) console.log(`  body: ${JSON.stringify(body).slice(0, 300)}`);
  if (body.usage) {
    console.log(`  used: ${body.usage.prompt_tokens} in / ${body.usage.completion_tokens} out`);
  }
}

async function main() {
  console.log(`model: ${MODEL}`);
  await call("short #1", "Say hello in one sentence.");
  await call("short #2", "Say hello in one sentence.");
  await call(
    "hard (guardrail-style)",
    "I'm pregnant. Can I use a retinol product? Answer in two sentences without giving medical advice."
  );
}

main();
