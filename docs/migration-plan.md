# Fitnaut-web: Supabase → Local SQLite Migration Plan

## Overview

Replace Supabase (remote Postgres + Auth) with a local SQLite database via Drizzle ORM. Remove all authentication (single-user, local-only web UI). Add REST API endpoints secured by an API key for the separate Hermes/Telegram agent. Migrate existing Supabase data.

### Key decisions

| Decision | Choice |
|---|---|
| Runtime | `next dev` on Mac mini |
| Database | SQLite via `better-sqlite3` |
| ORM | Drizzle |
| UI auth | None — open on localhost |
| API auth | Bearer token (`FITNAUT_API_KEY`) |
| Hermes agent | Separate service, language TBD |
| API spec | OpenAPI (`openapi.yaml`) |
| Data migration | One-time snapshot — dump, import, cut over |

---

## Phase 1: Environment & Dependency Setup

### 1.1 Install new dependencies

```bash
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3
```

### 1.2 Update `.env.local`

Remove all Supabase keys and add:

```
FITNAUT_DB_PATH=./data/fitnaut.db
FITNAUT_API_KEY=<generate-a-strong-random-string>
```

### 1.3 Create Drizzle config

`drizzle.config.ts`:
- Schema: `src/db/schema.ts`
- Out: `src/db/migrations/`
- Driver: `better-sqlite3`
- DB credentials from `.env.local`

---

## Phase 2: Define Drizzle Schema

### 2.1 Create `src/db/schema.ts`

Replaces `src/types/db.ts`. SQLite equivalents of all 7 Supabase tables:

| Table | Key changes |
|---|---|
| `exercises` | Drop FK to `auth.users`; `user_id` → `text` (UUID string); `weight_kg` → `real`; arrays stored as JSON text |
| `exercise_definitions` | Same columns; no RLS needed |
| `workout_sessions` | Drop FK to `auth.users`; `user_id` → `text` |
| `health_metrics` | Drop FK to `auth.users`; `user_id` → `text`; `date` → `text` |
| `user_preferences` | Drop FK to `auth.users`; `user_id` → `text` (PK) |
| `user_profiles` | Drop FK to `auth.users`; `user_id` → `text` (PK) |
| `user_api_keys` | Drop FK to `auth.users`; `user_id` → `text` (PK) |

### 2.2 Create `src/db/index.ts`

Database client singleton:
- Initialize `better-sqlite3` with `FITNAUT_DB_PATH`
- Export the Drizzle database instance
- Export `getDb()` helper function

### 2.3 Generate initial migration

```bash
npx drizzle-kit generate
```

---

## Phase 3: Data Migration from Supabase → SQLite

### 3.1 Write migration script

`scripts/migrate-from-supabase.ts`:
1. Use existing Supabase service client to fetch all rows from all 7 tables
2. Transform data (keep UUIDs as text strings, arrays as JSON)
3. Insert into SQLite via Drizzle
4. Log row counts per table for verification

### 3.2 Run migration

```bash
npx tsx scripts/migrate-from-supabase.ts
```

### 3.3 Verify data integrity

- Compare row counts per table
- Spot-check recent exercises
- Verify health metrics

### 3.4 Remove Supabase files

```bash
rm -rf supabase/
npm uninstall @supabase/ssr @supabase/supabase-js
```

---

## Phase 4: Replace All Supabase Queries with Drizzle

### 4.1 Shared user ID constant

Create `src/lib/constants.ts`:
```ts
export const DEFAULT_USER_ID = "<migrated-uuid>";
```

### 4.2 Client component queries

Pattern: Remove `supabase.auth.getUser()` → use `DEFAULT_USER_ID`. Replace `supabase.from().select()` with Drizzle queries.

| File | Queries to replace |
|---|---|
| `src/hooks/useExercises.ts` | `.from("exercises").insert()`, `.update()`, `.delete()`, `.select()` |
| `src/app/(app)/workout/page.tsx` | `.from("exercises").select("*").eq("user_id")...` |
| `src/app/(app)/history/page.tsx` | `.from("exercises").select("*").eq("user_id")...` (×2 locations) |
| `src/app/(app)/analytics/page.tsx` | `.from("exercises").select("*").eq("user_id")...` |
| `src/app/(app)/health/page.tsx` | `.from("health_metrics").select()`, `.delete()`, `.upsert()` |
| `src/app/(app)/settings/page.tsx` | `supabase.auth.getUser()` → read from `user_profiles` via Drizzle |

### 4.3 API routes

| File | Queries to replace |
|---|---|
| `src/app/api/ai/recommend/route.ts` | `.from("user_api_keys")`, `.from("exercises")`, `.from("user_profiles")` |
| `src/app/api/ai/save-key/route.ts` | `.from("user_api_keys").upsert()` |

---

## Phase 5: Remove Authentication

### 5.1 Files to delete

| File | Reason |
|---|---|
| `src/proxy.ts` | Auth middleware — no longer needed |
| `src/lib/getUser.ts` | Gets user from Supabase auth |
| `src/hooks/useUser.ts` | Client-side auth hook |
| `src/lib/supabase/client.ts` | Supabase browser client |
| `src/lib/supabase/server.ts` | Supabase server client |
| `src/lib/supabase/api.ts` | Supabase route handler client |
| `src/lib/supabase/service.ts` | Supabase service role client |
| `src/app/login/page.tsx` | Login/register page |
| `src/app/auth/callback/route.ts` | OAuth callback handler |

