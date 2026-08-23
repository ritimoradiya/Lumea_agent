import { getBrain, type ChatMessage } from "./brain";
import { getCompany, greetingFor, type Company } from "./company";
import { respond } from "./agent/respond";
import { generateRoutine } from "./agent/routine";
import {
  canWriteRoutine,
  isLeadComplete,
  merge,
  type Collected,
} from "./agent/checklist";
import {
  isUndeliverable,
  sendLeadAlert,
  sendRoutineToCustomer,
  summariseForOwner,
} from "./email";
import { checkLimits } from "./limits";
import {
  db,
  claimLeadForSending,
  createLeadIfNew,
  recogniseByEmail,
  releaseLead,
  rememberContact,
  loadConversation,
  saveTurn,
  syncCompany,
  type Channel,
} from "./db";

/**
 * The single entry point for every channel.
 *
 * The web widget, Telegram and email all call this with
 * the same three arguments. Nothing below here knows which door a message
 * came through, which is why adding a channel is a small job.
 */

export type InboundInput = {
  channel: Channel;
  /** Identifies the thread within its channel: a session id, Telegram chat id, email thread. */
  threadId: string;
  text: string;
  companySlug?: string;
  /**
   * Details the transport already knows, which the agent must therefore never
   * ask for. Email carries the sender's address and usually their name; asking
   * an emailer for their email address is absurd and reads as broken.
   *
   * Merged first-write-wins, so anything the customer states themselves later
   * is never overwritten by transport metadata.
   */
  known?: Collected;
  /**
   * How to run the follow-up work: writing the routine and sending two emails.
   *
   * Injected because the correct answer differs per runtime, and getting it
   * wrong loses leads silently. On a serverless platform the function can be
   * frozen the instant the response closes, so plain fire-and-forget work
   * started after streaming a reply may simply never run - which is exactly
   * what happened to a real lead: notified_at was stamped by the claim, the
   * mail was never sent, and the admin panel reported it as delivered.
   *
   * Route handlers pass Next's `after`, which keeps the function alive.
   * A long-lived worker can await it. The default matches neither, so callers
   * that care must say so.
   */
  schedule?: (work: () => Promise<void>) => void;
};

