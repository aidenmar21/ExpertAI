# Supabase: accounts, orgs, persistence

ExpertAI runs in two modes, picked at startup from environment variables:

| Mode | When | Jobs | Work Maps | Audit log | Sign-in |
|---|---|---|---|---|---|
| Demo (default) | any of the three Supabase vars missing | `shared/jobs/*.json` | browser localStorage + `data/workmaps/<job>.json` | `data/audit/<session>.jsonl` | none |
| Multi-tenant | all three set | `public.jobs` per org | `public.work_maps` (versioned) + localStorage cache | `public.audit_entries` (hash chain) | email magic link |

Nothing changes for the demo until all three variables are set.

## 1. Create the project

1. Create a project at supabase.com (any region; note the database password).
2. **Project Settings → API Keys**: copy the **publishable** key (`sb_publishable_...`) and a **secret** key (`sb_secret_...`).
   Legacy JWT `anon` / `service_role` keys work too.
3. **Project Settings → Data API**: copy the project URL (`https://<ref>.supabase.co`).

## 2. Apply the schema, then the seed

Run these files in this order, once:

1. `supabase/migrations/0001_init.sql`: tables, RLS policies, functions, the private `frames` bucket.
2. `supabase/migrations/0002_anonymous_sessions.sql`: lets demo-org sessions have no user (extension, public `/`).
3. `supabase/seed.sql`: the demo org (`00000000-0000-4000-8000-000000000001`) and the two demo jobs. No users.

Either:

- **SQL editor** (Dashboard → SQL Editor → New query): paste each file's contents and click Run, in order.
- **psql** with the connection string (Dashboard → Connect → "Session pooler" or "Direct"):

  ```bash
  export DB_URL='postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_anonymous_sessions.sql
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
  ```

- Or the Supabase CLI: `supabase link --project-ref <ref> && supabase db push`, then run `seed.sql` with psql.

`seed.sql` is idempotent (re-running refreshes the job profiles). It embeds `shared/jobs/*.json`; regenerate it after
editing a job file.

## 3. Auth settings

Dashboard → **Authentication → URL Configuration**:

- Site URL: where the app runs, e.g. `http://localhost:3000`.
- Redirect URLs: add `http://localhost:3000/auth/callback` (and the LAN / deployed origins you use, each with `/auth/callback`).

Email provider is on by default. The built-in mailer is rate limited (a few emails per hour); add custom SMTP under
Authentication → Emails for a team.

## 4. Environment variables

In `app/.env.local` (never commit it; `.env.example` lists the names empty):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # publishable key; safe in the browser
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...            # secret key; server only, bypasses RLS
# optional: EXPERTAI_DEMO_ORG_ID=<uuid>            # if you seeded the demo org under another id
```

Restart `next dev` after changing them (`NEXT_PUBLIC_*` values are inlined at build time).
The secret key also signs invite tokens, so rotating it invalidates outstanding invite links.

## 5. Sign in and invite teammates

1. Open `/login`, enter your email, click the link. The first sign-in creates an org ("My team") with you as `owner`
   and copies the demo jobs into it. You land on `/jobs`.
2. Invite a teammate (owner or manager) from the browser console on any app page while signed in:

   ```js
   await (await fetch("/auth/invite", { method: "POST", headers: { "content-type": "application/json" },
     body: JSON.stringify({ email: "friend@example.com", role: "expert" }) })).json()
   // -> { url: "http://localhost:3000/auth/invite?token=..." }
   ```

   Roles: `manager`, `expert`, `new_hire` (managers cannot invite managers). Send them the URL. The link is
   single-use, bound to that email, and expires after 7 days. Opening it signs them in (magic link) and adds the
   membership.
3. Sign out: `POST /auth/signout` (clears the session cookie and the browser's local cache).

Roles: `owner` / `manager` manage jobs (create, save discovered screens); `owner` / `manager` / `expert` build and
edit Work Maps; `new_hire` reads. Every member reads their org's jobs, maps, sessions and audit log.

## Data model

```
auth.users ──< memberships >── orgs                     (role: owner | manager | expert | new_hire)
                                 │
                                 ├──< jobs (slug, profile jsonb, role_id, software_ids)
                                 │      ├── work_maps (1 per job: map jsonb, version, confirmed_at, updated_by)
                                 │      │      └──< work_map_versions (immutable snapshot per save; trigger)
                                 │      └──< stuck_feedback (signals jsonb, label)
                                 ├──< sessions (id = hash(org,user)_<browser id>, job, user|null, kind expert|new_hire)
                                 │      ├──< screen_events (event jsonb, on-record only)
                                 │      ├── transcripts (lines jsonb, redacted)
                                 │      ├──< audit_entries (seq, ts, actor, type, payload, prev_hash, hash; pk session+seq)
                                 │      └──< frames (frame_id, storage_path -> storage bucket "frames"/<org>/<session>/<frame>)
                                 └──< org_invites (nonce_hash, email, role, expires_at, used_at)
```

- **RLS** is on for every table: members read their org's rows. Writes go through server routes using the secret
  key, which check membership and role first (`app/lib/db/server.ts`); map saves use `save_work_map` (compare-and-swap
  on `version`, 409 on conflict), history comes from the `work_map_history` trigger.
- **Audit chain**: the server computes `hash` over the canonical entry; `unique(session_id, seq)` elects one writer
  and losers retry on the new head. `GET /api/audit?session=` re-verifies the chain.

## How the app uses it

- `app/lib/db/*`: repository (jobs, workMaps, audit, sessions, invites). Each function falls back to the file code
  path when Supabase is off.
- API routes keep their request/response shapes. New: `GET /api/workmap?job=<id>` (latest server map, version in the
  `x-workmap-version` header) and `PUT /api/workmap { job_id, map, version }`.
- `app/lib/workmap.ts`: localStorage stays the cache; when signed in with Supabase on, it loads the server map on
  first use and saves local edits through `PUT /api/workmap`.
- `app/proxy.ts` (Next 16's middleware): public `/`, `/login`, `/auth/*`; other pages redirect to `/login`, other APIs
  return 401 without a session. Cross-origin writes are refused except the two extension APIs below.

## Known gaps

- **Extension auth**: `/api/check` and `/api/audit` stay open for the Chrome extension (cross-origin, no cookies).
  Without a session they are scoped to the demo org (read the demo map, append to anonymous demo sessions; `GET
  /api/audit` lists the demo org's sessions). Next step: an org API key header (`x-expertai-key`) mapped to an org.
- **Public `/`** shows the demo org's jobs when signed out; its live calls (`/api/vision`, `/api/question`, ...) need
  a session, so the expert loop works only when signed in.
- **Work Map build duplication**: `app/lib/db/brain.ts` mirrors `brain/server.ts buildWorkMap` because brain loads job
  profiles from files. Fix: let brain accept an explicit `JobProfile`, then delete the mirror.
- **Frames**: the `frames` table and bucket exist, but nothing uploads frames yet (frames are never stored today).
- **Stats** (`app/lib/stats.ts`) stay in localStorage only.
- No org switcher or invite UI yet (the `expertai-org` cookie selects among memberships; the invite API is above).
- Clearing a map in the browser (demo reset) clears the local cache only; the server copy remains.
