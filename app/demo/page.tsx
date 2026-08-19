import Link from "next/link";
import type { Metadata } from "next";
import Simulator from "@/components/Simulator";

export const metadata: Metadata = {
  title: "Try the Lumea assistant by text",
  description:
    "A simulated messaging thread with the Lumea reception agent. No phone number needed.",
};

/**
 * Deliberately public.
 *
 * The point of the simulator is that someone can try the texting experience
 * in one click. Behind a password it could not do that — it lived in the
 * admin area at first, which meant only the owner could ever open it.
 */
export default function DemoPage() {
  return (
    <main className="min-h-screen bg-paper">
      <nav className="flex items-center justify-between border-b hairline px-6 py-6 sm:px-12">
        <Link href="/" className="text-[19px] font-medium tracking-[0.16em]">
          LUMEA
        </Link>
        <Link href="/" className="text-[13px] text-muted">
          Back to the site
        </Link>
      </nav>

      <div className="mx-auto max-w-[1000px] px-6 py-14 sm:px-12">
        <h1 className="font-serif text-[clamp(30px,4.4vw,44px)] leading-[1.05] tracking-[-0.025em]">
          Try it by text
        </h1>
        <p className="mt-4 max-w-[520px] text-[16px] leading-[1.62] text-muted">
          Type into the phone. You are talking to the same agent that answers on
          the website — same knowledge, same guardrails, same lead handling.
        </p>
        <div className="mt-12">
          <Simulator />
        </div>
      </div>
    </main>
  );
}
