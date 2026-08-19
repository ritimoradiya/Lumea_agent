import { z } from "zod";
import type { Brain, ChatMessage } from "../brain";
import type { Collected } from "./checklist";

/**
 * Field extraction.
 *
 * Deliberately hybrid. Email and phone numbers have strict shapes, so
 * a regex reads them far more reliably than any model will — and a
 * mistyped email is the single worst failure this agent can have. The
 * model is only asked for the fuzzy fields: names and the description.
 * Where both find something, the regex wins.
 */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

// Loose candidate match; validated by digit count below.
const PHONE_CANDIDATE_RE = /\+?[\d][\d\s().-]{5,}\d/g;

const ExtractionSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  description: z.string().nullable(),
});

function findEmail(text: string): string | undefined {
  return text.match(EMAIL_RE)?.[0]?.toLowerCase();
}

function findPhone(text: string): string | undefined {
  const candidates = text.match(PHONE_CANDIDATE_RE) ?? [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    // Real phone numbers land in this range; order numbers and years don't.
    if (digits.length >= 8 && digits.length <= 15) {
      return candidate.trim();
    }
  }
  return undefined;
}

const EXTRACTION_PROMPT = `You extract contact details from a customer support message.

Return ONLY a JSON object with exactly these keys:
{"firstName": null, "lastName": null, "email": null, "phone": null, "description": null}

Rules:
- Use null for anything the customer has not clearly stated. Never guess.
- Only extract what THIS customer said about THEMSELVES.
- "description" is a short phrase (under 15 words) describing what they need help with, in your own words. Null if they have not said yet.
- If they give a full name, split it into firstName and lastName.
- Never invent a placeholder like "John Doe" or "unknown".`;

/**
 * Pull any newly stated details out of the latest customer message.
 * Returns only what it found — merging is the caller's job.
 */
export async function extractFields(
  brain: Brain,
  customerMessage: string,
  recentContext: ChatMessage[] = []
): Promise<Collected> {
  const found: Collected = {};

  // 1. Deterministic pass — highest confidence, so it runs first.
  const email = findEmail(customerMessage);
  if (email) found.email = email;

  const phone = findPhone(customerMessage);
  if (phone) found.phone = phone;

  // 2. Model pass for the fuzzy fields.
  const context = recentContext
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: EXTRACTION_PROMPT },
    {
      role: "user",
      content:
        (context ? `Recent conversation:\n${context}\n\n` : "") +
        `Latest customer message:\n${customerMessage}`,
    },
  ];

  try {
    const raw = await brain.complete(messages, { json: true, maxTokens: 200 });
    const parsed = ExtractionSchema.safeParse(JSON.parse(raw));

    if (parsed.success) {
      const d = parsed.data;
      if (d.firstName) found.firstName = d.firstName.trim();
      if (d.lastName) found.lastName = d.lastName.trim();
      if (d.description) found.description = d.description.trim();
      // Regex wins on these two; only fall back to the model.
      if (!found.email && d.email && EMAIL_RE.test(d.email)) {
        found.email = d.email.trim().toLowerCase();
      }
      if (!found.phone && d.phone) {
        const digits = d.phone.replace(/\D/g, "");
        if (digits.length >= 8 && digits.length <= 15) found.phone = d.phone.trim();
      }
    }
  } catch {
    // Extraction is best-effort. A failed pass just means we ask again
    // next turn — never let it break the customer-facing reply.
  }

  return found;
}
