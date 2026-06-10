# Two-device jurying: discovery, sessions, and live sync

**Date:** 2026-06-08
**Status:** Approved design, pre-implementation
**Branch:** `feat/winnovation-jury-pwa`

## Problem

Cross-device sync is wired (`JuryStore` ↔ `apps/sync-api`, commit `add5350`) and works once a
sync-api is reachable and `/api` is routed to it. But the two-juror experience has gaps that make
it feel broken in practice:

1. **No discovery.** Juror B can only reach an event by typing its random `eventCode`. The code is
   server-minted and unmemorable; the event *name* is not the code, which reliably trips users
   (observed: three events all named "WIN26", joined by typing "WIN26" → 404).
2. **No session persistence.** On refresh the active event is lost and the app drops to the join
   screen. Data survives in IndexedDB, but the session does not, so it *looks* like data loss.
3. **No live updates.** `pullNow()` runs only on join/navigation — there is no background refresh,
   so a juror never sees the other's changes without manually navigating.
4. **Codes are opaque.** The minted code is shown but not copyable; no easy way to share it.

These are the five improvements approved with the user (see Decisions).

## Goals

- Juror B can **discover and tap** the event juror A created — no code typing.
- A refresh/relaunch **restores** the juror back into their event.
- Each juror's changes appear on the other's device **in real time**.
- The event code is **visible and copyable**.
- Everything stays **offline-first** — IndexedDB remains the source of truth; the network is
  best-effort.

## Non-goals (YAGNI)

- **Photo sync** — photos remain device-local; only scores/ranks/notes/participants sync.
- **Real authentication** — the deployment is a trusted private instance; the `eventCode` stays a
  lightweight write-guard, not a security boundary.
- **Multi-process server** — the live-update pub/sub is in-process; a single sync-api container is
  assumed (documented as a limitation).
- **Offline-created-event reconciliation** — an event created while the server is unreachable is
  still local-only (random id/code); unchanged from today.

## Decisions (from brainstorming)

| # | Feature | Decision |
|---|---------|----------|
| 1 | Event discovery | **Trusted instance.** `GET /events` lists all events; both screens show a tap-to-join list by name. |
| 2 | Session persistence | Persist `{eventId, judge}`; restore straight into the event on launch/refresh. |
| 3 | Live refresh | **SSE, ping-then-pull.** Server emits a bare "changed" notification; client reacts by calling the existing `pull()` (reuses LWW merge; a dropped socket self-heals via a pull on reconnect). |
| 4 | Codes | Keep auto-generated codes; **show + copy** on home/event card. No custom codes. |
| 5 | Server sync | Already functional; this work makes it discoverable, live, and resilient. |

## Architecture

```
  Browser A                         sync-api (1 container)                 Browser B
  ─────────                         ──────────────────────                 ─────────
  JuryStore                                                                JuryStore
   ├─ RemoteGateway ──POST /api/events/:id/changes──▶ applyChanges ─┐      │
   │                                                  (SqliteStore)  │      │
   │                                                   ChangeBus.publish(id)│
   │                                                        │              │
   └─ ChangeStream ◀──SSE  GET /api/events/:id/stream───────┴──notify────▶ ChangeStream
        on "changed" → pull() → merge → bump revision signal → UI refresh

  GET /api/events  ──▶ listEvents()  (both browsers render the tap-to-join picker)
```

Same origin via the reverse proxy (`/api` → sync-api, prefix stripped). Photos never leave the
capturing device.

## Server changes — `apps/sync-api`

### `SyncStore` interface (`store.ts`)

Add list + count, implemented by both `InMemoryStore` and `SqliteStore`:

```ts
export interface EventListItem extends EventRow {
  projectCount: number; // distinct deelnemers for this event
}

export interface SyncStore {
  // …existing…
  listEvents(): EventListItem[];
}
```

- `InMemoryStore.listEvents()` — map over `events`, count `deelnemers` whose `eventId` matches.
- `SqliteStore.listEvents()` — `SELECT e.*, COUNT(d.standNr) AS projectCount FROM events e LEFT
  JOIN deelnemers d ON d.eventId = e.id GROUP BY e.id`.

### `ChangeBus` (new, `change-bus.ts`)

