/**
 * The checklist.
 *
 * The load-bearing design decision of the project: our CODE tracks what
 * is still outstanding, not the model. Each turn the model is handed at
 * most one thing to ask for. That is why the agent cannot loop or forget.
 *
 * The unit here is an ASK, not a field. "What's your name?" is one ask
 * filling two fields, because splitting it into "first name?" then "last
 * name?" reads like a form rather than a conversation.
 */

export const FIELDS = [
  "description",
  "experience",
  "firstName",
  "lastName",
  "email",
  "phone",
] as const;

export type Field = (typeof FIELDS)[number];
export type Collected = Partial<Record<Field, string>>;

export type Ask = {
  id: string;
  /** Fields this ask can fill. */
  fields: Field[];
  /** Fields that must be present before the ask counts as answered. */
  requires: Field[];
  /** How the model is told to phrase it. */
  label: string;
  /** Why we want it. Turns a form field into a reason to answer. */
  reason: string;
  /**
   * Optional asks are attempted once, never chased, and do not block a
   * lead from being considered complete.
   */
  optional?: boolean;
};

/**
 * Consultation order, not form order. Someone messaging a skincare brand
 * has a problem — understand their skin and their experience level first,
 * because those change what you should recommend. Contact details come
 * after you have been useful.
 *
 * Every ask carries a `reason`. "What's your email?" is a form; "so a
 * specialist can send you a written routine" is a service.
 *
 * `name` requires only firstName: if someone gives one name we take it and
 * move on. Chasing a surname is the badgering this exists to prevent.
 */
export const ASKS: Ask[] = [
  {
    id: "concern",
    fields: ["description"],
    requires: ["description"],
    label: "their skin type or the main concern they are dealing with",
    reason: "so anything you suggest actually suits their skin",
  },
  {
    id: "experience",
    fields: ["experience"],
    requires: ["experience"],
    label:
      "whether they already have a daily routine or are starting out for the first time",
    reason:
      "because a beginner should build up slowly while someone experienced can start on actives straight away",
  },
  {
    id: "name",
    fields: ["firstName", "lastName"],
    requires: ["firstName"],
    label: "their name",
    reason: "so the colleague following up knows who they are speaking to",
  },
  {
    id: "email",
    fields: ["email"],
    requires: ["email"],
    label: "their email address",
    reason: "so a specialist can send a written routine they can keep",
  },
  {
    id: "phone",
    fields: ["phone"],
    requires: ["phone"],
    label: "a phone number",
    reason:
      "ONLY in case they would rather be called than emailed - ask lightly, make it clearly optional, and never push it",
    optional: true,
  },
];

/** Give up on a required ask after this many attempts. Optional asks get one. */
const MAX_ATTEMPTS = 2;

/** Fields a lead needs before it counts as complete. Phone is not one. */
export const REQUIRED_FIELDS: Field[] = ASKS.filter((a) => !a.optional).flatMap(
  (a) => a.requires
);

/** State that has to survive between turns. */
export type ConversationState = {
  collected: Collected;
  /** askId → how many times we have asked it. */
  attempts: Record<string, number>;
  /** The ask made on the previous turn, if any. */
  lastAskId: string | null;
};

export function emptyState(): ConversationState {
  return { collected: {}, attempts: {}, lastAskId: null };
}

export function isAskSatisfied(ask: Ask, collected: Collected): boolean {
  return ask.requires.every((f) => collected[f]?.trim());
}

export function findAsk(id: string | null): Ask | null {
  return id ? ASKS.find((a) => a.id === id) ?? null : null;
}

/** The next thing worth asking for, skipping anything already exhausted. */
export function nextAsk(
  collected: Collected,
  attempts: Record<string, number>
): Ask | null {
  return (
    ASKS.find(
      (ask) =>
        !isAskSatisfied(ask, collected) &&
        (attempts[ask.id] ?? 0) < (ask.optional ? 1 : MAX_ATTEMPTS)
    ) ?? null
  );
}

/** True once every required detail is present. Phone is not required. */
export function isLeadComplete(collected: Collected): boolean {
  return REQUIRED_FIELDS.every((f) => collected[f]?.trim());
}

/**
 * Identity details are locked once known — a later guess must never
 * overwrite a confirmed email or phone number.
 */
const LOCKED_FIELDS: Field[] = ["firstName", "lastName", "email", "phone"];

/**
 * These are expected to evolve. Someone who opens with "something for
 * sensitive skin" and later says "actually I need a dry skin routine"
 * should end up with the second one on their lead.
 */
const MUTABLE_FIELDS: Field[] = ["description", "experience"];

export function merge(current: Collected, incoming: Collected): Collected {
  const next: Collected = { ...current };

  for (const field of FIELDS) {
    const value = incoming[field]?.trim();
    if (!value) continue;

    if (MUTABLE_FIELDS.includes(field)) {
      next[field] = value;
    } else if (LOCKED_FIELDS.includes(field) && !next[field]?.trim()) {
      next[field] = value;
    }
  }

  return next;
}

/** Progress against REQUIRED fields, for the harness and admin panel. */
export function progress(collected: Collected): string {
  const have = REQUIRED_FIELDS.filter((f) => collected[f]?.trim()).length;
  return `${have}/${REQUIRED_FIELDS.length}`;
}
