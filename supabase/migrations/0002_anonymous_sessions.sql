-- Anonymous demo sessions.
-- When Supabase is on, callers without a session cookie are scoped to the demo org: the public "/" page and the
-- browser extension, which calls /api/check and /api/audit cross-origin without cookies. Their audit entries still
-- need a sessions row (audit_entries references sessions), so user_id becomes optional. A null user_id means
-- "anonymous, demo org"; signed-in sessions always carry the user. Known gap: replace with an org API key.
alter table public.sessions alter column user_id drop not null;
comment on column public.sessions.user_id is 'null = anonymous caller scoped to the demo org (extension, public demo page)';