In-process pub/sub, store-agnostic, owned by `createApp`:

```ts
export class ChangeBus {
  private subs = new Map<string, Set<() => void>>();
  subscribe(eventId: string, fn: () => void): () => void; // returns unsubscribe
  publish(eventId: string): void;                          // fan out to subscribers
}
```

### Routes (`app.ts`)

- **`GET /events`** → `c.json(store.listEvents())`. (Trusted-instance: unauthenticated read.)
- **`POST /events/:eventId/changes`** — after `applyChanges`, call `bus.publish(eventId)`.
- **`GET /events/:eventId/stream`** — SSE via Hono `streamSSE`:
  - Guard via **`?code=`** query param (`EventSource` cannot send custom headers); validate it
    matches the event, else `403`.
  - On open: subscribe to `bus` for `eventId`; on publish write `data: changed\n\n`.
  - Keep-alive comment (`: ping`) every ~25s.
  - On client abort (`c.req.raw.signal`): unsubscribe and end the stream.

`createApp(store, gen?)` constructs one `ChangeBus` and closes over it. No store change needed for
the bus.

## Client data-access changes — `libs/data-access`

### `Remote` interface + `RemoteGateway` (`remote.ts`)

```ts
// data-access declares its own type matching the GET /events JSON shape;
// it does NOT import from apps/sync-api (no app→app dependency).
export interface RemoteEventListItem {
  id: string;
  name: string;
  date: string;
  eventCode: string;
  projectCount: number;
}
export interface Remote {
  // …existing: createEvent, joinEvent, transportFor…
  listEvents(): Promise<RemoteEventListItem[]>;
  openChangeStream(eventId: string, code: string, onChange: () => void): ChangeStreamHandle;
}
export interface ChangeStreamHandle { close(): void; }
```

- `listEvents()` → `GET ${base}/events`.
- `openChangeStream()` → constructs a `ChangeStream` (below). Behind the interface so
  `setRemoteForTest` fully fakes it.

### `ChangeStream` (new, `change-stream.ts`)

Thin wrapper over `EventSource`, with an injectable factory so vitest can fake it:

```ts
export type EventSourceFactory = (url: string) => EventSourceLike;
export class ChangeStream implements ChangeStreamHandle {
  constructor(base, eventId, code, onChange, factory = (u) => new EventSource(u));
  // opens GET {base}/events/{eventId}/stream?code={code}
  // onmessage  → onChange()  (debounced ~250ms to coalesce bursts)
  // onopen     → onChange()  (catch up via a pull after a (re)connect)
  // onerror    → EventSource auto-reconnects; surface a 'connecting' state
  close(): void; // eventSource.close()
}
```

Recovery: because every (re)connect triggers a pull, and `pull()` uses `lastPulledAt` + LWW, no
change is lost even if individual SSE messages are missed.

## Client store changes — `libs/feature-jury/src/lib/jury-store.ts`

New signals:

- `events = signal<EventListItem[]>([])` — for the picker.
- `revision = signal(0)` — bumped after every remote pull; screens that compute derived views
  (`reconcile`, `result`) watch it via `effect()` to recompute live.
- `connection = signal<'offline' | 'connecting' | 'live'>('offline')` — drives the `<wn-sync>` badge.

New behavior:

- `refreshEventList()` → `this.events.set(await this.remote.listEvents().catch(() => []))`.
- **Session persistence**: on successful `createEvent`/`joinEvent`, write
  `{ eventId, judge }` to `localStorage["winnovation:session"]`. `clearSession()` on explicit leave.
- `restoreSession(): Promise<boolean>` — read localStorage; if present, load the event from
  IndexedDB by id, set `event`/`judge`, `attachSync`, open the stream, `refreshDeelnemers()`.
  Returns whether a session was restored. No network needed to restore (offline-first).
  **Called from an app initializer** (`app.config.ts` `provideAppInitializer`, after the dev seed)
  so it completes *before* the first route renders — this avoids racing the JoinComponent redirect.
  JoinComponent then simply checks `store.event()` synchronously on init.
