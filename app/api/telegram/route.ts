import { extractMessage, sendMessage, sendTyping, type TelegramUpdate } from "@/lib/channels/telegram";
import { handleInbound } from "@/lib/handle";
import { getCompany, greetingFor } from "@/lib/company";

/**
 * Telegram webhook, for once this is deployed somewhere public.
 *
 * Locally, `npm run telegram` long polls instead — same handler underneath,
 * but polling needs no reachable URL. The two are mutually exclusive: setting
 * a webhook stops getUpdates working, which is why the worker clears it on
 * start.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  /**
   * Telegram echoes back the secret we registered with setWebhook. Without
   * checking it, anyone who guessed this URL could inject messages and spend
   * the whole token budget.
   */
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const given = request.headers.get("x-telegram-bot-api-secret-token");
    if (given !== expected) {
      return new Response("forbidden", { status: 403 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const message = extractMessage(update);
  // Always 200: a non-2xx makes Telegram retry the same update indefinitely.
  if (!message) return new Response("ok");

  try {
    if (message.text === "/start") {
      await sendMessage(message.chatId, greetingFor(await getCompany()));
      return new Response("ok");
    }

    await sendTyping(message.chatId);
    const result = await handleInbound({
      channel: "telegram",
      threadId: String(message.chatId),
      text: message.text,
    });

    if (!result.handedToHuman) {
      await sendMessage(message.chatId, result.reply);
    }
  } catch (error) {
    console.error(`[telegram] ${(error as Error).message}`);
    await sendMessage(
      message.chatId,
      "Sorry — I'm having trouble responding just now. A colleague will follow up shortly."
    ).catch(() => {});
  }

  return new Response("ok");
}
