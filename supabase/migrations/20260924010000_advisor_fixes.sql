-- Fixes from Supabase advisors after the initial schema.

-- Covering indexes for foreign keys.
create index conversations_topic_idx on public.conversations (topic_id);
create index learner_notes_topic_idx on public.learner_notes (topic_id);
create index messages_user_idx on public.messages (user_id);
create index usage_events_conversation_idx on public.usage_events (conversation_id);

-- Supabase's built-in event-trigger helper doesn't need to be callable over the Data API.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
