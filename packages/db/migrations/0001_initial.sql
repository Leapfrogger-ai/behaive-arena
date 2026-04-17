-- Behaive Arena — initial schema migration
--
-- Target: Supabase Postgres (free tier). Supabase provides `auth.users` and
-- the `auth.uid()` helper; RLS is enforced on every tenant-scoped table.
-- pgsodium/Vault handles BYO model key envelope encryption.
--
-- Apply via:
--   psql "$SUPABASE_DB_URL" -f packages/db/migrations/0001_initial.sql
-- or paste into the Supabase SQL editor.

set check_function_bodies = off;

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- pgsodium may not be installed on the free tier by default. Uncomment if
-- you've enabled the Vault extension in your Supabase project settings.
-- create extension if not exists pgsodium;

-- =============================================================
-- ORGS + MEMBERSHIP
-- =============================================================

create table if not exists public.orgs (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create type public.org_role as enum ('owner', 'admin', 'member');

create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user_idx on public.org_members(user_id);

-- =============================================================
-- EXPERIMENTS + RUNS
-- =============================================================

create type public.run_status as enum (
  'queued', 'running', 'completed', 'failed', 'cancelled'
);

create type public.run_visibility as enum ('private', 'unlisted', 'public');

create table if not exists public.experiments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete set null,
  name text not null,
  description text,
  -- { rounds, endowment, persona_mix, model_spec, seed, visibility }
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
  -- Frozen copy of experiment.config at run start — the reproducibility
  -- anchor. Never mutate after run creation.
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

create type public.agent_role as enum ('researcher', 'proposer', 'responder');

create table if not exists public.agent_instances (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references public.runs(id) on delete cascade,
  role public.agent_role not null,
  persona text not null,
  wallet_address text not null,
  -- Ciphertext of the ephemeral private key; decrypted only in the worker.
  wallet_key_ciphertext bytea,
  erc8004_agent_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists agent_instances_run_idx on public.agent_instances(run_id);

-- =============================================================
-- ROUNDS + MESSAGES (hot path)
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

-- `messages` is the hottest table. Kept wide so the arena view can render
-- turn-by-turn without joins. Realtime is enabled on this table so the
-- Next.js SSE handler can stream inserts to the browser.
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

-- =============================================================
-- REPUTATION + BYO KEYS + EXPORTS
-- =============================================================

create type public.reputation_status as enum ('pending', 'confirmed', 'failed');

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

create type public.provider as enum ('anthropic', 'openai', 'google', 'custom');

create table if not exists public.byo_keys (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete set null,
  provider public.provider not null,
  label text not null,
  -- Ciphertext only. Plaintext never lands in this table.
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
-- RLS
-- =============================================================

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.experiments enable row level security;
alter table public.runs enable row level security;
alter table public.agent_instances enable row level security;
alter table public.rounds enable row level security;
alter table public.messages enable row level security;
alter table public.reputation_events enable row level security;
alter table public.byo_keys enable row level security;
alter table public.exports enable row level security;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.org_members
    where org_id = target_org and user_id = auth.uid()
  );
$$;

-- orgs: members can see their own orgs.
create policy orgs_select on public.orgs
  for select using (public.is_org_member(id));

-- org_members: members can see co-members.
create policy org_members_select on public.org_members
  for select using (public.is_org_member(org_id));

-- experiments: members can read/write within their org.
create policy experiments_all on public.experiments
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- runs: tenant access for members + an anon escape hatch for public slugs.
create policy runs_tenant_all on public.runs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy runs_public_read on public.runs
  for select
  to anon, authenticated
  using (visibility in ('public', 'unlisted'));

-- Child tables follow the parent-run's visibility.
create policy agent_instances_read on public.agent_instances
  for select using (
    exists (
      select 1 from public.runs r
      where r.id = run_id
        and (public.is_org_member(r.org_id) or r.visibility in ('public', 'unlisted'))
    )
  );
create policy agent_instances_write on public.agent_instances
  for all using (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  ) with check (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  );

create policy rounds_read on public.rounds
  for select using (
    exists (
      select 1 from public.runs r
      where r.id = run_id
        and (public.is_org_member(r.org_id) or r.visibility in ('public', 'unlisted'))
    )
  );
create policy rounds_write on public.rounds
  for all using (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  ) with check (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  );

create policy messages_read on public.messages
  for select using (
    exists (
      select 1 from public.runs r
      where r.id = run_id
        and (public.is_org_member(r.org_id) or r.visibility in ('public', 'unlisted'))
    )
  );
create policy messages_write on public.messages
  for all using (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  ) with check (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  );

create policy reputation_events_read on public.reputation_events
  for select using (
    exists (
      select 1 from public.runs r
      where r.id = run_id
        and (public.is_org_member(r.org_id) or r.visibility in ('public', 'unlisted'))
    )
  );
create policy reputation_events_write on public.reputation_events
  for all using (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  ) with check (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  );

-- byo_keys: tenant-only; anon never sees ciphertext.
create policy byo_keys_tenant on public.byo_keys
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy exports_read on public.exports
  for select using (
    exists (
      select 1 from public.runs r
      where r.id = run_id
        and (public.is_org_member(r.org_id) or r.visibility in ('public', 'unlisted'))
    )
  );
create policy exports_write on public.exports
  for all using (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  ) with check (
    exists (select 1 from public.runs r where r.id = run_id and public.is_org_member(r.org_id))
  );

-- =============================================================
-- REALTIME (Supabase)
-- =============================================================

-- Publication `supabase_realtime` is created by Supabase on project init.
-- We add `messages` so the Arena view can stream live turns. Reputation
-- events are useful too — surfaces confirmed-on-chain transitions.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reputation_events;
alter publication supabase_realtime add table public.runs;
