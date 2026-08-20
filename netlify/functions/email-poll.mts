import type { Config } from "@netlify/functions";

/**
 * Triggers a pass over the support inbox once a minute.
 *
 * Deliberately thin: all the logic lives in /api/cron/email so it shares the
 * app's imports and path aliases. This exists only because Netlify's scheduler
 * runs Netlify Functions, not Next route handlers.
 */
const pollEmail = async () => {
  const secret = process.env.CRON_SECRET;
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL;

  if (!secret || !base) {
    console.warn("[email-poll] CRON_SECRET or URL missing; skipping");
    return new Response("not configured", { status: 200 });
  }

  const response = await fetch(`${base}/api/cron/email`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  const body = await response.text();
  console.log(`[email-poll] ${response.status} ${body}`);
  return new Response(body, { status: 200 });
};

export default pollEmail;

export const config: Config = {
  // Netlify's shortest interval. Email does not need to be faster than this.
  schedule: "* * * * *",
};