- **Live updates**: `attachSync` also opens the `ChangeStream`; the `onChange` handler does
  `pullNow()` → refresh `deelnemers`/`scores`/`driftFlags` → `revision.update(n => n+1)`. A
  `detachSync()`/leave path closes the stream and sets `connection='offline'`.

The existing coalescing `pushSoon()` and best-effort `pullNow()` are unchanged.

## UI changes

### Join screen → event picker (`join.component.ts`)

- On init: `store.refreshEventList()`. Render `store.events()` as tappable cards
  (**name · code · N projects**), matching the approved mockup.
- Tap a card → choose **A / B** → `joinEvent(code, slot)` → `/home`.
- Keep **"+ Nieuw event"** (existing create flow) and a secondary **"Code invoeren"** input for
  robustness (e.g. event not yet in the list, or manual entry).
- **Session restore redirect**: if `store.event()` is already set (restored by the app
  initializer before routing), redirect to `/home` on init.

### Home (`event-home.component.ts`)

- Make the `Eventcode XXXXXX` line **copyable** (tap → `navigator.clipboard.writeText`, brief
  "gekopieerd" confirmation).
- Wire `<wn-sync>` to `store.connection()` instead of the hardcoded `"synced"`. Extend
  `SyncComponent` states if needed (`offline` | `connecting` | `live`).

## Deploy addendum (updates the just-committed deploy docs)

SSE is buffered/closed by default nginx config. Update `deploy/frontend.nginx.conf` and
`deploy/nginx-proxy-manager.md` so the `/api` path (or a dedicated `/api/.../stream` location)
streams:

```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 1h;
proxy_set_header Connection '';
proxy_http_version 1.1;
```

ngrok needs no change (it streams SSE transparently). The Angular dev-server proxy already streams.
Note this in the NPM runbook's verify section (confirm the SSE connection stays open in DevTools).

## Testing

**vitest (libs + sync-api):**

- `store.ts` / `sqlite-store.ts`: `listEvents()` returns events with correct `projectCount`
  (including zero-project events).
- `change-bus.ts`: subscribe receives publishes for its `eventId` only; unsubscribe stops delivery.
- `app.ts`: `GET /events` shape; SSE handler publishes to a subscribed stream on `POST /changes`;
  stream `403`s on a bad `?code=`.
- `change-stream.ts`: with a fake `EventSource` — `onmessage` → debounced `onChange`; `onopen` →
  `onChange`; `close()` closes the source.
- `jury-store.ts` (via `*ForTest` seams + a fake `Remote`): session persist/restore;
  `onChange` triggers a pull and bumps `revision`; `refreshEventList` populates `events`.

**jury-app (jest):** join picker renders the event list and routes on tap; session-restore redirect.

**Manual (two-browser over ngrok):** create in A → appears in B's list immediately → score in A →
visible in B without navigation (SSE) → refresh B → still in the event. Confirm SSE stays open in
DevTools Network.

## Files

- **New:** `apps/sync-api/src/change-bus.ts`, `libs/data-access/src/lib/change-stream.ts`,
  spec/plan docs.
- **Edit (server):** `apps/sync-api/src/store.ts`, `sqlite-store.ts`, `app.ts`.
- **Edit (client data-access):** `libs/data-access/src/lib/remote.ts`, index exports.
- **Edit (store):** `libs/feature-jury/src/lib/jury-store.ts`.
- **Edit (bootstrap):** `apps/jury-app/src/app/app.config.ts` (session-restore initializer).
- **Edit (UI):** `libs/feature-jury/src/lib/join.component.ts`, `event-home.component.ts`,
  possibly `libs/ui` `SyncComponent`.
- **Edit (deploy):** `deploy/frontend.nginx.conf`, `deploy/nginx-proxy-manager.md`.

## Risks / notes

- **EventSource headers:** none allowed → code-guard via query param is required, not optional.
- **SSE through proxies:** the deploy addendum is load-bearing; without `proxy_buffering off` the
  live feature silently degrades to "nothing updates" in production (works locally/ngrok).
- **In-memory bus:** correct for one container; a future horizontal scale-out would need a shared
  bus (Redis/postgres LISTEN) — explicitly out of scope.
- **Trusted-instance reads:** `GET /events` is unauthenticated by design. Acceptable for a private
  homelab; revisit if the instance is ever exposed broadly.
