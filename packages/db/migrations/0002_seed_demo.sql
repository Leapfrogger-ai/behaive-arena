-- Seed data for local / staging development.
--
-- Creates a `demo` org + one researcher user + one Ultimatum-game experiment.
-- The fake-runner (apps/worker/src/fake-runner.ts) uses this seed to
-- create new runs without requiring any UI wiring.
--
-- Safe to re-run: every insert is idempotent via ON CONFLICT DO NOTHING.

insert into public.orgs (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'demo', 'Demo Lab')
on conflict (slug) do nothing;

-- The experiment below references a created_by user. On Supabase, you must
-- first create a user (Auth → Users → Add user) and replace the UUID below
-- with that auth.users.id, OR run this seed after at least one user exists
-- and update the UUID manually.
--
-- For local dev the constraint can be temporarily disabled, or you can use
-- the service-role worker to insert via the REST API once a real user signs
-- up. This SQL intentionally leaves the FK strict so staging stays honest.

do $$
declare
  any_user uuid;
begin
  select id into any_user from auth.users limit 1;
  if any_user is null then
    raise notice 'No auth.users rows yet — skip experiment seed. Sign up a user and re-run.';
    return;
  end if;

  insert into public.org_members (org_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', any_user, 'owner')
  on conflict do nothing;

  insert into public.experiments (id, org_id, created_by, name, description, config)
  values (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    any_user,
    'Ultimatum Game — demo',
    'Canonical 3-round Ultimatum Game with fair proposer persona.',
    jsonb_build_object(
      'rounds', 3,
      'endowment', 10,
      'persona_mix', jsonb_build_object('proposer', 'fair', 'responder', 'rational'),
      'model_spec', 'claude-sonnet-4-6',
      'seed', 42,
      'visibility', 'public'
    )
  )
  on conflict (id) do nothing;
end
$$;
