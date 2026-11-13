begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

create or replace function pg_temp.make_user(p_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    ''
  );
  return v_id;
end;
$$;

select pg_temp.make_user('owner@rls.test') as owner_id \gset
select pg_temp.make_user('intruder@rls.test') as intruder_id \gset

insert into public.platform_admins (user_id) values (:'owner_id');

select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'owner_id', 'role', 'authenticated', 'email', 'owner@rls.test')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.create_company(
      'Alpha Appliances',
      'alpha-rls',
      'America/Chicago',
      'invite',
      '[{"name":"Warehouse","type":"warehouse"},{"name":"Store","type":"retail"}]'::jsonb,
      'alpha-manager@rls.test',
      'alpha_mgr',
      'manager'
    )
  $$,
  'platform owner can create a company'
);

select lives_ok(
  $$
    select public.create_company(
      'Beta Appliances',
      'beta-rls',
      'America/Chicago',
      'invite',
      '[{"name":"Beta Warehouse","type":"warehouse"}]'::jsonb,
      'beta-manager@rls.test',
      'beta_mgr',
      'manager'
    )
  $$,
  'platform owner can create a second company'
);

select ok(
  (
    select
      (permissions ->> 'editLayout')::boolean
      and (permissions ->> 'manageUsers')::boolean
      and (permissions ->> 'manageLocations')::boolean
      and not (permissions ->> 'viewAudit')::boolean
      and not (permissions ->> 'deleteLocations')::boolean
    from public.roles
    where company_id = (select id from public.companies where slug = 'alpha-rls')
      and key = 'manager'
  ),
  'new companies give managers layout, users, and locations, not audit'
);

select ok(
  (
    select not notifications_enabled
    from public.company_settings
    where company_id = (select id from public.companies where slug = 'alpha-rls')
  ),
  'notification master switch starts off'
);

reset role;

select id as alpha_id from public.companies where slug = 'alpha-rls' \gset

insert into public.items (company_id, serial, model, price)
select id, 'SER-100', 'Fridge', 499.00
from public.companies where slug = 'alpha-rls';

insert into public.company_members (company_id, user_id, role_id, status, username)
select c.id, :'intruder_id'::uuid, r.id, 'active', 'intruder'
from public.companies c
join public.roles r on r.company_id = c.id and r.key = 'sales'
where c.slug = 'beta-rls';

select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'intruder_id', 'role', 'authenticated', 'email', 'intruder@rls.test')::text,
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from public.items),
  0,
  'a member of beta cannot read alpha items'
);

select is(
  (select count(*)::integer from public.stores where company_id = (select id from public.companies where slug = 'alpha-rls')),
  0,
  'a member of beta cannot read alpha sites'
);

select throws_ok(
  format(
    'insert into public.items (company_id, serial) values (%L, %L)',
    :'alpha_id',
    'STOLEN'
  ),
  '42501',
  'new row violates row-level security policy for table "items"',
  'beta cannot insert an item into alpha'
);

select throws_ok(
  $$ select public.create_company('Nope', 'nope-rls', 'America/Chicago', 'invite', '[{"name":"X","type":"warehouse"}]'::jsonb, 'x@rls.test', 'nope_user', 'manager') $$,
  '42501',
  'Only a platform owner can create a company',
  'a staff member cannot create a company'
);

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.companies $$,
  '42501',
  null,
  'anonymous clients cannot read companies'
);

select * from finish();
rollback;
