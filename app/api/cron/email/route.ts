import { fetchUnread, markHandled, replyToEmail } from "@/lib/channels/email";
import { handleInbound } from "@/lib/handle";
import { getCompany } from "@/lib/company";

/**
 * One pass over the support inbox.
 *
 * Called on a schedule by netlify/functions/email-poll.mts. The polling logic
 * lives here, in Next, rather than in the Netlify function, so it shares the
 * same imports and path aliases as everything else — the scheduled function is
 * a trigger and nothing more.
 *
 * Until this existed, email only worked while someone was running
 * `npm run email` on a laptop. That is a bad dependency for a channel a
 * customer expects to be answered.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Turn a From header into details the agent should not have to ask for. */
function knownFrom(displayName: string, address: string) {
  const known: Record<string, string> = { email: address.toLowerCase() };
  const clean = displayName.trim();
  if (!clean || clean.includes("@")) return known;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts[0] && parts[0].length > 1) known.firstName = parts[0];
  if (parts.length > 1) known.lastName = parts.slice(1).join(" ");
  return known;
}

export async function POST(request: Request) {
  /**
   * A shared secret, because this endpoint spends tokens and sends mail. Left
   * open, anyone who found the URL could drain the budget by hammering it.
   */
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("x-cron-secret") !== expected) {
    return new Response("forbidden", { status: 403 });
  }

  const company = await getCompany();
  const handled: string[] = [];
  const failed: string[] = [];

  try {
    for (const email of await fetchUnread()) {
      try {
        const result = await handleInbound({
          channel: "email",
          threadId: email.threadRoot,
          text: email.text,
          known: knownFrom(email.fromName, email.from),
        });

        if (!result.handedToHuman) {
          await replyToEmail(email, result.reply, company.name);
        }
        // Only after the reply is away, so a failure leaves it unread to retry.
        await markHandled(email.uid);
        handled.push(email.from);
      } catch (error) {
        failed.push(`${email.from}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, handled, failed });
}
