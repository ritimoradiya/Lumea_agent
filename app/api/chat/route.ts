import { z } from "zod";
import { handleInbound } from "@/lib/handle";
import { getCompany, greetingFor } from "@/lib/company";

/**
 * The website chat endpoint.
 *
 * Needs the Node runtime: it reaches Supabase with the service-role key and
 * sends mail over SMTP, neither of which works on the edge. Never cached —
 * every request is a distinct conversation turn.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Well above what a turn needs — replies stream in about a second. The default
 * on Vercel's free tier is ten seconds, which a slow first token plus a model
 * fallback could conceivably exceed, and the customer would see the stream cut
 * off rather than an error.
 */
export const maxDuration = 30;

const Body = z.object({
  threadId: z.string().min(8).max(120),
  text: z.string().min(1).max(2000),
  /**
   * Web only. This used to accept "simulator" as well, for the text demo;
   * that page is gone, and accepting any other channel would let a page
   * impersonate Telegram or email.
   */
  channel: z.literal("web").default("web"),
});

/** The opening line, so the widget can greet before the first message. */
export async function GET() {
  const company = await getCompany();
  return Response.json({ greeting: greetingFor(company), company: company.name });
}

export async function POST(request: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        const result = await handleInbound(
          { channel: body.channel, threadId: body.threadId, text: body.text },
          (token) => send({ token })
        );
        send({
          done: true,
          complete: result.complete,
          collected: result.collected,
          // A taken-over thread produces no tokens on purpose - a person is
          // answering. The widget has to be told, or it waits for a reply
          // that is never coming.
          handedToHuman: result.handedToHuman,
        });
      } catch (error) {
        // The customer gets a polite line rather than a stack trace. Their
        // message is already saved, so nothing is lost — this is what the
        // Groq rate limit looks like from the outside.
        console.error(`[chat] ${(error as Error).message}`);
        send({
          done: true,
          error:
            "Sorry — I'm having trouble responding just now. A colleague will follow up shortly.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
