import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "./company";
import type { Collected, ConversationState } from "./agent/checklist";
import { emptyState } from "./agent/checklist";

/**
 * Database access, always server-side.
 *
 * Every table has row level security enabled with no policies, so the
 * public key can read nothing at all. We connect with the service_role
 * key, which bypasses RLS by design — which is exactly why this module
 * must never be imported into anything that ships to a browser.
 */

export type Channel = "web" | "telegram" | "email" | "simulator";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local"
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Upsert a company profile and its catalogue. Idempotent. */
export async function syncCompany(company: Company): Promise<string> {
  const supabase = db();

  const { data: row, error } = await supabase
    .from("companies")
    .upsert(
      {
        slug: company.slug,
        name: company.name,
        industry: company.industry,
        tagline: company.tagline,
        about: company.about,
        support_hours: company.supportHours,
        extra_rules: company.extraRules,
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`syncCompany: ${error.message}`);
  const companyId = row.id as string;

  // Replace the catalogue wholesale — simpler than diffing, and these
  // tables are small enough that it costs nothing.
  await supabase.from("company_products").delete().eq("company_id", companyId);
  await supabase.from("company_faqs").delete().eq("company_id", companyId);

  if (company.products.length) {
    const { error: pErr } = await supabase.from("company_products").insert(
      company.products.map((p, i) => ({
        company_id: companyId,
        ref: p.id,
        name: p.name,
        price: p.price ?? null,
        summary: p.summary,
        details: p.details ?? {},
        notes: p.notes ?? null,
        sort_order: i,
      }))
    );
    if (pErr) throw new Error(`syncCompany products: ${pErr.message}`);
  }

  if (company.faqs.length) {
    const { error: fErr } = await supabase.from("company_faqs").insert(
      company.faqs.map((f, i) => ({
        company_id: companyId,
        question: f.q,
        answer: f.a,
        sort_order: i,
      }))
    );
    if (fErr) throw new Error(`syncCompany faqs: ${fErr.message}`);
  }

  return companyId;
}

export type LoadedConversation = {
  id: string;
  /** True when a person has taken over; the agent must not reply. */
  humanHandled: boolean;
  state: ConversationState;
  /** Prior turns, oldest first, for the model's context window. */
  history: { role: "user" | "assistant"; content: string }[];
  isNew: boolean;
};

/**
 * Find the conversation for this thread, or start one.
 *
 * The unique index on (company_id, channel, channel_thread_id) is what
 * makes this safe under concurrent messages from the same person.
 */
export async function loadConversation(
  companyId: string,
  channel: Channel,
  threadId: string
): Promise<LoadedConversation> {
  const supabase = db();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id, collected, attempts, last_ask_id, status")
    .eq("company_id", companyId)
    .eq("channel", channel)
    .eq("channel_thread_id", threadId)
    .maybeSingle();

  if (existing) {
    const { data: rows } = await supabase
      .from("messages")
      .select("role, body")
      .eq("conversation_id", existing.id)
      .order("created_at", { ascending: true })
      .limit(40);

    return {
      id: existing.id as string,
      humanHandled: existing.status === "human",
      state: {
        collected: existing.collected ?? {},
        attempts: existing.attempts ?? {},
        lastAskId: existing.last_ask_id ?? null,
      },
      history: (rows ?? []).map((m) => ({
        role: m.role === "customer" ? ("user" as const) : ("assistant" as const),
        content: m.body as string,
      })),
      isNew: false,
    };
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      company_id: companyId,
      channel,
      channel_thread_id: threadId,
      collected: {},
      attempts: {},
    })
    .select("id")
    .single();

  if (error) throw new Error(`loadConversation: ${error.message}`);

  return {
    id: created.id as string,
    humanHandled: false,
    state: emptyState(),
    history: [],
    isNew: true,
  };
}

/** Write both sides of a turn plus the updated checklist state. */
export async function saveTurn(
  conversationId: string,
  customerMessage: string,
  agentReply: string,
  state: ConversationState
): Promise<void> {
  const supabase = db();

  const { error: mErr } = await supabase.from("messages").insert([
    { conversation_id: conversationId, role: "customer", body: customerMessage },
    { conversation_id: conversationId, role: "agent", body: agentReply },
  ]);
  if (mErr) throw new Error(`saveTurn messages: ${mErr.message}`);

  const { error: cErr } = await supabase
    .from("conversations")
    .update({
      collected: state.collected,
      attempts: state.attempts,
      last_ask_id: state.lastAskId,
    })
    .eq("id", conversationId);
  if (cErr) throw new Error(`saveTurn conversation: ${cErr.message}`);
}

export type LeadRecord = { id: string; isNew: boolean };

