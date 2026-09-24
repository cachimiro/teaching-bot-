-- Virtus AI Tutor — initial schema.
-- Students read their own rows through RLS. Every credit mutation goes through the
-- security-definer functions at the bottom, which only the service role may call.

-------------------------------------------------------------------------------
-- Content
-------------------------------------------------------------------------------
create table public.topics (
  id             text primary key,               -- Virtus id, e.g. B076
  subject        text not null,
  unit           text not null,
  unit_name      text not null,
  slug           text not null,
  title          text not null,
  url            text not null unique,           -- path on virtusacademy.co.uk
  category       text,
  subcategory    text,
  boards         text[] not null default '{}',
  has_foundation boolean not null default false,
  has_higher     boolean not null default false,
  intro          text not null default '',
  notes          text not null default '',
  foundation     jsonb,                          -- {worksheet, markscheme, worksheetUrl, markschemeUrl}
  higher         jsonb,
  related        jsonb not null default '[]',
  search         tsvector generated always as (
                   setweight(to_tsvector('english', title), 'A') ||
                   setweight(to_tsvector('english', unit_name || ' ' || coalesce(category, '')), 'B') ||
                   setweight(to_tsvector('english', notes), 'C')
                 ) stored,
  updated_at     timestamptz not null default now(),
  unique (subject, unit, slug)
);
create index topics_search_idx on public.topics using gin (search);
create index topics_subject_unit_idx on public.topics (subject, unit);

-------------------------------------------------------------------------------
-- Students
-------------------------------------------------------------------------------
create table public.profiles (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  display_name            text,
  year_group              int check (year_group between 7 and 13),
  target_grade            text,
  learning_style          text[] not null default '{}',
  about_me                text,
  onboarded               boolean not null default false,
  subscription_status     text not null default 'active' check (subscription_status in ('active', 'inactive')),
  auto_topup              boolean not null default false,
  monthly_topup_cap_pence int not null default 2000 check (monthly_topup_cap_pence between 0 and 100000),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.subject_settings (
  user_id    uuid not null references auth.users (id) on delete cascade,
  subject    text not null,
  exam_board text not null check (exam_board in ('AQA', 'Edexcel', 'OCR')),
  tier       text not null check (tier in ('foundation', 'higher')),
  primary key (user_id, subject)
);

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  topic_id   text not null references public.topics (id),
  mode       text not null check (mode in ('learn', 'quiz', 'mock')),
  tier       text not null check (tier in ('foundation', 'higher')),
  exam_board text not null check (exam_board in ('AQA', 'Edexcel', 'OCR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_topic_idx on public.conversations (user_id, topic_id, updated_at desc);

-- `content` holds the exact Anthropic content blocks so history replays byte-for-byte (cache hits).
create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         jsonb not null,
  display_text    text,                          -- null for tool plumbing turns
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, id);

create table public.learner_notes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('strength', 'struggle', 'misconception', 'preference', 'goal')),
  note       text not null check (length(note) <= 300),
  topic_id   text references public.topics (id),
  created_at timestamptz not null default now()
);
create index learner_notes_user_idx on public.learner_notes (user_id, created_at desc);

-------------------------------------------------------------------------------
-- Credits (1 credit = 1p of provider cost)
-------------------------------------------------------------------------------
create table public.daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,                          -- Europe/London calendar day
  used    numeric(12, 4) not null default 0,
  primary key (user_id, day)
);

create table public.wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  balance    numeric(12, 4) not null default 0,   -- top-up credits; may dip below 0 by one message
  updated_at timestamptz not null default now()
);

create table public.topups (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  source       text not null check (source in ('auto', 'manual', 'admin')),
  packs        int not null check (packs > 0),
  amount_pence int not null check (amount_pence >= 0),
  credits      numeric(12, 4) not null,
  payment_ref  text,
  created_at   timestamptz not null default now()
);
create index topups_user_created_idx on public.topups (user_id, created_at desc);

