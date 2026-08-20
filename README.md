# Lumea Agent

An AI reception agent for a skincare brand. It answers product questions from a
fixed catalogue, collects enough to follow someone up, and emails the owner a
qualified lead — over a website widget, Telegram, and email, as one
conversation per person rather than three.

Lumea is a fictional brand. The interesting part is the engine, not the
storefront.

**Live: [lumea-agent.netlify.app](https://lumea-agent.netlify.app)**

Nothing needs a laptop switched on. The website and Telegram are served by
Netlify; the inbox is polled by a scheduled GitHub Action.

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

## What it does

- Answers from a supplied catalogue and FAQ, and declines anything outside its
  job rather than improvising
- Collects a name, an email, and what their skin needs — one question at a time
- Won't invent a price, a discount, a shipping claim, or medical advice
- Recognises a returning customer by email, on any channel
- Streams replies in about a second

## Where each channel runs

| Channel | Runs on | Reply time |
| --- | --- | --- |
| Web chat | Netlify function | ~1s |
| Telegram | Netlify webhook | ~1s |
| Email | Scheduled GitHub Action, every 5 min | within ~10 min |

Email is the odd one out because a Netlify function is killed at 30 seconds and
a scheduled inbox poll never fit. A GitHub Actions job has no such ceiling, and
minutes are unlimited on a public repository, so the poll runs there — four
minutes of work, then it exits so the next run can start.

## Architecture

```
  web chat ──┐
  Telegram ──┼──→  respond()  ──→  Groq  or  Ollama
  email ─────┘         │
                       └──→  Supabase  ──→  lead alert email
```

Every channel funnels into one `respond()` call, which is why adding a channel
is a small job rather than a rewrite.

## Design decisions

**The code owns the checklist, not the model.** The model is never asked to
remember what is still outstanding. Each turn, code picks the single next thing
to ask for and tells the model to ask for that; the model only writes sentences.
This is why the agent cannot loop, forget, or re-ask for something it already
has — and why it stays reliable on small models.

The unit is an *ask*, not a field: "may I have your name and email?" is one ask
filling two, because splitting it reads like a form. Each ask carries a reason,
and is abandoned after two unanswered attempts rather than repeated.

**A lead is somewhere to write to, plus one thing worth writing about.** Not a
list of required fields — that formulation silently dropped real customers,
because whichever field happened to be missing voided the whole lead. Telling
the owner and writing a routine are separate thresholds: contact details are
enough for the first, while the second needs to know something about their skin
or it is filler.

**Contact details are correctable; identity is not.** The split follows how each
field is read. Emails and phone numbers are found by regex, deterministically,
so a new valid value in the customer's own message is a correction and the last
word wins. Names and concerns are inferred by a model, where a later value may
be a misreading rather than a change of mind, so those are first-write-wins.

**Email is the identity key.** It is the only identifier that travels — a
Telegram chat id and a browser session id are meaningless outside their own
channel. The lookup runs before the next question is chosen, or a returning
customer gets asked for a name already on file.

**The company is data, not code.** Brand, catalogue, FAQ, and domain guardrails
live in `config/companies/*.json`; universal rules live in the prompt builder.
Rebranding means editing one JSON file. The model is swappable the same way —
`Brain` is a two-method interface, so the same agent runs on Groq or entirely
offline on Ollama.

## Testing

The guardrails are pure functions in `lib/eval/guardrails.ts`, deliberately
apart from anything that talks to a model — guardrails you can only check by
spending tokens get checked rarely.

`npm test` runs them against recorded replies: no key, no network, under a
second, so CI enforces them on every push. Each fixture declares which rules it
must trip, and about half must trip nothing at all — a rule that fires on a good
reply is worse than no rule, because the first false positive teaches everyone
to ignore the suite.

`npm run eval` puts the same functions in front of the live model over recorded
conversations, and adds what fixtures cannot: whether the agent chose to ask or
to answer, and whether a detail was actually captured.

Most fixtures are replies that really happened. A guardrail written from
imagination tends to catch imaginary problems.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the blanks
npm run models               # confirm your Groq key and model id
npm run chat
```

Only `GROQ_API_KEY` is needed to talk to the agent. Supabase, Gmail, and
Telegram values are needed for persistence and the other channels. For fully
offline operation, install [Ollama](https://ollama.com), run `ollama pull
qwen2.5:3b`, and set `BRAIN=ollama`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run chat` | Talk to the agent in a terminal |
| `npm test` | Guardrails and checklist. No key, no network, under a second |
| `npm run eval` | The same guardrails against the live model |
| `npm run identity` | Proves a customer is recognised across channels |
| `npm run verify` | Check every external dependency |
| `npm run recover` | Deliver leads that qualified but never sent |
| `npm run email` | Poll the inbox now, instead of waiting for the Action |
| `npm run bench` | Compare models on latency and accuracy |
| `npx tsx scripts/diag.ts` | Read Groq's rate-limit headers |

Groq's free tier allows 8,000 tokens a minute, and a turn costs roughly 2,800.
Every live script paces itself at 20 seconds a turn, because exceeding that
limit does not fail loudly — the SDK retries with backoff, which looks exactly
like a slow model.

## Known limitations

- Correcting an email **after** the routine has been sent does not resend it.
  The corrected address does reach the owner in the lead alert.
- The routine is sent as a fresh email rather than threaded into the customer's
  thread, so a reply starts a new conversation. Recognition makes that
  survivable rather than fixing it.
- Two people sharing one browser tab share one identity.
- GitHub disables scheduled workflows on a repository with no commits for 60
  days, which stops the email poll until the next push.

## Roadmap

- [x] Conversation engine, checklist, extraction, guardrails
- [x] Supabase persistence, lead alerts, generated routines
- [x] Web store, twelve product pages, chat widget
- [x] Admin inbox, lead list, human takeover
- [x] Three channels, rate limiting, CI, deploy
- [x] Cross-channel identity, and an evaluation suite over the guardrails
- [x] Every channel answering with no machine of mine running
- [ ] Observability: token spend, latency, completion rate by channel

## Stack

TypeScript · Next.js · Groq · Ollama · Supabase (Postgres) · Zod · Tailwind

## License

MIT — see [LICENSE](LICENSE).
