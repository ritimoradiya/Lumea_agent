"use client";

import { useEffect, useRef, useState } from "react";

type Bubble = { from: "them" | "me"; text: string };

/**
 * A fake iPhone Messages screen.
 *
 * Runs through the identical handleInbound() call a real SMS would, stored
 * under the `simulator` channel — nothing is special-cased. It exists so the
 * texting experience can be demonstrated without a paid phone number and
 * without asking anyone to install an app.
 *
 * Labelled a simulator in the UI on purpose. Presenting it as live SMS would
 * be dishonest, and one question from a technical interviewer would expose it.
 */
export default function Simulator() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [threadId, setThreadId] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThreadId(`sim-${crypto.randomUUID()}`);
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setBubbles([{ from: "them", text: d.greeting }]))
      .catch(() => setBubbles([{ from: "them", text: "Hi — how can I help?" }]));
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [bubbles]);

  function reset() {
    setThreadId(`sim-${crypto.randomUUID()}`);
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setBubbles([{ from: "them", text: d.greeting }]));
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy || !threadId) return;
    setDraft("");
    setBusy(true);
    setBubbles((b) => [...b, { from: "me", text }, { from: "them", text: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, text, channel: "simulator" }),
      });
      if (!res.body) throw new Error("no stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.replace(/^data: /, "").trim();
          if (!line) continue;
          const p = JSON.parse(line);
          const piece = p.token ?? p.error;
          if (!piece) continue;
          setBubbles((b) => {
            const next = [...b];
            next[next.length - 1] = {
              from: "them",
              text: p.error ? p.error : next[next.length - 1].text + p.token,
            };
            return next;
          });
        }
      }
    } catch {
      setBubbles((b) => {
        const next = [...b];
        next[next.length - 1] = { from: "them", text: "Message failed to send." };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-10">
      {/* iPhone */}
      <div className="w-[300px] flex-none rounded-[42px] bg-black p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="flex h-[560px] flex-col overflow-hidden rounded-[33px] bg-white">
          <div className="flex justify-between px-6 pt-3.5 pb-1 text-[11px] font-semibold text-black">
            <span>9:41</span>
            <span>▮▮▮ ⌁</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-b border-[#e5e5ea] px-4 pt-2 pb-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper">
              L
            </div>
            <span className="text-[11px] text-black">Lumea</span>
          </div>
          <div ref={bodyRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto bg-white px-3 py-3">
            {bubbles.map((b, i) => (
              <div
                key={i}
                className={`max-w-[76%] rounded-[17px] px-3 py-2 text-[12.5px] leading-[1.36] ${
                  b.from === "me"
                    ? "self-end bg-[#34c759] text-white"
                    : "self-start bg-[#e9e9eb] text-black"
                }`}
              >
                {b.text || (
                  <span className="inline-flex gap-1 py-0.5">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/35"
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
            className="flex items-center gap-2 border-t border-[#e5e5ea] px-3 py-2.5"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Text Message"
              className="flex-1 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-[12px]
                         text-black placeholder:text-[#aeaeb2] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="text-[17px] text-[#34c759] disabled:opacity-30"
            >
              ↑
            </button>
          </form>
        </div>
      </div>

      {/* Explanation */}
      <div className="max-w-[430px] flex-1">
        <h2 className="font-serif text-[24px] tracking-[-0.02em]">
          Why a simulator
        </h2>
        <p className="mt-3 text-[14px] leading-[1.65] text-muted">
          This runs through the same <code className="text-[13px]">handleInbound()</code>{" "}
          call a real text message would, saved under the{" "}
          <code className="text-[13px]">simulator</code> channel. Nothing is
          special-cased — conversations appear in the inbox and leads are
          recorded exactly as they would from any other door.
        </p>
        <p className="mt-3 text-[14px] leading-[1.65] text-muted">
          It exists because real SMS needs a paid programmable number, and
          because a recruiter should be able to try the texting experience in
          one click rather than installing something.
        </p>
        <div className="mt-5 rounded-[10px] border border-[#c9a961]/40 bg-[#c9a961]/[0.09] p-4">
          <p className="text-[12.5px] leading-[1.6] text-[#8a6d3b]">
            <strong>This is a simulator, not live SMS.</strong> It demonstrates
            the flow. Presenting it as real texting would be dishonest, and a
            technical interviewer would catch it in one question.
          </p>
        </div>
        <button
          onClick={reset}
          className="mt-5 rounded-full border hairline px-4 py-2 text-[12.5px] text-muted"
        >
          Start a fresh conversation
        </button>
      </div>
    </div>
  );
}
