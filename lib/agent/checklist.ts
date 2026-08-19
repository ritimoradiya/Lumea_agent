/**
 * The checklist.
 *
 * This is the load-bearing design decision of the whole project: our
 * CODE tracks which details we still need, not the model. The model is
 * never asked to remember anything — it is told, each turn, exactly
 * which single field to ask for. That makes the agent reliable even on
 * a small model, and means it can't loop or forget mid-conversation.
 */

export const FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "description",
] as const;

export type Field = (typeof FIELDS)[number];

export type Collected = Partial<Record<Field, string>>;

/** How the agent refers to each field when asking for it. */
export const FIELD_LABELS: Record<Field, string> = {
  firstName: "their first name",
  lastName: "their last name",
  email: "their email address",
  phone: "their phone number",
  description: "a short description of what they need help with",
};

/** Fields still outstanding, in asking order. */
export function missingFields(collected: Collected): Field[] {
  return FIELDS.filter((f) => !collected[f]?.trim());
}

/** The single next field to ask for, or null when we have everything. */
export function nextField(collected: Collected): Field | null {
  return missingFields(collected)[0] ?? null;
}

export function isComplete(collected: Collected): boolean {
  return missingFields(collected).length === 0;
}

/**
 * Merge newly extracted values over what we already have.
 * Existing values win — we never overwrite a confirmed detail with a
 * later guess, which stops the agent from corrupting good data.
 */
export function merge(current: Collected, incoming: Collected): Collected {
  const next: Collected = { ...current };
  for (const field of FIELDS) {
    const value = incoming[field]?.trim();
    if (value && !next[field]?.trim()) {
      next[field] = value;
    }
  }
  return next;
}

/** Human-readable progress, for the terminal harness and admin panel. */
export function progress(collected: Collected): string {
  const have = FIELDS.filter((f) => collected[f]?.trim()).length;
  return `${have}/${FIELDS.length}`;
}
