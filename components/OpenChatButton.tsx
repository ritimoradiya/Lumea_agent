"use client";

import { ASK_EVENT } from "./AskAboutButton";

/** Opens the widget from anywhere on the page, with nothing pre-drafted. */
export default function OpenChatButton() {
  return (
    <button
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(ASK_EVENT, { detail: { text: "" } })
        )
      }
      className="mt-5 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-paper
                 transition-transform duration-500 hover:-translate-y-0.5"
      style={{ transitionTimingFunction: "var(--ease-spring)" }}
    >
      Start a chat
    </button>
  );
}
