-- User reading paths (genre starter paths + AI-generated journeys)

create table if not exists public.user_reading_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  genre_slug text,
  genre_label text,
  path_name text not null,
  path_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_reading_paths_user on public.user_reading_paths (user_id);
create index if not exists idx_user_reading_paths_updated on public.user_reading_paths (user_id, updated_at desc);

create unique index if not exists idx_user_reading_paths_genre_unique
  on public.user_reading_paths (user_id, genre_slug)
  where genre_slug is not null;

alter table public.user_reading_paths enable row level security;

drop policy if exists "Users read own reading paths" on public.user_reading_paths;
create policy "Users read own reading paths"
  on public.user_reading_paths for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own reading paths" on public.user_reading_paths;
create policy "Users insert own reading paths"
  on public.user_reading_paths for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own reading paths" on public.user_reading_paths;
create policy "Users update own reading paths"
  on public.user_reading_paths for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own reading paths" on public.user_reading_paths;
create policy "Users delete own reading paths"
  on public.user_reading_paths for delete
  using (auth.uid() = user_id);
