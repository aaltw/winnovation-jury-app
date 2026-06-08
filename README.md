# Winnovation Jury

An offline-first **PWA** for jurying innovative student/maker projects at an event.
Two jurors (A and B) each score every project at its stand, rank them against the
projects they've already seen, and then **reconcile** their views into one fair final
ranking. The interface is in Dutch.

The app is built with **Angular 21** (standalone components + signals) in an **Nx**
monorepo, stores everything **locally in the browser** (IndexedDB via Dexie), and is
installable as a Progressive Web App.

---

## Quick start

> Prerequisites: **Node 20+** (developed on 24) and **pnpm** (`corepack enable` or
> `npm i -g pnpm`).

```sh
pnpm install
pnpm nx serve jury-app           # http://localhost:4300
# expose to other devices on your network:
pnpm nx serve jury-app --host 0.0.0.0 --port 4300
```

Open the app, enter the event code **`WIN-26`**, pick **Jurylid A** or **B**, and press
**Start**.

### Demo data (the `WIN-26` event)

In **dev mode only**, the app automatically seeds a demo event with code **`WIN-26`** the
first time it loads: 6 projects, both jurors fully scored and ranked, notes, plus an
intentional "drift" flag and A↔B disagreement so every screen (home, compare, review,
reconcile, result) has real content to explore. This is wired in
`apps/jury-app/src/app/app.config.ts` via `provideAppInitializer` and **never runs in a
production build**.

To start from a clean slate, clear the site's storage (DevTools → Application → Storage →
*Clear site data*, or delete the `winnovation-jury` IndexedDB database) and reload.

---

## Project layout

```
apps/
  jury-app/        # the Angular PWA (this is what you deploy)
  sync-api/        # optional backend for cross-device sync — see "Status" below
libs/
  domain/          # pure domain model + fairness/placement/reconcile logic
  data-access/     # Dexie IndexedDB layer, repositories, JuryService, demo seeder
  ui/              # presentational components + design tokens
  feature-jury/    # the seven screens + signal store + routing
```

## Common commands

```sh
pnpm nx serve jury-app                 # dev server
pnpm nx build jury-app                 # production build  → dist/apps/jury-app/browser
pnpm nx run-many -t test               # all unit tests (vitest)
pnpm nx test data-access               # one project's tests
pnpm biome check .                     # lint / format check
```

### Local testing over ngrok

To demo the app over a public HTTPS URL (e.g. on a phone) with cross-device sync working,
run the sync-api alongside the dev server and tunnel `:4300`:

```sh
pnpm nx serve sync-api                 # :8787  (so /api resolves)
pnpm nx serve jury-app -c tunnel       # :4300, HMR off, ngrok hosts allow-listed
ngrok http 4300                        # → https://hubbly-nonpendent-tyrell.ngrok-free.dev/
```

The dev server's own proxy (`apps/jury-app/proxy.conf.json`) forwards `/api` to the local
sync-api, so only `:4300` needs to be public. The `tunnel` configuration disables Vite's
HMR / live-reload socket — that `wss://` connection can't cross the TLS tunnel, so you refresh
manually instead. This is a dev-server convenience for demos, **not** the production path (see
Deploy below).

---

## Deploy

The jury app is a **static single-page PWA** — the frontend has no server of its own. A
production build emits plain static files:

```sh
pnpm nx build jury-app
# output: dist/apps/jury-app/browser/
```

Host that `browser/` folder on any static host. Three requirements:

1. **SPA fallback** — rewrite all unknown routes to `/index.html` (the app uses client-side
   routing for `/home`, `/stand`, `/compare`, …).
2. **Serve at the domain root** — the router uses absolute paths. If you must serve from a
   sub-path, rebuild with `--base-href=/your-subpath/`.
3. **HTTPS** — required for the service worker / installability (all the hosts below give
   you this automatically).

### Cross-device sync in production

