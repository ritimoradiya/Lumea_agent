import { signIn } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <form
        action={signIn}
        className="w-full max-w-[360px] rounded-[16px] border hairline bg-white/60 p-8 backdrop-blur-sm"
      >
        <h1 className="font-serif text-[26px] tracking-[-0.02em]">Lumea</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Sign in to see conversations and leads.
        </p>

        <input
          type="password"
          name="password"
          required
          autoFocus
          placeholder="Password"
          className="mt-7 w-full rounded-[10px] border hairline bg-paper px-4 py-3
                     text-[14px] placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-sage/40"
        />

        {error && (
          <p className="mt-3 text-[12.5px] text-[#b4442f]">
            That password is not right.
          </p>
        )}

        <button className="mt-5 w-full rounded-full bg-ink py-3 text-[13.5px] font-medium text-paper">
          Sign in
        </button>

        <p className="mt-6 text-[11.5px] leading-relaxed text-faint">
          A single shared password, set in <code>.env.local</code>. This is a
          demonstration gate, not real authentication — there are no accounts
          and no rate limiting.
        </p>
      </form>
    </main>
  );
}
