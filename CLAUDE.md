# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Winnovation Jury — an offline-first **PWA** for two jurors (slots **A** and **B**) to score, rank,
and reconcile student/maker projects at an event. Angular 21 (standalone + signals) in an Nx
monorepo, all data stored locally in the browser (IndexedDB via Dexie), installable as a PWA.
The UI is in **Dutch** (so are most domain terms: `deelnemer` = participant/project, `stand` =
booth, `jurylid` = juror).

## Commands

```sh
pnpm nx serve jury-app                 # dev server → http://localhost:4300
pnpm nx serve jury-app --host 0.0.0.0  # expose on the LAN (for two real devices)
pnpm nx build jury-app                 # prod build → dist/apps/jury-app/browser
pnpm nx run-many -t test               # all library unit tests (vitest)
pnpm nx test data-access               # one library's tests; append --watch to iterate
pnpm nx test jury-app                  # the app's tests (jest, NOT vitest — see below)
pnpm biome check .                     # lint + format check; add --write to fix
pnpm nx serve sync-api                 # optional backend → http://localhost:8787 (PORT/DB_PATH)
pnpm nx serve jury-app -c tunnel       # dev server for ngrok/reverse-proxy demos (HMR off, hosts allow-listed)
pnpm nx build sync-api                 # build the backend (precedes its docker build)
```

There is no top-level `npm run` script — drive everything through `nx`.

**Two test runners.** Libraries (`domain`, `data-access`, `ui`, `feature-jury`) use **vitest**
(`@nx/vitest`, analog plugin); the `jury-app` application uses **jest** (`jest.config.cts`). Run a
single library file with `pnpm nx test <lib> -- <path-or-pattern>`. Library DB tests run against
`fake-indexeddb`.

## Architecture

Four libraries plus two apps, wired by the `@winnovation/*` path aliases in `tsconfig.base.json`.
Dependency direction is strictly `domain ← data-access ← feature-jury`, with `ui` as leaf
presentational components. Nx eslint enforces these module boundaries.

- **`libs/domain`** — pure TypeScript, **no Angular, no I/O**. The model and all the scoring math:
  `model.ts` (types + `CRITERIA`), `fairness.ts` (rank-within-set, drift detection, final
  ranking), `placement.ts` (insertion-point math for ranking), `reconcile.ts` (A↔B disagreement,
  CSV export). This is where jury logic lives and where most unit tests are.
- **`libs/data-access`** — the persistence + sync layer. `db.ts` is the Dexie schema;
  `*.repo.ts` are thin table accessors; `jury.service.ts` (`JuryService`) composes repos +
  domain functions; `sync.ts`/`remote.ts` are the HTTP sync client; `seed.ts` seeds the demo.
- **`libs/ui`** — presentational standalone components + design tokens (`criteria.ts`). No store
  access; inputs/outputs only.
- **`libs/feature-jury`** — the seven routed screens (`join → home → stand → compare → review →
  reconcile → result`, lazy-loaded in `jury.routes.ts`) plus **`JuryStore`**, the single
  root-provided signal store that every screen talks to.
- **`apps/jury-app`** — the deployable PWA shell (router, service worker, dev-only demo seed).
- **`apps/sync-api`** — optional Hono backend for cross-device sync (`InMemoryStore` +
  SQLite-backed `sqlite-store.ts`). Has a `Dockerfile`.

### Key domain model (read before touching scoring)

- **`standNr`** is the identity of a project *within an event* and the **join key between the two
  judges**. **`eventId`** scopes everything — it is the first component of every composite key.
- Each judge gives every project a 1–5 `value` on each of the four `CRITERIA`
  (`innovativiteit`, `relevantie`, `haalbaarheid`, `impact`), plus a `rankPos` (1 = best, `null`
  = not yet placed) *per criterion*.
- **Final ranking** (`computeFinalRanking`): restrict each judge's per-criterion ranks to the
  projects *both* judges scored (`commonStandNrs`), renumber densely, average A's and B's rank
  per criterion, sum across criteria. **Lower `overall` = better.** Projects only one judge
  scored land in `incomplete`.
- **Drift** = a juror ranking a project above another while giving it a *lower* score
  (an inversion). `detectAllDrift` flags pairs; `computeDriftSeverity`/`driftList` grade by
  inversion count (≥3 = strong).

### JuryStore + sync model (the tricky part)

`JuryStore` (`feature-jury/src/lib/jury-store.ts`) owns the `JuryDb`, `JuryService`, and a
`SyncClient`, and exposes screen state as Angular signals (`event`, `judge`, `deelnemers`,
`scores`, `driftFlags`, …).

