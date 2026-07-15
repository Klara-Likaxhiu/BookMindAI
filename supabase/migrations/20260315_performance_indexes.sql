-- Performance indexes for frequent Lexo queries

-- Shelf / status filters
create index if not exists idx_user_library_user_status
  on public.user_library (user_id, status);

-- Continue-reading / recency sorts on the library
create index if not exists idx_user_library_user_last_opened
  on public.user_library (user_id, last_opened_at desc nulls last);

create index if not exists idx_user_library_user_created
  on public.user_library (user_id, created_at desc);

-- Community "my reviews" feed
create index if not exists idx_community_reviews_user_updated
  on public.community_reviews (user_id, updated_at desc);

-- Cover backfill / failed lookup sweeps
create index if not exists idx_book_covers_status_failed
  on public.book_covers (cover_status, lookup_failed_at)
  where cover_status = 'failed';

-- Recommendation expiry sweeps (optional / future)
create index if not exists idx_user_recommendations_expires
  on public.user_recommendations (user_id, expires_at);
