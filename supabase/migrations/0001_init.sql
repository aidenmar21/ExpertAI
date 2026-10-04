-- ExpertAI tenancy. Apply once to a fresh Supabase project; no demo users are created.
create extension if not exists pgcrypto;
create table public.orgs (
  id uuid primary key default gen_random_uuid(), name text not null,
  created_at timestamptz not null default now()
);
create table public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role text not null check (role in ('owner','manager','expert','new_hire')),
  primary key (user_id, org_id)
);
create index memberships_org on public.memberships(org_id);
-- Security-definer avoids recursive membership policies. Caller identity is always auth.uid().
create function public.org_role(oid uuid) returns text language sql stable security definer
set search_path = '' as $$
  select role from public.memberships where org_id = oid and user_id = auth.uid()
$$;
revoke all on function public.org_role(uuid) from public;
grant execute on function public.org_role(uuid) to authenticated;
create table public.jobs (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.orgs(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{1,80}$'), profile jsonb not null,
  role_id text, software_ids text[] not null default '{}',
  unique(org_id, slug), unique(org_id, id)
);
create table public.work_maps (
  org_id uuid not null, job_id uuid primary key, map jsonb not null,
  version integer not null default 1 check(version > 0), confirmed_at timestamptz,
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
  foreign key(org_id, job_id) references public.jobs(org_id, id) on delete cascade
);
create table public.work_map_versions (
  org_id uuid not null, job_id uuid not null, version integer not null, map jsonb not null,
  confirmed_at timestamptz, updated_by uuid references auth.users(id), updated_at timestamptz not null,
  primary key(job_id, version), foreign key(org_id, job_id) references public.jobs(org_id,id) on delete cascade
);
-- Trigger writes immutable snapshots, including the first map. Direct map writes are denied below.
create function public.snapshot_work_map() returns trigger language plpgsql security definer
set search_path = '' as $$ begin
  insert into public.work_map_versions values
    (new.org_id,new.job_id,new.version,new.map,new.confirmed_at,new.updated_by,new.updated_at);
  return new;
end $$;
create trigger work_map_history after insert or update on public.work_maps
for each row execute function public.snapshot_work_map();
-- CAS serialized on the job, including competing first inserts (expected version 0).
create function public.save_work_map(oid uuid, jid uuid, value jsonb, expected integer, uid uuid)
returns integer language plpgsql set search_path = '' as $$
declare current_version integer; next_version integer;
begin
  perform 1 from public.jobs where org_id=oid and id=jid for update;
  if not found then raise exception 'unknown job'; end if;
  select version into current_version from public.work_maps where job_id=jid and org_id=oid;
  if coalesce(current_version,0) <> expected then raise exception 'version conflict' using errcode='40001'; end if;
  next_version := expected + 1;
  insert into public.work_maps(org_id,job_id,map,version,confirmed_at,updated_by)
    values(oid,jid,value,next_version,nullif(value->>'confirmed_at','')::timestamptz,uid)
  on conflict(job_id) do update set map=excluded.map, version=excluded.version,
    confirmed_at=excluded.confirmed_at, updated_by=excluded.updated_by, updated_at=now();
  return next_version;
end $$;
revoke all on function public.save_work_map(uuid,uuid,jsonb,integer,uuid) from public, anon, authenticated;
grant execute on function public.save_work_map(uuid,uuid,jsonb,integer,uuid) to service_role;
create table public.sessions (
  id text primary key, org_id uuid not null references public.orgs(id) on delete cascade,
  job_id uuid, user_id uuid not null references auth.users(id),
  kind text not null check(kind in ('expert','new_hire')), started_at timestamptz not null default now(), ended_at timestamptz,
  unique(org_id,id), foreign key(org_id,job_id) references public.jobs(org_id,id)
);
create table public.screen_events (
  id bigint generated always as identity primary key, session_id text not null references public.sessions(id) on delete cascade,
  event jsonb not null
);
create table public.transcripts (
  session_id text primary key references public.sessions(id) on delete cascade, lines jsonb not null default '[]'
);
create table public.audit_entries (
  org_id uuid not null, session_id text not null, seq integer not null check(seq > 0),
  -- Text preserves the exact ISO timestamp bytes hashed by the server.
  ts text not null, actor text not null check(actor in ('expert','new_hire','expertai','system')),
  type text not null, payload jsonb not null, prev_hash text not null, hash text not null,
  primary key(session_id,seq), foreign key(org_id,session_id) references public.sessions(org_id,id) on delete cascade
);
create table public.stuck_feedback (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, job_id uuid not null,
  signals jsonb not null, label boolean not null, created_at timestamptz not null default now(),
  foreign key(org_id,job_id) references public.jobs(org_id,id) on delete cascade
);
create table public.frames (
  session_id text not null references public.sessions(id) on delete cascade,
  frame_id text not null, storage_path text not null unique, primary key(session_id,frame_id)
);
-- Invite nonce hashes are consumed once, atomically; signed tokens never live in this table.
create table public.org_invites (
  nonce_hash text primary key, org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null, role text not null check(role in ('manager','expert','new_hire')),
  expires_at timestamptz not null, used_at timestamptz
);
create function public.accept_invite(nonce text, uid uuid, user_email text) returns uuid
language plpgsql set search_path='' as $$
declare invitation public.org_invites;
begin
  select * into invitation from public.org_invites where nonce_hash=nonce for update;
  if not found or invitation.used_at is not null or invitation.expires_at <= now()
    or lower(invitation.email) <> lower(user_email) then raise exception 'invalid invite'; end if;
  insert into public.memberships values(uid,invitation.org_id,invitation.role)
    on conflict(user_id,org_id) do nothing; -- Never downgrade an existing owner.
  update public.org_invites set used_at=now() where nonce_hash=nonce;
  return invitation.org_id;
end $$;
revoke all on function public.accept_invite(text,uuid,text) from public,anon,authenticated;
grant execute on function public.accept_invite(text,uuid,text) to service_role;
-- Bootstrap is serialized by user, so callback retries cannot create orphan orgs.
create function public.bootstrap_org(uid uuid) returns uuid language plpgsql set search_path='' as $$
declare oid uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  select org_id into oid from public.memberships where user_id=uid order by org_id limit 1;
  if oid is null then
    insert into public.orgs(name) values('My team') returning id into oid;
    insert into public.memberships values(uid,oid,'owner');
  end if;
  return oid;
end $$;
revoke all on function public.bootstrap_org(uuid) from public,anon,authenticated;
grant execute on function public.bootstrap_org(uuid) to service_role;
-- All tables use RLS. Server repositories also enforce membership and roles before using service_role.
alter table public.orgs enable row level security;
alter table public.memberships enable row level security;
alter table public.jobs enable row level security;
alter table public.work_maps enable row level security;
alter table public.work_map_versions enable row level security;
alter table public.sessions enable row level security;
alter table public.screen_events enable row level security;
alter table public.transcripts enable row level security;
alter table public.audit_entries enable row level security;
alter table public.stuck_feedback enable row level security;
alter table public.frames enable row level security;
alter table public.org_invites enable row level security;
create policy org_read on public.orgs for select to authenticated using(public.org_role(id) is not null);
create policy org_update on public.orgs for update to authenticated using(public.org_role(id)='owner') with check(public.org_role(id)='owner');
create policy members_read on public.memberships for select to authenticated using(public.org_role(org_id) is not null);
-- Membership mutations go through the signed invitation service; no self-promotion via REST.
create policy jobs_read on public.jobs for select to authenticated using(public.org_role(org_id) is not null);
create policy jobs_write on public.jobs for all to authenticated using(public.org_role(org_id) in ('owner','manager')) with check(public.org_role(org_id) in ('owner','manager'));
create policy maps_read on public.work_maps for select to authenticated using(public.org_role(org_id) is not null);
create policy versions_read on public.work_map_versions for select to authenticated using(public.org_role(org_id) is not null);
-- Map/history/audit writes are service-only: the API checks expert/manager/owner for map changes.
create policy sessions_read on public.sessions for select to authenticated using(public.org_role(org_id) is not null);
create policy events_read on public.screen_events for select to authenticated using(exists(select 1 from public.sessions s where s.id=session_id and public.org_role(s.org_id) is not null));
create policy transcripts_read on public.transcripts for select to authenticated using(exists(select 1 from public.sessions s where s.id=session_id and public.org_role(s.org_id) is not null));
create policy audit_read on public.audit_entries for select to authenticated using(public.org_role(org_id) is not null);
create policy feedback_read on public.stuck_feedback for select to authenticated using(public.org_role(org_id) is not null);
create policy frames_read on public.frames for select to authenticated using(exists(select 1 from public.sessions s where s.id=session_id and public.org_role(s.org_id) is not null));
create policy invites_read on public.org_invites for select to authenticated using(public.org_role(org_id) in ('owner','manager'));
-- Private objects use <org UUID>/<session id>/<frame id>. Storage read/write never relies on a public URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('frames','frames',false,1048576,array['image/jpeg']) on conflict(id) do nothing;
create policy frames_storage_read on storage.objects for select to authenticated
using(bucket_id='frames' and exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.org_id::text=(storage.foldername(name))[1]));
-- Uploads go through the session-owner checked API. No direct overwrite/delete permissions.
-- Replace a session snapshot atomically; avoids duplicate full-history event uploads.
create function public.save_session_history(sid text, oid uuid, events jsonb, transcript jsonb)
returns void language plpgsql set search_path='' as $$ begin
  perform 1 from public.sessions where id=sid and org_id=oid for update;
  if not found then raise exception 'unknown session'; end if;
  delete from public.screen_events where session_id=sid;
  insert into public.screen_events(session_id,event) select sid,value from jsonb_array_elements(events);
  insert into public.transcripts values(sid,transcript)
    on conflict(session_id) do update set lines=excluded.lines;
end $$;
revoke all on function public.save_session_history(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_session_history(text,uuid,jsonb,jsonb) to service_role;
