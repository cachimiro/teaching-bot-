-- Remember which topic a sketch was first drawn for, and its exact spec, so the tutor can be shown
-- the drawings that already exist for a topic and reuse them (instant and free) instead of asking
-- for a slightly different one.
alter table public.sketches
  add column topic_id text references public.topics (id) on delete set null,
  add column spec jsonb;

create index sketches_topic_id_idx on public.sketches (topic_id);
