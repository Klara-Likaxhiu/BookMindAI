-- Persistent Home recommendation batches (user-scoped)

create table if not exists public.user_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  genre text,
  description text,
  cover_url text,
  reason text,
  match_score integer default 90,
  source text not null default 'companion',
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  batch_id uuid not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_recommendations_user
  on public.user_recommendations (user_id);

create index if not exists idx_user_recommendations_batch
  on public.user_recommendations (user_id, batch_id, position);

create index if not exists idx_user_recommendations_generated
  on public.user_recommendations (user_id, generated_at desc);

create unique index if not exists idx_user_recommendations_batch_position
  on public.user_recommendations (user_id, batch_id, position);

alter table public.user_recommendations enable row level security;

drop policy if exists "Users read own recommendations" on public.user_recommendations;
create policy "Users read own recommendations"
  on public.user_recommendations for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own recommendations" on public.user_recommendations;
create policy "Users insert own recommendations"
  on public.user_recommendations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own recommendations" on public.user_recommendations;
create policy "Users update own recommendations"
  on public.user_recommendations for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own recommendations" on public.user_recommendations;
create policy "Users delete own recommendations"
  on public.user_recommendations for delete
  using (auth.uid() = user_id);
