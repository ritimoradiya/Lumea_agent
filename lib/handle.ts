import { getBrain, type ChatMessage } from "./brain";
import { getCompany, greetingFor, type Company } from "./company";
import { respond } from "./agent/respond";
import { generateRoutine } from "./agent/routine";
import { isLeadComplete } from "./agent/checklist";
import { sendLeadAlert, sendRoutineToCustomer } from "./email";
import {
  createLeadIfNew,
  isLeadNotified,
  loadConversation,
  markLeadNotified,
  saveTurn,
  syncCompany,
  type Channel,
} from "./db";

/**
 * The single entry point for every channel.
 *
 * The web widget, Telegram, email, and the simulator all call this with
 * the same three arguments. Nothing below here knows which door a message
 * came through, which is why adding a channel is a small job.
 */

export type InboundInput = {
  channel: Channel;
  /** Identifies the thread within its channel: a session id, Telegram chat id, email thread. */
  threadId: string;
  text: string;
  companySlug?: string;
};

export type InboundResult = {
  reply: string;
  greeting: string | null;
  complete: boolean;
  mode: string;
  collected: Record<string, string | undefined>;
};

/** Company id is stable for the process; look it up once. */
let cached: { slug: string; id: string; company: Company } | null = null;

async function resolveCompany(slug?: string) {
  const company = await getCompany(slug);
  if (cached?.slug === company.slug) return { id: cached.id, company };

  const id = await syncCompany(company);
  cached = { slug: company.slug, id, company };
  return { id, company };
}

export async function handleInbound(
  input: InboundInput,
  onToken?: (token: string) => void
): Promise<InboundResult> {
  const brain = await getBrain();
  const { id: companyId, company } = await resolveCompany(input.companySlug);

  const conversation = await loadConversation(
    companyId,
    input.channel,
    input.threadId
  );

  const result = await respond(
    {
      brain,
      company,
      history: conversation.history,
      state: conversation.state,
      customerMessage: input.text,
    },
    onToken
  );

  await saveTurn(conversation.id, input.text, result.reply, result.state);

  // Fire-and-forget the follow-up work. The customer already has their
  // reply; making them wait on a routine being written and two SMTP
  // round-trips would add seconds to a conversation for no benefit.
  if (isLeadComplete(result.state.collected)) {
    void deliverLead({
      companyId,
      company,
      conversationId: conversation.id,
      collected: result.state.collected,
      history: [
        ...conversation.history,
        { role: "user", content: input.text },
        { role: "assistant", content: result.reply },
      ],
      channel: input.channel,
    }).catch((error) => {
      // Never let delivery failure surface to the customer — the lead row
      // is already saved, and notified_at stays null so it can be retried.
      console.error(`[lead delivery] ${(error as Error).message}`);
    });
  }

  return {
    reply: result.reply,
    // Only on a thread's first message, so the widget can show it above the reply.
    greeting: conversation.isNew ? greetingFor(company) : null,
    complete: result.complete,
    mode: result.mode,
    collected: result.state.collected,
  };
}

async function deliverLead(args: {
  companyId: string;
  company: Company;
  conversationId: string;
  collected: Record<string, string | undefined>;
  history: ChatMessage[];
  channel: Channel;
}): Promise<void> {
  const lead = await createLeadIfNew(
    args.companyId,
    args.conversationId,
    args.collected
  );

  // Either a previous turn already sent these, or a retry is in progress.
  if (!lead.isNew && (await isLeadNotified(lead.id))) return;

  const brain = await getBrain();
  const routine = await generateRoutine(
    brain,
    args.company,
    args.collected,
    args.history
  );

  const transcript = args.history
    .map((m) => `${m.role === "user" ? "Customer" : "Lumea"}: ${m.content}`)
    .join("\n\n");

  await sendRoutineToCustomer(args.company, args.collected, routine);
  await sendLeadAlert(args.company, args.collected, transcript, args.channel);

  await markLeadNotified(lead.id);
}
