import Link from "next/link";
import LiquidHero from "@/components/LiquidHero";
import ChatWidget from "@/components/ChatWidget";
import ProductImage from "@/components/ProductImage";
import { getCompany, type Product } from "@/lib/company";

const CATEGORY_ORDER = ["Cleanse", "Treat", "Hydrate", "Protect"];

const CLAIMS = [
  "Vegan",
  "Cruelty-free",
  "Fragrance-free",
  "Non-comedogenic",
  "Made in Copenhagen",
  "Recyclable glass",
];

function byCategory(products: Product[]) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: products.filter((p) => p.category === category),
  })).filter((group) => group.items.length > 0);
}

/** A sensible starter routine, referenced by product id so it survives renames. */
const ROUTINE = {
  Morning: ["clarity-cleanser", "quench-serum", "shield-cream", "daylight-spf"],
  Evening: ["dissolve-balm", "clarity-cleanser", "even-niacinamide", "shield-cream"],
};

export default async function Home() {
  const company = await getCompany();
  const groups = byCategory(company.products);
  const find = (id: string) => company.products.find((p) => p.id === id);

  return (
    <>
      <LiquidHero />
      <ChatWidget />

      <nav className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-12">
        <span className="text-[19px] font-medium tracking-[0.16em]">LUMEA</span>
        <div className="hidden gap-8 text-[13px] text-muted sm:flex">
          <a href="#shop">Shop</a>
          <a href="#routine">Routines</a>
          <a href="#claims">Ingredients</a>
          <a href="#faq">FAQ</a>
        </div>
      </nav>

      {/* ── hero ───────────────────────────────────────────────── */}
      <header className="relative z-10 flex min-h-[calc(100vh-5.5rem)] max-w-[1000px] flex-col justify-center px-6 sm:px-12">
        <p
          className="animate-rise mb-6 text-[11px] uppercase tracking-[0.18em] text-faint"
          style={{ animationDelay: "0.15s" }}
        >
          Fragrance-free · Dermatologist tested
        </p>
        <h1 className="font-serif text-[clamp(46px,7.4vw,96px)] leading-[0.99] tracking-[-0.03em]">
          {["Clinical", "care,", "quietly", "done."].map((word, i) => (
            <span
              key={word}
              className="animate-rise inline-block"
              style={{ animationDelay: `${0.3 + i * 0.1}s` }}
            >
              {word === "quietly" ? (
                <em className="text-sage italic">{word}</em>
              ) : (
                word
              )}
              {i < 3 ? " " : ""}
            </span>
          ))}
        </h1>
        <p
          className="animate-rise mt-7 max-w-[430px] text-[17px] leading-[1.62] text-muted"
          style={{ animationDelay: "0.78s" }}
        >
          {company.about}
        </p>
        <div
          className="animate-rise mt-9 flex flex-wrap gap-3"
          style={{ animationDelay: "0.92s" }}
        >
          <a
            href="#shop"
            className="rounded-full bg-ink px-7 py-3.5 text-[13.5px] font-medium text-paper
                       transition-transform duration-500 hover:-translate-y-0.5"
            style={{ transitionTimingFunction: "var(--ease-spring)" }}
          >
            Shop the twelve
          </a>
          <a
            href="#routine"
            className="rounded-full border hairline bg-white/50 px-7 py-3.5 text-[13.5px]
                       text-ink backdrop-blur-md transition-transform duration-500 hover:-translate-y-0.5"
            style={{ transitionTimingFunction: "var(--ease-spring)" }}
          >
            Build a routine
          </a>
        </div>
      </header>

      {/* ── products ───────────────────────────────────────────── */}
      <section
        id="shop"
        className="relative z-10 bg-paper px-6 py-24 sm:px-12"
      >
        <div className="mx-auto max-w-[1180px]">
          <h2 className="font-serif text-[38px] tracking-[-0.02em]">
            The twelve
          </h2>
          <p className="mt-3 max-w-[420px] text-[15px] leading-relaxed text-muted">
            Four steps, twelve products. Most people need three or four of them.
          </p>

          {groups.map(({ category, items }) => (
            <div key={category} className="mt-16">
              <h3 className="mb-6 text-[11px] uppercase tracking-[0.16em] text-faint">
                {category}
              </h3>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    className="group flex flex-col rounded-[14px] border hairline bg-white/45
                               p-5 backdrop-blur-sm transition-all duration-500
                               hover:-translate-y-1 hover:bg-white/70"
                    style={{ transitionTimingFunction: "var(--ease-spring)" }}
                  >
                    <ProductImage
                      category={p.category}
                      seed={p.id}
                      className="mb-5 h-[150px] w-full rounded-[10px]"
                    />
                    <span className="font-serif text-[18px] leading-tight tracking-[-0.01em]">
                      {p.name}
                    </span>
                    <span className="mt-2 flex-1 text-[13px] leading-[1.55] text-muted">
                      {p.summary}
                    </span>
                    <span className="mt-4 flex items-center justify-between text-[13px]">
                      <span className="text-ink">{p.price}</span>
                      <span className="text-faint">{p.details?.Size}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── routine ────────────────────────────────────────────── */}
      <section
        id="routine"
        className="relative z-10 border-y hairline bg-paper-2 px-6 py-24 sm:px-12"
      >
        <div className="mx-auto max-w-[1180px]">
          <h2 className="font-serif text-[38px] tracking-[-0.02em]">
            A routine, roughly
          </h2>
          <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-muted">
            Thinnest to thickest, sunscreen last. Ask the assistant and it will
            adjust this to your skin.
          </p>

          <div className="mt-14 grid gap-12 sm:grid-cols-2">
            {Object.entries(ROUTINE).map(([time, ids]) => (
              <div key={time}>
                <h3 className="mb-7 text-[11px] uppercase tracking-[0.16em] text-faint">
                  {time}
                </h3>
                <ol className="space-y-5">
                  {ids.map((id, i) => {
                    const p = find(id);
                    if (!p) return null;
                    return (
                      <li key={id} className="flex gap-4">
                        <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center
                                         rounded-full border hairline text-[11px] text-faint">
                          {i + 1}
                        </span>
                        <span>
                          <span className="font-serif text-[17px]">{p.name}</span>
                          <span className="mt-1 block text-[13px] leading-[1.55] text-muted">
                            {p.summary}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── claims ─────────────────────────────────────────────── */}
      <section id="claims" className="relative z-10 bg-paper px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="font-serif text-[26px] tracking-[-0.015em]">
            What isn&rsquo;t in it
          </h2>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {CLAIMS.map((c) => (
              <span
                key={c}
                className="rounded-full border hairline bg-white/50 px-4 py-2.5 text-[12.5px] text-muted"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── faq — same source the agent reads ──────────────────── */}
      <section
        id="faq"
        className="relative z-10 border-t hairline bg-paper px-6 py-24 sm:px-12"
      >
        <div className="mx-auto max-w-[760px]">
          <h2 className="font-serif text-[38px] tracking-[-0.02em]">
            Questions
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            These are the exact answers our assistant works from — one source,
            so the site and the chat can never contradict each other.
          </p>
          <dl className="mt-12 divide-y divide-black/[0.07]">
            {company.faqs.map((f) => (
              <div key={f.q} className="py-6">
                <dt className="font-serif text-[19px] leading-snug tracking-[-0.01em]">
                  {f.q}
                </dt>
                <dd className="mt-2.5 text-[14.5px] leading-[1.65] text-muted">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="relative z-10 border-t hairline bg-paper-2 px-6 py-14 sm:px-12">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-baseline justify-between gap-6">
          <span className="text-[17px] font-medium tracking-[0.16em]">LUMEA</span>
          <span className="text-[12.5px] text-faint">
            {company.supportHours} · {company.tagline}
          </span>
        </div>
        <p className="mx-auto mt-8 max-w-[1180px] text-[11.5px] leading-relaxed text-faint">
          Lumea is a fictional brand, built to demonstrate a multi-channel AI
          reception agent. Nothing here is for sale and nothing here is medical
          advice.
        </p>
      </footer>
    </>
  );
}
