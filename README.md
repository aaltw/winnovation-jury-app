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

---

## Deploy

The jury app is a **static single-page PWA** — there is no server to run for it. A
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

---

## Status & current limitations

- **Front-end is complete and works offline**, fully on-device. Each juror's scores live in
  that browser's IndexedDB.
- **Cross-device sync is not wired up yet.** `apps/sync-api` (a small SQLite-backed
  push/pull service, with a `Dockerfile`) and a `SyncClient` in `data-access` exist, but the
  PWA does not call them. So two jurors on two devices won't see each other's scores
  automatically — for the demo, each device works from its own (identical, seeded) `WIN-26`
  data. Wiring `SyncClient` into the app is the natural next step for a real two-device jury.

### Running the optional sync-api (for future work)

```sh
pnpm nx serve sync-api                 # http://localhost:8787 (PORT / DB_PATH env vars)
# or containerised:
docker build -f apps/sync-api/Dockerfile -t winnovation-sync-api .
docker run -p 8787:8787 winnovation-sync-api
```
