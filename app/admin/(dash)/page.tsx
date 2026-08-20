import { listThreads, getThread, countSimulatorThreads } from "@/lib/admin";
import { handBack, replyAsHuman, takeOver } from "../actions";
import { FIELDS } from "@/lib/agent/checklist";

/** Live data — never cache the inbox. */
export const dynamic = "force-dynamic";

const CHANNEL_STYLE: Record<string, string> = {
  web: "bg-stone text-muted",
  telegram: "bg-[#dbe8f0] text-[#4a6b80]",
  email: "bg-[#e4e0ee] text-[#5f5680]",
  simulator: "bg-[#efe2d6] text-[#8a6a4a]",
};

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; demos?: string }>;
}) {
  const { thread: selectedId, demos } = await searchParams;
  const showDemos = demos === "1";

  const [threads, demoCount] = await Promise.all([
    listThreads({ includeSimulator: showDemos }),
    countSimulatorThreads(),
  ]);
  const selected = await getThread(selectedId ?? threads[0]?.id ?? "");

  return (
    <div className="grid h-[calc(100vh-57px)] grid-cols-1 lg:grid-cols-[280px_1fr_260px]">
      {/* ── thread list ────────────────────────────────────── */}
      <aside className="overflow-y-auto border-r hairline">
        {demoCount > 0 && (
          <a
            href={showDemos ? "/admin" : "/admin?demos=1"}
            className="flex items-center justify-between border-b hairline bg-paper-2/70 px-4 py-2.5
                       text-[11.5px] text-muted transition-colors hover:bg-paper-2"
          >
            <span>
              {showDemos
                ? "Showing demo threads"
                : `${demoCount} demo thread${demoCount === 1 ? "" : "s"} hidden`}
            </span>
            <span className="text-faint">{showDemos ? "hide" : "show"}</span>
          </a>
        )}
        {threads.length === 0 && (
          <p className="p-6 text-[13px] leading-relaxed text-faint">
            No conversations yet. Open the site and send the widget a message.
          </p>
        )}
        {threads.map((t) => (
          <a
            key={t.id}
            href={`/admin?thread=${t.id}`}
            className={`block border-b hairline px-4 py-3.5 transition-colors ${
              selected?.id === t.id ? "bg-paper-2" : "hover:bg-paper-2/60"
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold tracking-tight">
                {[t.collected.firstName, t.collected.lastName]
                  .filter(Boolean)
                  .join(" ") || "Anonymous"}
              </span>
              <span
                className={`flex-none rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider ${
                  CHANNEL_STYLE[t.channel] ?? "bg-stone text-muted"
                }`}
              >
                {t.channel}
              </span>
            </div>
            <p className="truncate text-[11.5px] leading-snug text-faint">
              {t.preview || "—"}
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-faint">
              {t.status === "human" ? (
                <span className="rounded-full bg-[#b4442f] px-2 py-0.5 text-white">
                  You
                </span>
              ) : t.filled === t.required ? (
                <span className="rounded-full bg-sage px-2 py-0.5 text-white">
                  Lead ready
                </span>
              ) : (
                <span className="rounded-full bg-[#c9a961] px-2 py-0.5 text-white">
                  {t.filled}/{t.required}
                </span>
              )}
              <span>{ago(t.updatedAt)}</span>
            </div>
          </a>
        ))}
      </aside>

      {/* ── transcript ─────────────────────────────────────── */}
      <section className="flex min-h-0 flex-col border-r hairline">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-faint">
            Select a conversation
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b hairline px-5 py-3.5">
              <span className="text-[13.5px] font-semibold">
                {[selected.collected.firstName, selected.collected.lastName]
                  .filter(Boolean)
                  .join(" ") || "Anonymous"}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider ${
                  CHANNEL_STYLE[selected.channel] ?? "bg-stone text-muted"
                }`}
              >
                {selected.channel}
              </span>
              {selected.status === "human" ? (
                <form action={handBack} className="ml-auto">
                  <input type="hidden" name="conversationId" value={selected.id} />
                  <button className="rounded-full border hairline px-3.5 py-1.5 text-[12px] text-muted">
                    Give back to the agent
                  </button>
                </form>
              ) : (
                <form action={takeOver} className="ml-auto">
                  <input type="hidden" name="conversationId" value={selected.id} />
                  <button className="rounded-full border hairline px-3.5 py-1.5 text-[12px] text-muted">
                    Take over
                  </button>
                </form>
              )}
            </header>

            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4">
              {selected.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[76%] rounded-[14px] px-3.5 py-2.5 text-[12.5px] leading-[1.5] ${
                    m.role === "customer"
                      ? "self-end rounded-br-[4px] bg-ink text-paper"
                      : m.role === "human"
                        ? "self-start rounded-bl-[4px] bg-[#b4442f] text-white"
                        : "self-start rounded-bl-[4px] bg-paper-2"
                  }`}
                >
                  {m.role !== "customer" && (
                    <span className="mb-1 block text-[9.5px] uppercase tracking-wider opacity-55">
                      {m.role === "human" ? "You" : "Agent"}
                    </span>
                  )}
                  {m.body}
                </div>
              ))}
            </div>

            <form
              action={replyAsHuman}
              className="flex items-center gap-2.5 border-t hairline px-4 py-3"
            >
              <input type="hidden" name="conversationId" value={selected.id} />
              <input
                name="body"
                placeholder="Reply as a human — this takes the thread over"
                className="flex-1 rounded-full bg-paper-2 px-3.5 py-2.5 text-[12.5px]
                           placeholder:text-faint focus:outline-none"
              />
              <button className="rounded-full bg-ink px-4 py-2.5 text-[12.5px] text-paper">
                Send
              </button>
            </form>
          </>
        )}
      </section>

      {/* ── collected panel ────────────────────────────────── */}
      <aside className="overflow-y-auto p-5">
        {selected && (
          <>
            <h2 className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-faint">
              Collected
            </h2>
            <div className="mb-5 h-1 overflow-hidden rounded bg-stone">
              <div
                className="h-full bg-sage transition-all"
                style={{
                  width: `${(selected.filled / selected.required) * 100}%`,
                }}
              />
            </div>
            {FIELDS.map((f) => (
              <div key={f} className="mb-3">
                <div className="text-[10.5px] uppercase tracking-wider text-faint">
                  {f.replace(/([A-Z])/g, " $1")}
                </div>
                <div
                  className={`mt-0.5 text-[13px] ${
                    selected.collected[f] ? "" : "italic text-faint/70"
                  }`}
                >
                  {selected.collected[f] ??
                    (f === "phone"
                      ? "never asked for"
                      : f === "lastName" || f === "experience"
                        ? "not given"
                        : "—")}
                </div>
              </div>
            ))}

            {/* Same person, met elsewhere. Only shown when true. */}
            {selected.alsoSeenOn.length > 0 && (
              <>
                <h2 className="mt-7 mb-3 text-[10.5px] uppercase tracking-[0.14em] text-faint">
                  Returning customer
                </h2>
                <p className="mb-2.5 text-[12.5px] leading-relaxed text-muted">
                  Matched by email to{" "}
                  {selected.alsoSeenOn.length === 1
                    ? "one earlier conversation"
                    : `${selected.alsoSeenOn.length} earlier conversations`}
                  .
                </p>
                <ul className="space-y-1.5">
                  {selected.alsoSeenOn.map((prior, i) => (
                    <li
                      key={`${prior.channel}-${i}`}
                      className="flex items-center gap-2 text-[12.5px]"
                    >
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10.5px] ${
                          CHANNEL_STYLE[prior.channel] ?? "bg-stone text-muted"
                        }`}
                      >
                        {prior.channel}
                      </span>
                      <span className="text-faint">{ago(prior.updatedAt)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h2 className="mt-7 mb-3 text-[10.5px] uppercase tracking-[0.14em] text-faint">
              Delivery
            </h2>
            <div className="text-[13px]">
              {selected.notifiedAt ? (
                <span className="text-sage-deep">
                  Routine and alert sent{" "}
                  {new Date(selected.notifiedAt).toLocaleTimeString()}
                </span>
              ) : (
                <span className="italic text-faint/70">Nothing sent yet</span>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