/**
 * Record a lead, exactly once per conversation.
 *
 * The unique index on leads.conversation_id is what makes this safe: if
 * two messages race, or the process restarts mid-send, the second insert
 * is skipped and `isNew` comes back false — which is how the customer is
 * guaranteed never to receive the same routine twice.
 */
export async function createLeadIfNew(
  companyId: string,
  conversationId: string,
  collected: Record<string, string | undefined>
): Promise<LeadRecord> {
  const supabase = db();

  const { data, error } = await supabase
    .from("leads")
    .upsert(
      {
        company_id: companyId,
        conversation_id: conversationId,
        first_name: collected.firstName,
        last_name: collected.lastName ?? null,
        email: collected.email,
        phone: collected.phone ?? null,
        description: collected.description,
        experience: collected.experience ?? null,
      },
      { onConflict: "conversation_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) throw new Error(`createLeadIfNew: ${error.message}`);

  // ignoreDuplicates returns nothing when the row already existed.
  if (data && data.length > 0) {
    await supabase
      .from("conversations")
      .update({ status: "complete" })
      .eq("id", conversationId);
    return { id: data[0].id as string, isNew: true };
  }

  const { data: existing } = await supabase
    .from("leads")
    .select("id, notified_at")
    .eq("conversation_id", conversationId)
    .single();

  return { id: existing?.id as string, isNew: false };
}

/** Stamped only after both emails have actually gone out. */
export async function markLeadNotified(leadId: string): Promise<void> {
  const { error } = await db()
    .from("leads")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) throw new Error(`markLeadNotified: ${error.message}`);
}

export async function isLeadNotified(leadId: string): Promise<boolean> {
  const { data } = await db()
    .from("leads")
    .select("notified_at")
    .eq("id", leadId)
    .single();
  return Boolean(data?.notified_at);
}

export type ContactRecord = {
  id: string;
  /** What we already knew about this person from earlier conversations. */
  known: Collected;
  /** Conversations they have had before this one, on any channel. */
  priorConversations: number;
};

/**
 * Recognise someone by their email address, across every channel.
 *
 * This is what makes a customer who chatted on the website and emailed a week
 * later the same person rather than two strangers. Email is the key because it
 * is the only identifier that travels: a Telegram chat id and a browser
 * session id are meaningless outside their own channel.
 *
 * Returns null for an address never seen before, which the caller treats as a
 * new contact rather than an error.
 */
export async function recogniseByEmail(
  companyId: string,
  email: string
): Promise<ContactRecord | null> {
  const supabase = db();
  const address = email.trim().toLowerCase();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, phone")
    .eq("company_id", companyId)
    .ilike("email", address)
    .maybeSingle();

  if (!contact) return null;

  const { count } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("contact_id", contact.id);

  const known: Collected = {};
  if (contact.first_name) known.firstName = contact.first_name as string;
  if (contact.last_name) known.lastName = contact.last_name as string;
  if (contact.phone) known.phone = contact.phone as string;

  return {
    id: contact.id as string,
    known,
    priorConversations: count ?? 0,
  };
}

/**
 * Record what we now know about this person, and attach the conversation.
 *
 * Upserted on (company_id, email) so the same customer across four channels is
 * one row rather than four. Only fills blanks — a detail already on file is
 * never overwritten by a later guess, for the same reason the checklist is
 * first-write-wins.
 */
export async function rememberContact(
  companyId: string,
  conversationId: string,
  collected: Collected
): Promise<string | null> {
  if (!collected.email?.trim()) return null;

  const supabase = db();
  const address = collected.email.trim().toLowerCase();

  const existing = await recogniseByEmail(companyId, address);

  const fields = {
    first_name: collected.firstName ?? existing?.known.firstName ?? null,
    last_name: collected.lastName ?? existing?.known.lastName ?? null,
    phone: collected.phone ?? existing?.known.phone ?? null,
  };

  let contactId = existing?.id;

  if (contactId) {
    await supabase.from("contacts").update(fields).eq("id", contactId);
  } else {
    /**
     * Insert rather than upsert. The uniqueness index is on lower(email),
     * which is a functional index and cannot satisfy ON CONFLICT (company_id,
     * email) — Postgres needs a constraint on those exact columns for that.
     *
     * We have just looked the address up, so a collision here means two
     * messages from the same new customer arrived at once. Re-reading resolves
     * it, which is cheaper and clearer than reshaping the schema.
     */
    const { data, error } = await supabase
      .from("contacts")
      .insert({ company_id: companyId, email: address, ...fields })
      .select("id")
      .single();

    if (error) {
      const raced = await recogniseByEmail(companyId, address);
      if (!raced) throw new Error(`rememberContact: ${error.message}`);
      contactId = raced.id;
    } else {
      contactId = data.id as string;
    }
  }

  await supabase
    .from("conversations")
    .update({ contact_id: contactId })
    .eq("id", conversationId);

  return contactId;
}
