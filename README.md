# Lumea Agent

An AI reception agent for a skincare brand. It answers product questions from a
fixed catalogue, collects enough to follow someone up, and emails the owner a
qualified lead — over a website widget, Telegram, and email, as one
conversation per person rather than three.

Lumea is a fictional brand. The interesting part is the engine, not the
storefront.

**Live: [lumea-agent.netlify.app](https://lumea-agent.netlify.app)** — twelve
products, chat widget bottom-right.

Nothing needs a laptop switched on. The website and Telegram are served by
Netlify; the inbox is polled by a scheduled GitHub Action.

## What it does

- Answers only from a supplied catalogue and FAQ — twelve products, thirteen
  answers
- Collects a name, an email, and what their skin needs, one question at a time
- Refuses to invent a price, a discount, a shipping claim, or medical advice
- Recognises a returning customer by email, on any channel
- Streams replies in about a second

```
$ npm run chat

  Lumea — support agent
  brain: groq:openai/gpt-oss-120b  ·  12 products  ·  13 FAQs

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

## Where each channel runs

| Channel | Runs on | Reply time |
| --- | --- | --- |
| Web chat | Netlify function | ~1s |
| Telegram | Netlify webhook | ~1s |
| Email | Scheduled GitHub Action, every 5 min | within ~10 min |

### Why email is not on Netlify

A Netlify function is killed at 30 seconds, and a scheduled one polling Gmail
failed at exactly 30.3s every time. IMAP itself is not the problem — measured
directly it takes 1.7 to 11.4 seconds — so the cost was that sandbox's cold
start, not the protocol.

A GitHub Actions job has no such ceiling and minutes are unlimited on a public
repository, so the poll lives there instead. It runs for four minutes and
exits, because a job has to end before the next can start. Every five minutes
is the tightest schedule cron allows, and GitHub runs these best-effort, so
call it "within about ten minutes" — normal for email, and unread mail waits.

### Telegram: webhook or polling, never both

```bash
npm run webhook -- https://your-site.netlify.app   # deployed site answers
npm run webhook -- --off                           # back to local polling
npm run telegram                                   # local polling
```

Registering a webhook stops `getUpdates` working. That is Telegram's design,
not a bug.

## Design decisions

**The code owns the checklist, not the model.** The model is never asked to
remember what is still outstanding. Each turn, code picks the single next thing
to ask for and tells the model to ask for that. The model only writes
sentences. This is why the agent cannot loop, forget, or re-ask for something
it already has — and why it stays reliable on small models.

**Asks, not fields.** "May I have your name and email?" is one ask filling two
fields, because splitting it reads like a form. Each ask carries a reason, so
it sounds like a service rather than a data grab. An ask is abandoned after two
unanswered attempts instead of being repeated.

**A lead is somewhere to write to, plus one thing worth writing about.** Not "a
list of required fields" — that formulation silently dropped three different
customers, because whichever field happened to be missing voided the whole
lead. An address plus either a name or a concern is enough; the transcript
carries the rest.

**Two thresholds, not one.** Whether to tell the owner and whether to write a
routine are different questions. Contact details are enough for the first. The
second needs to know something about their skin, or it is filler. Merging them
meant a customer was told "here is a written routine, I'll email it to you" and
nothing was sent.

**Contact details are correctable; identity is not.** The split follows how
each field is read. Email and phone are found by regex, deterministically, so a
new valid value in the customer's own message is a correction and the last word
wins. Names and concerns are inferred by a model, where a later value may be a
misreading — a mention of a friend once overwrote the customer's own name, and
asking about retinol in pregnancy rewrote someone whose concern was dry skin.

**Extraction is hybrid, and the regex wins.** Emails and phone numbers have
strict shapes. The model handles only the fuzzy fields. It also knows which ask
is pending, which is what lets a bare reply of `"Riti"` read as a name rather
than noise, without feeding it the whole transcript.

**Email is the identity key.** It is the only identifier that travels — a
Telegram chat id and a browser session id are meaningless outside their own
channel. The lookup runs before the next question is chosen, or a returning
customer gets asked for a name already on file.

**The brain is swappable.** `Brain` is a two-method interface. Groq and Ollama
each implement it in isolation, chosen by one environment variable, so the same
agent runs on free cloud inference or entirely offline.

**The company is data, not code.** Brand, catalogue, FAQ, and domain guardrails
live in `config/companies/*.json`. Universal rules — never invent a price, one
question per reply — live in the prompt builder. Rebranding means editing one
JSON file.

## Architecture

```
  web chat ──┐
  Telegram ──┼──→  respond()  ──→  Groq  or  Ollama
  email ─────┘         │
                       └──→  Supabase  ──→  lead alert email
```

Every channel funnels into one `respond()` call, which is why adding a channel
is a small job rather than a rewrite.

## Testing in two halves

The guardrails are pure functions in `lib/eval/guardrails.ts`, kept apart from
anything that talks to a model. That split is the point: guardrails you can
only check by spending tokens get checked rarely.

`npm test` runs them against recorded replies in `lib/eval/fixtures.ts` — no
key, no network, under a second, so CI enforces them on every push. Each
fixture declares which rules it must trip, and roughly half must trip nothing
at all. Those matter most: a rule that fires on a good reply is worse than no
rule, because the first false positive teaches everyone to ignore the suite.
Three rules were caught being wrong this way, including one that failed a reply
correctly quoting the 15% subscription discount from the FAQs.

`npm run eval` puts the same functions in front of the live model over four
recorded conversations, and adds what fixtures cannot: whether the agent chose
to ask or to answer, and whether a detail was actually captured. It found four
real faults on its first run, including the agent answering a pregnancy
question with its own advice instead of pointing to a doctor.

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
Telegram values are needed for persistence and the other channels.

For fully offline operation, install [Ollama](https://ollama.com), run
`ollama pull qwen2.5:3b`, and set `BRAIN=ollama`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run chat` | Talk to the agent in a terminal |
| `npm test` | Guardrails and checklist. No key, no network, under a second |
| `npm run eval` | The same guardrails against the live model. Spends tokens |
| `npm run eval cold-open` | One scenario by name |
| `npm run identity` | Proves a customer is recognised across channels |
| `npm run verify` | Check every external dependency |
| `npm run recover` | Deliver leads that qualified but never sent |
| `npm run email` | Poll the inbox locally, instead of waiting for the Action |
| `npm run bench` | Compare models on latency and accuracy |
| `npm run models` | List models available to your Groq account |
| `npx tsx scripts/diag.ts` | Read Groq's rate-limit headers |

### Measuring latency, and a mistake worth repeating

Groq's free tier allows 8,000 tokens a minute, and a turn costs roughly 2,800
across extraction and reply. An unpaced test exhausts that in three turns,
after which the SDK retries with backoff — which looks exactly like a slow
model. Early on this was reported as 17–21 second model latency. It was
throttling; isolated calls took 340–540ms.

`diag.ts` exists to tell the two apart, and every live script paces itself at
20 seconds a turn.

## Known limitations

- Correcting an email **after** the routine has been sent does not resend it.
  The corrected address does reach the owner in the lead alert.
- Two people using the same browser tab share one identity, because identity
  fields are first-write-wins.
- The routine is sent as a fresh email rather than threaded into the customer's
  existing thread, so a reply starts a new conversation. Recognition makes that
  survivable — the new conversation knows who they are — rather than fixing it.
- GitHub disables scheduled workflows on a repository with no commits for 60
  days. If email goes quiet after a long break, that is why.

## Roadmap

- [x] Conversation engine, checklist, extraction, guardrails
- [x] Persist conversations and leads to Supabase
- [x] Lead alert emails and a generated routine for the customer
- [x] Web store, twelve product pages, chat widget
- [x] Admin inbox, lead list, human takeover
- [x] Telegram channel
- [x] Email channel with correct threading
- [x] Rate limiting, CI, and deploy
- [x] Cross-channel identity — recognise a returning customer by email
- [x] An evaluation suite over the guardrails
- [x] Every channel answering with no machine of mine running
- [ ] Observability: token spend, latency, completion rate by channel

## Stack

TypeScript · Next.js · Groq · Ollama · Supabase (Postgres) · Zod · Tailwind

## License

MIT — see [LICENSE](LICENSE).
