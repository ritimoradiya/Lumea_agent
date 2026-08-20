# Lumea Agent

An AI reception agent for a skincare brand. It answers product questions
from a fixed knowledge base and collects five contact details across
several channels, then hands a qualified lead to a human.

Lumea is a fictional brand built for this project — the interesting part
is the engine, not the storefront.

**Live: [lumea-agent.netlify.app](https://lumea-agent.netlify.app)**

- [The store](https://lumea-agent.netlify.app) — twelve products, chat widget bottom-right
- [Try it as a text thread](https://lumea-agent.netlify.app/demo) — no phone number needed

> The website is deployed. The email and Telegram workers run locally rather
> than on Netlify, so those two channels answer only while a laptop is running
> them — see [Running the channels](#running-the-channels).

## What works today

- Answers questions using only a supplied product catalogue and FAQ
- Collects first name, last name, email, phone, and a description of the need
- Refuses to invent prices, discounts, shipping claims, or medical advice
- Streams replies, ~1.0–1.5s per turn end to end
- Runs against Groq (cloud) or Ollama (fully local, no internet)

```
$ npm run chat

  Lumea — support agent
  brain: groq:openai/gpt-oss-120b  ·  6 products  ·  10 FAQs

Lumea  Hi, I'm the Lumea assistant. Ask me anything about our products,
       or tell me what you're looking for and I'll make sure the right
       person follows up.

You    anything for sensitive skin?
Lumea  Our gentlest start is the fragrance-free Clarity Gel Cleanser
       paired with the Shield Barrier Cream. May I have your first name?
       1487ms · collected 0/5
```

## Design decisions

**The application code owns the checklist, not the model.** The model is
never asked to remember which details are still outstanding. Each turn,
code computes the next missing field and instructs the model to ask for
that one thing. The model only writes sentences. This is why the agent
cannot loop, forget, or re-ask for something it already has — and why it
stays reliable on small models.

**Extraction is hybrid, and the regex wins.** Email addresses and phone
numbers have strict shapes, so a regex reads them more reliably than any
model. The model handles only the fuzzy fields — names and the free-text
description. Where both find an email, the regex value is kept. A
mistyped email address is the worst failure this system can have.

**Extraction knows what was just asked.** Passing the pending field into
the extraction pass is what lets a bare reply of `"Riti"` be read as a
first name rather than noise, without feeding it the whole transcript.

**Identity is locked, intent is not.** Once an email or phone number is
confirmed it is never overwritten. The description is allowed to be
superseded, because someone who opens with "something for sensitive skin"
and later says "actually I need a dry skin routine" should have the
second one on their lead.

**The brain is swappable.** `Brain` is a two-method interface. Groq and
Ollama each implement it in isolation, chosen by one environment
variable, so the same agent runs on free cloud inference or entirely
offline on a laptop.

**The company is data, not code.** Brand, catalogue, FAQ, and
industry-specific guardrails live in `config/companies/*.json`. Universal
rules (never invent a price, one question per reply) live in the prompt
builder; domain rules like "never give medical advice" come from the
profile.

## Architecture

```
  web chat ──┐
  Telegram ──┼──→  respond()  ──→  Groq  or  Ollama
  email ─────┤         │
  simulator ─┘         └──→  Supabase  ──→  lead alert email
```

Every channel funnels into one `respond()` call, which is why adding a
channel is a small job rather than a rewrite.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the blanks
npm run models               # confirm your Groq key and model id
npm run chat
```

Only `GROQ_API_KEY` is needed to talk to the agent. The Supabase, Gmail,
and Telegram values are for later phases.

For fully offline operation, install [Ollama](https://ollama.com), run
`ollama pull qwen2.5:3b`, and set `BRAIN=ollama`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run chat` | Interactive terminal conversation |
| `npm run smoke` | Six-turn scripted test covering every guardrail |
| `npm run bench` | Compare candidate models on latency and accuracy |
| `npm run models` | List models available to your Groq account |
| `npx tsx scripts/diag.ts` | Read Groq's rate-limit headers |

### A note on measuring latency

Groq's free tier allows 8,000 tokens per minute, and each turn costs
roughly 2,300. An unpaced six-turn test exhausts that budget by turn four,
after which the SDK retries with backoff — which reads as 15-second model
latency but is throttling. `smoke` and `bench` pace themselves for this
reason, and `diag.ts` exists to tell the two apart.

## Running the channels

The website is deployed. Two channels run as local workers, each in its own
terminal:

```bash
npm run telegram   # long polls Telegram; needs no public URL
npm run email      # polls the support inbox over IMAP
```

Both connect outward, which is why neither needs a tunnel or an exposed port.
Telegram allows one poller per bot, so only run one copy.

| Command | Purpose |
| --- | --- |
| `npm run chat` | Talk to the agent in a terminal |
| `npm run verify` | Check all five external dependencies |
| `npm run smoke` | Six-turn test covering every guardrail |
| `npm run replay` | Replays the conversation that caught a real bug |
| `npm run bench` | Compare models on latency and accuracy |
| `npm run recover` | Deliver leads that qualified but never sent |

## Roadmap

- [x] Conversation engine, checklist, extraction, guardrails
- [x] Persist conversations and leads to Supabase
- [x] Lead alert emails and a generated routine for the customer
- [x] Web store, twelve product pages, chat widget
- [x] Admin inbox, lead list, human takeover
- [x] Telegram channel
- [x] Email channel with correct threading
- [x] Rate limiting, CI, and deploy
- [ ] Cross-channel identity — recognise a returning customer by email
- [ ] An evaluation suite over the guardrails
- [ ] Observability: token spend, latency, completion rate by channel

## Stack

TypeScript · Next.js · Groq · Ollama · Supabase (Postgres) · Zod

## License

MIT — see [LICENSE](LICENSE).
