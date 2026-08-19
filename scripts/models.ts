/**
 * Lists the models your Groq account can actually use, so we pick a
 * real one instead of guessing at an id that may have been retired.
 *
 *   npm run models
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error(
      red("\n✗ GROQ_API_KEY is empty in .env.local — get one at console.groq.com/keys\n")
    );
    process.exit(1);
  }

  const response = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    console.error(
      red(`\n✗ Groq returned ${response.status} ${response.statusText}`)
    );
    if (response.status === 401) {
      console.error(red("  That key was rejected. Check for stray spaces or a partial paste.\n"));
    }
    process.exit(1);
  }

  const { data } = (await response.json()) as {
    data: { id: string; owned_by: string; context_window: number }[];
  };

  const configured = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const available = data.map((m) => m.id).sort();

  console.log(bold(`\n  ${available.length} models available on your account\n`));
  for (const model of data.sort((a, b) => a.id.localeCompare(b.id))) {
    const marker = model.id === configured ? green(" ← your GROQ_MODEL") : "";
    console.log(
      `  ${model.id}${marker}\n${dim(
        `      ${model.owned_by} · ${model.context_window?.toLocaleString() ?? "?"} token context`
      )}`
    );
  }

  console.log("");
  if (available.includes(configured)) {
    console.log(green(`  ✓ GROQ_MODEL "${configured}" is valid\n`));
  } else {
    console.log(
      red(`  ✗ GROQ_MODEL "${configured}" is NOT in the list above.`) +
        "\n" +
        dim("    Pick one from the list and set GROQ_MODEL in .env.local\n")
    );
  }
}

main().catch((error) => {
  console.error(red(`\n✗ ${error.message}\n`));
  process.exit(1);
});
