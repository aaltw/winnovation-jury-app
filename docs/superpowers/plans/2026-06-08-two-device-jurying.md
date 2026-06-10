# Two-Device Jurying Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make two-juror sync usable — events are discoverable by name, sessions survive refresh, and each juror's changes appear on the other's device in real time over SSE.

**Architecture:** Add `GET /events` (list) and an SSE `GET /events/:id/stream` to the Hono sync-api, with an in-process `ChangeBus` that fires on every push. The client gets a `ChangeStream` (EventSource wrapper) that reacts to notifications by calling the existing `pull()`; `JuryStore` persists `{eventId, judge}` to `localStorage` and restores it via an app initializer. Same-origin `/api`; photos stay device-local.

**Tech Stack:** Angular 21 (standalone + signals), Nx, Dexie/IndexedDB, Hono + better-sqlite3, vitest (libs + sync-api) / jest (jury-app), Biome (2-space, width 100, double quotes).

**Spec:** `docs/superpowers/specs/2026-06-08-two-device-jurying-design.md`

---

## Conventions for every task

- **Test commands:** libs + sync-api use vitest via Nx: `pnpm nx test <project>` (append `-- <pattern>` to filter). `jury-app` uses jest.
- **Lint/format after edits:** `pnpm biome check . --write` (the edit hook also auto-formats).
- **Commit style:** conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`).
- **Interface ripple:** the `Remote` interface (`libs/data-access/src/lib/remote.ts`) has three implementers — `RemoteGateway` (prod) and two fakes in `libs/feature-jury/src/lib/jury-store.spec.ts` (`offlineRemote`, `fakeBackend().remote`). Any method added to `Remote` MUST be added to all three in the same task or the `feature-jury` build breaks.

---

## GROUP A — Server (`apps/sync-api`)

### Task A1: `listEvents()` + `GET /events`

**Files:**
- Modify: `apps/sync-api/src/store.ts`
- Modify: `apps/sync-api/src/sqlite-store.ts`
- Modify: `apps/sync-api/src/app.ts`
- Test: `apps/sync-api/src/store.spec.ts`, `apps/sync-api/src/app.spec.ts`

- [ ] **Step 1: Write the failing store test**

Add to `apps/sync-api/src/store.spec.ts`:

```ts
describe("InMemoryStore.listEvents", () => {
  it("lists events with a per-event project count", () => {
    const store = new InMemoryStore();
    store.createEvent({ id: "e1", name: "Winnovation", date: "2026-06-05", eventCode: "ABC123" });
    store.applyChanges("e1", {
      deelnemers: [
        { eventId: "e1", standNr: "1", projectgroep: "g1", isVervolgproject: false, updatedAt: 1 },
        { eventId: "e1", standNr: "2", projectgroep: "g2", isVervolgproject: false, updatedAt: 1 },
      ],
      scores: [],
      captureMeta: [],
    });
    const list = store.listEvents();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "e1", name: "Winnovation", eventCode: "ABC123", projectCount: 2 });
  });

  it("reports zero projects for an empty event", () => {
    const store = new InMemoryStore();
    store.createEvent({ id: "e1", name: "Leeg", date: "2026-06-05", eventCode: "EMPTY1" });
    expect(store.listEvents()[0].projectCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm nx test sync-api -- store.spec`
Expected: FAIL — `store.listEvents is not a function`.

- [ ] **Step 3: Add the type + interface method, implement in both stores**

In `apps/sync-api/src/store.ts`, add the type after `EventRow` and extend `SyncStore`:

```ts
export interface EventListItem extends EventRow {
  projectCount: number;
}
```

```ts
export interface SyncStore {
  createEvent(event: EventRow): void;
  findEventByCode(eventCode: string): EventRow | undefined;
  applyChanges(eventId: string, changes: ChangeSet): void;
  changesSince(eventId: string, since: number): ChangeSet;
  listEvents(): EventListItem[];
}
```

Add to `InMemoryStore`:

```ts
  listEvents(): EventListItem[] {
    return [...this.events.values()].map((e) => ({
      ...e,
      projectCount: [...this.deelnemers.values()].filter((d) => d.eventId === e.id).length,
    }));
  }
```

Add to `SqliteStore` (`apps/sync-api/src/sqlite-store.ts`), and import `EventListItem`:

```ts
  listEvents(): EventListItem[] {
    return this.db
      .prepare(
        `SELECT e.id, e.name, e.date, e.eventCode, COUNT(d.standNr) AS projectCount
         FROM events e
         LEFT JOIN deelnemers d ON d.eventId = e.id
         GROUP BY e.id, e.name, e.date, e.eventCode
         ORDER BY e.name`,
      )
      .all() as EventListItem[];
  }
```

Update the import line in `sqlite-store.ts`:

```ts
import type { ChangeSet, EventListItem, EventRow, SyncStore } from "./store";
```

- [ ] **Step 4: Add the route + its failing test**

Add to `apps/sync-api/src/app.spec.ts`:

```ts
it("GET /events lists events with project counts", async () => {
  const store = new InMemoryStore();
  const app = createApp(store, gen);
  await app.request("/events", json({ name: "W", date: "2026-06-05" }));
  const res = await app.request("/events");
  expect(res.status).toBe(200);
  const list = await res.json();
  expect(list).toEqual([{ id: "e1", name: "W", date: "2026-06-05", eventCode: "ABC123", projectCount: 0 }]);
});
```

Add the route in `apps/sync-api/src/app.ts` (right after `app.post("/events", …)`):

```ts
  app.get("/events", (c) => c.json(store.listEvents()));
```

- [ ] **Step 5: Run all sync-api tests, verify pass**

Run: `pnpm nx test sync-api`
Expected: PASS (existing + new).

- [ ] **Step 6: Commit**

```bash
git add apps/sync-api/src/store.ts apps/sync-api/src/sqlite-store.ts apps/sync-api/src/app.ts apps/sync-api/src/store.spec.ts apps/sync-api/src/app.spec.ts
git commit -m "feat(sync-api): list events with project counts via GET /events"
```

---

### Task A2: `ChangeBus` + publish on push

**Files:**
- Create: `apps/sync-api/src/change-bus.ts`
- Create: `apps/sync-api/src/change-bus.spec.ts`
- Modify: `apps/sync-api/src/app.ts`
- Test: `apps/sync-api/src/app.spec.ts`

- [ ] **Step 1: Write the failing ChangeBus test**

Create `apps/sync-api/src/change-bus.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ChangeBus } from "./change-bus";

describe("ChangeBus", () => {
  it("delivers a publish only to subscribers of that eventId", () => {
    const bus = new ChangeBus();
    const hits: string[] = [];
    bus.subscribe("e1", () => hits.push("a"));
    bus.subscribe("e2", () => hits.push("b"));
    bus.publish("e1");
    expect(hits).toEqual(["a"]);
  });

  it("stops delivery after unsubscribe", () => {
    const bus = new ChangeBus();
    let n = 0;
    const off = bus.subscribe("e1", () => { n += 1; });
    bus.publish("e1");
    off();
    bus.publish("e1");
    expect(n).toBe(1);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm nx test sync-api -- change-bus`
Expected: FAIL — cannot find module `./change-bus`.

- [ ] **Step 3: Implement `ChangeBus`**

Create `apps/sync-api/src/change-bus.ts`:

```ts
/** In-process pub/sub: notify SSE subscribers when an event's data changes.
 *  Single-container only — a multi-process deploy would need a shared bus. */
export class ChangeBus {
  private subs = new Map<string, Set<() => void>>();

  subscribe(eventId: string, fn: () => void): () => void {
    const set = this.subs.get(eventId) ?? new Set<() => void>();
    set.add(fn);
    this.subs.set(eventId, set);
    return () => {
      set.delete(fn);
      if (set.size === 0) this.subs.delete(eventId);
    };
  }

  publish(eventId: string): void {
    for (const fn of this.subs.get(eventId) ?? []) fn();
  }
}
```

- [ ] **Step 4: Wire the bus into `createApp` + add the publish-on-push test**

In `apps/sync-api/src/app.ts`, import the bus and add it as an injectable param, then publish after `applyChanges`:

```ts
import { ChangeBus } from "./change-bus";
```

```ts
export function createApp(store: SyncStore, gen: IdGen = defaultGen, bus: ChangeBus = new ChangeBus()) {
```

```ts
  app.post("/events/:eventId/changes", async (c) => {
    const eventId = c.req.param("eventId");
    store.applyChanges(eventId, await c.req.json());
    bus.publish(eventId);
    return c.json({ ok: true });
  });
```

Add to `apps/sync-api/src/app.spec.ts` (import `ChangeBus` at top):

```ts
it("publishes a change notification after a successful push", async () => {
  const store = new InMemoryStore();
  const bus = new ChangeBus();
  const published: string[] = [];
  const realPublish = bus.publish.bind(bus);
  bus.publish = (id: string) => { published.push(id); realPublish(id); };
  const app = createApp(store, gen, bus);
  await app.request("/events", json({ name: "W", date: "2026-06-05" }));
  const push = {
    ...json({ deelnemers: [], scores: [], captureMeta: [] }),
    headers: { "content-type": "application/json", "x-event-code": "ABC123" },
  };
  await app.request("/events/e1/changes", push);
  expect(published).toEqual(["e1"]);
});
```

- [ ] **Step 5: Run, verify pass**

Run: `pnpm nx test sync-api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/sync-api/src/change-bus.ts apps/sync-api/src/change-bus.spec.ts apps/sync-api/src/app.ts apps/sync-api/src/app.spec.ts
git commit -m "feat(sync-api): ChangeBus pub/sub, publish on every pushed change"
```

---

### Task A3: SSE `GET /events/:eventId/stream`

**Files:**
- Modify: `apps/sync-api/src/app.ts`
- Test: `apps/sync-api/src/app.spec.ts`

> **Test scope note:** live SSE *delivery* is covered by `ChangeBus` tests (A2) + the manual two-browser pass (Task F1). Consuming a live stream in a unit test is timer-sensitive and flaky, so here we only assert the **403 guard** synchronously. This is a deliberate, documented coverage boundary, not a gap.

- [ ] **Step 1: Write the failing guard test**

Add to `apps/sync-api/src/app.spec.ts`:

```ts
describe("sync-api: SSE stream", () => {
  it("rejects a stream subscription with a wrong code", async () => {
    const store = new InMemoryStore();
    const app = createApp(store, gen);
    await app.request("/events", json({ name: "W", date: "2026-06-05" }));
    const res = await app.request("/events/e1/stream?code=WRONG");
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm nx test sync-api -- app.spec`
Expected: FAIL — route returns 404 (no stream route yet).

- [ ] **Step 3: Implement the SSE route**

In `apps/sync-api/src/app.ts`, import `streamSSE` and add the route after the `GET …/changes` route:

```ts
import { streamSSE } from "hono/streaming";
```

```ts
  app.get("/events/:eventId/stream", (c) => {
    const eventId = c.req.param("eventId");
    // EventSource cannot set custom headers, so the code guard is a query param.
    const event = store.findEventByCode(c.req.query("code") ?? "");
    if (!event || event.id !== eventId) return c.json({ error: "forbidden" }, 403);
    return streamSSE(c, async (stream) => {
      const unsubscribe = bus.subscribe(eventId, () => {
        void stream.writeSSE({ data: "changed" });
      });
      const ping = setInterval(() => {
        void stream.writeSSE({ data: "ping", event: "ping" });
      }, 25000);
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(ping);
          unsubscribe();
          resolve();
        });
      });
    });
  });
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm nx test sync-api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sync-api/src/app.ts apps/sync-api/src/app.spec.ts
git commit -m "feat(sync-api): SSE stream endpoint guarded by ?code, fed by ChangeBus"
```

---

## GROUP B — Client data-access (`libs/data-access`)

### Task B1: `RemoteEventListItem` + `Remote.listEvents`

**Files:**
- Modify: `libs/data-access/src/lib/remote.ts`
- Modify: `libs/feature-jury/src/lib/jury-store.spec.ts` (fakes — interface ripple)
- Test: `libs/data-access/src/lib/remote.spec.ts`

- [ ] **Step 1: Write the failing RemoteGateway test**

Add to `libs/data-access/src/lib/remote.spec.ts`:

```ts
it("listEvents GETs /events and returns the array with project counts", async () => {
  const { impl, calls } = fakeFetch(() =>
    json([{ id: "e1", name: "W", date: "2026-06-05", eventCode: "ABC123", projectCount: 3 }]),
  );
  const gw = new RemoteGateway("/api", impl);
  const out = await gw.listEvents();
  expect(out).toEqual([{ id: "e1", name: "W", date: "2026-06-05", eventCode: "ABC123", projectCount: 3 }]);
  expect(calls[0].url).toBe("/api/events");
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm nx test data-access -- remote.spec`
Expected: FAIL — `gw.listEvents is not a function`.

- [ ] **Step 3: Add the type + interface method + implementation**

In `libs/data-access/src/lib/remote.ts`, add the type near `RemoteEventInfo`:

```ts
/** One row from the server's `GET /events` listing. */
export interface RemoteEventListItem {
  id: string;
  name: string;
  date: string;
  eventCode: string;
  projectCount: number;
}
```

Add to the `Remote` interface:

```ts
  listEvents(): Promise<RemoteEventListItem[]>;
```

Implement in `RemoteGateway` (add the method):

```ts
  async listEvents(): Promise<RemoteEventListItem[]> {
    const res = await this.fetchImpl(`${this.base}/events`);
    if (!res.ok) throw new Error(`list events → ${res.status}`);
    return res.json() as Promise<RemoteEventListItem[]>;
  }
```

- [ ] **Step 4: Update the two `Remote` fakes (interface ripple)**

In `libs/feature-jury/src/lib/jury-store.spec.ts`, add `listEvents` to `offlineRemote`:

```ts
const offlineRemote: Remote = {
  createEvent: () => Promise.reject(new Error("offline")),
  joinEvent: () => Promise.resolve(null),
  transportFor: () => ({
    post: () => Promise.reject(new Error("offline")),
    get: () => Promise.reject(new Error("offline")),
  }),
  listEvents: () => Promise.resolve([]),
};
```

And to `fakeBackend().remote` (place after `joinEvent`):

```ts
    listEvents: () =>
      Promise.resolve(
        [...events.values()].map((e) => ({
          id: e.id,
          name: e.name,
          date: e.date,
          eventCode: e.eventCode,
          projectCount: [...deelnemers.values()].filter((d) => d.eventId === e.id).length,
        })),
      ),
```

- [ ] **Step 5: Run both suites, verify pass**

Run: `pnpm nx test data-access -- remote.spec` then `pnpm nx test feature-jury`
Expected: PASS (feature-jury compiles again with the new fakes).

- [ ] **Step 6: Commit**

```bash
git add libs/data-access/src/lib/remote.ts libs/data-access/src/lib/remote.spec.ts libs/feature-jury/src/lib/jury-store.spec.ts
git commit -m "feat(data-access): RemoteGateway.listEvents + RemoteEventListItem"
```

---

### Task B2: `ChangeStream` (EventSource wrapper)

**Files:**
- Create: `libs/data-access/src/lib/change-stream.ts`
- Create: `libs/data-access/src/lib/change-stream.spec.ts`
- Modify: `libs/data-access/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/data-access/src/lib/change-stream.spec.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ChangeStream, type EventSourceLike } from "./change-stream";

function fakeEventSource() {
  const es = {
    url: "",
    closed: false,
    onopen: null as null | (() => void),
    onmessage: null as null | ((ev: { data: string }) => void),
    onerror: null as null | (() => void),
    close() { this.closed = true; },
  };
  const factory = (url: string) => { es.url = url; return es as unknown as EventSourceLike; };
  return { es, factory };
}

describe("ChangeStream", () => {
  it("builds the stream URL with eventId and code", () => {
    const { es, factory } = fakeEventSource();
    new ChangeStream("/api", "e1", "ABC123", () => {}, factory);
    expect(es.url).toBe("/api/events/e1/stream?code=ABC123");
  });

  it("fires onChange (debounced/coalesced) when messages arrive", async () => {
    vi.useFakeTimers();
    const { es, factory } = fakeEventSource();
    let hits = 0;
    new ChangeStream("/api", "e1", "c", () => { hits += 1; }, factory);
    es.onmessage?.({ data: "changed" });
    es.onmessage?.({ data: "changed" });
    await vi.advanceTimersByTimeAsync(300);
    expect(hits).toBe(1);
    vi.useRealTimers();
  });

  it("fires onChange on (re)connect via onopen, and reports 'live' state", async () => {
    vi.useFakeTimers();
    const { es, factory } = fakeEventSource();
    let hits = 0;
    const states: string[] = [];
    new ChangeStream("/api", "e1", "c", () => { hits += 1; }, factory, (s) => states.push(s));
    es.onopen?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(hits).toBe(1);
    expect(states).toContain("live");
    vi.useRealTimers();
  });

  it("reports 'connecting' on error and closes the source on close()", () => {
    const { es, factory } = fakeEventSource();
    const states: string[] = [];
    const cs = new ChangeStream("/api", "e1", "c", () => {}, factory, (s) => states.push(s));
    es.onerror?.();
    expect(states).toContain("connecting");
    cs.close();
    expect(es.closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm nx test data-access -- change-stream`
Expected: FAIL — cannot find module `./change-stream`.

- [ ] **Step 3: Implement `ChangeStream`**

Create `libs/data-access/src/lib/change-stream.ts`:

```ts
/** Minimal surface of the browser `EventSource` we depend on (injectable for tests). */
export interface EventSourceLike {
  onopen: ((this: EventSourceLike, ev: unknown) => void) | null;
  onmessage: ((this: EventSourceLike, ev: { data: string }) => void) | null;
  onerror: ((this: EventSourceLike, ev: unknown) => void) | null;
  close(): void;
}

export type EventSourceFactory = (url: string) => EventSourceLike;
export type ConnectionState = "offline" | "connecting" | "live";

export interface ChangeStreamHandle {
  close(): void;
}

const defaultFactory: EventSourceFactory = (url) =>
  new EventSource(url) as unknown as EventSourceLike;

/** Subscribes to the sync-api SSE stream. On any notification (or reconnect) it
 *  calls `onChange`, debounced so a burst collapses into one pull. The caller
 *  reacts by pulling — a dropped socket self-heals because EventSource reconnects
 *  and `onopen` re-fires `onChange`. */
export class ChangeStream implements ChangeStreamHandle {
  private readonly es: EventSourceLike;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    base: string,
    eventId: string,
    code: string,
    private readonly onChange: () => void,
    factory: EventSourceFactory = defaultFactory,
    private readonly onState?: (s: ConnectionState) => void,
  ) {
    const url = `${base}/events/${encodeURIComponent(eventId)}/stream?code=${encodeURIComponent(code)}`;
    this.es = factory(url);
    this.es.onopen = () => {
      this.onState?.("live");
      this.fire();
    };
    this.es.onmessage = () => this.fire();
    this.es.onerror = () => this.onState?.("connecting");
  }

  private fire(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onChange();
    }, 250);
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.es.close();
  }
}
```

- [ ] **Step 4: Export from the barrel**

In `libs/data-access/src/index.ts`, add:

```ts
export * from "./lib/change-stream";
```

- [ ] **Step 5: Run, verify pass**

Run: `pnpm nx test data-access -- change-stream`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/data-access/src/lib/change-stream.ts libs/data-access/src/lib/change-stream.spec.ts libs/data-access/src/index.ts
git commit -m "feat(data-access): ChangeStream SSE wrapper (debounced, reconnect-safe)"
```

---

### Task B3: `Remote.openChangeStream`

**Files:**
- Modify: `libs/data-access/src/lib/remote.ts`
- Modify: `libs/feature-jury/src/lib/jury-store.spec.ts` (fakes — interface ripple)
- Test: `libs/data-access/src/lib/remote.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `libs/data-access/src/lib/remote.spec.ts`:

```ts
it("openChangeStream opens an EventSource at the stream URL via the injected factory", () => {
  let url = "";
  const fakeEs = { onopen: null, onmessage: null, onerror: null, close() {} };
  const gw = new RemoteGateway("/api", undefined, () => {
    return fakeEs as never;
  });
  const handle = gw.openChangeStream("e1", "ABC123", () => {});
  // The factory captured the URL via ChangeStream:
  handle.close();
  expect(gw.lastStreamUrlForTest).toBe("/api/events/e1/stream?code=ABC123");
});
```

> The assertion uses a tiny test-only field; if you prefer not to add it, capture the URL inside the factory instead:
> ```ts
> let url = "";
> const gw = new RemoteGateway("/api", undefined, (u) => { url = u; return fakeEs as never; });
> gw.openChangeStream("e1", "ABC123", () => {});
> expect(url).toBe("/api/events/e1/stream?code=ABC123");
> ```
> Use the second form (no production test-only field). Delete the first assertion.

Final test (use this):

```ts
it("openChangeStream opens an EventSource at the stream URL via the injected factory", () => {
  let url = "";
  const fakeEs = { onopen: null, onmessage: null, onerror: null, close() {} };
  const gw = new RemoteGateway("/api", undefined, (u: string) => {
    url = u;
    return fakeEs as never;
  });
  const handle = gw.openChangeStream("e1", "ABC123", () => {});
  expect(url).toBe("/api/events/e1/stream?code=ABC123");
  handle.close();
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm nx test data-access -- remote.spec`
Expected: FAIL — `RemoteGateway` constructor takes 2 args / `openChangeStream` missing.

- [ ] **Step 3: Wire `ChangeStream` into `RemoteGateway`**

In `libs/data-access/src/lib/remote.ts`, import the stream types at the top:

```ts
import {
  ChangeStream,
  type ChangeStreamHandle,
  type ConnectionState,
  type EventSourceFactory,
} from "./change-stream";
```

Add to the `Remote` interface (re-export `ChangeStreamHandle` type is already available via the barrel):

```ts
  openChangeStream(
    eventId: string,
    code: string,
    onChange: () => void,
    onState?: (s: ConnectionState) => void,
  ): ChangeStreamHandle;
```

Extend the `RemoteGateway` constructor with an optional EventSource factory and implement the method:

```ts
  constructor(
    private readonly base: string,
    private readonly fetchImpl: FetchLike = defaultFetch,
    private readonly eventSourceFactory?: EventSourceFactory,
  ) {}
```

```ts
  openChangeStream(
    eventId: string,
    code: string,
    onChange: () => void,
    onState?: (s: ConnectionState) => void,
  ): ChangeStreamHandle {
    return new ChangeStream(this.base, eventId, code, onChange, this.eventSourceFactory, onState);
  }
```

- [ ] **Step 4: Update the two `Remote` fakes (interface ripple)**

In `libs/feature-jury/src/lib/jury-store.spec.ts`, add to `offlineRemote`:

```ts
  openChangeStream: () => ({ close() {} }),
```

And to `fakeBackend().remote`:

```ts
    openChangeStream: () => ({ close() {} }),
```

- [ ] **Step 5: Run both suites, verify pass**

Run: `pnpm nx test data-access -- remote.spec` then `pnpm nx test feature-jury`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/data-access/src/lib/remote.ts libs/data-access/src/lib/remote.spec.ts libs/feature-jury/src/lib/jury-store.spec.ts
git commit -m "feat(data-access): Remote.openChangeStream backed by ChangeStream"
```

---

## GROUP C — Client store (`libs/feature-jury`)

### Task C1: `events` signal + `refreshEventList()`

**Files:**
- Modify: `libs/feature-jury/src/lib/jury-store.ts`
- Test: `libs/feature-jury/src/lib/jury-store.spec.ts`

- [ ] **Step 1: Write the failing test**

Add inside the `describe("JuryStore sync", …)` block in `jury-store.spec.ts`:

```ts
it("refreshEventList loads the server's event listing", async () => {
  const backend = fakeBackend();
  const store = freshStore(backend.remote, 1000);
  await store.createEvent("Winnovation", "2026-06-05");
  await store.refreshEventList();
  expect(store.events().map((e) => e.name)).toContain("Winnovation");
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm nx test feature-jury -- jury-store`
Expected: FAIL — `store.events`/`store.refreshEventList` missing.

- [ ] **Step 3: Implement**

In `libs/feature-jury/src/lib/jury-store.ts`, add to the imports from `@winnovation/data-access`:

```ts
  type RemoteEventListItem,
```

Add the signal near the other signals:

```ts
  readonly events = signal<RemoteEventListItem[]>([]);
```

Add the method:

```ts
  async refreshEventList(): Promise<void> {
    this.events.set(await this.remote.listEvents().catch(() => []));
  }
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm nx test feature-jury -- jury-store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/feature-jury/src/lib/jury-store.ts libs/feature-jury/src/lib/jury-store.spec.ts
git commit -m "feat(feature-jury): JuryStore.events + refreshEventList"
```

---

### Task C2: Session persistence (`localStorage` seam + restore)

**Files:**
- Modify: `libs/feature-jury/src/lib/jury-store.ts`
- Test: `libs/feature-jury/src/lib/jury-store.spec.ts`

- [ ] **Step 1: Write the failing test**

Add a memory-storage helper at the top of `jury-store.spec.ts` (after the imports):

```ts
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}
```

Add the test inside `describe("JuryStore sync", …)`:

```ts
it("persists the session on create and restores it into a fresh store on the same device", async () => {
  const backend = fakeBackend();
  const dbName = `restore-test-${++dbSeq}`;
  const storage = memoryStorage();

  const first = new JuryStore();
  first.setDbForTest(new JuryDb(dbName));
  first.setRemoteForTest(backend.remote);
  first.setStorageForTest(storage);
  let t = 5000;
  first.setClockForTest(() => ++t);
  created.push(first);
  await first.createEvent("Winnovation", "2026-06-05");
  const code = first.event()?.eventCode;

  // A brand-new store = a fresh page load. Same db name + same storage = same device.
  const second = new JuryStore();
  second.setDbForTest(new JuryDb(dbName));
  second.setRemoteForTest(backend.remote);
  second.setStorageForTest(storage);
  created.push(second);

  expect(await second.restoreSession()).toBe(true);
  expect(second.event()?.eventCode).toBe(code);

  // No persisted session → restore is a no-op.
  const fresh = new JuryStore();
  fresh.setDbForTest(new JuryDb(`empty-${++dbSeq}`));
  fresh.setRemoteForTest(backend.remote);
  fresh.setStorageForTest(memoryStorage());
  created.push(fresh);
  expect(await fresh.restoreSession()).toBe(false);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm nx test feature-jury -- jury-store`
Expected: FAIL — `setStorageForTest`/`restoreSession` missing.

- [ ] **Step 3: Implement the storage seam + persist/restore**

In `libs/feature-jury/src/lib/jury-store.ts`, add fields near the `clock` seam:

```ts
  private storage: Storage | null = typeof localStorage !== "undefined" ? localStorage : null;
  setStorageForTest(s: Storage): void {
    this.storage = s;
  }
  private static readonly SESSION_KEY = "winnovation:session";

  private persistSession(eventId: string, judge: JudgeSlot): void {
    this.storage?.setItem(JuryStore.SESSION_KEY, JSON.stringify({ eventId, judge }));
  }
  private clearSession(): void {
    this.storage?.removeItem(JuryStore.SESSION_KEY);
  }

  async restoreSession(): Promise<boolean> {
    const raw = this.storage?.getItem(JuryStore.SESSION_KEY);
    if (!raw) return false;
    let parsed: { eventId?: string; judge?: JudgeSlot };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }
    if (!parsed.eventId) return false;
    const found = await this.db.events.get(parsed.eventId);
    if (!found) return false;
    this.event.set(found);
    this.judge.set(parsed.judge === "B" ? "B" : "A");
    this.attachSync(found);
    await this.refreshDeelnemers();
    return true;
  }
```

In `createEvent`, persist after the server path sets the event (inside `try`, after `this.attachSync(event)`):

```ts
      this.attachSync(event);
      this.persistSession(event.id, this.judge());
```

…and in the offline `catch` (after `this.event.set(...)`):

```ts
      const local = await this.service.createEvent({ name, date });
      this.event.set(local);
      this.persistSession(local.id, this.judge());
```

(Refactor the `catch` to a named `local` so we can persist its id.)

In `joinEvent`, persist after `this.judge.set(slot)`:

```ts
    this.event.set(found);
    this.judge.set(slot);
    this.persistSession(found.id, slot);
    this.attachSync(found);
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm nx test feature-jury -- jury-store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/feature-jury/src/lib/jury-store.ts libs/feature-jury/src/lib/jury-store.spec.ts
git commit -m "feat(feature-jury): persist + restore {eventId, judge} session"
```

---

### Task C3: Live updates (open stream, pull on notify, revision + connection)

**Files:**
- Modify: `libs/feature-jury/src/lib/jury-store.ts`
- Test: `libs/feature-jury/src/lib/jury-store.spec.ts`

- [ ] **Step 1: Write the failing test**

Add inside `describe("JuryStore sync", …)`:

```ts
it("reacts to a stream notification by pulling and bumping revision", async () => {
  const backend = fakeBackend();
  let notify: () => void = () => {};
  // Listener device: same backend, but its stream is controllable.
  const liveRemote: Remote = {
    ...backend.remote,
    openChangeStream: (_id, _code, onChange) => {
      notify = onChange;
      return { close() {} };
    },
  };

  const deviceA = freshStore(backend.remote, 1_000); // writer
  const deviceB = freshStore(liveRemote, 100_000); // listener

  await deviceA.createEvent("W", "2026-06-05");
  deviceA.setJudge("A");
  const code = deviceA.event()?.eventCode ?? "";
  expect(await deviceB.joinEvent(code, "B")).toBe(true);

  const before = deviceB.revision();

  // A writes and pushes to the shared backend.
  await deviceA.captureDeelnemer(capture("1", flat(5)));
  await deviceA.settleSyncForTest();

  // Server would emit SSE → simulate it. B pulls.
  notify();
  await deviceB.settleLiveForTest();

  expect(deviceB.deelnemers().map((d) => d.standNr)).toContain("1");
  expect(deviceB.revision()).toBeGreaterThan(before);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm nx test feature-jury -- jury-store`
Expected: FAIL — `store.revision`/`settleLiveForTest` missing.

- [ ] **Step 3: Implement live updates**

In `libs/feature-jury/src/lib/jury-store.ts`, add to the data-access imports:

```ts
  type ChangeStreamHandle,
  type ConnectionState,
```

Add signals + stream state near the others:

```ts
  readonly revision = signal(0);
  readonly connection = signal<ConnectionState>("offline");

  private stream: ChangeStreamHandle | null = null;
  private liveTick: Promise<void> = Promise.resolve();
  settleLiveForTest(): Promise<void> {
    return this.liveTick;
  }
```

Change `attachSync` to also open the stream:

```ts
  private attachSync(event: JuryEvent): void {
    this.sync = new SyncClient(this.db, this.remote.transportFor(() => event.eventCode), event.id);
    this.openStream(event);
  }

  private openStream(event: JuryEvent): void {
    this.stream?.close();
    this.connection.set("connecting");
    this.stream = this.remote.openChangeStream(
      event.id,
      event.eventCode,
      () => {
        this.liveTick = this.onRemoteChange();
      },
      (s) => this.connection.set(s),
    );
  }

  private async onRemoteChange(): Promise<void> {
    await this.refreshDeelnemers(); // pulls + reloads roster + scores
    await this.refreshDrift();
    this.revision.update((n) => n + 1);
  }
```

Add a `leaveEvent()` for switching events / returning to the picker:

```ts
  leaveEvent(): void {
    this.stream?.close();
    this.stream = null;
    this.connection.set("offline");
    this.clearSession();
    this.event.set(null);
    this.deelnemers.set([]);
    this.scores.set([]);
  }
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm nx test feature-jury -- jury-store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/feature-jury/src/lib/jury-store.ts libs/feature-jury/src/lib/jury-store.spec.ts
git commit -m "feat(feature-jury): live SSE updates (pull on notify, revision + connection signals)"
```

---

## GROUP D — Bootstrap + UI

### Task D1: Session-restore app initializer (`apps/jury-app`)

**Files:**
- Modify: `apps/jury-app/src/app/app.config.ts`

> No unit test — this is bootstrap wiring; verified by Task F1's build + the manual refresh check.

- [ ] **Step 1: Add the initializer**

In `apps/jury-app/src/app/app.config.ts`, add `inject` to the `@angular/core` import and import the store:

```ts
import {
  type ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { JuryStore } from "@winnovation/feature-jury";
```

Add a second initializer after the demo-seed one:

```ts
    // Restore the last {eventId, judge} so a refresh lands back in the event
    // instead of the join screen. Runs before routing; failures are swallowed.
    provideAppInitializer(() => {
      const store = inject(JuryStore);
      return store.restoreSession().catch(() => false);
    }),
```

- [ ] **Step 2: Verify it builds**

Run: `pnpm nx build jury-app`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/jury-app/src/app/app.config.ts
git commit -m "feat(jury-app): restore juror session on launch before routing"
```

---

### Task D2: Join screen → event picker + restore redirect

**Files:**
- Modify: `libs/feature-jury/src/lib/join.component.ts`

> Verified by build + Task F1 manual pass (component DOM tests for this inline-styled screen are low value).

- [ ] **Step 1: Implement picker + redirect**

In `libs/feature-jury/src/lib/join.component.ts`:

1. Update imports/class to implement `OnInit` and use `Router`:

```ts
import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from "@angular/core";
```

2. Add an event-list block to the template, immediately **above** the `Eventcode` input block (the `<div style="margin-top:32px">…`):

```html
        @if (store.events().length) {
          <div style="margin-top:32px">
            <label class="wv-label" style="color:rgba(255,255,255,.55)">Kies een event</label>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
              @for (ev of store.events(); track ev.id) {
                <button
                  type="button"
                  (click)="chooseEvent(ev.eventCode)"
                  [style.border]="
                    code === ev.eventCode ? '1.5px solid var(--brand)' : '1.5px solid rgba(255,255,255,.16)'
                  "
                  style="padding:13px 14px;border-radius:14px;background:rgba(255,255,255,.05);color:#fff;text-align:left;cursor:pointer"
                >
                  <div style="font-weight:700;font-size:15px">{{ ev.name }}</div>
                  <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">
                    {{ ev.eventCode }} · {{ ev.projectCount }} projecten
                  </div>
                </button>
              }
            </div>
          </div>
        }
```

3. Add `OnInit` + `chooseEvent` to the class, and load the list / redirect on init:

```ts
export class JoinComponent implements OnInit {
  private readonly store = inject(JuryStore);
  private readonly router = inject(Router);

  protected readonly judge = this.store.judge;
  protected readonly slots: JudgeSlot[] = ["A", "B"];
  protected readonly steps = STEPS;
  protected code = "";
  protected newName = "";
  protected readonly error = signal(false);
  protected readonly creating = signal(false);

  async ngOnInit(): Promise<void> {
    // Session was restored by the app initializer → skip the join screen.
    if (this.store.event()) {
      await this.router.navigate(["/home"]);
      return;
    }
    await this.store.refreshEventList();
  }

  protected chooseEvent(code: string): void {
    this.code = code;
    this.error.set(false);
  }

  protected pick(slot: JudgeSlot): void {
    this.store.setJudge(slot);
  }
  // …existing start() and create() unchanged…
}
```

Expose `store` to the template (it is currently `private`). Change the field to `protected readonly store = inject(JuryStore);` and update `start()`/`create()` references from `this.store` (already correct).

- [ ] **Step 2: Verify it builds + lints**

Run: `pnpm nx build jury-app && pnpm biome check libs/feature-jury/src/lib/join.component.ts`
Expected: success, no lint errors.

- [ ] **Step 3: Commit**

```bash
git add libs/feature-jury/src/lib/join.component.ts
git commit -m "feat(feature-jury): event picker on join + session-restore redirect"
```

---

### Task D3: Home — copyable code + live sync badge

**Files:**
- Modify: `libs/feature-jury/src/lib/event-home.component.ts`

- [ ] **Step 1: Implement copy + badge mapping**

In `libs/feature-jury/src/lib/event-home.component.ts`:

1. Ensure `computed` and `signal` are imported from `@angular/core` (computed already is; add `signal`). Import `SyncState`:

```ts
import { IconComponent, SyncComponent, DeelnemerCardComponent, fmtStand, type SyncState } from "@winnovation/ui";
```

2. Replace the eventcode line with a tap-to-copy button:

```html
            <div class="sub" style="margin-top:2px">
              <button
                type="button"
                (click)="copyCode()"
                style="background:none;border:none;padding:0;color:inherit;font:inherit;cursor:pointer"
              >
                Eventcode {{ store.event()?.eventCode ?? "—" }}{{ copied() ? " ✓ gekopieerd" : "" }}
              </button>
              · Jurylid {{ store.judge() }}
            </div>
```

3. Replace `<wn-sync state="synced" />` with:

```html
          <wn-sync [state]="syncState()" />
```

4. Add to the class:

```ts
  protected readonly copied = signal(false);

  protected readonly syncState = computed<SyncState>(() => {
    switch (this.store.connection()) {
      case "live":
        return "synced";
      case "connecting":
        return "syncing";
      default:
        return "offline";
    }
  });

  protected async copyCode(): Promise<void> {
    const code = this.store.event()?.eventCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context) — ignore.
    }
  }
```

- [ ] **Step 2: Verify it builds + lints**

Run: `pnpm nx build jury-app && pnpm biome check libs/feature-jury/src/lib/event-home.component.ts`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add libs/feature-jury/src/lib/event-home.component.ts
git commit -m "feat(feature-jury): copyable event code + live sync badge on home"
```

---

## GROUP E — Deploy docs (SSE)

### Task E1: SSE proxy addendum

**Files:**
- Modify: `deploy/frontend.nginx.conf`
- Modify: `deploy/nginx-proxy-manager.md`

- [ ] **Step 1: Add the config-as-code `/api` block to `frontend.nginx.conf`**

Append inside the `server { … }` block, after the `location /` block:

```nginx
  # Cross-device sync API (config-as-code alternative — see deploy/nginx-proxy-manager.md).
  # Requires the sync-api reachable as `sync-api` on a shared Docker network.
  location /api/ {
    proxy_pass http://sync-api:8787/;   # trailing slash strips the /api prefix

    # Server-Sent Events: do not buffer or time out the long-lived stream.
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
  }
```

- [ ] **Step 2: Add the SSE note to the NPM runbook**

In `deploy/nginx-proxy-manager.md`, in **step 5 (Custom Location `/api`)**, replace the advanced box block with:

````markdown
```nginx
rewrite ^/api/?(.*)$ /$1 break;

# Server-Sent Events (live sync): disable buffering or the stream never flushes.
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 1h;
proxy_http_version 1.1;
proxy_set_header Connection '';
```
````

And add to the **Verify** section:

```markdown
- Open DevTools → Network → filter "stream": `GET /api/events/<id>/stream` stays **pending/open**
  (not closed after a few seconds). A score on the other device appears live without navigation.
```

- [ ] **Step 3: Commit**

```bash
git add deploy/frontend.nginx.conf deploy/nginx-proxy-manager.md
git commit -m "docs(deploy): SSE proxy settings (disable buffering) for live sync"
```

---

## GROUP F — Integration

### Task F1: Full verification

**Files:** none (verification only)

- [ ] **Step 1: All unit tests**

Run: `pnpm nx run-many -t test`
Expected: all projects PASS.

- [ ] **Step 2: Lint/format**

Run: `pnpm biome check .`
Expected: clean.

- [ ] **Step 3: Production builds**

Run: `pnpm nx build jury-app && pnpm nx build sync-api`
Expected: both succeed.

- [ ] **Step 4: Manual two-browser pass (ngrok)**

Run (3 terminals): `pnpm nx serve sync-api`, `pnpm nx serve jury-app -c tunnel`, `ngrok http 4300`.

Verify at the ngrok URL:
1. Browser A: **create** an event → it appears in the picker list.
2. Browser B (incognito): the event shows in the list → tap it → pick **B** → enter.
3. A scores a project → **B sees it within ~1s without navigating** (SSE).
4. Refresh B → lands back in the event (not the join screen).
5. DevTools Network: `GET /api/events/:id/stream` stays open; `POST /api/events/:id/changes` → 200.

- [ ] **Step 5: Final commit (if any docs/tweaks)**

```bash
git add -A && git commit -m "test: verify two-device jurying end-to-end" || echo "nothing to commit"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** discovery (A1, C1, D2), sessions (C2, D1, D2), live SSE (A2, A3, B2, B3, C3, D3), copyable codes (D3), server sync reliability (whole of A/B/C), deploy SSE (E1). ✅ All five spec features mapped.
- **Interface ripple:** `Remote` gains `listEvents` (B1) and `openChangeStream` (B3); both fakes in `jury-store.spec.ts` updated in the same tasks. ✅
- **Type consistency:** `RemoteEventListItem` (data-access) ↔ `EventListItem` (server) are deliberately separate (no app→app import). `ConnectionState` defined in `change-stream.ts`, reused by store + mapped to `SyncState` in the home component. `ChangeStreamHandle` defined once (change-stream.ts), re-exported. ✅
- **No placeholders:** every code step has complete code; the one ambiguous draft assertion in B3 is explicitly resolved to the no-test-field form. ✅
- **Out of scope kept out:** photo sync, auth, multi-process bus — not in any task. ✅
