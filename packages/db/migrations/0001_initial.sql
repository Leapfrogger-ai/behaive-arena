-- Behaive Arena — initial schema migration (vanilla Postgres 16).
--
-- Earlier drafts targeted Supabase (auth.users, auth.uid(), Realtime
-- publication, pgsodium Vault). This revision removes every Supabase-
-- specific surface so the platform runs on any stock Postgres:
--   * plain public.users + public.sessions for cookie-based auth
--   * public.is_org_member() reads the org id from a GUC the server sets
--     per request via `SET LOCAL app.user_id = '…'`
--   * messages INSERT trigger calls pg_notify('run:<id>', …), which the
--     SSE route LISTENs on — replaces Supabase Realtime end-to-end
--
-- Apply via:
--   psql "$DATABASE_URL" -f packages/db/migrations/0001_initial.sql

set check_function_bodies = off;

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- =============================================================
-- USERS + SESSIONS (replaces Supabase Auth)
-- =============================================================

create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  -- nullable so magic-link signups can store an email before the user ever
  -- authenticates a session (future enhancement — not wired in the MVP).
  password_hash text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- A HMAC of the random bearer token we hand to the browser. We never
  -- store the raw token — rotation is a matter of revoking the row.
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on public.sessions(user_id);
create index if not exists sessions_expires_idx on public.sessions(expires_at);

-- =============================================================
-- ORGS + MEMBERSHIP
-- =============================================================

create table if not exists public.orgs (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user_idx on public.org_members(user_id);

-- =============================================================
-- EXPERIMENTS + RUNS
-- =============================================================

do $$ begin
  create type public.run_status as enum (
    'queued', 'running', 'completed', 'failed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.run_visibility as enum ('private', 'unlisted', 'public');
exception when duplicate_object then null; end $$;

create table if not exists public.experiments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete set null,
  name text not null,
  description text,
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experiments_org_idx on public.experiments(org_id);

create table if not exists public.runs (
  id uuid primary key default uuid_generate_v4(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  public_slug text unique not null,
  status public.run_status not null default 'queued',
  visibility public.run_visibility not null default 'private',
  config_snapshot jsonb not null,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists runs_experiment_idx on public.runs(experiment_id);
create index if not exists runs_org_idx on public.runs(org_id);
create index if not exists runs_status_idx on public.runs(status);

-- =============================================================
-- AGENT INSTANCES
-- =============================================================

do $$ begin
  create type public.agent_role as enum ('researcher', 'proposer', 'responder');
exception when duplicate_object then null; end $$;

create table if not exists public.agent_instances (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references public.runs(id) on delete cascade,
  role public.agent_role not null,
  persona text not null,
  wallet_address text not null,
  wallet_key_ciphertext bytea,
  erc8004_agent_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists agent_instances_run_idx on public.agent_instances(run_id);

-- =============================================================
-- ROUNDS + MESSAGES (hot path + realtime fan-out)
-- =============================================================

create table if not exists public.rounds (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references public.runs(id) on delete cascade,
  round_number int not null,
  offer_amount numeric,
  response text,
  verdict text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (run_id, round_number)
);

create index if not exists rounds_run_idx on public.rounds(run_id);

create table if not exists public.messages (
  id bigserial primary key,
  run_id uuid not null references public.runs(id) on delete cascade,
  round_number int,
  agent_role public.agent_role not null,
  from_agent text not null,
  content text not null,
  event_type text not null default 'chat',
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_run_created_idx on public.messages(run_id, created_at);
create index if not exists messages_run_round_idx on public.messages(run_id, round_number);

-- messages INSERT → pg_notify('run:<id>', …). The SSE handler in apps/web
-- opens a long-lived Postgres connection with `LISTEN run:<id>` and forwards
-- each notification as an SSE event. Payload is trimmed to the fields the
-- public run page actually renders so we stay under Postgres's 8000-byte
-- NOTIFY payload cap even with long agent utterances.
create or replace function public.notify_message_insert() returns trigger
language plpgsql
as $$
declare
  snippet text;
begin
  snippet := left(new.content, 4000);
  perform pg_notify(
    'run:' || new.run_id::text,
    json_build_object(
      'id', new.id,
      'run_id', new.run_id,
      'round_number', new.round_number,
      'agent_role', new.agent_role,
      'from_agent', new.from_agent,
      'event_type', new.event_type,
      'content', snippet,
      'payload', new.payload,
      'created_at', new.created_at
    )::text
  );
  return new;
end
$$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_message_insert();

-- runs status transitions also flow to the public page so the footer badge
-- can flip from "running" to "completed" in real time.
create or replace function public.notify_run_status() returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    perform pg_notify(
      'run:' || new.id::text,
      json_build_object(
        'id', 'run-status-' || new.id,
        'run_id', new.id,
        'event_type', 'run_status',
        'content', new.status::text,
        'payload', json_build_object(
          'status', new.status,
          'started_at', new.started_at,
          'completed_at', new.completed_at
        )
      )::text
    );
  end if;
  return new;
end
$$;

drop trigger if exists runs_notify_status on public.runs;
create trigger runs_notify_status
  after update of status on public.runs
  for each row execute function public.notify_run_status();

-- =============================================================
-- REPUTATION + BYO KEYS + EXPORTS
-- =============================================================

do $$ begin
  create type public.reputation_status as enum ('pending', 'confirmed', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.reputation_events (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references public.runs(id) on delete cascade,
  from_agent_id bigint not null,
  to_agent_id bigint not null,
  dimension text not null,
  score smallint not null,
  status public.reputation_status not null default 'pending',
  onchain_tx_hash text,
  block_number bigint,
  error text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists reputation_run_idx on public.reputation_events(run_id);
create index if not exists reputation_status_idx on public.reputation_events(status);

do $$ begin
  create type public.provider as enum ('anthropic', 'openai', 'google', 'mock', 'custom');
exception when duplicate_object then null; end $$;

create table if not exists public.byo_keys (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete set null,
  provider public.provider not null,
  label text not null,
  key_ciphertext bytea not null,
  key_fingerprint text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, label)
);

create index if not exists byo_keys_org_idx on public.byo_keys(org_id);

create table if not exists public.exports (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references public.runs(id) on delete cascade,
  format text not null,
  storage_path text not null,
  byte_size bigint,
  created_at timestamptz not null default now()
);

-- =============================================================
-- Multi-tenant guard — app-level, not RLS-based.
-- =============================================================
-- Supabase-flavored RLS used auth.uid(). On vanilla Postgres we give each
-- web request a session-scoped `app.user_id` GUC via SET LOCAL, and the
-- helper below resolves the caller's accessible orgs. Keeping it here
-- (rather than enforcing RLS across every table) means the queries in the
-- web app stay simple and the worker (which legitimately bypasses tenancy)
-- doesn't need to wear a special hat.

create or replace function public.current_user_id() returns uuid
language sql stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function public.is_org_member(target uuid) returns boolean
language sql stable
as $$
  select exists (
    select 1 from public.org_members
    where org_id = target and user_id = public.current_user_id()
  );
$$;
