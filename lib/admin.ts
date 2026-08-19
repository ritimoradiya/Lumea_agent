import { db } from "./db";
import { REQUIRED_FIELDS, type Collected } from "./agent/checklist";

/** Read and write helpers for the admin area. Server-only. */

export type ThreadSummary = {
  id: string;
  channel: string;
  threadId: string;
  status: "active" | "complete" | "human";
  collected: Collected;
  filled: number;
  required: number;
  preview: string;
  updatedAt: string;
};

export type ThreadFilter = {
  /**
   * Simulator threads are demonstrations, not customers. After a few demos
   * they outnumber the real conversations and bury genuine leads, so they are
   * hidden unless asked for.
   */
  includeSimulator?: boolean;
  limit?: number;
};

export async function listThreads(
  filter: ThreadFilter = {}
): Promise<ThreadSummary[]> {
  const { includeSimulator = false, limit = 40 } = filter;

  let query = db()
    .from("conversations")
    .select("id, channel, channel_thread_id, status, collected, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!includeSimulator) query = query.neq("channel", "simulator");

  const { data, error } = await query;

  if (error) throw new Error(`listThreads: ${error.message}`);
  if (!data?.length) return [];

  // One query for the newest message of every thread on the page, rather
  // than one query per thread.
  const { data: recent } = await db()
    .from("messages")
    .select("conversation_id, body, created_at")
    .in(
      "conversation_id",
      data.map((c) => c.id)
    )
    .order("created_at", { ascending: false });

  const previews = new Map<string, string>();
  for (const m of recent ?? []) {
    if (!previews.has(m.conversation_id)) {
      previews.set(m.conversation_id, m.body as string);
    }
  }

  return data.map((c) => {
    const collected = (c.collected ?? {}) as Collected;
    return {
      id: c.id as string,
      channel: c.channel as string,
      threadId: c.channel_thread_id as string,
      status: c.status as ThreadSummary["status"],
      collected,
      filled: REQUIRED_FIELDS.filter((f) => collected[f]?.trim()).length,
      required: REQUIRED_FIELDS.length,
      preview: previews.get(c.id as string) ?? "",
      updatedAt: c.updated_at as string,
    };
  });
}

export type ThreadDetail = ThreadSummary & {
  messages: { id: string; role: string; body: string; createdAt: string }[];
  notifiedAt: string | null;
};

/** How many demo threads are hidden, so the toggle can say. */
export async function countSimulatorThreads(): Promise<number> {
  const { count } = await db()
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("channel", "simulator");
  return count ?? 0;
}

export async function getThread(id: string): Promise<ThreadDetail | null> {
  const { data: c } = await db()
    .from("conversations")
    .select("id, channel, channel_thread_id, status, collected, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;

  const { data: messages } = await db()
    .from("messages")
    .select("id, role, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const { data: lead } = await db()
    .from("leads")
    .select("notified_at")
    .eq("conversation_id", id)
    .maybeSingle();

  const collected = (c.collected ?? {}) as Collected;

  return {
    id: c.id as string,
    channel: c.channel as string,
    threadId: c.channel_thread_id as string,
    status: c.status as ThreadSummary["status"],
    collected,
    filled: REQUIRED_FIELDS.filter((f) => collected[f]?.trim()).length,
    required: REQUIRED_FIELDS.length,
    preview: "",
    updatedAt: c.updated_at as string,
    notifiedAt: (lead?.notified_at as string | null) ?? null,
    messages: (messages ?? []).map((m) => ({
      id: m.id as string,
      role: m.role as string,
      body: m.body as string,
      createdAt: m.created_at as string,
    })),
  };
}

/**
 * Hand a conversation to a person, or give it back to the agent.
 *
 * While status is 'human' the agent must not reply — otherwise a customer
 * gets two answers to the same question from two different voices.
 */
export async function setThreadStatus(
  id: string,
  status: "active" | "human"
): Promise<void> {
  const { error } = await db()
    .from("conversations")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`setThreadStatus: ${error.message}`);
}

export async function postHumanMessage(
  conversationId: string,
  body: string
): Promise<void> {
  const { error } = await db()
    .from("messages")
    .insert({ conversation_id: conversationId, role: "human", body });
  if (error) throw new Error(`postHumanMessage: ${error.message}`);
}

export type LeadRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  description: string;
  experience: string | null;
  notifiedAt: string | null;
  createdAt: string;
  channel: string;
};

export async function listLeads(limit = 100): Promise<LeadRow[]> {
  const { data, error } = await db()
    .from("leads")
    .select(
      "id, first_name, last_name, email, phone, description, experience, notified_at, created_at, conversations(channel)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listLeads: ${error.message}`);

  return (data ?? []).map((l) => ({
    id: l.id as string,
    firstName: l.first_name as string,
    lastName: l.last_name as string | null,
    email: l.email as string,
    phone: l.phone as string | null,
    description: l.description as string,
    experience: l.experience as string | null,
    notifiedAt: l.notified_at as string | null,
    createdAt: l.created_at as string,
    channel:
      (l.conversations as { channel?: string } | null)?.channel ?? "unknown",
  }));
}