The client calls a **relative** `/api`; the optional `apps/sync-api` backend serves its routes
**without** that prefix (`/events`, `/events/:code/join`, …). So a production deploy that wants
cross-device sync needs the static frontend and the sync-api behind **one origin**, with the
reverse proxy routing `/api/*` to the sync-api and **stripping the `/api` prefix**. Same origin
→ no CORS, no code change.

```
browser ──HTTPS──▶ reverse proxy (your domain, TLS)
                          │
        ┌─────────────────┴───────────────────────┐
   /api/*  (strip prefix)                    everything else
        │                                          │
  sync-api container (:8787,                static-server container
  SQLite on a volume)                       (dist/.../browser, SPA fallback)
```

The homelab deployment behind **Nginx Proxy Manager** is documented step-by-step in
[`deploy/nginx-proxy-manager.md`](deploy/nginx-proxy-manager.md), with the static-server config
in [`deploy/frontend.nginx.conf`](deploy/frontend.nginx.conf).

> **Dev vs. prod differences to expect on the live site:** a production build does **not**
> auto-seed the `WIN-26` demo event (that is dev-only, gated on `isDevMode()` in
> `app.config.ts`), and the service worker **is** enabled. So on the live site you create a real
> event via the server rather than starting from the seeded demo.

### Examples

**Netlify** — add a `netlify.toml` at the repo root, then connect the repo or run `netlify deploy --prod`:

```toml
[build]
  command = "pnpm install && pnpm nx build jury-app"
  publish = "dist/apps/jury-app/browser"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Vercel** — Framework preset *Other*; Build command `pnpm nx build jury-app`; Output
directory `dist/apps/jury-app/browser`. Add a rewrite of `/(.*)` → `/index.html`.

**Cloudflare Pages** — Build command `pnpm nx build jury-app`; Build output
`dist/apps/jury-app/browser`; SPA fallback is on by default.

**Azure Static Web Apps** — `app_location: "/"`, `output_location:
"dist/apps/jury-app/browser"`, and a `staticwebapp.config.json` with a navigation fallback
to `/index.html`.

**Any host / quick local check** — serve the folder statically with a SPA fallback:

```sh
npx serve -s dist/apps/jury-app/browser -l 8080
```

These static hosts serve the frontend only. For cross-device sync on any of them you must also
host the sync-api separately and add an equivalent `/api` → sync-api rewrite (with the `/api`
prefix stripped) at the platform's edge — Netlify/Vercel rewrites, Cloudflare rules, an Azure
Static Web Apps `route`, etc. Without that, the app still works fully offline on each device but
the two jurors won't see each other's scores.

---

## Status & current limitations

- **Front-end is complete and works offline**, fully on-device. Each juror's scores live in
  that browser's IndexedDB, which is the source of truth.
- **Cross-device sync is wired up** (commit `add5350`). `JuryStore` pushes/pulls through a
  `SyncClient` against `apps/sync-api` (a small SQLite-backed push/pull service, with a
  `Dockerfile`). It works as soon as a sync-api is reachable and the proxy routes `/api` to it
  (see Deploy). Sync is best-effort — all sync errors are swallowed so the local cache keeps
  working offline.
- **Caveats:**
  - **Photos are device-local** — captured images are not synced, only scores/ranks/notes.
  - **An event created while offline is local-only** — if the server can't be reached at
    creation time, the event falls back to a random local id/code and **can't be joined from
    another device**. Create events online for a real two-device jury.

### Running the optional sync-api

```sh
pnpm nx serve sync-api                 # http://localhost:8787 (PORT / DB_PATH env vars)
# or containerised:
pnpm nx build sync-api
docker build -f apps/sync-api/Dockerfile -t winnovation-sync-api .
docker run -p 8787:8787 winnovation-sync-api
```

For local testing over a public HTTPS URL with sync working, see
[Local testing over ngrok](#local-testing-over-ngrok) above; for the homelab production
deployment see [`deploy/nginx-proxy-manager.md`](deploy/nginx-proxy-manager.md).