create table public.usage_events (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  kind            text not null check (kind in ('chat', 'stt', 'tts')),
  credits         numeric(12, 4) not null,
  from_daily      numeric(12, 4) not null,
  from_wallet     numeric(12, 4) not null,
  detail          jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

-------------------------------------------------------------------------------
-- New user bootstrap
-------------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id);
  insert into public.wallets (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Credit functions (service role only)
-------------------------------------------------------------------------------

-- Everything the app needs to decide whether a student may send another message.
create function public.credit_status(p_user uuid, p_day date, p_month_start timestamptz)
returns table (
  daily_used            numeric,
  wallet_balance        numeric,
  auto_topup            boolean,
  monthly_cap_pence     int,
  auto_spent_pence      int,
  subscription_status   text
)
language sql stable security definer set search_path = '' as $$
  select
    coalesce((select d.used from public.daily_usage d where d.user_id = p_user and d.day = p_day), 0),
    coalesce((select w.balance from public.wallets w where w.user_id = p_user), 0),
    p.auto_topup,
    p.monthly_topup_cap_pence,
    coalesce((select sum(t.amount_pence)::int from public.topups t
              where t.user_id = p_user and t.source = 'auto' and t.created_at >= p_month_start), 0),
    p.subscription_status
  from public.profiles p
  where p.user_id = p_user
$$;

-- Deducts from today's allowance first, then the top-up wallet (which may go negative).
create function public.consume_credits(
  p_user uuid,
  p_day date,
  p_daily_allowance numeric,
  p_credits numeric,
  p_kind text,
  p_conversation uuid,
  p_detail jsonb
) returns table (from_daily numeric, from_wallet numeric, daily_used numeric, wallet_balance numeric)
language plpgsql security definer set search_path = '' as $$
declare
  v_used numeric;
  v_from_daily numeric;
  v_from_wallet numeric;
  v_balance numeric;
begin
  if p_credits < 0 then
    raise exception 'credits must be non-negative';
  end if;

  insert into public.daily_usage (user_id, day) values (p_user, p_day)
    on conflict (user_id, day) do nothing;
  select d.used into v_used from public.daily_usage d
    where d.user_id = p_user and d.day = p_day for update;

  v_from_daily := least(p_credits, greatest(p_daily_allowance - v_used, 0));
  v_from_wallet := p_credits - v_from_daily;

  update public.daily_usage d set used = d.used + v_from_daily
    where d.user_id = p_user and d.day = p_day
    returning d.used into v_used;

  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.wallets w set balance = w.balance - v_from_wallet, updated_at = now()
    where w.user_id = p_user
    returning w.balance into v_balance;

  insert into public.usage_events (user_id, conversation_id, kind, credits, from_daily, from_wallet, detail)
    values (p_user, p_conversation, p_kind, p_credits, v_from_daily, v_from_wallet, coalesce(p_detail, '{}'));

  return query select v_from_daily, v_from_wallet, v_used, v_balance;
end $$;

-- Records a paid (or admin-granted) top-up and credits the wallet.
create function public.grant_topup(
  p_user uuid,
  p_source text,
  p_packs int,
  p_amount_pence int,
  p_credits numeric,
  p_payment_ref text
) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_balance numeric;
begin
  insert into public.topups (user_id, source, packs, amount_pence, credits, payment_ref)
    values (p_user, p_source, p_packs, p_amount_pence, p_credits, p_payment_ref);
  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.wallets w set balance = w.balance + p_credits, updated_at = now()
    where w.user_id = p_user
    returning w.balance into v_balance;
  return v_balance;
end $$;

revoke all on function public.credit_status(uuid, date, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_credits(uuid, date, numeric, numeric, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.grant_topup(uuid, text, int, int, numeric, text) from public, anon, authenticated;
grant execute on function public.credit_status(uuid, date, timestamptz) to service_role;
grant execute on function public.consume_credits(uuid, date, numeric, numeric, text, uuid, jsonb) to service_role;
grant execute on function public.grant_topup(uuid, text, int, int, numeric, text) to service_role;

-------------------------------------------------------------------------------
-- Row-level security
-------------------------------------------------------------------------------
alter table public.topics           enable row level security;
alter table public.profiles         enable row level security;
alter table public.subject_settings enable row level security;
alter table public.conversations    enable row level security;
alter table public.messages         enable row level security;
alter table public.learner_notes    enable row level security;
alter table public.daily_usage      enable row level security;
alter table public.wallets          enable row level security;
alter table public.topups           enable row level security;
alter table public.usage_events     enable row level security;

-- Explicit Data API grants (new projects may not expose tables by default). RLS still
-- decides which rows each student sees; anon gets nothing.
grant usage on schema public to authenticated, service_role;
grant select on public.topics to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.subject_settings to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant select, delete on public.learner_notes to authenticated;
grant select on public.daily_usage, public.wallets, public.topups, public.usage_events to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy "signed-in users read topics" on public.topics
  for select to authenticated using (true);

create policy "own profile" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Students may not change their own subscription status.
revoke update on public.profiles from authenticated;
grant update (display_name, year_group, target_grade, learning_style, about_me, onboarded,
              auto_topup, monthly_topup_cap_pence, updated_at)
  on public.profiles to authenticated;

create policy "own subject settings" on public.subject_settings
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own conversations" on public.conversations
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "read own messages" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));

create policy "read own notes" on public.learner_notes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "delete own notes" on public.learner_notes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "read own daily usage" on public.daily_usage
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own wallet" on public.wallets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own topups" on public.topups
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own usage" on public.usage_events
  for select to authenticated using (user_id = (select auth.uid()));
