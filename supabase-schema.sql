create extension if not exists pgcrypto;

create table if not exists public.forest_site_settings (
  id text primary key default 'main' check (id = 'main'),
  site_title text not null default '별숲 블로그 보드',
  owner_user_id uuid references auth.users(id) on delete set null,
  default_mode text not null default 'board' check (default_mode in ('board', 'blog')),
  background_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.forest_site_settings (id)
values ('main')
on conflict (id) do nothing;

create table if not exists public.forest_posts (
  id uuid primary key default gen_random_uuid(),
  post_type text not null default 'board' check (post_type in ('board', 'blog')),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 80),
  content text not null check (char_length(content) between 1 and 4000),
  author_name text not null default '익명' check (char_length(author_name) between 1 and 24),
  category text not null default '일상' check (category in ('일상', '질문', '공유', '공지')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.forest_site_settings enable row level security;
alter table public.forest_posts enable row level security;

drop policy if exists "site settings are readable" on public.forest_site_settings;
drop policy if exists "site settings can be created by owner" on public.forest_site_settings;
drop policy if exists "site settings can be claimed or edited by owner" on public.forest_site_settings;
drop policy if exists "forest posts are readable" on public.forest_posts;
drop policy if exists "visitors can create board posts" on public.forest_posts;
drop policy if exists "owner can create blog posts" on public.forest_posts;
drop policy if exists "authors or owner can update posts" on public.forest_posts;
drop policy if exists "authors or owner can delete posts" on public.forest_posts;

create policy "site settings are readable"
on public.forest_site_settings
for select
to authenticated
using (true);

create policy "site settings can be created by owner"
on public.forest_site_settings
for insert
to authenticated
with check (
  id = 'main'
  and (owner_user_id is null or (select auth.uid()) = owner_user_id)
);

create policy "site settings can be claimed or edited by owner"
on public.forest_site_settings
for update
to authenticated
using (owner_user_id is null or (select auth.uid()) = owner_user_id)
with check (owner_user_id is null or (select auth.uid()) = owner_user_id);

create policy "forest posts are readable"
on public.forest_posts
for select
to authenticated
using (true);

create policy "visitors can create board posts"
on public.forest_posts
for insert
to authenticated
with check (post_type = 'board' and (select auth.uid()) = user_id);

create policy "owner can create blog posts"
on public.forest_posts
for insert
to authenticated
with check (
  post_type = 'blog'
  and (select auth.uid()) = user_id
  and (select auth.uid()) = (
    select owner_user_id from public.forest_site_settings where id = 'main'
  )
);

create policy "authors or owner can update posts"
on public.forest_posts
for update
to authenticated
using (
  (post_type = 'board' and (select auth.uid()) = user_id)
  or (post_type = 'blog' and (select auth.uid()) = (
    select owner_user_id from public.forest_site_settings where id = 'main'
  ))
)
with check (
  (post_type = 'board' and (select auth.uid()) = user_id)
  or (post_type = 'blog' and (select auth.uid()) = (
    select owner_user_id from public.forest_site_settings where id = 'main'
  ))
);

create policy "authors or owner can delete posts"
on public.forest_posts
for delete
to authenticated
using (
  (post_type = 'board' and (select auth.uid()) = user_id)
  or (post_type = 'blog' and (select auth.uid()) = (
    select owner_user_id from public.forest_site_settings where id = 'main'
  ))
);

create index if not exists forest_posts_type_created_at_idx on public.forest_posts (post_type, created_at desc);
create index if not exists forest_posts_user_id_idx on public.forest_posts (user_id);

alter table public.forest_posts replica identity full;
alter table public.forest_site_settings replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forest_posts'
  ) then
    alter publication supabase_realtime add table public.forest_posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forest_site_settings'
  ) then
    alter publication supabase_realtime add table public.forest_site_settings;
  end if;
end $$;
