-- What the student is into (gaming, football, music...), used to personalise examples.
alter table public.profiles add column interests text check (length(interests) <= 200);
grant update (interests) on public.profiles to authenticated;
