import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductImage from "@/components/ProductImage";
import FloatingProduct from "@/components/FloatingProduct";
import ChatWidget from "@/components/ChatWidget";
import AskAboutButton from "@/components/AskAboutButton";
import { getCompany } from "@/lib/company";

/** All twelve are known at build time, so prerender them. */
export async function generateStaticParams() {
  const company = await getCompany();
  return company.products.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const company = await getCompany();
  const product = company.products.find((p) => p.id === id);
  if (!product) return { title: `Not found — ${company.name}` };
  return {
    title: `${product.name} — ${company.name}`,
    description: product.summary,
  };
}

/**
 * Words that mean a note is a safety caveat rather than a usage tip, so it
 * gets rendered as a warning instead of buried in the fine print.
 */
const SAFETY = /pregnan|breastfeed|doctor|dermatologist|not suitable|avoid/i;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompany();
  const product = company.products.find((p) => p.id === id);
  if (!product) notFound();

  const related = company.products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 3);

  const isSafetyNote = product.notes ? SAFETY.test(product.notes) : false;
  const howToUse = product.details?.["How to use"];
  const specs = Object.entries(product.details ?? {}).filter(
    ([k]) => k !== "How to use"
  );

  return (
    <>
      <ChatWidget />

      <nav className="flex items-center justify-between px-6 py-6 sm:px-12">
        <Link href="/" className="text-[19px] font-medium tracking-[0.16em]">
          LUMEA
        </Link>
        <Link href="/#shop" className="text-[13px] text-muted">
          All products
        </Link>
      </nav>

      <main className="mx-auto max-w-[1180px] px-6 pb-24 sm:px-12">
        <p className="mb-8 text-[12.5px] text-faint">
          <Link href="/#shop" className="hover:text-muted">
            Shop
          </Link>
          <span className="mx-2">/</span>
          <span>{product.category}</span>
        </p>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <FloatingProduct>
            <ProductImage product={product} className="w-full rounded-[14px]" />
          </FloatingProduct>

          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
              {product.category}
            </span>
            <h1 className="mt-4 font-serif text-[clamp(32px,4vw,46px)] leading-[1.05] tracking-[-0.025em]">
              {product.name}
            </h1>
            <p className="mt-5 text-[16.5px] leading-[1.62] text-muted">
              {product.summary}
            </p>

            <div className="mt-7 flex items-baseline gap-4">
              <span className="text-[22px]">{product.price}</span>
              <span className="text-[13.5px] text-faint">
                {product.details?.Size}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                disabled
                title="This is a demonstration — nothing here is for sale."
                className="cursor-not-allowed rounded-full bg-ink/25 px-7 py-3.5 text-[13.5px] font-medium text-paper"
              >
                Add to bag
              </button>
              <AskAboutButton productName={product.name} />
            </div>

            {isSafetyNote && product.notes && (
              <div className="mt-8 rounded-[12px] border border-amber/30 bg-amber/[0.07] p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-amber">
                  Before you use this
                </p>
                <p className="mt-2 text-[14px] leading-[1.6] text-muted">
                  {product.notes}
                </p>
              </div>
            )}

            <dl className="mt-10 divide-y divide-black/[0.07] border-y hairline">
              {specs.map(([key, value]) => (
                <div key={key} className="flex gap-6 py-4">
                  <dt className="w-[130px] flex-none text-[12.5px] text-faint">
                    {key}
                  </dt>
                  <dd className="text-[14px] leading-[1.6]">{value}</dd>
                </div>
              ))}
            </dl>

            {howToUse && (
              <div className="mt-8">
                <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  How to use
                </h2>
                <p className="mt-3 text-[14.5px] leading-[1.65] text-muted">
                  {howToUse}
                </p>
              </div>
            )}

            {!isSafetyNote && product.notes && (
              <p className="mt-8 text-[13.5px] leading-[1.6] text-faint">
                {product.notes}
              </p>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-24 border-t hairline pt-14">
            <h2 className="mb-8 text-[11px] uppercase tracking-[0.16em] text-faint">
              Also in {product.category}
            </h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group flex flex-col rounded-[14px] border hairline bg-white/45 p-5
                             transition-all duration-500 hover:-translate-y-1 hover:bg-white/70"
                  style={{ transitionTimingFunction: "var(--ease-spring)" }}
                >
                  <ProductImage
                      product={p}
                      compact
                      className="mb-5 h-[130px] w-full rounded-[10px]"
                    />
                  <span className="font-serif text-[17px] tracking-[-0.01em]">
                    {p.name}
                  </span>
                  <span className="mt-2 text-[13px] leading-[1.55] text-muted">
                    {p.summary}
                  </span>
                  <span className="mt-4 text-[13px]">{p.price}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t hairline bg-paper-2 px-6 py-12 sm:px-12">
        <p className="mx-auto max-w-[1180px] text-[11.5px] leading-relaxed text-faint">
          Lumea is a fictional brand, built to demonstrate a multi-channel AI
          reception agent. Nothing here is for sale and nothing here is medical
          advice.
        </p>
      </footer>
    </>
  );
}
