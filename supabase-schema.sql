create extension if not exists pgcrypto;

create table if not exists public.forest_site_settings (
  id text primary key default 'main' check (id = 'main'),
  site_title text not null default '별숲 커뮤니티',
  owner_user_id uuid references auth.users(id) on delete set null,
  default_board_slug text not null default 'free',
  background_url text,
  theme text not null default 'night' check (theme in ('night', 'dawn', 'classic')),
  skin text not null default 'forest' check (skin in ('forest', 'classic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.forest_site_settings (id)
values ('main')
on conflict (id) do nothing;

create table if not exists public.forest_boards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{1,30}$'),
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '',
  board_type text not null default 'board' check (board_type in ('board', 'blog')),
  write_role text not null default 'all' check (write_role in ('all', 'owner')),
  allow_comments boolean not null default true,
  skin text not null default 'table' check (skin in ('table', 'blog')),
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.forest_boards (slug, name, description, board_type, write_role, allow_comments, skin, sort_order)
values
  ('notice', '공지사항', '운영자가 올리는 안내 게시판', 'board', 'owner', true, 'table', 10),
  ('free', '자유게시판', '방문자들이 함께 쓰는 열린 게시판', 'board', 'all', true, 'table', 20),
  ('qna', '질문답변', '질문과 답변을 남기는 게시판', 'board', 'all', true, 'table', 30),
  ('blog', '블로그', '운영자만 작성하는 블로그', 'blog', 'owner', true, 'blog', 40)
on conflict (slug) do nothing;

create table if not exists public.forest_posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.forest_boards(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  client_key text not null default '',
  title text not null check (char_length(title) between 1 and 100),
  content text not null check (char_length(content) between 1 and 8000),
  author_name text not null default '익명' check (char_length(author_name) between 1 and 24),
  category text not null default '일반' check (char_length(category) between 1 and 20),
  is_notice boolean not null default false,
  view_count int not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.forest_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forest_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  client_key text not null default '',
  author_name text not null default '익명' check (char_length(author_name) between 1 and 24),
  content text not null check (char_length(content) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create or replace function public.forest_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.forest_site_settings
    where id = 'main'
      and owner_user_id = auth.uid()
  );
$$;

alter table public.forest_posts alter column user_id drop not null;
alter table public.forest_posts add column if not exists client_key text not null default '';
alter table public.forest_comments alter column user_id drop not null;
alter table public.forest_comments add column if not exists client_key text not null default '';

create or replace function public.increment_forest_post_view(post_uuid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.forest_posts
  set view_count = view_count + 1
  where id = post_uuid;
$$;

grant execute on function public.increment_forest_post_view(uuid) to authenticated;

alter table public.forest_site_settings enable row level security;
alter table public.forest_boards enable row level security;
alter table public.forest_posts enable row level security;
alter table public.forest_comments enable row level security;

drop policy if exists "site settings are readable" on public.forest_site_settings;
drop policy if exists "site settings can be created by owner" on public.forest_site_settings;
drop policy if exists "site settings can be claimed or edited by owner" on public.forest_site_settings;
drop policy if exists "boards are readable" on public.forest_boards;
drop policy if exists "owner can create boards" on public.forest_boards;
drop policy if exists "owner can update boards" on public.forest_boards;
drop policy if exists "owner can delete boards" on public.forest_boards;
drop policy if exists "posts are readable" on public.forest_posts;
drop policy if exists "visitors can create permitted posts" on public.forest_posts;
drop policy if exists "authors or owner can update posts" on public.forest_posts;
drop policy if exists "authors or owner can delete posts" on public.forest_posts;
drop policy if exists "comments are readable" on public.forest_comments;
drop policy if exists "visitors can create comments" on public.forest_comments;
drop policy if exists "authors or owner can update comments" on public.forest_comments;
drop policy if exists "authors or owner can delete comments" on public.forest_comments;

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
  and (owner_user_id is null or owner_user_id = auth.uid())
);

create policy "site settings can be claimed or edited by owner"
on public.forest_site_settings
for update
to authenticated
using (owner_user_id is null or public.forest_is_owner())
with check (owner_user_id is null or owner_user_id = auth.uid() or public.forest_is_owner());

create policy "boards are readable"
on public.forest_boards
for select
to authenticated
using (true);

create policy "owner can create boards"
on public.forest_boards
for insert
to authenticated
with check (public.forest_is_owner());

create policy "owner can update boards"
on public.forest_boards
for update
to authenticated
using (public.forest_is_owner())
with check (public.forest_is_owner());

create policy "owner can delete boards"
on public.forest_boards
for delete
to authenticated
using (public.forest_is_owner());

create policy "posts are readable"
on public.forest_posts
for select
to authenticated
using (true);

create policy "visitors can create permitted posts"
on public.forest_posts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    exists (
      select 1
      from public.forest_boards b
      where b.id = board_id
        and b.write_role = 'all'
    )
    or public.forest_is_owner()
  )
  and (is_notice is false or public.forest_is_owner())
);

create policy "authors or owner can update posts"
on public.forest_posts
for update
to authenticated
using (user_id = auth.uid() or public.forest_is_owner())
with check ((user_id = auth.uid() or public.forest_is_owner()) and (is_notice is false or public.forest_is_owner()));

create policy "authors or owner can delete posts"
on public.forest_posts
for delete
to authenticated
using (user_id = auth.uid() or public.forest_is_owner());

create policy "comments are readable"
on public.forest_comments
for select
to authenticated
using (true);

create policy "visitors can create comments"
on public.forest_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.forest_posts p
    join public.forest_boards b on b.id = p.board_id
    where p.id = post_id
      and b.allow_comments = true
  )
);

create policy "authors or owner can update comments"
on public.forest_comments
for update
to authenticated
using (user_id = auth.uid() or public.forest_is_owner())
with check (user_id = auth.uid() or public.forest_is_owner());

create policy "authors or owner can delete comments"
on public.forest_comments
for delete
to authenticated
using (user_id = auth.uid() or public.forest_is_owner());

create index if not exists forest_boards_sort_idx on public.forest_boards (sort_order, name);
create index if not exists forest_posts_board_created_idx on public.forest_posts (board_id, is_notice desc, created_at desc);
create index if not exists forest_posts_user_idx on public.forest_posts (user_id);
create index if not exists forest_comments_post_created_idx on public.forest_comments (post_id, created_at);

alter table public.forest_site_settings replica identity full;
alter table public.forest_boards replica identity full;
alter table public.forest_posts replica identity full;
alter table public.forest_comments replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forest_site_settings'
  ) then
    alter publication supabase_realtime add table public.forest_site_settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forest_boards'
  ) then
    alter publication supabase_realtime add table public.forest_boards;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forest_posts'
  ) then
    alter publication supabase_realtime add table public.forest_posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forest_comments'
  ) then
    alter publication supabase_realtime add table public.forest_comments;
  end if;
end $$;
