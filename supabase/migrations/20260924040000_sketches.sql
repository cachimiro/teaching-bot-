-- Tutor-drawn diagrams (```sketch) for things outside the built-in library. Each distinct request is
-- drawn once and reused for every student, so the collection grows as students use the tutor.
create table public.sketches (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,           -- sha-256 of the normalised description
  title      text not null,
  describe   text not null,
  svg        text not null check (length(svg) <= 60000),
  uses       int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.sketches enable row level security;
grant all on public.sketches to service_role;
