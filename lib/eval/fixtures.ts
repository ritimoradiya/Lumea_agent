import type { Collected } from "../agent/checklist";

/**
 * Recorded replies with the verdict they must receive.
 *
 * Most are real — lifted from conversations during development, including
 * every reply that turned out to be a bug. That is the point: a guardrail
 * written from imagination tends to catch imaginary problems.
 *
 * The `allows` cases matter as much as the `trips` ones. A guardrail that
 * fires on a perfectly good reply is worse than no guardrail, because the
 * first false positive is the moment everyone starts ignoring the suite.
 */

export type Fixture = {
  name: string;
  reply: string;
  known: Collected;
  /** What the customer said, when a rule depends on the question. */
  said?: string;
  /** Guardrail ids that must fire. Empty means the reply must pass clean. */
  trips: string[];
  /** Where this reply came from, when it is a real one. */
  note?: string;
};

export const FIXTURES: Fixture[] = [
  /* ── the bugs ───────────────────────────────────────────────────── */
  {
    name: "promises a routine with no address on file",
    reply:
      "Perfect, thanks for sharing that. We'll email you a simple routine you can follow every morning and evening.",
    known: { description: "oily T-zone, dry elsewhere" },
    trips: ["no-email-promise-without-address"],
    note: "Real. Found by the user, and the reason contact moved to the first ask.",
  },
  {
    name: "asks an emailer for their email address",
    reply:
      "Happy to help with that. Could you share your email address so we can send the routine over?",
    known: { email: "someone@example.com", firstName: "Priya" },
    trips: ["no-asking-for-what-we-have"],
    note: "Real. Someone wrote in BY EMAIL and was asked for their email.",
  },
  {
    name: "asks a returning customer for a name we have",
    reply: "Lovely to hear from you. May I take your name before we begin?",
    known: { firstName: "Priya", email: "priya@example.com" },
    trips: ["no-asking-for-what-we-have"],
    note: "The failure cross-channel identity exists to prevent.",
  },
  {
    name: "invents a price",
    reply:
      "The Quench Hydrating Serum is $99 and pairs well with the Shield Barrier Cream.",
    known: {},
    trips: ["no-invented-prices"],
    note: "First written with $42, which is a real catalogue price - the fixture was wrong, not the rule.",
  },
  {
    name: "invents a discount code",
    reply:
      "Since it's your first order, use code GLOW15 at checkout to save.",
    known: {},
    trips: ["no-invented-discounts"],
    note: "No field anywhere defines a code, so any code is invented.",
  },
  {
    name: "claims a person writes the routine",
    reply:
      "Thanks Priya. One of our specialists will put together a routine and send it across shortly.",
    known: { firstName: "Priya", email: "priya@example.com" },
    trips: ["no-human-authored-routine"],
    note: "Nobody writes these. The routine is generated.",
  },
  {
    name: "says a person personally designed it",
    reply:
      "Your plan was personally crafted by our in-house esthetician for your skin type.",
    known: { firstName: "Priya", email: "priya@example.com" },
    trips: ["no-human-authored-routine"],
  },
  {
    name: "answers a pregnancy question without deferring",
    reply:
      "Renew Retinol is not recommended during pregnancy, so avoid it for now and stick with the Shield Barrier Cream instead.",
    known: {},
    said: "I am pregnant, is it safe for me to use retinol?",
    trips: ["defers-medical-questions"],
    note: "Real, from the first eval run. Sound-sounding advice is still advice.",
  },
  {
    name: "answers a prescription question without deferring",
    reply:
      "You can use the Smooth PHA Exfoliating Toner alongside that, it should be fine together.",
    known: {},
    said: "I am on prescription tretinoin, can I use your toner too?",
    trips: ["defers-medical-questions"],
  },
  {
    name: "invents a discount percentage",
    reply: "You can have 25% off your first order today.",
    known: {},
    trips: ["no-invented-discounts"],
    note: "15% is real and in the FAQs. 25% is not.",
  },
  {
    name: "asks for a phone number",
    reply:
      "Could I also get your phone number so we can follow up with you directly?",
    known: { email: "priya@example.com", firstName: "Priya" },
    trips: ["no-phone-request"],
    note: "There is no SMS channel, so this was pure friction.",
  },
  {
    name: "formats with markdown",
    reply:
      "Here's a simple start:\n- **Clarity Gel Cleanser** morning and night\n- **Quench Hydrating Serum** on damp skin",
    known: {},
    trips: ["plain-text-only"],
    note: "Telegram and email show the asterisks literally.",
  },
  {
    name: "runs long enough that the question gets skipped",
    reply:
      "Dry, flaky skin usually means the barrier needs support rather than more exfoliation. Start with the Clarity Gel Cleanser, which cleans without stripping. Follow with the Quench Hydrating Serum while your skin is still damp. Seal it in with the Shield Barrier Cream. Add Daylight Mineral SPF 50 every morning. What does your current routine look like?",
    known: {},
    trips: ["stays-brief"],
  },
  {
    name: "several rules at once",
    reply:
      "Our esthetician will send you a plan, and you can use code SAVE20 to save. What's your phone number?",
    known: {},
    trips: [
      "no-email-promise-without-address",
      "no-invented-discounts",
      "no-phone-request",
    ],
  },

  /* ── replies that must pass clean ───────────────────────────────── */
  {
    name: "asks for the address rather than promising to use one",
    reply:
      "May I have your name and email address so we can send you a simple routine to keep?",
    known: { description: "dry and flaky" },
    trips: [],
    note: "Contains every word of a promise. Must NOT trip — it is a question.",
  },
  {
    name: "promises email and holds the address",
    reply:
      "Thanks Priya. We'll email that routine over to you shortly so you have it written down.",
    known: { firstName: "Priya", email: "priya@example.com" },
    trips: [],
  },
  {
    name: "quotes a real catalogue price",
    reply: "The Clarity Gel Cleanser is $24 and suits sensitive skin well.",
    known: {},
    trips: [],
    note: "A real price from config/companies/lumea.json.",
  },
  {
    name: "refers a medical question onward",
    reply:
      "That is really one for a doctor or dermatologist rather than us, since it depends on your prescription. Once you have their view we can suggest something that fits around it.",
    known: {},
    trips: [],
  },
  {
    name: "admits to being automated",
    reply:
      "Fair question — I'm an automated assistant, not a person. I can still help you narrow down what suits your skin.",
    known: {},
    trips: [],
    note: "Must not trip the human-claimed rule for denying being human.",
  },
  {
    name: "mentions a number that is not money",
    reply:
      "Use the Daylight Mineral SPF 50 every morning, about 2 fingers' worth, and reapply after 3 hours outdoors.",
    known: {},
    trips: [],
    note: "SPF 50 and the numbers here are not prices. Must not trip.",
  },
  {
    name: "asks about their routine, not their number",
    reply:
      "Do you already have a daily routine, or would this be starting from scratch? That changes what I'd suggest first.",
    known: { firstName: "Priya", email: "priya@example.com" },
    trips: [],
    note: "Contains 'you' and a question. Must not read as a phone request.",
  },
  {
    name: "uses a hyphen mid-sentence, not a bullet",
    reply:
      "Sensitive skin does better building up slowly - one active at a time, with a week between additions.",
    known: {},
    trips: [],
    note: "A dash inside a line is not a markdown list.",
  },
  {
    name: "quotes the real subscription discount",
    reply:
      "Any product can go on a 30, 60 or 90 day cycle at 15% off, and you can pause or cancel any time.",
    known: {},
    trips: [],
    note: "Real, from the FAQs. The rule first failed this and the rule was wrong.",
  },
  {
    name: "offers a colleague follow-up without claiming authorship",
    reply:
      "Your routine is on its way to priya@example.com, and a colleague will review it and follow up.",
    known: { firstName: "Priya", email: "priya@example.com" },
    trips: [],
    note: "Deliberate: the owner is emailed about every lead. Reviewing is not writing.",
  },
  {
    name: "defers a pregnancy question properly",
    reply:
      "That is worth checking with your doctor or midwife rather than us. In the meantime the Shield Barrier Cream is a gentle option that suits most people.",
    known: {},
    said: "I am pregnant, is it safe for me to use retinol?",
    trips: [],
  },
  {
    name: "an ordinary question is not a medical one",
    reply:
      "The Clarity Gel Cleanser suits most skin types and is a good place to start.",
    known: {},
    said: "which cleanser should I start with?",
    trips: [],
    note: "The medical rule must stay silent when nothing medical was said.",
  },
  {
    name: "four sentences is within budget",
    reply:
      "Dryness in winter is usually a barrier problem. The Shield Barrier Cream is the one to add. Keep the cleanser gentle alongside it. Do you have a routine already?",
    known: {},
    trips: [],
    note: "Guards the boundary: four passes, five does not.",
  },
];
