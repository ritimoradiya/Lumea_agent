import { z } from "zod";
import type { Brain, ChatMessage } from "../brain";
import type { Collected } from "./checklist";

/**
 * Field extraction.
 *
 * Deliberately hybrid. Email and phone numbers have strict shapes, so a
 * regex reads them far more reliably than any model will — and a
 * mistyped email is the worst failure this agent can have. The model is
 * only asked for the fuzzy fields: names and the description.
 *
 * The model is told which field we just asked for, which is what makes
 * a bare reply like "Riti" unambiguous, and is told what we already
 * have so it never re-reports a stale value from earlier in the thread.
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
  experience: z.string().nullable(),
});

function findEmail(text: string): string | undefined {
  return text.match(EMAIL_RE)?.[0]?.toLowerCase();
}

function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  // Real phone numbers land in this range; order numbers and years don't.
  return digits.length >= 8 && digits.length <= 15;
}

function findPhone(text: string): string | undefined {
  for (const candidate of text.match(PHONE_CANDIDATE_RE) ?? []) {
    if (isPlausiblePhone(candidate)) return candidate.trim();
  }
  return undefined;
}

export type ExtractOptions = {
  /** What the agent asked for last turn, phrased for the prompt. Lets a
   *  bare reply like "Riti" be read as a name rather than as noise. */
  askedFor: string | null;
  /** Already-known values, so the model doesn't echo them back. */
  alreadyHave: Collected;
};

export async function extractFields(
  brain: Brain,
  customerMessage: string,
  options: ExtractOptions
): Promise<Collected> {
  const found: Collected = {};

  // 1. Deterministic pass — highest confidence, so it runs first.
  const email = findEmail(customerMessage);
  if (email) found.email = email;

  const phone = findPhone(customerMessage);
  if (phone) found.phone = phone;

  // 2. Model pass for the fuzzy fields.
  const known = Object.entries(options.alreadyHave)
    .filter(([, v]) => v?.trim())
    .map(([k]) => k);

  const system = `You extract contact details from ONE customer message.

Return ONLY a JSON object with exactly these keys:
{"firstName": null, "lastName": null, "email": null, "phone": null,
 "description": null, "experience": null}

Rules:
- Extract ONLY from the message given. Ignore anything you infer from elsewhere.
- Use null for anything not clearly stated in that message. Never guess.
- Only extract what the customer says about THEMSELVES.
- "description" is a short phrase, under 15 words, for their skin type or the
  concern they need help with. If they state a new need, return the NEW one.
- "experience" is their skincare experience level, ONLY if they indicate it.
  Use one of exactly: "first time", "some experience", "daily routine".
- A full name splits into firstName and lastName.
- Never invent a placeholder like "John Doe" or "unknown".${
    options.askedFor
      ? `\n- The agent just asked for ${options.askedFor}, so a short or bare
  reply is most likely answering that.`
      : ""
  }${
    known.length
      ? `\n- Already on file, do NOT return these unless the message changes them: ${known.join(
          ", "
        )}.`
      : ""
  }`;

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: customerMessage },
  ];

  try {
    const raw = await brain.complete(messages, { json: true, maxTokens: 200, reasoningEffort: "low" });
    const parsed = ExtractionSchema.safeParse(JSON.parse(raw));

    if (parsed.success) {
      const d = parsed.data;
      if (d.firstName) found.firstName = d.firstName.trim();
      if (d.lastName) found.lastName = d.lastName.trim();
      if (d.description) found.description = d.description.trim();
      if (d.experience) found.experience = d.experience.trim();
      // Regex wins on these two; only fall back to the model.
      if (!found.email && d.email && EMAIL_RE.test(d.email)) {
        found.email = d.email.trim().toLowerCase();
      }
      if (!found.phone && d.phone && isPlausiblePhone(d.phone)) {
        found.phone = d.phone.trim();
      }
    }
  } catch {
    // Extraction is best-effort. A failed pass just means we ask again
    // next turn — never let it break the customer-facing reply.
  }

  return found;
}
