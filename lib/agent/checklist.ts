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
  /** How the model is told to phrase it when nothing is known yet. */
  label: string;
  /**
   * Per-field phrasing, used when an ask is only partly answered. Someone
   * who gives their name but not their email must be asked for the email
   * alone — re-requesting the name they just gave is the fastest way to
   * look broken.
   */
  partialLabels?: Partial<Record<Field, string>>;
  /** Why we want it. Turns a form field into a reason to answer. */
  reason: string;
  /** Attempts before giving up. Defaults to MAX_ATTEMPTS. */
  maxAttempts?: number;
};

/**
 * Contact details come FIRST, deliberately.
 *
 * They used to be queued behind the skin questions, on the theory that you
 * should earn them by being useful. In practice the conversation reached
 * wrap-up before the ask ever landed, and the agent cheerfully promised to
 * email a routine to a customer whose address it had never collected.
 *
 * The greeting already opens with a question about their skin, so asking
 * who they are on the next turn is not a cold form — and it means every
 * later promise to email something is one we can actually keep.
 *
 * Every ask carries a `reason`. "What's your email?" is a form; "so a
 * specialist can send you a written routine" is a service.
 *
 * Name and email are ONE ask. They are both "how do I reach you", so
 * splitting them costs an extra round trip for nothing. Surname is taken
 * opportunistically and never chased — if someone gives one name, we keep
 * it and move on.
 */
export const ASKS: Ask[] = [
  {
    id: "contact",
    fields: ["firstName", "lastName", "email"],
    requires: ["firstName", "email"],
    label: "their name and email address",
    partialLabels: {
      firstName: "their name",
      email: "their email address",
    },
    reason:
      "so we can email them a written routine to keep - do NOT say a specialist or a person writes it, because it is generated automatically",
    // Email is the single most valuable detail here, so it gets one more
    // attempt than everything else before we give up on it.
    maxAttempts: 3,
  },
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
];

/**
 * Phone is deliberately NOT asked for.
 *
 * There is no SMS channel, so a phone number is data nobody could ever act
 * on — and it was the highest-friction thing we asked for. The field remains,
 * because if a customer volunteers "call me on 555…" that is worth recording;
 * we simply never request it.
 */

/** Give up on an ask after this many attempts. */
const MAX_ATTEMPTS = 2;

/**
 * Fields a lead genuinely cannot do without.
 *
 * Stated explicitly rather than derived from the ask list, because deriving
 * it created a contradiction: an ask is abandoned after two unanswered
 * attempts, yet the field it fills still gated the lead — so a customer who
 * ignored one question could never become a lead no matter what else they
 * gave. A real conversation hit exactly that, handing over name, email, phone
 * and concern, and producing nothing because the experience question went
 * unanswered.
 *
 * The test is whether you could act on the lead without it. You can follow up
 * with someone whose experience level you do not know. You cannot follow up
 * with someone who never gave you an email address.
 */
export const REQUIRED_FIELDS: Field[] = ["firstName", "email", "description"];

/** Collected when offered, but never allowed to block a lead. */
export const BONUS_FIELDS: Field[] = ["lastName", "experience", "phone"];

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

/**
 * How to phrase an ask given what we already have. Falls back to the full
 * label when nothing has been supplied yet.
 */
export function askLabel(ask: Ask, collected: Collected): string {
  const missing = ask.requires.filter((f) => !collected[f]?.trim());

  if (missing.length === 0 || missing.length === ask.requires.length) {
    return ask.label;
  }

  return missing.map((f) => ask.partialLabels?.[f] ?? ask.label).join(" and ");
}

/** Did this turn supply any part of the ask we made last turn? */
export function engagedWith(
  ask: Ask | null,
  learned: Collected
): boolean {
  return ask !== null && ask.fields.some((f) => learned[f]?.trim());
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
        (attempts[ask.id] ?? 0) < (ask.maxAttempts ?? MAX_ATTEMPTS)
    ) ?? null
  );
}

/** True once every required detail is present. Phone is not required. */
export function isLeadComplete(collected: Collected): boolean {
  return REQUIRED_FIELDS.every((f) => collected[f]?.trim());
}

/**
 * Every field is first-write-wins.
 *
 * Identity details obviously must never be overwritten by a later guess.
 * The description was mutable at first, on the theory that someone might
 * change what they need mid-conversation. In practice that let ordinary
 * follow-up questions clobber it: asking "can I use retinol while
 * pregnant?" three turns in rewrote a customer whose actual concern was
 * dry skin into "pregnant, asks about retinol safety".
 *
 * People state their need in their opening message. Later messages are
 * questions about it, not replacements for it. If someone genuinely
 * changes direction, the colleague following up has the full transcript.
 */
const LOCKED_FIELDS: Field[] = [...FIELDS];

export function merge(current: Collected, incoming: Collected): Collected {
  const next: Collected = { ...current };

  for (const field of FIELDS) {
    const value = incoming[field]?.trim();
    if (!value) continue;

    if (LOCKED_FIELDS.includes(field) && !next[field]?.trim()) {
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
