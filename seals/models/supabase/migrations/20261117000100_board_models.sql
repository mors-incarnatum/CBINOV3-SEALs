-- Communication profiles are owned by caregivers (Supabase Auth users).
-- Local board/tile IDs remain text, scoped by profile, including "home" and "n-1".
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.profile_member_role as enum ('editor', 'viewer');
create type public.tile_kind as enum ('word', 'folder');
create type public.board_color as enum ('rose', 'emerald', 'amber', 'blue', 'violet', 'teal', 'orange', 'pink', 'slate');
create type public.word_class as enum ('social', 'question', 'verb', 'pronoun', 'particle', 'modifier', 'place', 'noun', 'other');

create function private.valid_grid(value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object'
    and value ?& array['rows', 'cols']
    and jsonb_typeof(value->'rows') = 'number'
    and jsonb_typeof(value->'cols') = 'number'
    and (value->>'rows') ~ '^(1[0-6]|[1-9])$'
    and (value->>'cols') ~ '^(1[0-6]|[1-9])$', false);
$$;

create function private.valid_pages(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare page jsonb; cell record;
begin
  if jsonb_typeof(value) is distinct from 'array' then return false; end if;
  if jsonb_array_length(value) = 0 then return false; end if;
  for page in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(page->'cells') is distinct from 'object' then return false; end if;
    for cell in select * from jsonb_each(page->'cells') loop
      -- Keep out-of-current-grid placements so resizing never discards vocabulary.
      if cell.key !~ '^(0|[1-9]|1[0-5]):(0|[1-9]|1[0-5])$'
        or jsonb_typeof(cell.value->'tileId') is distinct from 'string'
        or length(cell.value->>'tileId') = 0
        or (cell.value ? 'hidden' and jsonb_typeof(cell.value->'hidden') <> 'boolean')
      then return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_owner_id_idx on public.profiles(owner_id);

create table public.profile_memberships (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.profile_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);
create index profile_memberships_user_id_idx on public.profile_memberships(user_id, profile_id);

create table public.boards (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  id text not null check (length(id) > 0),
  name text not null check (length(btrim(name)) > 0),
  short_name text not null,
  color_key public.board_color not null,
  icon_name text,
  is_built_in boolean not null default false,
  grid_override jsonb check (grid_override is null or private.valid_grid(grid_override)),
  pages jsonb not null default '[{"cells":{}}]'::jsonb check (private.valid_pages(pages)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, id)
);

create table public.tiles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  id text not null check (length(id) > 0),
  kind public.tile_kind not null default 'word',
  label text not null check (length(btrim(label)) > 0),
  spoken_text text,
  icon_name text,
  category_id text not null,
  target_board_id text,
  color_key public.board_color,
  word_class public.word_class,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, id),
  foreign key (profile_id, category_id) references public.boards(profile_id, id) deferrable initially deferred,
  foreign key (profile_id, target_board_id) references public.boards(profile_id, id) deferrable initially deferred,
  check ((kind = 'folder' and target_board_id is not null) or (kind = 'word' and target_board_id is null))
);
create index tiles_category_idx on public.tiles(profile_id, category_id);
create index tiles_target_board_idx on public.tiles(profile_id, target_board_id);

