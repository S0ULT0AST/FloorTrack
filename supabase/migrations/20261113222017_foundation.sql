-- FloorTrack phase 1: multi-tenant foundation.
-- Companies are walled off by row-level security. Writes go through
-- private security-definer functions that check the caller. The public
-- wrappers are security invoker so PostgREST can expose them without
-- putting definer functions in an API schema.
--
-- Sale and transfer notification email stays off: notifications_enabled
-- defaults to false and nothing in this migration inserts into the outbox.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.permission_set(p_enabled text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_object_agg(perm, perm = any (p_enabled))
  from unnest(array[
    'viewInventory', 'addItems', 'editItems', 'moveItems', 'markSold',
    'viewSoldList', 'markVerified', 'addNotes', 'overrideLocks',
    'initiateTransfer', 'verifyTransfer', 'viewTransferHistory', 'viewMap',
    'editLayout', 'viewLogs', 'manageUsers', 'manageRoles', 'viewAudit',
    'viewLocations', 'manageLocations', 'deleteLocations'
  ]::text[]) as perm;
$$;

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  theme text not null default 'dark' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  timezone text not null default 'America/Chicago',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  account_access_mode text not null check (
    account_access_mode in ('invite', 'self_signup_with_approval')
  ),
  notifications_enabled boolean not null default false,
  notification_toggles jsonb not null default '{}'::jsonb,
  map_colors jsonb not null default '{}'::jsonb,
  appliance_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  type text not null check (type in ('warehouse', 'retail')),
  timezone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.floor_layouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  canvas_rows integer not null default 8 check (canvas_rows > 0),
  canvas_cols integer not null default 8 check (canvas_cols > 0),
  cell_w integer not null default 64 check (cell_w > 0),
  cell_h integer not null default 64 check (cell_h > 0),
  canvas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  key text not null,
  name text not null,
  color text not null,
  locked boolean not null default false,
  permissions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, key)
);

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  key text not null,
  name text not null,
  color text not null,
  locked boolean not null default false,
  show_item boolean not null default true,
  show_transfer boolean not null default false,
  show_filter boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, key)
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  status text not null check (status in ('pending', 'active', 'disabled')),
  username text not null,
  invited_by uuid references auth.users (id),
  primary_store_id uuid references public.stores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id),
  constraint company_members_profile_fkey foreign key (user_id) references public.profiles (user_id) on delete cascade
);

create unique index company_members_username_active_idx
  on public.company_members (company_id, username)
  where status <> 'disabled';

create index company_members_user_idx on public.company_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  role_id uuid not null references public.roles (id),
  username text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references auth.users (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index invites_one_pending_email_idx
  on public.invites (company_id, email)
  where status = 'pending';

create table public.invite_secrets (
  invite_id uuid primary key references public.invites (id) on delete cascade,
  token_hash text not null
);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint join_requests_profile_fkey foreign key (user_id) references public.profiles (user_id) on delete cascade
);

create unique index join_requests_one_pending_idx
  on public.join_requests (company_id, user_id)
  where status = 'pending';

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  content_type text,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.column_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  mapping jsonb not null,
  sample_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_uploads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  storage_path text,
  mapping_id uuid references public.column_mappings (id) on delete set null,
  status text not null default 'pending_review' check (status in ('pending_review', 'applied', 'rejected')),
  uploaded_by uuid references auth.users (id),
  reviewed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  current_store_id uuid references public.stores (id) on delete set null,
  serial text not null check (length(btrim(serial)) > 0),
  model text,
  appliance_type text,
  condition_notes text,
  price numeric(12, 2) check (price is null or price >= 0),
  web_link text,
  location_code text,
  layout_id uuid references public.floor_layouts (id) on delete set null,
  sold boolean not null default false,
  sold_at timestamptz,
  sold_by uuid references auth.users (id),
  sale_type text,
  customer_pickup boolean not null default false,
  customer_inspection boolean not null default false,
  needs_repair boolean not null default false,
  flagged_for_repair_at timestamptz,
  needs_location boolean not null default false,
  floor_removed boolean not null default false,
  picked_up_at timestamptz,
  locked_by uuid references auth.users (id),
  invoice_id uuid references public.invoices (id) on delete set null,
  last_verified timestamptz,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users (id),
  source_upload_id uuid references public.inventory_uploads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A sold serial may be reused. Two unsold rows in one company may not.
create unique index items_active_serial_idx
  on public.items (company_id, lower(serial))
  where sold = false;

create index items_company_idx on public.items (company_id);
create index items_store_idx on public.items (current_store_id);

create table public.item_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  author_id uuid references auth.users (id),
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index item_notes_item_idx on public.item_notes (item_id);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  from_store_id uuid references public.stores (id) on delete set null,
  to_store_id uuid references public.stores (id) on delete set null,
  from_location text,
  reason text not null,
  notes text,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  initiated_by uuid references auth.users (id),
  initiated_at timestamptz not null default now(),
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  batch_id uuid,
  invoice_id uuid references public.invoices (id) on delete set null
);

create index transfers_company_status_idx on public.transfers (company_id, status);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('wh_to_store', 'store_to_wh', 'sell')),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transfers
  add constraint transfers_batch_fkey foreign key (batch_id) references public.batches (id) on delete set null;