**Offline-first, IndexedDB is the source of truth; sync is best-effort.**
- `createEvent` asks the server to mint the shared `id`+`eventCode`; on failure it falls back to
  a **local-only** event (random id/code, no cross-device sync). `joinEvent` checks the local DB
  first, then the server.
- Writes call `pushSoon()` — a **coalescing, non-blocking** push loop: at most one in-flight push
  plus one queued follow-up that sends the latest snapshot. Reads call `pullNow()`. **All sync
  errors are swallowed** so the local cache keeps working offline.
- The server merges with **last-writer-wins on `updatedAt`** (epoch ms, stamped by the store's
  injectable `clock`). The `eventCode` is the shared secret, sent as the `x-event-code` header
  and checked by the sync-api.
- Sync is wired (commit `add5350`) and the README reflects this. `JuryStore` constructs
  `new RemoteGateway("/api")` (`jury-store.ts:51`) — a **relative** `/api`. The sync-api serves
  its routes with **no** `/api` prefix (`/events`, `/events/:code/join`,
  `/events/:eventId/changes`), so whatever fronts the app must route `/api/*` to the sync-api
  **and strip the prefix**. Locally that's the dev-server proxy
  (`apps/jury-app/proxy.conf.json`); in prod it's the reverse proxy (see Deploy).

`JuryStore` has `*ForTest` seams (`setClockForTest`, `setDbForTest`, `setRemoteForTest`,
`settleSyncForTest`, `resetForTest`) — use these for deterministic store tests rather than mocking
internals.

### Dexie schema migrations (`db.ts`)

Schema is at **v4**. The v3→v4 step **drops and recreates** `scores` and `captureMeta` to add
`eventId` as the first key component (two events reusing a `standNr` previously collided).
IndexedDB primary keys are immutable and Dexie refuses in-place primary-key changes, so
drop-then-recreate is the only path — the dropped rows are the pre-fix contaminated data. Demo
re-seeds and real events re-sync. **Any future change to a composite primary key needs the same
drop/recreate dance, not an in-place edit.**

### Demo data

In **dev mode only**, `provideAppInitializer` in `apps/jury-app/src/app/app.config.ts` calls
`seedDemo()` to create the **`WIN-26`** event with a full two-judge dataset (6 projects, scores,
ranks, an intentional drift flag and an A↔B disagreement). Never runs in production; failures are
swallowed. To reset: clear site storage / delete the `winnovation-jury` IndexedDB database.

## Conventions

- **Biome** for format + lint (`biome.json`, 2-space, width 100) — **not** Prettier/ESLint for
  style. ESLint is present only to enforce Nx module boundaries.
- Standalone components, `inject()` over constructor DI, signals over RxJS, `kebab-case.*.ts`.
- `JuryEvent` (not `Event`) is deliberately named to avoid clashing with the DOM `Event` type.

## Deploy

The PWA is static files (`dist/apps/jury-app/browser`). A host needs: SPA fallback to
`/index.html`, served at the domain root (router uses absolute paths; otherwise rebuild with
`--base-href`), and HTTPS for the service worker. See README for Netlify/Vercel/Cloudflare/Azure
examples.

**Cross-device sync needs the sync-api behind the same origin.** The client calls a relative
`/api` (see sync note above), so the reverse proxy must route `/api/*` to the sync-api and
**strip the `/api` prefix** (server routes have none). Same origin → no CORS, no code change.

- **Homelab (Nginx Proxy Manager):** static-server container (`nginx:alpine` serving the build
  with SPA fallback, `deploy/frontend.nginx.conf`) on `:8080`, sync-api Docker container on
  `:8787` (SQLite on a named volume, `DB_PATH=/app/data/jury.db`). NPM Proxy Host → `:8080`
  with a Let's Encrypt cert, plus a Custom Location `/api` → `:8787` whose advanced config does
  `rewrite ^/api/?(.*)$ /$1 break;`. Full runbook: `deploy/nginx-proxy-manager.md`.
- **Local demo over a public URL:** `pnpm nx serve jury-app -c tunnel` + `pnpm nx serve sync-api`
  + an ngrok tunnel to `:4300` — the dev-server proxy (`apps/jury-app/proxy.conf.json`) handles
  the `/api` split. The `tunnel` serve config allow-lists the proxy hosts and disables HMR/
  live-reload (the Vite `wss://` socket can't cross a TLS tunnel). See README.
- A prod build does **not** auto-seed `WIN-26` (dev-only, gated on `isDevMode()`) and the
  service worker is enabled — on the live site you create a real event via the server.

See `deploy/` for the production infra files.
