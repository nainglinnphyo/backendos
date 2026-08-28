# BackendOS

A developer-friendly Postgres backend: define tables from a dashboard (or the API), and get an
automatic CRUD API plus a fully type-safe TypeScript client generated from your real schema.

v1 scope is deliberately database-only - no storage, file uploads, or social login, and no
auth-as-a-service for *your* app's end users. Every data-plane request is authenticated by a
single project-level API key. (The dashboard itself does have real accounts - see "Dashboard
accounts" below - that's about who can manage projects, not your projects' own users.)

```
BackendOS Dashboard → Create Project → Define Tables → BackendOS generates API + Types
                                                              ↓
                              Developer connects with URL + Access Key → type-safe client
```

## Monorepo layout

```
packages/
  schema-engine/   introspection, DDL builder, query builder, TypeScript codegen (the "engine")
  client/          @backendos/client - the runtime SDK (createBackendOS<Database>(...))
  cli/             backendos CLI - `backendos generate` / `backendos pull`
apps/
  api/             Fastify server - project/table management (admin API) + auto-generated data API
  dashboard/       Next.js dashboard - create projects, manage tables/columns/keys
```

Everything is plain TypeScript + pnpm workspaces (no build framework needed beyond `tsc`).

## Quick start

```bash
pnpm install
pnpm db:up                     # starts Postgres in docker on localhost:54329

cp apps/api/.env.example apps/api/.env
pnpm dev:api                   # http://localhost:8787

cp apps/dashboard/.env.example apps/dashboard/.env.local
pnpm dev:dashboard             # http://localhost:3100 (see apps/dashboard/package.json)
```

Open the dashboard, sign up for an account (`/signup` - just email + password, no invite needed),
then create a project and add a `users` table. The dashboard shows the generated Project URL and
a one-time API key right after creation - copy it, you won't see it again.

### Using the generated client in your own app

```bash
cd your-app
npx --package @backendos/cli backendos init --url http://localhost:8787/p/my-app
export BACKENDOS_ACCESS_KEY=bko_live_xxxxxxxx
npx --package @backendos/cli backendos generate    # or `backendos pull`
```

This writes `backendos-types.ts` - a self-contained module with `Database`, `UsersRow`,
`UsersInsert`, `UsersUpdate`, etc., and a `createBackendOS()` factory already bound to your
project's schema:

```ts
import { createBackendOS } from "./backendos-types";

const backendos = createBackendOS({
  url: "http://localhost:8787/p/my-app",
  accessKey: process.env.BACKENDOS_ACCESS_KEY!,
});

const users = await backendos.users.findMany({
  where: { age: { gte: 18 } },
  orderBy: { createdAt: "desc" },
  limit: 20,
});

await backendos.users.create({ name: "Naing", email: "naing@example.com", age: 30 }); // ✅
await backendos.users.create({ age: "25" }); // ❌ compile-time error
```

Re-run `backendos generate` any time the schema changes (new table, new column, etc.) to refresh
the types and client.

## Architecture decisions worth knowing about

**Isolation strategy: schema-per-project.** All projects share one Postgres instance; each gets
its own schema (`proj_<random>`), decoupled from its human-readable slug so renaming a project
never breaks anyone's URL. Every DB-touching code path goes through a `TenantContext { pool,
schemaName }` ([apps/api/src/db/pool.ts](apps/api/src/db/pool.ts)) rather than assuming a shared
pool directly - upgrading a project to its own dedicated database later means changing
`getTenantContext()` in one place, not rewriting the DDL/introspection/query-builder layers.

**Auto API wire format: RPC-style POST per operation**, e.g. `POST /v1/users/findMany`, rather
than REST query-string filters. This keeps the request body a plain typed JSON object
(`where`/`orderBy`/`select`/`data`) that maps 1:1 to both the SQL query builder on the server and
the generic TypeScript arguments on the client, with no query-string mini-DSL to keep in sync.

**Project URL vs. API key.** The API key alone identifies the project (per spec) - there's no
wildcard DNS in this v1, so "Project URL" is a path-prefixed form of the API's own address
(`/p/:slug/v1/...`). The slug in the URL is still checked against the key's actual project, so a
key can't be pointed at the wrong project's URL by mistake. Swapping in real subdomains later
(`https://my-app.backendos.dev`) is a routing/DNS change, not an API contract change - the client
just calls `${url}/v1/...` regardless of which form `url` takes.

