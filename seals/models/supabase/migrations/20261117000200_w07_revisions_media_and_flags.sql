-- Additive W07 rollout: profile revisions, tile media/language, neutral colorMode,
-- feature_flags, atomic publish RPC, and private profile-media storage policies.
begin;

alter table public.profiles
  add column if not exists revision integer not null default 1;

alter table public.tiles
  add column if not exists media_id text,
  add column if not exists language text default 'fil',
  add column if not exists is_quick_phrase boolean not null default false,
  drop constraint if exists tiles_media_id_valid,
  add constraint tiles_media_id_valid check (media_id is null or media_id ~ '^[A-Za-z0-9_-]{1,128}$');

alter table public.profile_settings
  drop constraint if exists appearance_valid,
  add constraint appearance_valid check (coalesce(
    jsonb_typeof(tile_appearance) = 'object'
    and tile_appearance ?& array['labelPosition','fontScale','iconScale','showIcons','gridGap','colorMode']
    and tile_appearance->>'labelPosition' in ('top','bottom')
    and tile_appearance->>'fontScale' in ('sm','md','lg')
    and tile_appearance->>'iconScale' in ('sm','md','lg')
    and jsonb_typeof(tile_appearance->'showIcons') = 'boolean'
    and tile_appearance->>'gridGap' in ('compact','normal','relaxed')
    and tile_appearance->>'colorMode' in ('catalog','wordClass','neutral'), false));

alter table public.profile_settings
  add column if not exists feature_flags jsonb not null default '{}'::jsonb;

alter table public.profile_settings
  drop constraint if exists feature_flags_valid,
  add constraint feature_flags_valid check (jsonb_typeof(feature_flags) = 'object'),
  drop constraint if exists speech_valid,
  add constraint speech_valid check (coalesce(
    jsonb_typeof(speech_config) = 'object'
    and speech_config ?& array['volume','speakOnTap','autoClear']
    and jsonb_typeof(speech_config->'volume') = 'number'
    and (speech_config->>'volume')::numeric between 0 and 1
    and jsonb_typeof(speech_config->'speakOnTap') = 'boolean'
    and speech_config->>'autoClear' in ('off','afterSpeak','nextTap')
    and (not (speech_config ? 'provider') or speech_config->>'provider' in ('local','cloud-puter','none'))
    and (not (speech_config ? 'rate') or (jsonb_typeof(speech_config->'rate') = 'number' and (speech_config->>'rate')::numeric between 0.5 and 2)), false));

create or replace function public.publish_profile_snapshot(
  p_profile_id uuid,
  p_expected_revision integer,
  p_boards jsonb,
  p_tiles jsonb,
  p_settings jsonb
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_revision integer;
  v_next_revision integer;
  v_board jsonb;
  v_tile jsonb;
begin
  if not private.can_edit_profile(p_profile_id) then
    raise exception 'PERMISSION_DENIED: Not authorized to edit this profile';
  end if;

  select revision into v_current_revision
  from public.profiles
  where id = p_profile_id
  for update;

  if v_current_revision is null then
    raise exception 'NOT_FOUND: Cloud profile does not exist';
  end if;

  if p_expected_revision is not null and v_current_revision <> p_expected_revision then
    raise exception 'STALE_REVISION: Cloud profile has revision %, expected %', v_current_revision, p_expected_revision;
  end if;

  -- Replace snapshot atomically inside this transaction
  delete from public.tiles where profile_id = p_profile_id;
  delete from public.boards where profile_id = p_profile_id;

  for v_board in select * from jsonb_array_elements(p_boards) loop
    insert into public.boards (
      profile_id, id, name, short_name, color_key, icon_name, is_built_in, grid_override, pages
    ) values (
      p_profile_id,
      v_board->>'id',
      v_board->>'name',
      v_board->>'short_name',
      (v_board->>'color_key')::public.board_color,
      v_board->>'icon_name',
      coalesce((v_board->>'is_built_in')::boolean, false),
      case when v_board->'grid_override' is null or v_board->'grid_override' = 'null'::jsonb then null else v_board->'grid_override' end,
      v_board->'pages'
    );
  end loop;

  for v_tile in select * from jsonb_array_elements(p_tiles) loop
    insert into public.tiles (
      profile_id, id, kind, label, spoken_text, icon_name, media_id, language, is_quick_phrase,
      category_id, target_board_id, color_key, word_class, is_custom
    ) values (
      p_profile_id,
      v_tile->>'id',
      (v_tile->>'kind')::public.tile_kind,
      v_tile->>'label',
      v_tile->>'spoken_text',
      v_tile->>'icon_name',
      v_tile->>'media_id',
      coalesce(v_tile->>'language', 'fil'),
      coalesce((v_tile->>'is_quick_phrase')::boolean, false),
      v_tile->>'category_id',
      v_tile->>'target_board_id',
      case when v_tile->>'color_key' is null then null else (v_tile->>'color_key')::public.board_color end,
      case when v_tile->>'word_class' is null then null else (v_tile->>'word_class')::public.word_class end,
      coalesce((v_tile->>'is_custom')::boolean, false)
    );
  end loop;

  insert into public.profile_settings (
    profile_id, catalog_order, grid_config, tile_appearance, speech_config, access_config, feature_flags
  ) values (
    p_profile_id,
    array(select jsonb_array_elements_text(p_settings->'catalog_order')),
    p_settings->'grid_config',
    p_settings->'tile_appearance',
    p_settings->'speech_config',
    p_settings->'access_config',
    coalesce(p_settings->'feature_flags', '{}'::jsonb)
  )
  on conflict (profile_id) do update set
    catalog_order = excluded.catalog_order,
    grid_config = excluded.grid_config,
    tile_appearance = excluded.tile_appearance,
    speech_config = excluded.speech_config,
    access_config = excluded.access_config,
    feature_flags = excluded.feature_flags;

  v_next_revision := v_current_revision + 1;
  update public.profiles set revision = v_next_revision where id = p_profile_id;
  return v_next_revision;
end;
$$;

revoke all on function public.publish_profile_snapshot(uuid, integer, jsonb, jsonb, jsonb) from public;
grant execute on function public.publish_profile_snapshot(uuid, integer, jsonb, jsonb, jsonb) to authenticated;

create or replace function private.try_parse_uuid(value text) returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then value::uuid
    else null
  end;
$$;

revoke all on function private.try_parse_uuid(text) from public;
grant execute on function private.try_parse_uuid(text) to authenticated;

-- Private profile-scoped media bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy profile_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-media'
    and private.can_read_profile(private.try_parse_uuid((storage.foldername(name))[1]))
  );

create policy profile_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and private.can_edit_profile(private.try_parse_uuid((storage.foldername(name))[1]))
  );

create policy profile_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-media'
    and private.can_edit_profile(private.try_parse_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'profile-media'
    and private.can_edit_profile(private.try_parse_uuid((storage.foldername(name))[1]))
  );

create policy profile_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-media'
    and private.can_edit_profile(private.try_parse_uuid((storage.foldername(name))[1]))
  );

commit;