export type InboundResult = {
  reply: string;
  /** True when this turn matched a customer we had seen before. */
  recognised: boolean;
  /** True when a limit was hit and the reply is a holding message. */
  limited: boolean;
  /** True when a person has taken over and the agent deliberately stayed quiet. */
  handedToHuman: boolean;
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

  // Fold in whatever the transport handed us before the agent decides what to
  // ask for, so it never requests something it already has.
  if (input.known) {
    conversation.state = {
      ...conversation.state,
      collected: merge(conversation.state.collected, input.known),
    };
  }

  /**
   * Checked here rather than in each route, so every channel is covered by
   * construction — a new channel cannot forget to rate limit itself.
   *
   * The customer's message is still saved. They said it, we should have it,
   * and it appears in the admin inbox so a person can pick it up.
   */
  const verdict = await checkLimits(conversation.id);
  if (!verdict.allowed) {
    await db().from("messages").insert([
      { conversation_id: conversation.id, role: "customer", body: input.text },
      { conversation_id: conversation.id, role: "agent", body: verdict.message },
    ]);
    console.warn(`[limit] ${verdict.reason} ceiling hit on ${input.channel}`);

    return {
      reply: verdict.message,
      recognised: false,
      limited: true,
      handedToHuman: false,
      greeting: null,
      complete: isLeadComplete(conversation.state.collected),
      mode: "limited",
      collected: conversation.state.collected,
    };
  }

  // A person has taken this thread over. Save what the customer said so it
  // appears in the admin inbox, but do not reply — two answers in two voices
  // is worse than one slightly slower answer from a person.
  if (conversation.humanHandled) {
    await db()
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        role: "customer",
        body: input.text,
      });

    return {
      reply: "",
      recognised: false,
      limited: false,
      handedToHuman: true,
      greeting: null,
      complete: isLeadComplete(conversation.state.collected),
      mode: "human",
      collected: conversation.state.collected,
    };
  }

  const result = await respond(
    {
      brain,
      company,
      history: conversation.history,
      state: conversation.state,
      customerMessage: input.text,
      /**
       * Recognises someone by an address seen on any channel. Passed in as a
       * function so respond() never touches the database and stays testable.
       */
      recogniseBy: async (email) => {
        const contact = await recogniseByEmail(companyId, email);
        if (contact) {
          console.log(
            `[identity] ${email} matched an existing contact ` +
              `(${contact.priorConversations} prior conversation${contact.priorConversations === 1 ? "" : "s"})`
          );
        }
        return contact?.known ?? null;
      },
    },
    onToken
  );

  await saveTurn(conversation.id, input.text, result.reply, result.state);

  /**
   * Record the person, not just the conversation.
   *
   * This is what makes the same customer across four channels one row rather
   * than four, and it is why the next conversation can recognise them. It runs
   * after the reply so a failure here never costs the customer their answer.
   */
  try {
    await rememberContact(companyId, conversation.id, result.state.collected);
  } catch (error) {
    console.error(`[identity] ${(error as Error).message}`);
  }

  // The customer already has their reply; making them wait on a routine being
  // written and two SMTP round-trips would add seconds for no benefit. But it
  // has to actually run - see `schedule` on InboundInput.
  if (isLeadComplete(result.state.collected)) {
    const run = () =>
      deliverLead({
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
        // Never let delivery failure surface to the customer — the claim is
        // released on failure, so `npm run recover` can pick it up.
        console.error(`[lead delivery] ${(error as Error).message}`);
      });

    if (input.schedule) input.schedule(run);
    else void run();
  }

  return {
    reply: result.reply,
    recognised: result.recognised,
    limited: false,
    handedToHuman: false,
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

  /**
   * Claim it before doing anything, not after.
   *
   * Reading "has this been sent?" and then sending leaves a gap, and delivery
   * is fire-and-forget so several turns can be inside that gap at once. One
   * customer got the same routine twice, 86 seconds apart, because neither
   * call had stamped notified_at yet.
   */
  if (!(await claimLeadForSending(lead.id))) return;

  /**
   * A reserved test domain means this is a test, so nothing is sent - not the
   * routine, and not the owner alert either. Skipping only the routine would
   * still have put a "New lead" email on the owner's phone, which is exactly
   * what happened while testing the recognition fix.
   *
   * The claim is released so the lead is not left looking delivered.
   */
  if (isUndeliverable(args.collected.email)) {
    console.log(
      `[lead] ${args.collected.email} is a reserved test address — sending nothing`
    );
    await releaseLead(lead.id);
    return;
  }

  // Only generated when there is something to base it on - otherwise this is
  // a model call, and a token spend, for text nobody will ever receive.
  const routine = canWriteRoutine(args.collected)
    ? await generateRoutine(
        await getBrain(),
        args.company,
        args.collected,
        args.history
      )
    : "";

  const summary = summariseForOwner(args.company, args.history);

  /**
   * Wrapped so a failed send hands the claim back. Without this a transient
   * SMTP error would leave the lead stamped as sent forever, and `npm run
   * recover` - which exists precisely to catch that - would skip it.
   */
  try {
    // The owner always hears about it; the customer only gets a routine we can
    // actually write. Both were once gated on the same check, so someone who
    // gave a name and an address but never described their skin produced
    // neither - no routine, and no word to the owner that she had been in touch.
    if (canWriteRoutine(args.collected)) {
      await sendRoutineToCustomer(args.company, args.collected, routine);
    } else {
      console.log(
        `[lead] ${args.collected.email}: no concern on file, so no routine — ` +
          "alerting the owner only"
      );
    }

    await sendLeadAlert(args.company, args.collected, summary, args.channel);
  } catch (error) {
    await releaseLead(lead.id);
    throw error;
  }

  // notified_at was stamped by the claim above. A dry run has to undo it, or
  // a test would permanently block real delivery for that conversation.
  if (process.env.EMAIL_DRY_RUN === "1") {
    await releaseLead(lead.id);
  }
}
