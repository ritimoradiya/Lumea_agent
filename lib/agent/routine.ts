import type { Brain, ChatMessage } from "../brain";
import { catalogueForPrompt, type Company } from "../company";
import type { Collected } from "./checklist";

/**
 * Turns a finished conversation into the written routine we promised to
 * email. Runs after the customer has already had their reply, so latency
 * does not matter here and it can afford to think properly.
 *
 * This lands in someone's inbox as a document they will keep and act on,
 * which is a higher bar than a chat message. It must not invent products,
 * must respect their experience level, and must carry its caveats.
 */
export async function generateRoutine(
  brain: Brain,
  company: Company,
  collected: Collected,
  history: ChatMessage[]
): Promise<string> {
  const transcript = history
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  const system = `You write a personalised skincare routine for ${company.name}.

# Available products — you may recommend NOTHING else
${catalogueForPrompt(company)}

# What we know about this customer
- Name: ${collected.firstName ?? "unknown"}
- Their concern: ${collected.description ?? "not stated"}
- Experience: ${collected.experience ?? "not stated"}

# Rules
- Use ONLY the products listed above. Never invent a product, price, or claim.
- If they are new to skincare, keep it to three or four products and do NOT
  include retinol or vitamin C. Say those can be introduced later once their
  skin has settled.
- If they already have a routine, you may include actives, but never put
  vitamin C and retinol in the same routine.
- Explain briefly WHY each product is there, in one clause.
- If their concern touches pregnancy, breastfeeding, a medical condition, a
  reaction, or prescription medication, say clearly that they should confirm
  with a doctor or dermatologist before starting.
- End with a one-line note that this is an automatically generated starting
  point, not medical advice, and that a colleague will follow up.

# Format
Plain text. No markdown, no asterisks, no headings with # symbols.
Use this shape exactly:

Morning
1. ...
2. ...

Evening
1. ...
2. ...

A few notes
- ...
- ...

Keep the whole thing under 250 words.`;

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Here is the conversation:\n\n${transcript}\n\nWrite their routine.`,
    },
  ];

  let out = "";
  for await (const token of brain.stream(messages, {
    maxTokens: 700,
    reasoningEffort: "low",
  })) {
    out += token;
  }
  return out.trim();
}
