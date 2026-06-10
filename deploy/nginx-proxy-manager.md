# Deploying Winnovation Jury behind Nginx Proxy Manager

Runbook for hosting the PWA at **https://winnovation.wouterhomelab.com/** on the homelab,
fronted by **Nginx Proxy Manager (NPM)**.

## Topology

```
browser ──HTTPS──▶ Nginx Proxy Manager (winnovation.wouterhomelab.com, Let's Encrypt)
                          │
        ┌─────────────────┴───────────────────────┐
  Custom Location /api  (advanced: strip prefix)   main proxy host
        │                                          │
  http://<host-ip>:8787                    http://<host-ip>:8080
  sync-api container                       static-server container
  (SQLite on a volume)                     (serves dist/.../browser, SPA fallback)
```

NPM only proxies — it does not serve files — so production needs a tiny static-server
container behind it (NPM forwards to it). NPM does the `/api` split via a Custom Location
whose advanced config strips the `/api` prefix (the sync-api routes have **no** prefix:
`/events`, `/events/:code/join`, `/events/:eventId/changes`). The client calls a **relative**
`/api`, so frontend and API share one origin → no CORS, no code change.

## Steps

### 1. Build the frontend

```sh
pnpm nx build jury-app
```

Copy `dist/apps/jury-app/browser` to the host, e.g. `/srv/winnovation-jury/browser`, and copy
`deploy/frontend.nginx.conf` to `/srv/winnovation-jury/frontend.nginx.conf`.

> A production build does **not** auto-seed the `WIN-26` demo event (that is dev-only) and the
> service worker **is** enabled. On the live site you create a real event via the server.

### 2. Run the static-server container

Pure static files + SPA fallback (no `/api` here — NPM handles that):

```sh
docker run -d --name winnovation-frontend -p 8080:80 \
  -v /srv/winnovation-jury/browser:/usr/share/nginx/html:ro \
  -v /srv/winnovation-jury/frontend.nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
```

### 3. Build + run the sync-api container

```sh
pnpm nx build sync-api
docker build -f apps/sync-api/Dockerfile -t winnovation-sync-api .
docker run -d --name winnovation-sync-api -p 8787:8787 \
  -v winnovation-sync-data:/app/data -e DB_PATH=/app/data/jury.db \
  winnovation-sync-api
```

`nx build sync-api` must precede `docker build` — the Dockerfile copies `dist/apps/sync-api`.
`DB_PATH` + the named volume keep the SQLite DB across restarts; the default `jury.db` would
otherwise live in the container's ephemeral CWD and vanish on recreate.

### 4. NPM — Proxy Host

- **Domain:** `winnovation.wouterhomelab.com`
- **Forward to:** `http://<host-ip>:8080` (the static-server container)
- **SSL tab:** request a Let's Encrypt certificate and enable **Force SSL**. HTTPS is required
  for the service worker / PWA install.

### 5. NPM — Custom Location `/api`

On that same Proxy Host, add a **Custom Location** `/api` → Forward `http://<host-ip>:8787`
(the sync-api container). The server routes have no `/api` prefix, so strip it in the
location's **Advanced** box:

```nginx
rewrite ^/api/?(.*)$ /$1 break;

# Server-Sent Events (live sync): disable buffering or the stream never flushes.
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 1h;
proxy_http_version 1.1;
proxy_set_header Connection '';
```

Verify: `curl -X POST https://winnovation.wouterhomelab.com/api/events …` should mint an event
(NPM strips `/api` → sync-api sees `POST /events`).

> **Alternative (config-as-code).** If you prefer not to use an NPM Custom Location, skip step 5
> and put the split in `frontend.nginx.conf` instead — add an `/api` block that strips the prefix
> with a trailing slash on `proxy_pass`:
>
> ```nginx
> location /api/ {
>   proxy_pass http://<host-ip>:8787/;   # trailing slash strips the /api prefix
> }
> ```
>
> This requires both containers to reach each other (put them on a shared Docker network and
> use the container name instead of `<host-ip>`), and NPM just forwards everything to `:8080`.

## Verify

- Load `https://winnovation.wouterhomelab.com/` → app loads, **no** Vite WebSocket errors (a
  production build ships no Vite dev client).
- `/api/*` returns 200 through NPM; `curl -X POST .../api/events …` mints an event.
- Create an event on device A, join it on device B → scores sync across devices.
- Open DevTools → Network → filter "stream": `GET /api/events/<id>/stream` stays **pending/open**
  (not closed after a few seconds). A score on the other device appears live without navigation.
- Restart the sync-api container (`docker restart winnovation-sync-api`) → data persists
  (volume).