**camelCase on the wire.** Postgres columns are typically `snake_case`; generated types and every
request/response field are `camelCase` (`created_at` → `createdAt`), matching the Prisma/tRPC-like
DX the client aims for. The mapping is computed once during introspection
([naming.ts](packages/schema-engine/src/naming.ts)) and reused by both the SQL builder (column
aliasing) and the type generator.

**Dates are real `Date` objects, not strings.** JSON has no date type, so the API sends
timestamps as ISO strings; the generated client ships a small runtime schema descriptor
(`backendOSSchema`) alongside the types telling the client SDK which fields to convert back into
`Date` on the way in.

**No direct Postgres credentials are ever handed to applications.** The "connection info" the
dashboard shows is informational only. This keeps the API-key model as the single enforced
boundary instead of a second, easier-to-misuse one.

**The dashboard has its own real accounts, separate from project API keys.** Signing into the
BackendOS dashboard (`/signup`, `/login`) is a normal email/password account with a server-side
session (opaque token, sha256-hashed at rest, 30-day expiry) - this is who's allowed to *manage*
projects, analogous to logging into supabase.com itself. It's unrelated to a project's own API
key, which just identifies that project for data-plane requests and has nothing to do with the
dashboard. Every project has an `owner_id`; free accounts are capped at 3 projects
(`users.max_projects`), enforced server-side on create. This is still not end-user auth *for
projects* (i.e. BackendOS itself doesn't offer an auth-as-a-service product to your app's users
yet) - that part of the original scope is unchanged.

## API reference (short version)

Auth (no session required for signup/login):

| Method & path | Does |
|---|---|
| `POST /auth/signup` | `{ email, password }` → creates an account + session token |
| `POST /auth/login` | `{ email, password }` → session token |
| `POST /auth/logout` | Invalidates the current session |
| `GET /auth/me` | Current user + project count (session required) |

Admin API (`Authorization: Bearer <session token>`, scoped to the signed-in user's own projects):

| Method & path | Does |
|---|---|
| `POST /admin/projects` | Create a project (also creates its schema + first API key); 403 past the account's project limit |
| `GET /admin/projects` / `/:id` | List / view projects |
| `PATCH /admin/projects/:id` | Rename |
| `DELETE /admin/projects/:id` | Delete (drops the schema) |
| `GET /admin/projects/:id/status` \| `/connection` | Status + connection info |
| `POST/GET/DELETE .../api-keys[/:keyId]`, `.../regenerate` | API key lifecycle |
| `GET/POST/PATCH/DELETE .../tables[/:table]` | Table CRUD |
| `POST/PATCH/DELETE .../tables/:table/columns[/:column]` | Column CRUD |
| `POST .../unique-constraints`, `.../foreign-keys`, `DELETE .../constraints/:name` | Constraints |
| `POST .../indexes`, `DELETE .../indexes/:name` | Indexes |

Data API (`Authorization: Bearer bko_live_...`, or `x-backendos-key` header):

| Path | Body |
|---|---|
| `POST /v1/:table/findMany` (or `/p/:slug/v1/...`) | `{ where?, orderBy?, limit?, offset?, select? }` |
| `POST /v1/:table/findUnique` | `{ where, select? }` - `where` must fully specify a PK/unique constraint |
| `POST /v1/:table/create` | `{ data: {...} \| [...] }` |
| `POST /v1/:table/update` | `{ where, data }` - `where` must be non-empty |
| `POST /v1/:table/delete` | `{ where }` - must be non-empty |
| `POST /v1/:table/count` | `{ where? }` |
| `GET /v1/schema` | Full introspected schema JSON (what `backendos generate` reads) |

`where` filters: `{ col: value }` (equals), or `{ col: { equals, not, gt, gte, lt, lte, in, notIn,
contains, startsWith, endsWith } }`, composable with `AND` / `OR` / `NOT`.

## What's not built (by design, per v1 scope)

Storage/file uploads, social login, and auth-as-a-service *for your app's own users* are
explicitly out of scope for this version. (Dashboard accounts for managing BackendOS projects
themselves - signup/login/sessions/per-account limits - are in, described above.)
