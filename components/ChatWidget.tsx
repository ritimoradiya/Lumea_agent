"use client";

import { useEffect, useRef, useState } from "react";
import { ASK_EVENT } from "./AskAboutButton";

type Message = { role: "bot" | "me"; text: string };

/**
 * The website chat widget.
 *
 * The thread id lives in localStorage, so a customer can close the tab and
 * come back to the same conversation — the agent still knows who they are
 * and what it has already asked for.
 */
const THREAD_KEY = "lumea.threadId";

function getThreadId(): string {
  const existing = localStorage.getItem(THREAD_KEY);
  if (existing) return existing;
  const fresh = `web-${crypto.randomUUID()}`;
  localStorage.setItem(THREAD_KEY, fresh);
  return fresh;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch the greeting once, the first time it is opened.
  useEffect(() => {
    if (!open || messages.length) return;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setMessages([{ role: "bot", text: d.greeting }]))
      .catch(() =>
        setMessages([{ role: "bot", text: "Hi — how can I help?" }])
      );
  }, [open, messages.length]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // "Ask about this" on a product page opens the widget with a draft ready,
  // so the customer only has to press send.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      setOpen(true);
      setDraft(detail.text);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;

    setDraft("");
    setBusy(true);
    setMessages((m) => [...m, { role: "me", text }, { role: "bot", text: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: getThreadId(), text }),
      });
      if (!res.body) throw new Error("no stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Server-sent events arrive as `data: {...}\n\n` frames, which can be
      // split across reads — so buffer until a frame boundary.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.replace(/^data: /, "").trim();
          if (!line) continue;
          const payload = JSON.parse(line);

          if (payload.token) {
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = {
                role: "bot",
                text: next[next.length - 1].text + payload.token,
              };
              return next;
            });
          }
          if (payload.error) {
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = { role: "bot", text: payload.error };
              return next;
            });
          }
        }
      }
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: "bot",
          text: "Sorry — something went wrong. Please try again.",
        };
        return next;
      });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Chat with the Lumea assistant"}
        className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center
                   rounded-full bg-ink text-paper shadow-[0_10px_30px_rgba(38,36,31,0.28)]
                   transition-transform duration-500 hover:-translate-y-0.5 active:scale-95"
        style={{ transitionTimingFunction: "var(--ease-spring)" }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 8.5C3 5.46 5.9 3 9.9 3s6.9 2.46 6.9 5.5S13.9 14 9.9 14c-.75 0-1.47-.09-2.14-.25L4.2 15.4l.7-2.62A5.4 5.4 0 0 1 3 8.5Z" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed right-6 bottom-24 z-50 flex w-[calc(100vw-3rem)] max-w-[376px]
                    flex-col overflow-hidden rounded-[20px] border hairline
                    bg-[rgba(255,255,255,0.82)] shadow-[0_16px_48px_rgba(60,50,35,0.18)]
                    backdrop-blur-2xl backdrop-saturate-150 transition-all duration-500
                    ${open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
        style={{ transitionTimingFunction: "var(--ease-spring)" }}
        role="dialog"
        aria-label="Lumea assistant"
      >
        <header className="flex items-center gap-3 border-b hairline px-[18px] py-4">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink text-[12px] font-semibold tracking-wide text-paper">
            L
          </div>
          <div>
            <div className="text-[13.5px] font-semibold tracking-tight">
              Lumea assistant
            </div>
            <div className="mt-px flex items-center gap-1.5 text-[11.5px] text-faint">
              <span className="h-[5px] w-[5px] rounded-full bg-[#30d158]" />
              Automated · a colleague reviews every reply
            </div>
          </div>
        </header>

        <div
          ref={bodyRef}
          className="flex max-h-[380px] min-h-[180px] flex-col gap-2.5 overflow-y-auto px-[18px] pt-3 pb-3.5"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[87%] rounded-[16px] px-3.5 py-2.5 text-[13.5px] leading-[1.47] ${
                m.role === "me"
                  ? "self-end rounded-br-[5px] bg-ink text-paper"
                  : "self-start rounded-bl-[5px] bg-paper-2 text-ink"
              }`}
            >
              {m.text || (
                <span className="inline-flex gap-1 py-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40"
                      style={{ animationDelay: `${d * 0.14}s` }}
                    />
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2.5 border-t hairline px-3.5 py-3"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message…"
            className="flex-1 rounded-full bg-paper-2 px-3.5 py-2.5 text-[13.5px]
                       placeholder:text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="flex h-[31px] w-[31px] flex-none items-center justify-center rounded-full
                       bg-ink text-paper transition-opacity disabled:opacity-30"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M6.5 11V2M6.5 2 2.6 5.9M6.5 2l3.9 3.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
