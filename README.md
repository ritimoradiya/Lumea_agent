# Lumea Agent

A multi-channel AI customer service agent for a skincare brand. It answers
product questions from a fixed catalogue, qualifies the enquiry, and delivers
the lead to the business owner by email.

One conversation per customer across three channels: a website widget,
Telegram, and email. Lumea is a fictional brand; the project is the engine.

**Live demo — [lumea-agent.netlify.app](https://lumea-agent.netlify.app)**

```
You    my skin has been really dry and tight since winter started
Lumea  For dry, tight skin start with Clarity Gel Cleanser to cleanse
       without stripping, then Quench Hydrating Serum on damp skin, and
       seal it with Shield Barrier Cream. May I have your name and email
       so we can send you a simple routine you can keep?
       1085ms · ask · 0/2

You    I'm Ana Whitfield, ana@example.com
Lumea  Thanks, Ana. Do you already have a daily routine, or would this be
       starting from scratch?
       1239ms · ask · 2/2
```

## Features

- **Grounded responses.** Answers are drawn from a supplied product catalogue
  and FAQ. Out-of-scope requests are declined.
- **Structured qualification.** Captures name, email, and stated need through
  natural conversation rather than a form.
- **Guardrails.** Will not quote unlisted prices, offer discounts, make
  shipping claims, or give medical advice.
- **Cross-channel identity.** A returning customer is recognised by email
  address on any channel and is not asked twice.
- **Automated handoff.** A qualified lead triggers a summary to the owner and a
  generated routine to the customer.
- **Streaming responses**, approximately one second per turn.

## Deployment

| Channel | Host | Latency |
| --- | --- | --- |
| Web chat | Netlify function | ~1s |
| Telegram | Netlify webhook | ~1s |
| Email | GitHub Actions, 5-minute schedule | ~10 min |

No always-on machine is required.

Email polling runs on GitHub Actions rather than Netlify because serverless
functions terminate at 30 seconds, which an IMAP poll cannot reliably complete
within. Actions imposes no such limit and is unmetered on public repositories.
Each run polls for four minutes and exits so the next may start.

## Architecture

```
  web chat ──┐
  Telegram ──┼──→  respond()  ──→  Groq  or  Ollama
  email ─────┘         │
                       └──→  Supabase  ──→  lead alert email
```

All channels converge on a single `respond()` call. Channel adapters handle
transport only and contain no agent logic, so adding a channel requires no
change to the conversation engine.

## Design

**Deterministic checklist.** Application code tracks which details are
outstanding and passes a single target to the model each turn. The model
generates prose only. This prevents loops, duplicate questions, and dropped
fields, and keeps behaviour stable on smaller models.

**Asks over fields.** The unit of collection is a question, not a database
column: name and email are requested together. Each carries a stated reason and
is abandoned after two unanswered attempts.

**Two qualification thresholds.** Notifying the owner requires contact details.
Generating a routine additionally requires a stated skin concern. Separating
them prevents both silent drop-off and generic output.

**Field-specific merge policy.** Email and phone are extracted by regex, so a
new valid value supersedes the old one and corrections are honoured. Names and
free-text concerns are model-inferred, so the first value is retained to
prevent misattribution.

**Email as identity key.** The only identifier portable across channels; a
Telegram chat ID and a browser session ID are channel-local. Identity resolution
runs before question selection.

**Configuration over code.** Brand, catalogue, FAQ, and domain-specific rules
are defined in `config/companies/*.json`. Universal rules live in the prompt
builder. Re-targeting the agent to another business requires no code change.
Inference is likewise pluggable through a two-method `Brain` interface, backed
by either Groq or a local Ollama model.

## Testing

Guardrails are implemented as pure functions in `lib/eval/guardrails.ts`,
isolated from any inference call.

- `npm test` — evaluates guardrails against recorded responses. No API key, no
  network, sub-second. Runs in CI on every push.
- `npm run eval` — applies the same guardrails to live model output across
  recorded conversations, and additionally asserts response mode and field
  extraction.

Fixtures assert both positive and negative cases: roughly half must produce no
violation, which is what prevents false positives from accumulating.

## Setup

```bash
npm install
cp .env.example .env.local   # populate credentials
npm run models               # verify Groq key and model availability
npm run chat
```

`GROQ_API_KEY` is sufficient for conversation. Supabase, Gmail, and Telegram
credentials enable persistence and the remaining channels.

For offline inference, install [Ollama](https://ollama.com), run `ollama pull
qwen2.5:3b`, and set `BRAIN=ollama`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run chat` | Interactive terminal session |
| `npm test` | Guardrail and checklist suite — offline, no API key |
| `npm run eval` | Guardrails against live model output |
| `npm run identity` | Verifies cross-channel customer recognition |
| `npm run verify` | Checks all external dependencies |
| `npm run recover` | Re-delivers qualified leads that failed to send |
| `npm run email` | Polls the inbox on demand |
| `npm run bench` | Compares models on latency and extraction accuracy |
| `npx tsx scripts/diag.ts` | Reports Groq rate-limit headers |

The Groq free tier permits 8,000 tokens per minute against roughly 2,800 per
turn. Live scripts are paced at 20 seconds per turn, as exceeding the limit
produces transparent SDK retries rather than an error.

## Limitations

- An email correction made after routine delivery does not trigger a resend.
  The corrected address is included in the owner notification.
- Routine emails are sent as new threads, so customer replies open a new
  conversation. Identity resolution links them to the existing customer record.
- Concurrent users sharing a browser session share one conversation identity.
- GitHub suspends scheduled workflows on repositories inactive for 60 days,
  pausing email polling until the next commit.

## Roadmap

- [x] Conversation engine, checklist, extraction, guardrails
- [x] Supabase persistence, lead notification, generated routines
- [x] Storefront, twelve product pages, chat widget
- [x] Admin inbox, lead management, human handoff
- [x] Three channels, rate limiting, CI/CD
- [x] Cross-channel identity and guardrail evaluation suite
- [x] Unattended operation across all channels
- [ ] Observability: token spend, latency distribution, completion rate

## Stack

TypeScript · Next.js · Groq · Ollama · Supabase (Postgres) · Zod · Tailwind CSS

## License

MIT — see [LICENSE](LICENSE).