create table public.profile_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  catalog_order text[] not null default '{}',
  grid_config jsonb not null default '{"rows":5,"cols":4}' check (private.valid_grid(grid_config)),
  tile_appearance jsonb not null default '{"labelPosition":"bottom","fontScale":"md","iconScale":"md","showIcons":true,"gridGap":"normal","colorMode":"catalog"}',
  speech_config jsonb not null default '{"volume":1,"speakOnTap":true,"autoClear":"off"}',
  access_config jsonb not null default '{"longPressToEdit":true,"holdDurationMs":650,"moveTolerancePx":12,"swipeThresholdPx":60}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appearance_valid check (coalesce(
    jsonb_typeof(tile_appearance) = 'object'
    and tile_appearance ?& array['labelPosition','fontScale','iconScale','showIcons','gridGap','colorMode']
    and tile_appearance->>'labelPosition' in ('top','bottom')
    and tile_appearance->>'fontScale' in ('sm','md','lg')
    and tile_appearance->>'iconScale' in ('sm','md','lg')
    and jsonb_typeof(tile_appearance->'showIcons') = 'boolean'
    and tile_appearance->>'gridGap' in ('compact','normal','relaxed')
    and tile_appearance->>'colorMode' in ('catalog','wordClass'), false)),
  constraint speech_valid check (coalesce(
    jsonb_typeof(speech_config) = 'object'
    and speech_config ?& array['volume','speakOnTap','autoClear']
    and jsonb_typeof(speech_config->'volume') = 'number'
    and (speech_config->>'volume')::numeric between 0 and 1
    and jsonb_typeof(speech_config->'speakOnTap') = 'boolean'
    and speech_config->>'autoClear' in ('off','afterSpeak','nextTap'), false)),
  constraint access_valid check (coalesce(
    jsonb_typeof(access_config) = 'object'
    and access_config ?& array['longPressToEdit','holdDurationMs','moveTolerancePx','swipeThresholdPx']
    and not (access_config ? 'editPin')
    and jsonb_typeof(access_config->'longPressToEdit') = 'boolean'
    and jsonb_typeof(access_config->'holdDurationMs') = 'number'
    and (access_config->>'holdDurationMs')::numeric >= 0
    and jsonb_typeof(access_config->'moveTolerancePx') = 'number'
    and (access_config->>'moveTolerancePx')::numeric >= 0
    and jsonb_typeof(access_config->'swipeThresholdPx') = 'number'
    and (access_config->>'swipeThresholdPx')::numeric >= 0, false))
);

-- The owner is stored separately, so no membership can promote itself to owner.
-- Definer helpers avoid recursive policies; the private schema is not an API schema.
create function private.owns_profile(profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = profile and owner_id = (select auth.uid()));
$$;
create function private.can_read_profile(profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.owns_profile(profile) or exists(
    select 1 from public.profile_memberships where profile_id = profile and user_id = (select auth.uid()));
$$;
create function private.can_edit_profile(profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.owns_profile(profile) or exists(
    select 1 from public.profile_memberships
    where profile_id = profile and user_id = (select auth.uid()) and role = 'editor');
$$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;

alter table public.profiles enable row level security;
alter table public.profile_memberships enable row level security;
create policy profiles_read on public.profiles for select to authenticated
  using (owner_id = (select auth.uid()) or private.can_read_profile(id));
create policy profiles_insert on public.profiles for insert to authenticated with check (owner_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (owner_id = (select auth.uid()));
create policy memberships_read on public.profile_memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.owns_profile(profile_id));
create policy memberships_insert on public.profile_memberships for insert to authenticated with check (private.owns_profile(profile_id));
create policy memberships_update on public.profile_memberships for update to authenticated
  using (private.owns_profile(profile_id)) with check (private.owns_profile(profile_id));
create policy memberships_delete on public.profile_memberships for delete to authenticated using (private.owns_profile(profile_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['boards', 'tiles', 'profile_settings'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy member_read on public.%I for select to authenticated using (private.can_read_profile(profile_id))', table_name);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (private.can_edit_profile(profile_id))', table_name);
    execute format('create policy editor_update on public.%I for update to authenticated using (private.can_edit_profile(profile_id)) with check (private.can_edit_profile(profile_id))', table_name);
    execute format('create policy editor_delete on public.%I for delete to authenticated using (private.can_edit_profile(profile_id))', table_name);
  end loop;
  foreach table_name in array array['profiles', 'profile_memberships', 'boards', 'tiles', 'profile_settings'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end;
$$;

revoke all on function private.valid_grid(jsonb), private.valid_pages(jsonb),
  private.owns_profile(uuid), private.can_read_profile(uuid), private.can_edit_profile(uuid),
  private.touch_updated_at() from public;
grant execute on function private.valid_grid(jsonb), private.valid_pages(jsonb),
  private.owns_profile(uuid), private.can_read_profile(uuid), private.can_edit_profile(uuid) to authenticated;

commit;
