import Link from "next/link";
import LiquidHero from "@/components/LiquidHero";
import ChatWidget from "@/components/ChatWidget";
import OpenChatButton from "@/components/OpenChatButton";
import ProductImage from "@/components/ProductImage";
import Reveal from "@/components/Reveal";
import FloatingProduct from "@/components/FloatingProduct";
import TextureSwatch from "@/components/TextureSwatch";
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
          <a href="#textures">Textures</a>
          <a href="#faq">FAQ</a>
          <a href="#contact">Contact</a>
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
            Shop the range
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
            The range
          </h2>
          <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-muted">
            Built on ingredients you can actually pronounce — ceramides,
            niacinamide, hyaluronic acid, encapsulated retinol, zinc oxide.
            Four steps, and most people need three or four products rather than
            the whole shelf.
          </p>

          {groups.map(({ category, items }) => (
            <div key={category} className="mt-16">
              <h3 className="mb-6 text-[11px] uppercase tracking-[0.16em] text-faint">
                {category}
              </h3>
              <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((p, i) => (
                  <Reveal key={p.id} delay={i * 70} className="h-full">
                  <Link
                    href={`/products/${p.id}`}
                    /* A fixed height, not h-full: each category is its own grid, so
                       row-based equalising cannot make all twelve match. */
                    className="group flex h-[352px] flex-col rounded-[14px] border hairline
                               bg-white/45 p-5 backdrop-blur-sm transition-all duration-500
                               hover:-translate-y-1 hover:bg-white/70"
                    style={{ transitionTimingFunction: "var(--ease-spring)" }}
                  >
                    <FloatingProduct hoverOnly className="mb-5">
                      <ProductImage
                        product={p}
                        compact
                        className="h-[150px] w-full rounded-[10px]"
                      />
                    </FloatingProduct>
                    <span className="font-serif text-[18px] leading-tight tracking-[-0.01em]">
                      {p.name}
                    </span>
                    <span className="mt-2 line-clamp-3 flex-1 text-[13px] leading-[1.55] text-muted">
                      {p.summary}
                    </span>
                    <span className="mt-4 flex items-center justify-between text-[13px]">
                      <span className="text-ink">{p.price}</span>
                      <span className="text-faint">{p.details?.Size}</span>
                    </span>
                  </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── textures ───────────────────────────────────────────── */}
      <section
        id="textures"
        className="relative z-10 border-t hairline bg-paper px-6 py-24 sm:px-12"
      >
        <div className="mx-auto max-w-[1180px]">
          <h2 className="font-serif text-[38px] tracking-[-0.02em]">
            How they feel
          </h2>
          <p className="mt-3 max-w-[440px] text-[15px] leading-relaxed text-muted">
            Half of choosing skincare is texture. Ours run from almost-water to
            genuinely rich.
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { texture: "water" as const, tint: "#9fb4bd", name: "Watery", note: "Quench, Smooth, Even — absorb in seconds and disappear." },
              { texture: "gel" as const, tint: "#8fae9c", name: "Gel", note: "Clarity — cool on the skin, rinses clean." },
              { texture: "oil" as const, tint: "#c08d45", name: "Oil", note: "Dissolve, Dawn, Renew — slower, and they stay put." },
              { texture: "cream" as const, tint: "#ded2be", name: "Cream", note: "Shield, Recover, Daylight — the ones you can feel working." },
            ].map((t, i) => (
              <Reveal key={t.texture} delay={i * 90}>
                <figure>
                  <TextureSwatch
                    texture={t.texture}
                    tint={t.tint}
                    className="h-[210px] w-full rounded-[14px]"
                  />
                  <figcaption className="mt-4">
                    <span className="font-serif text-[18px]">{t.name}</span>
                    <span className="mt-1.5 block text-[13px] leading-[1.55] text-muted">
                      {t.note}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>

          <p className="mt-10 max-w-[540px] text-[11.5px] leading-relaxed text-faint">
            These are generated live on your device rather than photographed —
            each one is a shader, a few lines of maths, no image to download.
          </p>
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


      {/* ── contact ────────────────────────────────────────────── */}
      <section
        id="contact"
        className="relative z-10 border-t hairline bg-paper-2 px-6 py-24 sm:px-12"
      >
        <div className="mx-auto max-w-[1180px]">
          <h2 className="font-serif text-[38px] tracking-[-0.02em]">Reach us</h2>
          <p className="mt-3 max-w-[470px] text-[15px] leading-relaxed text-muted">
            Four ways in, one assistant behind all of them. Whichever you pick,
            the same person picks it up afterwards.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex h-full flex-col rounded-[14px] border hairline bg-white/55 p-6">
              <h3 className="font-serif text-[19px]">Chat here</h3>
              <p className="mt-2.5 flex-1 text-[13.5px] leading-[1.6] text-muted">
                Fastest. Replies in about a second, any hour.
              </p>
              <OpenChatButton />
            </div>

            {company.contact.telegram && (
              <div className="flex h-full flex-col rounded-[14px] border hairline bg-white/55 p-6">
                <h3 className="font-serif text-[19px]">Telegram</h3>
                <p className="mt-2.5 flex-1 text-[13.5px] leading-[1.6] text-muted">
                  Message us from your phone and keep the thread.
                </p>
                <a
                  href={`https://t.me/${company.contact.telegram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-block self-start rounded-full bg-ink px-5 py-2.5
                             text-[13px] font-medium text-paper transition-transform
                             duration-500 hover:-translate-y-0.5"
                  style={{ transitionTimingFunction: "var(--ease-spring)" }}
                >
                  @{company.contact.telegram}
                </a>
              </div>
            )}

            {company.contact.email && (
              <div className="flex h-full flex-col rounded-[14px] border hairline bg-white/55 p-6">
                <h3 className="font-serif text-[19px]">Email</h3>
                <p className="mt-2.5 flex-1 text-[13.5px] leading-[1.6] text-muted">
                  Best for anything detailed. We reply in the same thread.
                </p>
                <a
                  href={`mailto:${company.contact.email}`}
                  className="mt-5 inline-block self-start text-[13px] underline
                             decoration-black/20 underline-offset-4 hover:decoration-black/50"
                >
                  {company.contact.email}
                </a>
              </div>
            )}

            <div className="flex h-full flex-col rounded-[14px] border hairline bg-white/55 p-6">
              <h3 className="font-serif text-[19px]">Hours</h3>
              <p className="mt-2.5 flex-1 text-[13.5px] leading-[1.6] text-muted">
                {company.supportHours}. The assistant answers outside them too;
                a person replies the next working day.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t hairline bg-paper px-6 py-14 sm:px-12">
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
