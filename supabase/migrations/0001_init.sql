-- ─────────────────────────────────────────────────────────────
--  Initial schema — Lumea skincare AI reception agent
--
--  Lumea's brand, products, and FAQs live in the companies /
--  company_products / company_faqs tables rather than in code, so the
--  catalogue can be edited without a deploy.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ─── enums ───────────────────────────────────────────────────

do $$ begin
  create type channel_type as enum ('web', 'telegram', 'email', 'simulator');
exception when duplicate_object then null; end $$;

do $$ begin
  -- active   = agent is handling it
  -- complete = all five details collected, lead created
  -- human    = a person took over from the agent
  create type conversation_status as enum ('active', 'complete', 'human');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_role as enum ('customer', 'agent', 'human');
exception when duplicate_object then null; end $$;

-- ─── companies (tenants) ─────────────────────────────────────

create table if not exists companies (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  industry      text not null default '',
  tagline       text not null default '',
  about         text not null default '',
  support_hours text not null default '',
  -- Industry-specific guardrails appended to the universal rule set,
  -- e.g. "never give medical advice" or "never quote a freight rate".
  extra_rules   text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists company_products (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  ref        text not null,
  name       text not null,
  price      text,
  summary    text not null default '',
  -- Free-form spec sheet: skincare uses "Key ingredients",
  -- freight uses "Equipment". Shape varies by tenant.
  details    jsonb not null default '{}'::jsonb,
  notes      text,
  sort_order int not null default 0
);

create unique index if not exists company_products_ref_unique
  on company_products (company_id, ref);

create table if not exists company_faqs (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  question   text not null,
  answer     text not null,
  sort_order int not null default 0
);

create index if not exists company_faqs_company_idx
  on company_faqs (company_id, sort_order);

-- ─── contacts ────────────────────────────────────────────────
-- Deduplicated on email WITHIN a tenant, so someone who starts on
-- the website and later emails us is recognised as the same person.

create table if not exists contacts (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  first_name text,
  last_name  text,
  email      text,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contacts_company_email_unique
  on contacts (company_id, lower(email)) where email is not null;

-- ─── conversations ───────────────────────────────────────────
-- One per person per channel. `collected` holds the checklist state,
-- which is owned by our code rather than by the model.

create table if not exists conversations (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies (id) on delete cascade,
  contact_id        uuid references contacts (id) on delete set null,
  channel           channel_type not null,
  channel_thread_id text not null,
  status            conversation_status not null default 'active',
  collected         jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Identifies a thread within a channel: a Telegram chat id, an email
-- Message-ID root, or a browser session id.
create unique index if not exists conversations_thread_unique
  on conversations (company_id, channel, channel_thread_id);

create index if not exists conversations_status_idx
  on conversations (company_id, status, updated_at desc);

-- ─── messages ────────────────────────────────────────────────

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  role            message_role not null,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on messages (conversation_id, created_at);

-- ─── leads ───────────────────────────────────────────────────
-- Written once every REQUIRED detail is present. Surname and phone are
-- deliberately nullable: chasing a surname annoys people, and a phone
-- number is the lowest-value, highest-friction field to demand from a
-- skincare customer, so it is asked once and never pushed.

create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies (id) on delete cascade,
  conversation_id uuid not null references conversations (id) on delete cascade,
  contact_id      uuid references contacts (id) on delete set null,
  first_name      text not null,
  last_name       text,
  email           text not null,
  phone           text,
  description     text not null,
  -- "first time" | "some experience" | "daily routine"
  experience      text,
  notified_at     timestamptz,
  created_at      timestamptz not null default now()
);

create unique index if not exists leads_conversation_unique
  on leads (conversation_id);

create index if not exists leads_pending_notification_idx
  on leads (created_at desc) where notified_at is null;

-- ─── updated_at maintenance ──────────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists companies_touch on companies;
create trigger companies_touch before update on companies
  for each row execute function touch_updated_at();

drop trigger if exists contacts_touch on contacts;
create trigger contacts_touch before update on contacts
  for each row execute function touch_updated_at();

drop trigger if exists conversations_touch on conversations;
create trigger conversations_touch before update on conversations
  for each row execute function touch_updated_at();

-- ─── row level security ──────────────────────────────────────
-- RLS on with no policies = the public anon key can read nothing.
-- Every read and write goes through the server using the service_role
-- key, which bypasses RLS by design.

alter table companies        enable row level security;
alter table company_products enable row level security;
alter table company_faqs     enable row level security;
alter table contacts         enable row level security;
alter table conversations    enable row level security;
alter table messages         enable row level security;
alter table leads            enable row level security;
