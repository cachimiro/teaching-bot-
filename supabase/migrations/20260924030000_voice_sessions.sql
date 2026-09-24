-- Live listening sessions (browser streams straight to Deepgram). The server times each one so
-- students are charged for mic-open time without trusting the client's clock.
create table public.voice_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  seconds    numeric(8, 2)
);
create index voice_sessions_open_idx on public.voice_sessions (user_id) where ended_at is null;

alter table public.voice_sessions enable row level security;
grant all on public.voice_sessions to service_role;
