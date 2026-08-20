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

  /**
   * Imported inside the handler on purpose.
   *
   * imapflow opens a raw TLS socket and is the kind of Node library that may
   * not survive serverless bundling. At module scope a failure to load crashes
   * the function before any of our code runs, and the platform returns a bare
   * 502 with no detail. In here, we can report what actually went wrong.
   */
  let email!: typeof import("@/lib/channels/email");
  try {
    email = await import("@/lib/channels/email");
  } catch (error) {
    return Response.json(
      { ok: false, stage: "import", error: (error as Error).message },
      { status: 500 }
    );
  }

  const company = await getCompany();
  const handled: string[] = [];
  const failed: string[] = [];

  try {
    for (const message of await email.fetchUnread()) {
      try {
        const result = await handleInbound({
          channel: "email",
          threadId: message.threadRoot,
          text: message.text,
          known: knownFrom(message.fromName, message.from),
        });

        if (!result.handedToHuman) {
          await email.replyToEmail(message, result.reply, company.name);
        }
        // Only after the reply is away, so a failure leaves it unread to retry.
        await email.markHandled(message.uid);
        handled.push(message.from);
      } catch (error) {
        failed.push(`${message.from}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    return Response.json(
      { ok: false, stage: "poll", error: (error as Error).message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, handled, failed });
}
