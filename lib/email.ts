import nodemailer, { type Transporter } from "nodemailer";
import type { Company } from "./company";
import type { Collected } from "./agent/checklist";

/**
 * Outbound email over Gmail SMTP.
 *
 * Free, and replies come from the brand's own address, which reads far
 * better than mail from a sending service the recipient has never heard
 * of. The tradeoff is Gmail's ~500/day ceiling and a real chance of
 * landing in spam for recipients who have never corresponded with the
 * account — acceptable at demo volume, and the reason production systems
 * use a dedicated sender on their own domain.
 */

/**
 * Set EMAIL_DRY_RUN=1 to log what would be sent instead of sending it.
 * Useful in development, and essential for testing the delivery path
 * without putting real mail in someone's inbox.
 */
function isDryRun(): boolean {
  return process.env.EMAIL_DRY_RUN === "1";
}

let transport: Transporter | null = null;

function mailer(): Transporter {
  if (transport) return transport;

  const user = process.env.GMAIL_ADDRESS;
  // App Passwords are displayed in four groups; the spaces are cosmetic.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error(
      "GMAIL_ADDRESS and GMAIL_APP_PASSWORD must be set in .env.local. " +
        "The password must be a 16-character App Password from " +
        "myaccount.google.com/apppasswords, not the account password."
    );
  }

  transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transport;
}

/** Confirms credentials without sending anything. */
export async function verifyMailer(): Promise<void> {
  if (isDryRun()) return;
  await mailer().verify();
}

async function deliver(message: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (isDryRun()) {
    console.log(
      `\n\x1b[33m[DRY RUN] would send\x1b[0m\n` +
        `  to:      ${message.to}\n` +
        `  subject: ${message.subject}\n` +
        `  ─────────────────────────────────────────\n` +
        message.text.replace(/^/gm, "  ") +
        `\n  ─────────────────────────────────────────`
    );
    return;
  }
  await mailer().sendMail(message);
}

function textToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
font-size:15px;line-height:1.6;color:#1d1d1f;max-width:520px">
<pre style="font-family:inherit;font-size:inherit;white-space:pre-wrap;margin:0">${escaped}</pre>
</div>`;
}

/**
 * The routine we told the customer to expect.
 *
 * The sign-off states plainly that this was generated automatically. The
 * agent is forbidden from claiming a person wrote it, and this has to
 * match — a document someone keeps is the wrong place to be vague about
 * who produced it.
 */
export async function sendRoutineToCustomer(
  company: Company,
  collected: Collected,
  routine: string
): Promise<void> {
  const to = collected.email;
  if (!to) throw new Error("sendRoutineToCustomer: no email address collected");

  const name = collected.firstName ? ` ${collected.firstName}` : "";

  const body = `Hi${name},

Thanks for getting in touch. Here is a starting routine based on what you told us.

${routine}

If anything here does not suit you, reply to this email and a colleague will
adjust it.

— ${company.name}
${company.supportHours}

This routine was put together automatically from your conversation with our
assistant. It is a starting point rather than medical advice, and a colleague
will review it.`;

  await deliver({
    from: `"${company.name}" <${process.env.GMAIL_ADDRESS}>`,
    to,
    subject: `Your ${company.name} routine`,
    text: body,
    html: textToHtml(body),
  });
}

/** Tells the owner a lead has landed. */
export async function sendLeadAlert(
  company: Company,
  collected: Collected,
  transcript: string,
  channel: string
): Promise<void> {
  const to = process.env.OWNER_NOTIFY_EMAIL;
  if (!to) throw new Error("OWNER_NOTIFY_EMAIL is not set in .env.local");

  const fullName = [collected.firstName, collected.lastName]
    .filter(Boolean)
    .join(" ");

  const body = `New lead from ${channel}.

Name        ${fullName || "—"}
Email       ${collected.email ?? "—"}
Phone       ${collected.phone ?? "not given"}
Concern     ${collected.description ?? "—"}
Experience  ${collected.experience ?? "—"}

Conversation
────────────
${transcript}`;

  await deliver({
    from: `"${company.name} agent" <${process.env.GMAIL_ADDRESS}>`,
    to,
    replyTo: collected.email,
    subject: `New lead — ${fullName || collected.email} (${
      collected.description ?? "no concern given"
    })`,
    text: body,
    html: textToHtml(body),
  });
}
