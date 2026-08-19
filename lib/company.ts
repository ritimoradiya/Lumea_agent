import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * A company profile is DATA, not code.
 *
 * The agent has no hardcoded knowledge of any business. It is handed a
 * Company at runtime and can only speak to what that profile contains.
 * Swapping the tenant means swapping a JSON file (or, later, a database
 * row) — no code changes anywhere.
 */

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.string().optional(),
  summary: z.string(),
  /** Free-form spec sheet. Skincare uses "Key ingredients"; freight uses "Equipment". */
  details: z.record(z.string(), z.string()).optional(),
  notes: z.string().optional(),
});

export const FaqSchema = z.object({
  q: z.string(),
  a: z.string(),
});

export const CompanySchema = z.object({
  slug: z.string(),
  name: z.string(),
  industry: z.string(),
  tagline: z.string(),
  about: z.string(),
  supportHours: z.string(),
  /** Industry-specific guardrails appended to the universal rule set. */
  extraRules: z.array(z.string()).default([]),
  products: z.array(ProductSchema).default([]),
  faqs: z.array(FaqSchema).default([]),
});

export type Product = z.infer<typeof ProductSchema>;
export type Faq = z.infer<typeof FaqSchema>;
export type Company = z.infer<typeof CompanySchema>;

const CONFIG_DIR = path.join(process.cwd(), "config", "companies");

/** Every company profile available on disk. */
export function listCompanySlugs(): string[] {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs
    .readdirSync(CONFIG_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function loadCompanyFromFile(slug: string): Company {
  const file = path.join(CONFIG_DIR, `${slug}.json`);

  if (!fs.existsSync(file)) {
    const available = listCompanySlugs();
    throw new Error(
      `No company profile "${slug}" in config/companies/. ` +
        (available.length ? `Available: ${available.join(", ")}` : "That folder is empty.")
    );
  }

  const parsed = CompanySchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new Error(
      `config/companies/${slug}.json is not a valid company profile:\n` +
        parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
    );
  }
  return parsed.data;
}

/**
 * The active company for this process.
 *
 * Reads from disk today. Once the admin panel can edit a company, this
 * is the single place that starts preferring the database row and falls
 * back to the file — nothing upstream has to change.
 */
export async function getCompany(slug?: string): Promise<Company> {
  return loadCompanyFromFile(slug ?? process.env.COMPANY_SLUG ?? "lumea");
}

/** Compact catalogue text for the system prompt. */
export function catalogueForPrompt(company: Company): string {
  if (!company.products.length) return "(no products listed)";

  return company.products
    .map((p) => {
      const details = p.details
        ? " " +
          Object.entries(p.details)
            .map(([k, v]) => `${k}: ${v}.`)
            .join(" ")
        : "";
      const price = p.price ? ` (${p.price})` : "";
      return `- ${p.name}${price} — ${p.summary}${details}${p.notes ? ` Note: ${p.notes}` : ""}`;
    })
    .join("\n");
}

/** Compact FAQ text for the system prompt. */
export function faqForPrompt(company: Company): string {
  if (!company.faqs.length) return "(no FAQ entries)";
  return company.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
}
