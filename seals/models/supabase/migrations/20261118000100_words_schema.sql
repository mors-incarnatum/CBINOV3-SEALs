-- Profile-scoped vocabulary words table, following the same RLS and key
-- conventions as public.boards and public.tiles.
begin;

create table public.words (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  id text not null check (length(id) > 0),
  label text not null check (length(btrim(label)) > 0),
  spoken_text text,
  icon_name text,
  media_id text constraint words_media_id_valid check (media_id is null or media_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  language text default 'fil',
  category_id text not null,
  color_key public.board_color,
  word_class public.word_class,
  is_custom boolean not null default false,
  is_quick_phrase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, id),
  foreign key (profile_id, category_id) references public.boards(profile_id, id) deferrable initially deferred
);

create index words_category_idx on public.words(profile_id, category_id);

alter table public.words enable row level security;

create policy member_read on public.words for select to authenticated
  using (private.can_read_profile(profile_id));
create policy editor_insert on public.words for insert to authenticated
  with check (private.can_edit_profile(profile_id));
create policy editor_update on public.words for update to authenticated
  using (private.can_edit_profile(profile_id)) with check (private.can_edit_profile(profile_id));
create policy editor_delete on public.words for delete to authenticated
  using (private.can_edit_profile(profile_id));

create trigger touch_updated_at before update on public.words
  for each row execute function private.touch_updated_at();

revoke all on public.words from anon, authenticated;
grant select, insert, update, delete on public.words to authenticated;

commit;
