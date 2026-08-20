import { db } from "./db";

/**
 * Rate limiting, backed by the messages table.
 *
 * No Redis and no in-memory counters: serverless functions get recycled and
 * run in parallel, so anything held in process memory is both lost and
 * inconsistent. The messages table is already the record of every reply we
 * have sent, which makes it the honest source of truth and costs nothing
 * extra.
 *
 * Two ceilings, because they protect against different things:
 *
 *   per conversation — stops one person monopolising the agent
 *   global          — protects the daily token budget from everyone at once
 *
 * Groq's free tier allows ~170 conversation turns a day across both models.
 * A public URL with no ceiling could burn that in minutes and leave the demo
 * dead exactly when it is needed.
 */

export const PER_THREAD_HOURLY = Number(process.env.LIMIT_PER_THREAD ?? 25);
export const GLOBAL_HOURLY = Number(process.env.LIMIT_GLOBAL ?? 120);

export type LimitVerdict =
  | { allowed: true }
  | { allowed: false; reason: "thread" | "global"; message: string };

const HOUR_MS = 60 * 60 * 1000;

export async function checkLimits(
  conversationId: string | null
): Promise<LimitVerdict> {
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const supabase = db();

  // Global first: if the budget is gone, the per-thread count is irrelevant.
  const { count: globalCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("role", "agent")
    .gte("created_at", since);

  if ((globalCount ?? 0) >= GLOBAL_HOURLY) {
    return {
      allowed: false,
      reason: "global",
      message:
        "We're unusually busy just now. Please try again in a little while, " +
        "or email us and a colleague will pick it up.",
    };
  }

  if (conversationId) {
    const { count: threadCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("role", "agent")
      .gte("created_at", since);

    if ((threadCount ?? 0) >= PER_THREAD_HOURLY) {
      return {
        allowed: false,
        reason: "thread",
        message:
          "That's a lot of questions for one sitting. Let's pick this up " +
          "shortly — or email us and a colleague will take it from here.",
      };
    }
  }

  return { allowed: true };
}
