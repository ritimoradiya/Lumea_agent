"use client";

/**
 * Opens the chat widget with a question about this product already drafted.
 *
 * Communicates by CustomEvent rather than shared state: the widget can sit
 * anywhere in the tree, on any page, and neither component needs to know the
 * other exists.
 */
export const ASK_EVENT = "lumea:ask";

export default function AskAboutButton({
  productName,
}: {
  productName: string;
}) {
  return (
    <button
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(ASK_EVENT, {
            detail: { text: `Is ${productName} right for my skin?` },
          })
        )
      }
      className="rounded-full border hairline bg-white/60 px-7 py-3.5 text-[13.5px] text-ink
                 transition-transform duration-500 hover:-translate-y-0.5"
      style={{ transitionTimingFunction: "var(--ease-spring)" }}
    >
      Ask about this
    </button>
  );
}
