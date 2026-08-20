import Link from "next/link";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/auth";
import { signOut } from "../actions";

/**
 * Everything in this route group requires a session.
 *
 * The login page deliberately lives outside the group — gating it too would
 * redirect to itself forever. A route group gives that separation without
 * changing any URL.
 */
export default async function DashLayout({
  children,
}: { children: React.ReactNode }) {
  if (!(await isSignedIn())) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center gap-6 border-b hairline px-6 py-4">
        <Link href="/" className="text-[14px] font-medium tracking-[0.13em]">
          LUMEA
        </Link>
        <nav className="flex gap-1.5">
          {[
            ["/admin", "Inbox"],
            ["/admin/leads", "Leads"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3.5 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-paper-2"
            >
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="ml-auto">
          <button className="text-[12px] text-faint hover:text-muted">
            Sign out
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