create table public.batch_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  serial text,
  reason text,
  sale_type text,
  invoice_id uuid references public.invoices (id) on delete set null,
  position integer not null default 0
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id),
  action text not null,
  detail text,
  item_id uuid,
  created_at timestamptz not null default now()
);

create index audit_log_company_created_idx on public.audit_log (company_id, created_at desc);

create table public.inventory_upload_rows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  upload_id uuid not null references public.inventory_uploads (id) on delete cascade,
  change_type text not null check (change_type in ('added', 'changed', 'missing')),
  before_payload jsonb,
  after_payload jsonb,
  accepted boolean,
  created_at timestamptz not null default now()
);

create table public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'held' check (status in ('held', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

create index stores_company_idx on public.stores (company_id);
create index roles_company_idx on public.roles (company_id);
create index floor_layouts_store_idx on public.floor_layouts (store_id);
create index invites_company_idx on public.invites (company_id);
create index join_requests_company_idx on public.join_requests (company_id);

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger companies_touch before update on public.companies
  for each row execute function private.touch_updated_at();
create trigger company_settings_touch before update on public.company_settings
  for each row execute function private.touch_updated_at();
create trigger stores_touch before update on public.stores
  for each row execute function private.touch_updated_at();
create trigger floor_layouts_touch before update on public.floor_layouts
  for each row execute function private.touch_updated_at();
create trigger roles_touch before update on public.roles
  for each row execute function private.touch_updated_at();
create trigger statuses_touch before update on public.statuses
  for each row execute function private.touch_updated_at();
create trigger company_members_touch before update on public.company_members
  for each row execute function private.touch_updated_at();
create trigger items_touch before update on public.items
  for each row execute function private.touch_updated_at();
create trigger batches_touch before update on public.batches
  for each row execute function private.touch_updated_at();
create trigger column_mappings_touch before update on public.column_mappings
  for each row execute function private.touch_updated_at();
create trigger inventory_uploads_touch before update on public.inventory_uploads
  for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function private.handle_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = lower(coalesce(new.email, ''))
  where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email
  after update of email on auth.users
  for each row execute function private.handle_user_email();

-- Authorization helpers. Security definer so policies do not recurse.

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins p
    where p.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_any_membership(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.shares_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
      and m.status in ('active', 'pending')
  );
$$;

create or replace function private.can_read_operations(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
      and m.status in ('active', 'pending')
      and c.status = 'active'
  );
$$;

create or replace function private.has_perm(p_company_id uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    join public.roles r on r.id = m.role_id
    join public.companies c on c.id = m.company_id
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and c.status = 'active'
      and coalesce((r.permissions ->> p_perm)::boolean, false)
  );
$$;

create or replace function private.can_manage_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members me
    join public.company_members them on them.company_id = me.company_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and them.user_id = p_user_id
      and private.has_perm(me.company_id, 'manageUsers')
  );
$$;

create or replace function private.require_uid()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

create or replace function private.assert_known_timezone(p_timezone text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown timezone %', p_timezone using errcode = '22023';
  end if;
end;
$$;

create or replace function private.normalize_username(p_username text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_username text := lower(btrim(p_username));
begin
  if v_username !~ '^[a-z][a-z0-9_]{2,31}$' then
    raise exception 'Username must be 3–32 characters, start with a letter, and use only letters, numbers, or underscores'
      using errcode = '22023';
  end if;
  return v_username;
end;
$$;

create or replace function private.normalize_email(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  return v_email;
end;
$$;

create or replace function private.caller_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = (select auth.uid());
$$;

create or replace function private.assert_company_access(p_company_id uuid, p_perm text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if private.is_platform_admin() or private.has_perm(p_company_id, p_perm) then
    return v_uid;
  end if;
  raise exception 'You do not have permission to do that' using errcode = '42501';
end;
$$;

create or replace function private.role_is_admin(p_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.roles r where r.id = p_role_id and r.key = 'admin');
$$;

create or replace function private.caller_is_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin() or exists (
    select 1
    from public.company_members m
    join public.roles r on r.id = m.role_id
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and r.key = 'admin'
  );
$$;

create or replace function private.assert_can_assign_role(p_company_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.roles r where r.id = p_role_id and r.company_id = p_company_id) then
    raise exception 'That role is not part of this company' using errcode = '22023';
  end if;
  if private.role_is_admin(p_role_id) and not private.caller_is_company_admin(p_company_id) then
    raise exception 'Only a company admin can assign the Admin role' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.username_taken(
  p_company_id uuid,
  p_username text,
  p_except_user uuid default null,
  p_except_invite uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id
      and m.username = p_username
      and m.status <> 'disabled'
      and (p_except_user is null or m.user_id <> p_except_user)
  ) or exists (
    select 1 from public.invites i
    where i.company_id = p_company_id
      and i.username = p_username
      and i.status = 'pending'
      and (p_except_invite is null or i.id <> p_except_invite)
  );
$$;

create or replace function private.write_audit(p_company_id uuid, p_action text, p_detail text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (company_id, user_id, action, detail)
  values (p_company_id, auth.uid(), p_action, p_detail);
$$;

create or replace function private.store_invite_token(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash text := encode(extensions.digest(v_token, 'sha256'), 'hex');
begin
  insert into public.invite_secrets (invite_id, token_hash)
  values (p_invite_id, v_hash)
  on conflict (invite_id) do update set token_hash = excluded.token_hash;
  return v_token;
end;
$$;

create or replace function private.seed_company_defaults(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_all text[] := array[
    'viewInventory', 'addItems', 'editItems', 'moveItems', 'markSold',
    'viewSoldList', 'markVerified', 'addNotes', 'overrideLocks',
    'initiateTransfer', 'verifyTransfer', 'viewTransferHistory', 'viewMap',
    'editLayout', 'viewLogs', 'manageUsers', 'manageRoles', 'viewAudit',
    'viewLocations', 'manageLocations', 'deleteLocations'
  ];
begin
  insert into public.roles (company_id, key, name, color, locked, permissions)
  values
    (p_company_id, 'admin', 'Admin', '#f0a202', true, private.permission_set(v_all)),
    (p_company_id, 'manager', 'Manager', '#5b8def', true, private.permission_set(array[
      'viewInventory', 'addItems', 'editItems', 'moveItems', 'markSold',
      'viewSoldList', 'markVerified', 'addNotes', 'overrideLocks',
      'initiateTransfer', 'verifyTransfer', 'viewTransferHistory', 'viewMap',
      'editLayout', 'viewLogs', 'manageUsers', 'viewLocations', 'manageLocations'
    ])),
    (p_company_id, 'warehouse', 'Warehouse', '#3dbe7a', true, private.permission_set(array[
      'viewInventory', 'addItems', 'moveItems', 'markVerified', 'addNotes',
      'verifyTransfer', 'viewTransferHistory', 'viewMap', 'viewLocations'
    ])),
    (p_company_id, 'sales', 'Sales', '#c084fc', true, private.permission_set(array[
      'viewInventory', 'addNotes', 'viewTransferHistory', 'viewMap', 'viewLocations'
    ])),
    (p_company_id, 'guest', 'Guest', '#8b939c', true, private.permission_set(array[
      'viewInventory', 'viewMap', 'viewLocations'
    ]));

  insert into public.statuses (company_id, key, name, color, locked, show_item, show_transfer, show_filter)
  values
    (p_company_id, 'in_stock', 'In Stock', '#e8eaed', true, true, false, true),
    (p_company_id, 'sold', 'Sold', '#e85d4c', true, true, false, true),
    (p_company_id, 'store_stock', 'Store Stock', '#3dbe7a', true, true, false, true),
    (p_company_id, 'customer_pickup', 'Customer Pickup', '#f0a202', true, true, true, true),
    (p_company_id, 'store_return', 'Store Return', '#5b8def', true, true, true, true);
end;
$$;

create or replace function private.create_company(
  p_name text,
  p_slug text,
  p_timezone text,
  p_mode text,
  p_sites jsonb,
  p_manager_email text,
  p_manager_username text,
  p_manager_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_company uuid;
  v_name text := btrim(p_name);
  v_slug text := lower(btrim(p_slug));
  v_email text;
  v_username text;
  v_role_id uuid;
  v_invite uuid;
  v_token text;
  v_site jsonb;
  v_site_name text;
  v_site_type text;
  v_site_tz text;
  v_count integer := 0;
begin
  if not private.is_platform_admin() then
    raise exception 'Only a platform owner can create a company' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Company name must be 2–120 characters' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) < 2 or char_length(v_slug) > 48 then
    raise exception 'Slug must be 2–48 characters: lowercase letters, numbers, and hyphens' using errcode = '22023';
  end if;
  if exists (select 1 from public.companies where slug = v_slug) then
    raise exception 'That company slug is already in use' using errcode = '23505';
  end if;
  perform private.assert_known_timezone(p_timezone);
  if p_mode not in ('invite', 'self_signup_with_approval') then
    raise exception 'Account access must be invite or self sign-up with approval' using errcode = '22023';
  end if;
  if p_manager_role not in ('admin', 'manager') then
    raise exception 'The first account must be an admin or a manager' using errcode = '22023';
  end if;
  if jsonb_typeof(p_sites) <> 'array' or jsonb_array_length(p_sites) < 1 then
    raise exception 'Add at least one site' using errcode = '22023';
  end if;
  v_email := private.normalize_email(p_manager_email);
  v_username := private.normalize_username(p_manager_username);

  insert into public.companies (name, slug, timezone, created_by)
  values (v_name, v_slug, p_timezone, v_uid)
  returning id into v_company;

  insert into public.company_settings (
    company_id, account_access_mode, notifications_enabled, notification_toggles, map_colors, appliance_types
  ) values (
    v_company,
    p_mode,
    false,
    jsonb_build_object(
      'new_user', false,
      'first_login', false,
      'password_reset', false,
      'role_change', false,
      'user_deleted', false,
      'layout_edited', false,
      'bulk_modify', false,
      'sale', false,
      'transfer', false
    ),
    jsonb_build_object(
      'empty', '#2a3340',
      'occupied', '#f0a202',
      'multi', '#e07a3d',
      'transfer', '#7c6af7',
      'sold', '#e85d4c',
      'stale', '#c9a227',
      'space', '#1a1f26',
      'aisle', '#14181d'
    ),
    array[
      'Refrigerator', 'Washer', 'Dryer', 'Dishwasher', 'Range / Stove',
      'Microwave', 'Freezer', 'Wall Oven', 'Accessories', 'Cooktop',
      'Ventilation', 'Laundry Center', 'Other'
    ]
  );

  for v_site in select value from jsonb_array_elements(p_sites) loop
    v_count := v_count + 1;
    if v_count > 20 then
      raise exception 'A company can start with at most 20 sites' using errcode = '22023';
    end if;
    v_site_name := btrim(v_site ->> 'name');
    v_site_type := v_site ->> 'type';
    v_site_tz := nullif(btrim(v_site ->> 'timezone'), '');
    if v_site_name is null or char_length(v_site_name) < 1 or char_length(v_site_name) > 80 then
      raise exception 'Each site needs a name' using errcode = '22023';
    end if;
    if v_site_type not in ('warehouse', 'retail') then
      raise exception 'Site type must be warehouse or retail' using errcode = '22023';
    end if;
    if v_site_tz is not null then
      perform private.assert_known_timezone(v_site_tz);
    end if;
    insert into public.stores (company_id, name, type, timezone)
    values (v_company, v_site_name, v_site_type, v_site_tz);
  end loop;

  perform private.seed_company_defaults(v_company);

  select id into v_role_id
  from public.roles
  where company_id = v_company and key = p_manager_role;

  insert into public.invites (company_id, email, role_id, username, invited_by, expires_at)
  values (v_company, v_email, v_role_id, v_username, v_uid, now() + interval '14 days')
  returning id into v_invite;

  v_token := private.store_invite_token(v_invite);
  perform private.write_audit(v_company, 'company_created', v_name);

  return jsonb_build_object(
    'company_id', v_company,
    'invite_id', v_invite,
    'invite_token', v_token
  );
end;
$$;

create or replace function private.create_invite(
  p_company_id uuid,
  p_email text,
  p_role_key text,
  p_username text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_mode text;
  v_email text;
  v_username text;
  v_role_id uuid;
  v_invite uuid;
  v_token text;
begin
  v_uid := private.assert_company_access(p_company_id, 'manageUsers');
  select account_access_mode into v_mode
  from public.company_settings where company_id = p_company_id;
  if v_mode is distinct from 'invite' then
    raise exception 'This company approves sign-ups instead of sending invites' using errcode = '22023';
  end if;
  if not exists (select 1 from public.companies c where c.id = p_company_id and c.status = 'active') then
    raise exception 'This company is not active' using errcode = '42501';
  end if;
  v_email := private.normalize_email(p_email);
  v_username := private.normalize_username(p_username);
  select id into v_role_id from public.roles where company_id = p_company_id and key = p_role_key;
  if v_role_id is null then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  perform private.assert_can_assign_role(p_company_id, v_role_id);
  if private.username_taken(p_company_id, v_username) then
    raise exception 'That username is already in use at this company' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.invites i
    where i.company_id = p_company_id and i.email = v_email and i.status = 'pending'
  ) then
    raise exception 'There is already a pending invite for that email' using errcode = '23505';
  end if;

  insert into public.invites (company_id, email, role_id, username, invited_by, expires_at)
  values (p_company_id, v_email, v_role_id, v_username, v_uid, now() + interval '14 days')
  returning id into v_invite;
  v_token := private.store_invite_token(v_invite);
  perform private.write_audit(p_company_id, 'invite_created', v_email);
  return jsonb_build_object('invite_id', v_invite, 'invite_token', v_token);
end;
$$;

create or replace function private.reissue_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_token text;
begin
  select company_id into v_company from public.invites where id = p_invite_id and status = 'pending';
  if v_company is null then
    raise exception 'That invite is not pending' using errcode = '22023';
  end if;
  perform private.assert_company_access(v_company, 'manageUsers');
  update public.invites set expires_at = now() + interval '14 days' where id = p_invite_id;
  v_token := private.store_invite_token(p_invite_id);
  return jsonb_build_object('invite_id', p_invite_id, 'invite_token', v_token);
end;
$$;

create or replace function private.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_email text;
begin
  select company_id, email into v_company, v_email
  from public.invites where id = p_invite_id and status = 'pending';
  if v_company is null then
    raise exception 'That invite is not pending' using errcode = '22023';
  end if;
  perform private.assert_company_access(v_company, 'manageUsers');
  update public.invites set status = 'revoked' where id = p_invite_id;
  delete from public.invite_secrets where invite_id = p_invite_id;
  perform private.write_audit(v_company, 'invite_revoked', v_email);
end;
$$;

create or replace function private.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_email text := private.caller_email();
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_invite public.invites%rowtype;
  v_member uuid;
begin
  select i.* into v_invite
  from public.invites i
  join public.invite_secrets s on s.invite_id = i.id
  where s.token_hash = v_hash
    and i.status = 'pending'
    and i.expires_at > now();
  if v_invite.id is null then
    raise exception 'This invite link is invalid or expired' using errcode = '22023';
  end if;
  if v_email is distinct from v_invite.email then
    raise exception 'Sign in with the invited email address' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.company_members m
    where m.company_id = v_invite.company_id and m.user_id = v_uid and m.status = 'active'
  ) then
    raise exception 'You are already a member of this company' using errcode = '23505';
  end if;
  if private.username_taken(v_invite.company_id, v_invite.username, v_uid, v_invite.id) then
    raise exception 'That username was taken before the invite was accepted. Ask a manager to send a new one.'
      using errcode = '23505';
  end if;

  insert into public.company_members (company_id, user_id, role_id, status, username, invited_by)
  values (v_invite.company_id, v_uid, v_invite.role_id, 'active', v_invite.username, v_invite.invited_by)
  on conflict (company_id, user_id) do update
    set role_id = excluded.role_id,
        status = 'active',
        username = excluded.username,
        invited_by = excluded.invited_by
  returning id into v_member;

  update public.invites
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;
  delete from public.invite_secrets where invite_id = v_invite.id;

  update public.join_requests
  set status = 'approved', reviewed_by = v_uid, reviewed_at = now()
  where company_id = v_invite.company_id and user_id = v_uid and status = 'pending';

  perform private.write_audit(v_invite.company_id, 'invite_accepted', v_invite.email);
  return v_member;
end;
$$;

create or replace function private.request_to_join(p_slug text, p_username text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_company uuid;
  v_mode text;
  v_status text;
  v_username text := private.normalize_username(p_username);
  v_guest uuid;
  v_request uuid;
begin
  select c.id, c.status, s.account_access_mode
    into v_company, v_status, v_mode
  from public.companies c
  join public.company_settings s on s.company_id = c.id
  where c.slug = lower(btrim(p_slug));
  if v_company is null then
    raise exception 'No company uses that link' using errcode = '22023';
  end if;
  if v_status <> 'active' then
    raise exception 'This company is not accepting people right now' using errcode = '42501';
  end if;
  if v_mode is distinct from 'self_signup_with_approval' then
    raise exception 'This company invites people by email. Ask a manager for a link.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.company_members m
    where m.company_id = v_company and m.user_id = v_uid and m.status = 'disabled'
  ) then
    raise exception 'Your access to this company is disabled. Ask a manager if that should change.'
      using errcode = '42501';
  end if;
  if exists (
    select 1 from public.company_members m
    where m.company_id = v_company and m.user_id = v_uid and m.status in ('active', 'pending')
  ) then
    raise exception 'You already belong to this company' using errcode = '23505';
  end if;
  if private.username_taken(v_company, v_username, v_uid) then
    raise exception 'That username is already in use at this company' using errcode = '23505';
  end if;
  select id into v_guest from public.roles where company_id = v_company and key = 'guest';

  insert into public.company_members (company_id, user_id, role_id, status, username)
  values (v_company, v_uid, v_guest, 'pending', v_username);

  insert into public.join_requests (company_id, user_id)
  values (v_company, v_uid)
  returning id into v_request;

  perform private.write_audit(v_company, 'join_requested', v_username);
  return v_request;
end;
$$;

create or replace function private.review_join_request(
  p_request_id uuid,
  p_decision text,
  p_role_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_user uuid;
  v_role uuid;
begin
  select company_id, user_id into v_company, v_user
  from public.join_requests
  where id = p_request_id and status = 'pending';
  if v_company is null then
    raise exception 'That request is not pending' using errcode = '22023';
  end if;
  perform private.assert_company_access(v_company, 'manageUsers');
  if p_decision = 'deny' then
    update public.join_requests
    set status = 'denied', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
    update public.company_members
    set status = 'disabled'
    where company_id = v_company and user_id = v_user;
    perform private.write_audit(v_company, 'join_denied', v_user::text);
    return;
  end if;
  if p_decision <> 'approve' then
    raise exception 'Decision must be approve or deny' using errcode = '22023';
  end if;
  if p_role_key in ('guest') or p_role_key is null then
    raise exception 'Choose a role before approving' using errcode = '22023';
  end if;
  select id into v_role from public.roles where company_id = v_company and key = p_role_key;
  if v_role is null then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  perform private.assert_can_assign_role(v_company, v_role);
  update public.join_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;
  update public.company_members
  set status = 'active', role_id = v_role
  where company_id = v_company and user_id = v_user;
  perform private.write_audit(v_company, 'join_approved', p_role_key);
end;
$$;

create or replace function private.set_member_role(p_membership_id uuid, p_role_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_user uuid;
  v_old uuid;
  v_new uuid;
  v_admins integer;
begin
  select company_id, user_id, role_id into v_company, v_user, v_old
  from public.company_members where id = p_membership_id and status = 'active';
  if v_company is null then
    raise exception 'That person is not an active member' using errcode = '22023';
  end if;
  perform private.assert_company_access(v_company, 'manageUsers');
  select id into v_new from public.roles where company_id = v_company and key = p_role_key;
  if v_new is null or p_role_key = 'guest' then
    raise exception 'Choose a staff role' using errcode = '22023';
  end if;
  perform private.assert_can_assign_role(v_company, v_new);
  if private.role_is_admin(v_old) and not private.role_is_admin(v_new) then
    select count(*) into v_admins
    from public.company_members m
    join public.roles r on r.id = m.role_id
    where m.company_id = v_company and m.status = 'active' and r.key = 'admin';
    if v_admins <= 1 and not private.is_platform_admin() then
      raise exception 'The company needs at least one active admin' using errcode = '42501';
    end if;
  end if;
  update public.company_members set role_id = v_new where id = p_membership_id;
  perform private.write_audit(v_company, 'role_changed', p_role_key);
end;
$$;

create or replace function private.set_member_status(p_membership_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_user uuid;
  v_role uuid;
  v_managers integer;
begin
  if p_status not in ('active', 'disabled') then
    raise exception 'Status must be active or disabled' using errcode = '22023';
  end if;
  select company_id, user_id, role_id into v_company, v_user, v_role
  from public.company_members where id = p_membership_id;
  if v_company is null then
    raise exception 'Unknown membership' using errcode = '22023';
  end if;
  perform private.assert_company_access(v_company, 'manageUsers');
  if v_user = auth.uid() and p_status = 'disabled' then
    raise exception 'You cannot disable your own access' using errcode = '42501';
  end if;
  if p_status = 'active' and private.role_is_admin(v_role) = false and exists (
    select 1 from public.roles r where r.id = v_role and r.key = 'guest'
  ) then
    raise exception 'Assign a role before enabling this person' using errcode = '22023';
  end if;
  if p_status = 'disabled' then
    select count(*) into v_managers
    from public.company_members m
    join public.roles r on r.id = m.role_id
    where m.company_id = v_company
      and m.status = 'active'
      and m.id <> p_membership_id
      and coalesce((r.permissions ->> 'manageUsers')::boolean, false);
    if v_managers < 1 and not private.is_platform_admin() then
      raise exception 'Someone at the company still needs to be able to manage users' using errcode = '42501';
    end if;
  end if;
  update public.company_members set status = p_status where id = p_membership_id;
  perform private.write_audit(v_company, case when p_status = 'disabled' then 'member_disabled' else 'member_enabled' end, v_user::text);
end;
$$;

create or replace function private.set_my_username(p_company_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_username text := private.normalize_username(p_username);
begin
  if not private.shares_company(p_company_id) then
    raise exception 'You are not a member of this company' using errcode = '42501';
  end if;
  if private.username_taken(p_company_id, v_username, v_uid) then
    raise exception 'That username is already in use at this company' using errcode = '23505';
  end if;
  update public.company_members
  set username = v_username
  where company_id = p_company_id and user_id = v_uid and status <> 'disabled';
end;
$$;

create or replace function private.set_home_store(p_company_id uuid, p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if not private.shares_company(p_company_id) then
    raise exception 'You are not a member of this company' using errcode = '42501';
  end if;
  if p_store_id is not null and not exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.company_id = p_company_id and s.active
  ) then
    raise exception 'Pick an active site in this company' using errcode = '22023';
  end if;
  update public.company_members
  set primary_store_id = p_store_id
  where company_id = p_company_id and user_id = v_uid;
end;
$$;

create or replace function private.set_my_theme(p_theme text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_uid();
  if p_theme not in ('light', 'dark') then
    raise exception 'Theme must be light or dark' using errcode = '22023';
  end if;
  update public.profiles set theme = p_theme where user_id = auth.uid();
end;
$$;

create or replace function private.update_company_settings(
  p_company_id uuid,
  p_name text,
  p_timezone text,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
begin
  perform private.assert_company_access(p_company_id, 'manageUsers');
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Company name must be 2–120 characters' using errcode = '22023';
  end if;
  perform private.assert_known_timezone(p_timezone);
  if p_mode not in ('invite', 'self_signup_with_approval') then
    raise exception 'Account access must be invite or self sign-up with approval' using errcode = '22023';
  end if;
  update public.companies set name = v_name, timezone = p_timezone where id = p_company_id;
  update public.company_settings set account_access_mode = p_mode where company_id = p_company_id;
  perform private.write_audit(p_company_id, 'settings_updated', p_mode);
end;
$$;

create or replace function private.create_site(
  p_company_id uuid,
  p_name text,
  p_type text,
  p_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_tz text := nullif(btrim(p_timezone), '');
  v_id uuid;
begin
  perform private.assert_company_access(p_company_id, 'manageLocations');
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Site name must be 1–80 characters' using errcode = '22023';
  end if;
  if p_type not in ('warehouse', 'retail') then
    raise exception 'Site type must be warehouse or retail' using errcode = '22023';
  end if;
  if v_tz is not null then
    perform private.assert_known_timezone(v_tz);
  end if;
  insert into public.stores (company_id, name, type, timezone)
  values (p_company_id, v_name, p_type, v_tz)
  returning id into v_id;
  perform private.write_audit(p_company_id, 'site_created', v_name);
  return v_id;
end;
$$;

create or replace function private.update_site(
  p_site_id uuid,
  p_name text,
  p_type text,
  p_timezone text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_name text := btrim(p_name);
  v_tz text := nullif(btrim(p_timezone), '');
begin
  select company_id into v_company from public.stores where id = p_site_id;
  if v_company is null then
    raise exception 'Unknown site' using errcode = '22023';
  end if;
  perform private.assert_company_access(v_company, 'manageLocations');
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Site name must be 1–80 characters' using errcode = '22023';
  end if;
  if p_type not in ('warehouse', 'retail') then
    raise exception 'Site type must be warehouse or retail' using errcode = '22023';
  end if;
  if v_tz is not null then
    perform private.assert_known_timezone(v_tz);
  end if;
  update public.stores
  set name = v_name, type = p_type, timezone = v_tz, active = p_active
  where id = p_site_id;
  perform private.write_audit(v_company, 'site_updated', v_name);
end;
$$;

create or replace function private.set_company_status(p_company_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_uid();
  if not private.is_platform_admin() then
    raise exception 'Only a platform owner can change company status' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Status must be active or suspended' using errcode = '22023';
  end if;
  update public.companies set status = p_status where id = p_company_id;
  if not found then
    raise exception 'Unknown company' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.preview_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_row record;
begin
  select c.name as company_name, c.slug, i.email, i.username, r.name as role_name, i.expires_at
    into v_row
  from public.invite_secrets s
  join public.invites i on i.id = s.invite_id
  join public.companies c on c.id = i.company_id
  join public.roles r on r.id = i.role_id
  where s.token_hash = v_hash
    and i.status = 'pending'
    and i.expires_at > now();
  if v_row.company_name is null then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'company_name', v_row.company_name,
    'slug', v_row.slug,
    'email', v_row.email,
    'username', v_row.username,
    'role_name', v_row.role_name,
    'expires_at', v_row.expires_at
  );
end;
$$;

create or replace function private.preview_join(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select c.name, c.slug, c.status, s.account_access_mode
    into v_row
  from public.companies c
  join public.company_settings s on s.company_id = c.id
  where c.slug = lower(btrim(coalesce(p_slug, '')));
  if v_row.name is null then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'name', v_row.name,
    'slug', v_row.slug,
    'status', v_row.status,
    'account_access_mode', v_row.account_access_mode
  );
end;
$$;

create or replace function private.my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_theme text;
  v_memberships jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('signed_in', false);
  end if;
  select email, display_name, theme into v_email, v_name, v_theme
  from public.profiles where user_id = v_uid;
  if v_email is null then
    select lower(email) into v_email from auth.users where id = v_uid;
    v_name := split_part(coalesce(v_email, 'user'), '@', 1);
    v_theme := 'dark';
  end if;

  select coalesce(jsonb_agg(m.obj order by m.company_name), '[]'::jsonb)
    into v_memberships
  from (
    select c.name as company_name,
      jsonb_build_object(
        'membership_id', cm.id,
        'company_id', c.id,
        'company_name', c.name,
        'company_slug', c.slug,
        'company_status', c.status,
        'timezone', c.timezone,
        'account_access_mode', cs.account_access_mode,
        'status', cm.status,
        'username', cm.username,
        'role_key', r.key,
        'role_name', r.name,
        'role_color', r.color,
        'permissions', r.permissions,
        'primary_store_id', cm.primary_store_id,
        'stores', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'type', s.type,
            'active', s.active,
            'timezone', s.timezone
          ) order by s.name), '[]'::jsonb)
          from public.stores s
          where s.company_id = c.id
        )
      ) as obj
    from public.company_members cm
    join public.companies c on c.id = cm.company_id
    join public.company_settings cs on cs.company_id = c.id
    join public.roles r on r.id = cm.role_id
    where cm.user_id = v_uid
  ) m;

  return jsonb_build_object(
    'signed_in', true,
    'user_id', v_uid,
    'email', v_email,
    'display_name', v_name,
    'theme', v_theme,
    'is_platform_admin', private.is_platform_admin(),
    'memberships', v_memberships
  );
end;
$$;

-- Public wrappers. Invoker so the API role is the caller; the private body is definer.

create or replace function public.my_context()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.my_context(); $$;

create or replace function public.preview_invite(token text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.preview_invite(token); $$;

create or replace function public.preview_join(slug text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.preview_join(slug); $$;

create or replace function public.create_company(
  name text, slug text, timezone text, account_access_mode text, sites jsonb,
  manager_email text, manager_username text, manager_role text
) returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_company(name, slug, timezone, account_access_mode, sites, manager_email, manager_username, manager_role); $$;

create or replace function public.create_invite(company_id uuid, email text, role_key text, username text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_invite(company_id, email, role_key, username); $$;

create or replace function public.reissue_invite(invite_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.reissue_invite(invite_id); $$;

create or replace function public.revoke_invite(invite_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.revoke_invite(invite_id); $$;

create or replace function public.accept_invite(token text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.accept_invite(token); $$;

create or replace function public.request_to_join(slug text, username text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.request_to_join(slug, username); $$;

create or replace function public.review_join_request(request_id uuid, decision text, role_key text)
returns void language sql security invoker set search_path = ''
as $$ select private.review_join_request(request_id, decision, role_key); $$;

create or replace function public.set_member_role(membership_id uuid, role_key text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_member_role(membership_id, role_key); $$;

create or replace function public.set_member_status(membership_id uuid, status text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_member_status(membership_id, status); $$;

create or replace function public.set_my_username(company_id uuid, username text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_my_username(company_id, username); $$;

create or replace function public.set_home_store(company_id uuid, store_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.set_home_store(company_id, store_id); $$;

create or replace function public.set_my_theme(theme text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_my_theme(theme); $$;

create or replace function public.update_company_settings(company_id uuid, name text, timezone text, account_access_mode text)
returns void language sql security invoker set search_path = ''
as $$ select private.update_company_settings(company_id, name, timezone, account_access_mode); $$;

create or replace function public.create_site(company_id uuid, name text, site_type text, timezone text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_site(company_id, name, site_type, timezone); $$;

create or replace function public.update_site(site_id uuid, name text, site_type text, timezone text, active boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.update_site(site_id, name, site_type, timezone, active); $$;

create or replace function public.set_company_status(company_id uuid, status text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_company_status(company_id, status); $$;

revoke all on all functions in schema public from public, anon;
grant execute on function public.preview_invite(text), public.preview_join(text) to anon, authenticated;
grant execute on function
  public.my_context(),
  public.create_company(text, text, text, text, jsonb, text, text, text),
  public.create_invite(uuid, text, text, text),
  public.reissue_invite(uuid),
  public.revoke_invite(uuid),
  public.accept_invite(text),
  public.request_to_join(text, text),
  public.review_join_request(uuid, text, text),
  public.set_member_role(uuid, text),
  public.set_member_status(uuid, text),
  public.set_my_username(uuid, text),
  public.set_home_store(uuid, uuid),
  public.set_my_theme(text),
  public.update_company_settings(uuid, text, text, text),
  public.create_site(uuid, text, text, text),
  public.update_site(uuid, text, text, text, boolean),
  public.set_company_status(uuid, text)
to authenticated;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
grant execute on function private.preview_invite(text), private.preview_join(text) to anon;

alter table public.platform_admins enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_settings enable row level security;
alter table public.stores enable row level security;
alter table public.floor_layouts enable row level security;
alter table public.roles enable row level security;
alter table public.statuses enable row level security;
alter table public.company_members enable row level security;
alter table public.invites enable row level security;
alter table public.invite_secrets enable row level security;
alter table public.join_requests enable row level security;
alter table public.invoices enable row level security;
alter table public.column_mappings enable row level security;
alter table public.inventory_uploads enable row level security;
alter table public.items enable row level security;
alter table public.item_notes enable row level security;
alter table public.transfers enable row level security;
alter table public.batches enable row level security;
alter table public.batch_lines enable row level security;
alter table public.audit_log enable row level security;
alter table public.inventory_upload_rows enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.notification_outbox enable row level security;

create policy platform_admins_select_self on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_platform_admin())
    or (select private.can_manage_user(user_id))
  );

create policy companies_select on public.companies
  for select to authenticated
  using (
    (select private.has_any_membership(id))
    or (select private.is_platform_admin())
  );

create policy company_settings_select on public.company_settings
  for select to authenticated
  using (
    (select private.has_any_membership(company_id))
    or (select private.is_platform_admin())
  );

create policy stores_select on public.stores
  for select to authenticated
  using (
    (select private.can_read_operations(company_id))
    or (select private.is_platform_admin())
  );

create policy layouts_select on public.floor_layouts
  for select to authenticated
  using ((select private.can_read_operations(company_id)));

create policy roles_select on public.roles
  for select to authenticated
  using (
    (select private.shares_company(company_id))
    or (select private.is_platform_admin())
  );

create policy statuses_select on public.statuses
  for select to authenticated
  using ((select private.can_read_operations(company_id)));

create policy members_select on public.company_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.shares_company(company_id))
    or (select private.is_platform_admin())
  );

create policy invites_select on public.invites
  for select to authenticated
  using (
    (select private.has_perm(company_id, 'manageUsers'))
    or (select private.is_platform_admin())
  );

create policy join_requests_select on public.join_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_perm(company_id, 'manageUsers'))
    or (select private.is_platform_admin())
  );

create policy invoices_select on public.invoices
  for select to authenticated using ((select private.can_read_operations(company_id)));
create policy mappings_select on public.column_mappings
  for select to authenticated using ((select private.can_read_operations(company_id)));
create policy uploads_select on public.inventory_uploads
  for select to authenticated using ((select private.can_read_operations(company_id)));
create policy upload_rows_select on public.inventory_upload_rows
  for select to authenticated using ((select private.can_read_operations(company_id)));
create policy items_select on public.items
  for select to authenticated using ((select private.can_read_operations(company_id)));
create policy notes_select on public.item_notes
  for select to authenticated using ((select private.can_read_operations(company_id)));
create policy transfers_select on public.transfers
  for select to authenticated using ((select private.can_read_operations(company_id)));
create policy batches_select on public.batches
  for select to authenticated using ((select private.can_read_operations(company_id)));
create policy batch_lines_select on public.batch_lines
  for select to authenticated using ((select private.can_read_operations(company_id)));

create policy audit_select on public.audit_log
  for select to authenticated
  using ((select private.has_perm(company_id, 'viewAudit')));

create policy recipients_select on public.notification_recipients
  for select to authenticated
  using (
    (select private.has_perm(company_id, 'manageUsers'))
    or (select private.is_platform_admin())
  );

create policy outbox_select on public.notification_outbox
  for select to authenticated
  using ((select private.has_perm(company_id, 'manageUsers')));

revoke all on all tables in schema public from anon;
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke all on public.invite_secrets from authenticated, anon;

-- No insert/update/delete policies: authenticated clients cannot write rows
-- directly. Mutations go through the functions above.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.items, public.transfers, public.batches, public.company_members, public.join_requests;
  end if;
end $$;

alter table public.items replica identity full;
alter table public.transfers replica identity full;
alter table public.batches replica identity full;
alter table public.company_members replica identity full;
alter table public.join_requests replica identity full;

create or replace function private.uuid_or_null(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception
  when others then
    return null;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'storage' and c.relname = 'objects') then
    insert into storage.buckets (id, name, public)
    values ('invoices', 'invoices', false)
    on conflict (id) do nothing;

    execute 'drop policy if exists invoices_read on storage.objects';
    execute $pol$
      create policy invoices_read on storage.objects
        for select to authenticated
        using (
          bucket_id = 'invoices'
          and (select private.can_read_operations(private.uuid_or_null((storage.foldername(name))[1])))
        )
    $pol$;
  end if;
exception
  when others then
    raise notice 'invoice bucket policy skipped: %', sqlerrm;
end $$;

revoke all on function private.uuid_or_null(text) from public;
grant execute on function private.uuid_or_null(text) to authenticated, service_role;