### 5.2 Files to simplify

| File | Changes |
|---|---|
| `src/app/(app)/layout.tsx` | Remove `supabase.auth.getUser()` + redirect; just render children with TabBar/ProfileMenu |
| `src/components/ProfileMenu.tsx` | Remove sign-out; optionally show app info or remove menu entirely |
| `src/app/(app)/settings/page.tsx` | Read username/email from local DB instead of Supabase auth metadata; remove sign-out button |

---

## Phase 6: Add REST API Endpoints

### 6.1 Create API auth middleware

`src/lib/api-auth.ts`:
```ts
export function validateApiKey(request: NextRequest): boolean
```
Compares `Authorization: Bearer xxx` against `process.env.FITNAUT_API_KEY`.

### 6.2 Endpoints

All under `src/app/api/v1/`. All require `Authorization: Bearer <FITNAUT_API_KEY>`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/exercises` | Log an exercise set. Body converts lbs→kg, miles→m internally. |
| `GET` | `/api/v1/exercises` | Get exercise history. `?from=&to=&limit=&order=` |
| `PUT` | `/api/v1/exercises/[id]` | Update an exercise set |
| `DELETE` | `/api/v1/exercises/[id]` | Delete an exercise set |
| `POST` | `/api/v1/health-metrics` | Log health metric (upsert by date) |
| `GET` | `/api/v1/health-metrics` | Get health metrics. `?from=&to=` |
| `GET` | `/api/v1/sessions` | Get workout sessions (grouped by time gap). `?from=&to=&limit=` |
| `GET` | `/api/v1/exercise-library` | Get full 66-exercise library as JSON |
| `POST` | `/api/v1/recommend` | Get AI workout recommendations. `{provider?, comment?}` |
| `GET` | `/api/v1/profile` | Get user profile + preferences |
| `PUT` | `/api/v1/profile` | Update user profile. `{name?, year_of_birth?, gender?, fitness_goals?}` |
| `GET` | `/api/v1/preferences` | Get user preferences |
| `PUT` | `/api/v1/preferences` | Update preferences. `{weight_unit?, distance_unit?, ...}` |

### 6.3 Response format

```json
// Success
{ "ok": true, "data": {...} }

// Error
{ "ok": false, "error": "message" }
```

### 6.4 Generate OpenAPI spec

`docs/openapi.yaml` — full API contract with all endpoints, auth scheme, request/response schemas, and examples. Usable by the Hermes agent developer for code generation, testing, and reference.

---

## Phase 7: Cleanup & Configuration

### 7.1 Update `.gitignore`

Add:
```
data/
```

### 7.2 Update `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 7.3 Auto-migrate on startup

In the root layout or a server component, run Drizzle migrations on first access (check if tables exist). Alternatively, require manual `npm run db:migrate` before first run.

### 7.4 Verify `next.config.ts`

Keep `allowedDevOrigins` for local network + ngrok access (unchanged).

---

## Phase 8: Testing & Verification

### 8.1 Web UI tests

- [ ] Workout logging (manual + voice)
- [ ] History browsing + session detail
- [ ] Analytics charts (calendar, volume, types, muscle groups, PRs)
- [ ] Health metric tracking + charts
- [ ] Settings page (AI key save)
- [ ] AI recommendations

### 8.2 API tests

```bash
# Log an exercise
curl -H "Authorization: Bearer $FITNAUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"exercise_name":"Squat","reps":10,"weight_lbs":135}' \
  http://localhost:3000/api/v1/exercises

# Get exercise history
curl -H "Authorization: Bearer $FITNAUT_API_KEY" \
  http://localhost:3000/api/v1/exercises?limit=10

# Get recommendations
curl -H "Authorization: Bearer $FITNAUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Focus on upper body today"}' \
  http://localhost:3000/api/v1/recommend
```

### 8.3 Data migration verification

- [ ] Row counts match between Supabase export and SQLite import
- [ ] Spot-check recent exercises for correct values
- [ ] Verify health metrics dates and values
- [ ] Confirm user preferences and profile carried over

---

## Files Summary

| Action | Count | Files |
|---|---|---|
| **Delete** | 8 | `src/proxy.ts`, `src/lib/getUser.ts`, `src/hooks/useUser.ts`, `src/lib/supabase/` (4 files), `src/app/login/page.tsx`, `src/app/auth/callback/route.ts` |
| **Rewrite** | 7 | `src/app/(app)/layout.tsx`, `workout/page.tsx`, `history/page.tsx`, `analytics/page.tsx`, `health/page.tsx`, `settings/page.tsx`, `src/components/ProfileMenu.tsx` |
| **Modify** | 3 | `src/hooks/useExercises.ts`, `src/app/api/ai/recommend/route.ts`, `src/app/api/ai/save-key/route.ts` |
| **Create** | ~14 | `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `src/lib/constants.ts`, `src/lib/api-auth.ts`, 6 route files under `src/app/api/v1/`, `scripts/migrate-from-supabase.ts`, `docs/openapi.yaml` |
| **Remove** | 3 | `supabase/` directory, `@supabase/ssr`, `@supabase/supabase-js` |

**Total: ~30 files touched** (8 deleted, 7 rewritten, 3 modified, ~14 created, 3 removed)
