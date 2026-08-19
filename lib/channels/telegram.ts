/**
 * Telegram transport.
 *
 * Only concerned with talking to Telegram — turning its payloads into the
 * three things handleInbound() wants, and sending text back. No agent logic
 * lives here, which is the point of the channel-adapter split.
 */

const API = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not set in .env.local — get one from @BotFather"
    );
  }
  return t;
}

async function call<T>(method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const data = (await response.json()) as {
    ok: boolean;
    result?: T;
    description?: string;
  };

  if (!data.ok) {
    throw new Error(`telegram ${method}: ${data.description ?? response.status}`);
  }
  return data.result as T;
}

export type TelegramMessage = {
  chatId: number;
  text: string;
  /** For logging only — never used to identify the conversation. */
  from: string;
  /** Profile first name, when Telegram supplies one. */
  firstName?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string; username?: string };
  };
};

export async function getMe(): Promise<{ username: string; first_name: string }> {
  return call("getMe");
}

/**
 * Long poll for updates.
 *
 * Deliberately not a webhook: webhooks need a publicly reachable URL, and
 * long polling works from a laptop with nothing exposed. Passing an offset
 * also acknowledges everything before it, so Telegram will not resend
 * messages we have already handled.
 */
export async function getUpdates(
  offset: number,
  timeoutSeconds = 25
): Promise<TelegramUpdate[]> {
  return call("getUpdates", {
    offset,
    timeout: timeoutSeconds,
    allowed_updates: ["message"],
  });
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    // The agent writes plain text, so parse_mode stays off — a stray asterisk
    // would otherwise break the message or silently vanish.
    disable_web_page_preview: true,
  });
}

/** Shows "typing…" in the client while the agent composes. */
export async function sendTyping(chatId: number): Promise<void> {
  try {
    await call("sendChatAction", { chat_id: chatId, action: "typing" });
  } catch {
    // Cosmetic only — never let it break the reply.
  }
}

/** Point Telegram at a public URL instead of polling. For after deploy. */
export async function setWebhook(url: string, secret: string): Promise<void> {
  await call("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export async function deleteWebhook(): Promise<void> {
  await call("deleteWebhook", { drop_pending_updates: false });
}

export function extractMessage(update: TelegramUpdate): TelegramMessage | null {
  const message = update.message;
  if (!message?.text?.trim()) return null;
  return {
    chatId: message.chat.id,
    text: message.text.trim(),
    from:
      message.from?.username ??
      message.from?.first_name ??
      String(message.chat.id),
    firstName: message.from?.first_name,
  };
}
