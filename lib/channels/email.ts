import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

/**
 * Email transport.
 *
 * Reads over IMAP and replies over SMTP, both against the brand's own Gmail.
 * Nothing needs to be publicly reachable: the process connects OUT to Gmail,
 * which is why this works from a laptop with no tunnel.
 *
 * The fiddly part is threading. A reply is only stitched into the original
 * conversation if it carries In-Reply-To and References pointing at the
 * message it answers. Get that wrong and every reply starts a new thread in
 * the customer's client, which looks broken in a way that is easy to miss
 * when you are only testing against your own inbox.
 */

function credentials() {
  const user = process.env.GMAIL_ADDRESS;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) {
    throw new Error(
      "GMAIL_ADDRESS and GMAIL_APP_PASSWORD must be set. The password must be a " +
        "16-character App Password from myaccount.google.com/apppasswords."
    );
  }
  return { user, pass };
}

export type InboundEmail = {
  /** IMAP uid, so it can be marked read only after we have actually replied. */
  uid: number;
  /** The address that wrote to us. */
  from: string;
  fromName: string;
  subject: string;
  /** Plain text body with quoted history stripped. */
  text: string;
  /** This message's own Message-ID, needed to thread the reply. */
  messageId: string;
  /**
   * The root of the thread. Used as the conversation key so every message in
   * one exchange maps to one conversation, rather than a fresh one each time.
   */
  threadRoot: string;
};

/**
 * Strip quoted history from a reply.
 *
 * Without this, every reply resends the entire conversation to the model —
 * which inflates the prompt on each turn and, worse, lets the agent read its
 * own earlier replies as if the customer had said them.
 */
/**
 * The longest inbound body we will read.
 *
 * The web widget caps input at 2,000 characters; email had no cap at all, so
 * one long message went into the prompt whole. Groq's free tier allows 8,000
 * tokens a minute, and a single newsletter that slipped past the bulk filter
 * could spend the lot - starving every other channel for the rest of it.
 *
 * The opening is what gets kept, because that is where people put the actual
 * question. Anything past this is signature, disclaimer or history.
 */
const MAX_BODY_CHARS = 4000;

export function capBody(text: string): string {
  if (text.length <= MAX_BODY_CHARS) return text;

  // Cut at a line break where possible, so a sentence is not sliced mid-word.
  const head = text.slice(0, MAX_BODY_CHARS);
  const lastBreak = head.lastIndexOf("\n");
  const kept = lastBreak > MAX_BODY_CHARS * 0.6 ? head.slice(0, lastBreak) : head;

  return `${kept.trimEnd()}\n\n[message truncated]`;
}

function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    // "On <date>, <someone> wrote:" — the standard reply attribution.
    if (/^\s*On .{10,80}wrote:\s*$/i.test(line)) break;
    // Outlook and some clients use a divider instead.
    if (/^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i.test(line)) break;
    if (/^\s*_{10,}\s*$/.test(line)) break;
    if (line.trimStart().startsWith(">")) continue;
    out.push(line);
  }

  return out.join("\n").trim();
}

export async function fetchUnread(limit = 10): Promise<InboundEmail[]> {
  const { user, pass } = credentials();

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const found: InboundEmail[] = [];

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const unseen = await client.search({ seen: false });
    const ids = (unseen || []).slice(-limit);

    for (const id of ids) {
      // fetchOne returns `false` when the message has vanished between the
      // search and the fetch, which happens if another client moves it.
      const message = await client.fetchOne(String(id), { source: true });
      if (message === false || !message.source) continue;

      const parsed = await simpleParser(message.source);
      const from = parsed.from?.value?.[0];
      if (!from?.address) continue;

      /**
       * Never process mail from our own address.
       *
       * Without this the agent can answer itself: a reply that lands back in
       * the inbox unread gets treated as a customer message, answered, and
       * that answer arrives too — a loop that would spend the entire token
       * budget and fill the customer's inbox. Real data already showed the
       * company's own address recorded as a customer's.
       */
      if (from.address.toLowerCase() === user.toLowerCase()) {
        await client.messageFlagsAdd(String(id), ["\\Seen"]);
        continue;
      }

      // Bulk and automated mail — Google notifications, newsletters — is not a
      // customer writing in, and answering it is pure waste.
      const headers = parsed.headers;
      if (
        headers.get("list-unsubscribe") ||
        headers.get("auto-submitted") ||
        String(headers.get("precedence") ?? "").toLowerCase() === "bulk"
      ) {
        await client.messageFlagsAdd(String(id), ["\\Seen"]);
        continue;
      }

      const text = capBody(stripQuoted(parsed.text ?? ""));
      if (!text) continue;

      // References holds the whole ancestry; its first entry is the thread
      // root. Absent it, this message IS the root.
      const references = Array.isArray(parsed.references)
        ? parsed.references
        : parsed.references
          ? [parsed.references]
          : [];

      found.push({
        uid: Number(id),
        from: from.address,
        fromName: from.name || from.address,
        subject: parsed.subject ?? "(no subject)",
        text,
        messageId: parsed.messageId ?? "",
        threadRoot: references[0] ?? parsed.messageId ?? from.address,
      });

    }
  } finally {
    lock.release();
    await client.logout();
  }

  return found;
}

/**
 * Mark a message read.
 *
 * Deliberately separate from fetching. Marking on fetch meant that a crash
 * between reading a message and replying to it lost the customer's email
 * silently — unread is the only record that we still owe them an answer.
 */
export async function markHandled(uid: number): Promise<void> {
  const { user, pass } = credentials();

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    await client.messageFlagsAdd(String(uid), ["\\Seen"]);
  } finally {
    lock.release();
    await client.logout();
  }
}

export async function replyToEmail(
  original: InboundEmail,
  body: string,
  companyName: string
): Promise<void> {
  const { user, pass } = credentials();

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const subject = /^re:/i.test(original.subject)
    ? original.subject
    : `Re: ${original.subject}`;

  await transport.sendMail({
    from: `"${companyName}" <${user}>`,
    to: original.from,
    subject,
    text: body,
    // These two headers are what make a client show this as a reply rather
    // than a new conversation.
    inReplyTo: original.messageId,
    references: [original.threadRoot, original.messageId].filter(Boolean),
  });
}
