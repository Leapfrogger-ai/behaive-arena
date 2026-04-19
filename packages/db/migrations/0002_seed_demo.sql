-- Seed data for local / staging development.
--
-- Creates:
--   * one demo user (id below — used by the fake-runner and CLI scripts)
--   * one demo org with that user as owner
--   * one Ultimatum-game experiment under the org
--
-- Safe to re-run — every insert is idempotent.

insert into public.users (id, email, display_name)
values ('00000000-0000-0000-0000-000000000010', 'demo@behaive.local', 'Demo Researcher')
on conflict (id) do nothing;

insert into public.orgs (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'demo', 'Demo Lab')
on conflict (slug) do nothing;

insert into public.org_members (org_id, user_id, role)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'owner'
)
on conflict do nothing;

insert into public.experiments (id, org_id, created_by, name, description, config)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Ultimatum Game — demo',
  'Canonical 3-round Ultimatum Game with fair proposer + rational responder.',
  jsonb_build_object(
    'rounds', 3,
    'endowment', 10,
    'persona_mix', jsonb_build_object('proposer', 'fair', 'responder', 'rational'),
    'model_spec', 'mock-deterministic',
    'seed', 42,
    'visibility', 'public'
  )
)
on conflict (id) do nothing;
