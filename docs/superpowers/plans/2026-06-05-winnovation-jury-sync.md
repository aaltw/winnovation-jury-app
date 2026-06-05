# Winnovation Jury — Sync + Reconcile Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the two judges' phones share data so they can reconcile — a small self-hosted sync API, an offline-first sync client, and the Reconcile + Result/export screens.

**Architecture:** A portable **Hono** HTTP API persists per-event changes behind a `SyncStore` interface (in-memory impl for tests, `better-sqlite3` impl for production). Synced records carry an `updatedAt` timestamp; conflicts resolve **last-write-wins**, and the deelnemer roster merges by `standNr`. Photos never leave the device. A `SyncClient` in `@winnovation/data-access` pushes all local rows and pulls changes-since, merging into Dexie with LWW. The Reconcile/Result screens consume the merged data via `JuryStore`.

**Tech Stack:** Hono + `@hono/node-server` + `better-sqlite3` (Node, deployable as a container) · Vitest (in-memory store + `app.request()`) · the Plan 1/2 libraries.

**Depends on:** Plans 1 and 2 merged.

---

## Scope: two parts

- **Part A — build now (design-independent):** Tasks 1–7. Schema migration, sync DTOs + store, the API, the production SQLite store + deploy, the sync client, and the pure reconcile/result helpers. Fully TDD'd. **Not blocked by wireframes.**
- **Part B — build when wireframes land (design-dependent):** Tasks 8–9. Reconcile and Result/export screens — behavioral contract + functional skeleton + "apply visual design" step.

> **WAIT GATE:** Part B waits for the Reconcile/Result wireframes. Part A may proceed once Plans 1–2 are merged.

---

## File Structure

| File | Responsibility | Part |
| --- | --- | --- |
| `libs/domain/src/lib/model.ts` (modify) | Add optional `updatedAt` to synced entities. | A |
| `libs/data-access/src/lib/db.ts` (modify) | Dexie v2: index `updatedAt`, add `syncMeta` table. | A |
| `libs/feature-jury/src/lib/jury-store.ts` (modify) | Stamp `updatedAt` on writes (injectable clock). | A |
| `libs/data-access/src/lib/sync-dto.ts` (+ in app) | Shared sync DTO shapes + `ChangeSet`. | A |
| `apps/sync-api/src/store.ts` (+spec) | `SyncStore` interface + `InMemoryStore` (LWW). | A |
| `apps/sync-api/src/app.ts` (+spec) | Hono app factory (create/join/push/pull). | A |
| `apps/sync-api/src/sqlite-store.ts` | `better-sqlite3` `SyncStore` impl. | A |
| `apps/sync-api/src/main.ts`, `Dockerfile` | Production wiring + container. | A |
| `libs/data-access/src/lib/sync.ts` (+spec) | `SyncClient`: push-all / pull-since + local LWW merge. | A |
| `libs/domain/src/lib/reconcile.ts` (+spec) | `computeDisagreements`, `toCsv`. | A |
| `libs/feature-jury/src/lib/reconcile.component.ts` | Reconcile screen. | B |
| `libs/feature-jury/src/lib/result.component.ts` | Result + export screen. | B |

---

# PART A — design-independent

## Task 1: Schema migration — `updatedAt` + `syncMeta`

`updatedAt` is added as **optional** so Plan 1/2 specs (which build rows without it) still pass; the sync layer treats a missing value as `0`. The `JuryStore` stamps it on every write via an injectable clock.

**Files:**
- Modify: `libs/domain/src/lib/model.ts`
- Modify: `libs/data-access/src/lib/db.ts`
- Modify: `libs/feature-jury/src/lib/jury-store.ts`
- Modify: `libs/feature-jury/src/lib/jury-store.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `libs/feature-jury/src/lib/jury-store.spec.ts`:

```ts
it('stamps updatedAt on captured rows using the injectable clock', async () => {
  store.setClockForTest(() => 1234);
  store.setJudge('A');
  await store.createEvent('Winnovation', '2026-06-05');
  await store.captureDeelnemer({
    standNr: '7', projectgroep: 'X', isVervolgproject: false,
    keyword: 'k', note: '', review: '', scores: { innovativiteit: 5, relevantie: 5, haalbaarheid: 5, impact: 5 },
  });
  const scores = await store['service'].scoresForJudge('A');
  expect(scores.every((s) => s.updatedAt === 1234)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test feature-jury`
Expected: FAIL — `setClockForTest is not a function` / `updatedAt` undefined.

- [ ] **Step 3: Add `updatedAt` to the model**

In `libs/domain/src/lib/model.ts`, add `updatedAt?: number; // epoch ms; set by the sync layer` to **`Deelnemer`**, **`Score`**, and **`CaptureMeta`** interfaces.

- [ ] **Step 4: Bump the Dexie schema**

In `libs/data-access/src/lib/db.ts`, add a `syncMeta` table type and a version 2:

```ts
export interface SyncMetaRow { eventId: string; lastPulledAt: number; }
```

Add to the class: `syncMeta!: Table<SyncMetaRow, string>;` and after the existing `this.version(1)...` block:

```ts
    this.version(2).stores({
      events: 'id, eventCode',
      deelnemers: '[eventId+standNr], eventId, updatedAt',
      scores: '[judge+standNr+criterion], judge, standNr, criterion, updatedAt',
      captureMeta: '[judge+standNr], judge, standNr, updatedAt',
      photos: 'id',
      syncMeta: 'eventId',
    });
```

- [ ] **Step 5: Stamp `updatedAt` in `JuryStore`**

In `libs/feature-jury/src/lib/jury-store.ts`, add a clock and apply it on writes:

```ts
  private clock: () => number = () => Date.now();
  setClockForTest(fn: () => number) { this.clock = fn; }
```

In `captureDeelnemer`, set `updatedAt: this.clock()` on the `upsertDeelnemer`, each `saveScore`, and `saveCaptureMeta` payloads. In `applyPlacement`, set `updatedAt: this.clock()` on each re-saved score.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm nx run-many -t test` (domain, data-access, feature-jury all green)
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/domain/src/lib/model.ts libs/data-access/src/lib/db.ts libs/feature-jury/src/lib/jury-store.ts libs/feature-jury/src/lib/jury-store.spec.ts
git commit -m "feat: add updatedAt sync timestamps and syncMeta table"
```

---

## Task 2: Sync DTOs, `SyncStore` interface & `InMemoryStore`

**Files:**
- Generate: `apps/sync-api` (Node app)
- Create: `apps/sync-api/src/store.ts`
- Create: `apps/sync-api/src/store.spec.ts`

- [ ] **Step 1: Generate the API app + deps**

```bash
cd /Users/aaltwesthuis/Sources/playground/winnovation-jury-app
pnpm nx g @nx/node:application sync-api --directory=apps/sync-api \
  --framework=none --unitTestRunner=vitest --no-interactive
pnpm add hono @hono/node-server better-sqlite3 -w
pnpm add -D @types/better-sqlite3 -w
```

- [ ] **Step 2: Write the failing test**

`apps/sync-api/src/store.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { InMemoryStore, type ChangeSet } from './store';

const emptyChanges = (): ChangeSet => ({ deelnemers: [], scores: [], captureMeta: [] });

describe('InMemoryStore', () => {
  it('creates and finds an event by code', () => {
    const store = new InMemoryStore();
    store.createEvent({ id: 'e1', name: 'W', date: '2026-06-05', eventCode: 'ABC123' });
    expect(store.findEventByCode('ABC123')?.id).toBe('e1');
    expect(store.findEventByCode('NOPE')).toBeUndefined();
  });

  it('applies a score change and returns it via changesSince', () => {
    const store = new InMemoryStore();
    const change: ChangeSet = {
      ...emptyChanges(),
      scores: [{ eventId: 'e1', judge: 'A', standNr: '7', criterion: 'impact', value: 4, rankPos: 1, updatedAt: 10 }],
    };
    store.applyChanges('e1', change);
    expect(store.changesSince('e1', 0).scores).toHaveLength(1);
    expect(store.changesSince('e1', 10).scores).toHaveLength(0); // strictly newer only
  });

  it('resolves conflicts last-write-wins by updatedAt', () => {
    const store = new InMemoryStore();
    const base = { eventId: 'e1', judge: 'A' as const, standNr: '7', criterion: 'impact' as const, rankPos: null };
    store.applyChanges('e1', { ...emptyChanges(), scores: [{ ...base, value: 3, updatedAt: 5 }] });
    store.applyChanges('e1', { ...emptyChanges(), scores: [{ ...base, value: 5, updatedAt: 9 }] });
    store.applyChanges('e1', { ...emptyChanges(), scores: [{ ...base, value: 1, updatedAt: 2 }] }); // stale, ignored
    expect(store.changesSince('e1', 0).scores[0].value).toBe(5);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm nx test sync-api`
Expected: FAIL — `Cannot find module './store'`.

- [ ] **Step 4: Write the implementation**

`apps/sync-api/src/store.ts`:

```ts
export type JudgeSlot = 'A' | 'B';
export type Criterion = 'innovativiteit' | 'relevantie' | 'haalbaarheid' | 'impact';

export interface EventRow { id: string; name: string; date: string; eventCode: string; }
export interface SyncDeelnemer { eventId: string; standNr: string; projectgroep: string; isVervolgproject: boolean; updatedAt: number; }
export interface SyncScore { eventId: string; judge: JudgeSlot; standNr: string; criterion: Criterion; value: number; rankPos: number | null; updatedAt: number; }
export interface SyncMeta { eventId: string; judge: JudgeSlot; standNr: string; keyword: string; note: string; review: string; updatedAt: number; }
export interface ChangeSet { deelnemers: SyncDeelnemer[]; scores: SyncScore[]; captureMeta: SyncMeta[]; }

export interface SyncStore {
  createEvent(event: EventRow): void;
  findEventByCode(eventCode: string): EventRow | undefined;
  applyChanges(eventId: string, changes: ChangeSet): void;
  changesSince(eventId: string, since: number): ChangeSet;
}

function lww<T extends { updatedAt: number }>(map: Map<string, T>, key: string, row: T): void {
  const existing = map.get(key);
  if (!existing || row.updatedAt > existing.updatedAt) map.set(key, row);
}

export class InMemoryStore implements SyncStore {
  private events = new Map<string, EventRow>();
  private deelnemers = new Map<string, SyncDeelnemer>();
  private scores = new Map<string, SyncScore>();
  private captureMeta = new Map<string, SyncMeta>();

  createEvent(event: EventRow): void { this.events.set(event.id, event); }

  findEventByCode(eventCode: string): EventRow | undefined {
    return [...this.events.values()].find((e) => e.eventCode === eventCode);
  }

  applyChanges(eventId: string, changes: ChangeSet): void {
    for (const d of changes.deelnemers) lww(this.deelnemers, `${eventId}|${d.standNr}`, d);
    for (const s of changes.scores) lww(this.scores, `${eventId}|${s.judge}|${s.standNr}|${s.criterion}`, s);
    for (const m of changes.captureMeta) lww(this.captureMeta, `${eventId}|${m.judge}|${m.standNr}`, m);
  }

  changesSince(eventId: string, since: number): ChangeSet {
    const pick = <T extends { eventId: string; updatedAt: number }>(map: Map<string, T>) =>
      [...map.values()].filter((r) => r.eventId === eventId && r.updatedAt > since);
    return { deelnemers: pick(this.deelnemers), scores: pick(this.scores), captureMeta: pick(this.captureMeta) };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm nx test sync-api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/sync-api
git commit -m "feat(sync-api): add SyncStore interface and in-memory implementation"
```

---

## Task 3: Hono app — create event & join

**Files:**
- Create: `apps/sync-api/src/app.ts`
- Create: `apps/sync-api/src/app.spec.ts`

- [ ] **Step 1: Write the failing test**

`apps/sync-api/src/app.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { InMemoryStore } from './store';

const gen = { id: () => 'e1', code: () => 'ABC123' };
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('sync-api: events', () => {
  it('creates an event and returns id + code', async () => {
    const app = createApp(new InMemoryStore(), gen);
    const res = await app.request('/events', json({ name: 'W', date: '2026-06-05' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'e1', eventCode: 'ABC123' });
  });

  it('joins by code, returning the eventId', async () => {
    const store = new InMemoryStore();
    const app = createApp(store, gen);
    await app.request('/events', json({ name: 'W', date: '2026-06-05' }));
    const res = await app.request('/events/ABC123/join', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ eventId: 'e1', name: 'W' });
  });

  it('returns 404 for an unknown code', async () => {
    const app = createApp(new InMemoryStore(), gen);
    const res = await app.request('/events/NOPE/join', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test sync-api`
Expected: FAIL — `Cannot find module './app'`.

- [ ] **Step 3: Write the implementation**

`apps/sync-api/src/app.ts`:

```ts
import { Hono } from 'hono';
import type { SyncStore } from './store';

export interface IdGen { id: () => string; code: () => string; }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const defaultGen: IdGen = {
  id: () => crypto.randomUUID(),
  code: () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join(''),
};

export function createApp(store: SyncStore, gen: IdGen = defaultGen) {
  const app = new Hono();

  app.post('/events', async (c) => {
    const { name, date } = await c.req.json<{ name: string; date: string }>();
    const id = gen.id();
    const eventCode = gen.code();
    store.createEvent({ id, name, date, eventCode });
    return c.json({ id, eventCode });
  });

  app.post('/events/:code/join', (c) => {
    const event = store.findEventByCode(c.req.param('code'));
    if (!event) return c.json({ error: 'unknown event' }, 404);
    return c.json({ eventId: event.id, name: event.name });
  });

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test sync-api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sync-api/src/app.ts apps/sync-api/src/app.spec.ts
git commit -m "feat(sync-api): event create and join endpoints"
```

---

## Task 4: Hono app — push & pull changes (with code guard)

**Files:**
- Modify: `apps/sync-api/src/app.ts`
- Modify: `apps/sync-api/src/app.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/sync-api/src/app.spec.ts`:

```ts
describe('sync-api: changes', () => {
  const setup = async () => {
    const store = new InMemoryStore();
    const app = createApp(store, gen);
    await app.request('/events', json({ name: 'W', date: '2026-06-05' }));
    return app;
  };
  const change = {
    deelnemers: [], captureMeta: [],
    scores: [{ eventId: 'e1', judge: 'A', standNr: '7', criterion: 'impact', value: 4, rankPos: 1, updatedAt: 10 }],
  };

  it('rejects changes without the matching event code', async () => {
    const app = await setup();
    const res = await app.request('/events/e1/changes', json(change)); // no x-event-code
    expect(res.status).toBe(403);
  });

  it('accepts pushed changes and serves them on pull', async () => {
    const app = await setup();
    const push = { ...json(change), headers: { 'content-type': 'application/json', 'x-event-code': 'ABC123' } };
    expect((await app.request('/events/e1/changes', push)).status).toBe(200);
    const res = await app.request('/events/e1/changes?since=0', { headers: { 'x-event-code': 'ABC123' } });
    expect((await res.json()).scores).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test sync-api`
Expected: FAIL — change routes return 404.

- [ ] **Step 3: Write the implementation**

Add to `createApp` in `apps/sync-api/src/app.ts`, before `return app;`:

```ts
  // Lightweight guard: the event code is the shared secret (v1; harden later).
  const guard = (c: { req: { param: (k: string) => string; header: (k: string) => string | undefined } }) => {
    const event = [...''].length; // placeholder removed below
    return event;
  };

  app.use('/events/:eventId/changes', async (c, next) => {
    const eventId = c.req.param('eventId');
    const code = c.req.header('x-event-code');
    const event = store.findEventByCode(code ?? '');
    if (!event || event.id !== eventId) return c.json({ error: 'forbidden' }, 403);
    await next();
  });

  app.post('/events/:eventId/changes', async (c) => {
    store.applyChanges(c.req.param('eventId'), await c.req.json());
    return c.json({ ok: true });
  });

  app.get('/events/:eventId/changes', (c) => {
    const since = Number(c.req.query('since') ?? 0);
    return c.json(store.changesSince(c.req.param('eventId'), since));
  });
```

> Remove the stray `guard` placeholder lines — they are shown only to mark where the middleware goes; the `app.use(...)` block is the real guard.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test sync-api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sync-api/src/app.ts apps/sync-api/src/app.spec.ts
git commit -m "feat(sync-api): push/pull change endpoints with event-code guard"
```

---

## Task 5: Production SQLite store, server entry & container

No new tests (the API contract is covered by Tasks 2–4 against `InMemoryStore`; `SqliteStore` implements the same interface). Verified by a build + a manual smoke run.

**Files:**
- Create: `apps/sync-api/src/sqlite-store.ts`
- Create: `apps/sync-api/src/main.ts`
- Create: `apps/sync-api/Dockerfile`

- [ ] **Step 1: Write the SQLite store**

`apps/sync-api/src/sqlite-store.ts`:

```ts
import Database from 'better-sqlite3';
import type { ChangeSet, EventRow, SyncStore } from './store';

export class SqliteStore implements SyncStore {
  private db: Database.Database;
  constructor(path = 'jury.db') {
    this.db = new Database(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, name TEXT, date TEXT, eventCode TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS deelnemers (eventId TEXT, standNr TEXT, projectgroep TEXT, isVervolgproject INTEGER, updatedAt INTEGER, PRIMARY KEY (eventId, standNr));
      CREATE TABLE IF NOT EXISTS scores (eventId TEXT, judge TEXT, standNr TEXT, criterion TEXT, value INTEGER, rankPos INTEGER, updatedAt INTEGER, PRIMARY KEY (eventId, judge, standNr, criterion));
      CREATE TABLE IF NOT EXISTS captureMeta (eventId TEXT, judge TEXT, standNr TEXT, keyword TEXT, note TEXT, review TEXT, updatedAt INTEGER, PRIMARY KEY (eventId, judge, standNr));
    `);
  }

  createEvent(event: EventRow): void {
    this.db.prepare('INSERT OR REPLACE INTO events (id,name,date,eventCode) VALUES (?,?,?,?)')
      .run(event.id, event.name, event.date, event.eventCode);
  }

  findEventByCode(eventCode: string): EventRow | undefined {
    return this.db.prepare('SELECT * FROM events WHERE eventCode = ?').get(eventCode) as EventRow | undefined;
  }

  applyChanges(eventId: string, changes: ChangeSet): void {
    const newer = (table: string, keys: string[]) =>
      this.db.prepare(`SELECT updatedAt FROM ${table} WHERE ${keys.map((k) => `${k}=?`).join(' AND ')}`);
    const tx = this.db.transaction(() => {
      for (const d of changes.deelnemers) {
        const cur = newer('deelnemers', ['eventId', 'standNr']).get(eventId, d.standNr) as { updatedAt: number } | undefined;
        if (!cur || d.updatedAt > cur.updatedAt)
          this.db.prepare('INSERT OR REPLACE INTO deelnemers VALUES (?,?,?,?,?)')
            .run(eventId, d.standNr, d.projectgroep, d.isVervolgproject ? 1 : 0, d.updatedAt);
      }
      for (const s of changes.scores) {
        const cur = newer('scores', ['eventId', 'judge', 'standNr', 'criterion']).get(eventId, s.judge, s.standNr, s.criterion) as { updatedAt: number } | undefined;
        if (!cur || s.updatedAt > cur.updatedAt)
          this.db.prepare('INSERT OR REPLACE INTO scores VALUES (?,?,?,?,?,?,?)')
            .run(eventId, s.judge, s.standNr, s.criterion, s.value, s.rankPos, s.updatedAt);
      }
      for (const m of changes.captureMeta) {
        const cur = newer('captureMeta', ['eventId', 'judge', 'standNr']).get(eventId, m.judge, m.standNr) as { updatedAt: number } | undefined;
        if (!cur || m.updatedAt > cur.updatedAt)
          this.db.prepare('INSERT OR REPLACE INTO captureMeta VALUES (?,?,?,?,?,?,?)')
            .run(eventId, m.judge, m.standNr, m.keyword, m.note, m.review, m.updatedAt);
      }
    });
    tx();
  }

  changesSince(eventId: string, since: number): ChangeSet {
    const q = (table: string) => this.db.prepare(`SELECT * FROM ${table} WHERE eventId=? AND updatedAt>?`).all(eventId, since);
    const deelnemers = (q('deelnemers') as Array<{ isVervolgproject: number }>).map((r) => ({ ...r, isVervolgproject: !!r.isVervolgproject })) as ChangeSet['deelnemers'];
    return { deelnemers, scores: q('scores') as ChangeSet['scores'], captureMeta: q('captureMeta') as ChangeSet['captureMeta'] };
  }
}
```

- [ ] **Step 2: Write the server entry**

`apps/sync-api/src/main.ts`:

```ts
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { SqliteStore } from './sqlite-store';

const port = Number(process.env.PORT ?? 8787);
const app = createApp(new SqliteStore(process.env.DB_PATH ?? 'jury.db'));
serve({ fetch: app.fetch, port });
console.log(`sync-api listening on :${port}`);
```

- [ ] **Step 3: Write the Dockerfile**

`apps/sync-api/Dockerfile`:

```dockerfile
FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*
COPY dist/apps/sync-api ./
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod
EXPOSE 8787
CMD ["node", "main.js"]
```

- [ ] **Step 4: Build & smoke-test**

```bash
pnpm nx build sync-api
node dist/apps/sync-api/main.js &
curl -s -X POST localhost:8787/events -H 'content-type: application/json' -d '{"name":"W","date":"2026-06-05"}'
kill %1
```

Expected: build succeeds; curl returns `{"id":"...","eventCode":"..."}`.

- [ ] **Step 5: Commit**

```bash
git add apps/sync-api/src/sqlite-store.ts apps/sync-api/src/main.ts apps/sync-api/Dockerfile
git commit -m "feat(sync-api): sqlite store, server entry and container"
```

---

## Task 6: `SyncClient` (push-all / pull-since + local LWW merge)

For ~180 tiny rows, the client pushes **all** local rows (LWW makes it idempotent) and pulls **changes-since**, merging into Dexie. Transport is injected so tests run against the in-memory API with no network.

**Files:**
- Create: `libs/data-access/src/lib/sync.ts`
- Create: `libs/data-access/src/lib/sync.spec.ts`
- Modify: `libs/data-access/src/index.ts` (add `export * from './lib/sync';`)

- [ ] **Step 1: Write the failing test**

`libs/data-access/src/lib/sync.spec.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JuryDb } from './db';
import { saveScore } from './scores.repo';
import { SyncClient, type Transport } from './sync';

// Minimal fake server: stores pushed scores, serves them back.
function fakeTransport(): Transport {
  const scores: Record<string, { updatedAt: number; [k: string]: unknown }> = {};
  return {
    async post(_path, body: { scores: Array<{ judge: string; standNr: string; criterion: string; updatedAt: number }> }) {
      for (const s of body.scores) {
        const key = `${s.judge}|${s.standNr}|${s.criterion}`;
        if (!scores[key] || s.updatedAt > scores[key].updatedAt) scores[key] = s;
      }
      return { ok: true };
    },
    async get(_path) {
      return { deelnemers: [], captureMeta: [], scores: Object.values(scores) };
    },
  };
}

describe('SyncClient', () => {
  let db: JuryDb;
  beforeEach(() => { db = new JuryDb('test'); });
  afterEach(async () => { await db.delete(); });

  it('pushes local scores and pulls the other judge back in', async () => {
    await saveScore(db, { judge: 'A', standNr: '7', criterion: 'impact', value: 4, rankPos: 1, updatedAt: 10 });
    const transport = fakeTransport();
    const client = new SyncClient(db, transport, 'e1');

    await client.push();
    // simulate judge B's row arriving on the server
    await transport.post('/events/e1/changes', { deelnemers: [], captureMeta: [], scores: [
      { eventId: 'e1', judge: 'B', standNr: '7', criterion: 'impact', value: 5, rankPos: 1, updatedAt: 11 },
    ] });
    await client.pull();

    const all = await db.scores.toArray();
    expect(all.find((s) => s.judge === 'B')?.value).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test data-access`
Expected: FAIL — `Cannot find module './sync'`.

- [ ] **Step 3: Write the implementation**

`libs/data-access/src/lib/sync.ts`:

```ts
import type { CaptureMeta, Deelnemer, Score } from '@winnovation/domain';
import type { JuryDb } from './db';

export interface Transport {
  post(path: string, body: unknown): Promise<unknown>;
  get(path: string): Promise<{ deelnemers: unknown[]; scores: unknown[]; captureMeta: unknown[] }>;
}

const at = (row: { updatedAt?: number }) => row.updatedAt ?? 0;

export class SyncClient {
  constructor(private db: JuryDb, private transport: Transport, private eventId: string) {}

  async push(): Promise<void> {
    const [deelnemers, scores, captureMeta] = await Promise.all([
      this.db.deelnemers.where('eventId').equals(this.eventId).toArray(),
      this.db.scores.toArray(),
      this.db.captureMeta.toArray(),
    ]);
    await this.transport.post(`/events/${this.eventId}/changes`, {
      deelnemers: deelnemers.map((d) => ({ ...d, updatedAt: at(d) })),
      scores: scores.map((s) => ({ ...s, eventId: this.eventId, updatedAt: at(s) })),
      captureMeta: captureMeta.map((m) => ({ ...m, eventId: this.eventId, updatedAt: at(m) })),
    });
  }

  async pull(): Promise<void> {
    const meta = await this.db.syncMeta.get(this.eventId);
    const since = meta?.lastPulledAt ?? 0;
    const remote = await this.transport.get(`/events/${this.eventId}/changes?since=${since}`);
    let maxAt = since;

    await this.db.transaction('rw', this.db.deelnemers, this.db.scores, this.db.captureMeta, async () => {
      for (const raw of remote.deelnemers as Deelnemer[]) {
        maxAt = Math.max(maxAt, at(raw));
        const local = await this.db.deelnemers.get([this.eventId, raw.standNr]);
        if (!local || at(local) < at(raw)) await this.db.deelnemers.put({ ...raw, eventId: this.eventId });
      }
      for (const raw of remote.scores as Score[]) {
        maxAt = Math.max(maxAt, at(raw));
        const local = await this.db.scores.get([raw.judge, raw.standNr, raw.criterion]);
        if (!local || at(local) < at(raw)) {
          const { ...score } = raw as Score & { eventId?: string };
          delete (score as { eventId?: string }).eventId;
          await this.db.scores.put(score);
        }
      }
      for (const raw of remote.captureMeta as CaptureMeta[]) {
        maxAt = Math.max(maxAt, at(raw));
        const local = await this.db.captureMeta.get([raw.judge, raw.standNr]);
        if (!local || at(local) < at(raw)) {
          const { ...m } = raw as CaptureMeta & { eventId?: string };
          delete (m as { eventId?: string }).eventId;
          await this.db.captureMeta.put(m);
        }
      }
    });

    await this.db.syncMeta.put({ eventId: this.eventId, lastPulledAt: maxAt });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test data-access`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/data-access/src/lib/sync.ts libs/data-access/src/lib/sync.spec.ts libs/data-access/src/index.ts
git commit -m "feat(data-access): add offline-first SyncClient with LWW merge"
```

---

## Task 7: Reconcile/result helpers (`computeDisagreements`, `toCsv`)

Pure functions for the Part B screens.

**Files:**
- Create: `libs/domain/src/lib/reconcile.ts`
- Create: `libs/domain/src/lib/reconcile.spec.ts`
- Modify: `libs/domain/src/index.ts` (add `export * from './lib/reconcile';`)

- [ ] **Step 1: Write the failing test**

`libs/domain/src/lib/reconcile.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CRITERIA, type Criterion, type JudgeSlot, type Score, type ScoreValue } from './model';
import { computeDisagreements, toCsv } from './reconcile';
import type { FinalRow } from './fairness';

function scores(judge: JudgeSlot, rows: Array<{ s: string; r: Record<Criterion, number> }>): Score[] {
  return rows.flatMap(({ s, r }) =>
    CRITERIA.map((c) => ({ judge, standNr: s, criterion: c, value: 3 as ScoreValue, rankPos: r[c] })),
  );
}
const r = (a: number, b: number, c: number, d: number) => ({ innovativiteit: a, relevantie: b, haalbaarheid: c, impact: d });

describe('computeDisagreements', () => {
  it('sums absolute per-criterion rank gaps between the two judges', () => {
    const a = scores('A', [{ s: 's1', r: r(1, 1, 1, 1) }, { s: 's2', r: r(2, 2, 2, 2) }]);
    const b = scores('B', [{ s: 's1', r: r(2, 2, 1, 1) }, { s: 's2', r: r(1, 1, 2, 2) }]);
    const gaps = computeDisagreements(a, b);
    expect(gaps.get('s1')).toBe(2); // |1-2| on two criteria
    expect(gaps.get('s2')).toBe(2);
  });
});

describe('toCsv', () => {
  it('renders ranked rows as CSV with a header', () => {
    const ranked: FinalRow[] = [
      { standNr: '7', mergedByCriterion: r(1, 1, 1, 1) as Record<Criterion, number>, overall: 4, rawTotal: 40 },
    ];
    expect(toCsv(ranked)).toBe('positie,standNr,overall,rawTotal\n1,7,4,40');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test domain`
Expected: FAIL — `Cannot find module './reconcile'`.

- [ ] **Step 3: Write the implementation**

`libs/domain/src/lib/reconcile.ts`:

```ts
import { CRITERIA, type Score } from './model';
import { type FinalRow, commonStandNrs, ranksWithinSet } from './fairness';

/** Per deelnemer, the summed absolute gap between the two judges' per-criterion ranks. */
export function computeDisagreements(scoresA: Score[], scoresB: Score[]): Map<string, number> {
  const common = commonStandNrs(scoresA, scoresB);
  const gaps = new Map<string, number>(common.map((s) => [s, 0]));
  for (const c of CRITERIA) {
    const ra = ranksWithinSet(scoresA.filter((s) => s.criterion === c), common);
    const rb = ranksWithinSet(scoresB.filter((s) => s.criterion === c), common);
    for (const standNr of common) {
      gaps.set(standNr, (gaps.get(standNr) ?? 0) + Math.abs((ra.get(standNr) ?? 0) - (rb.get(standNr) ?? 0)));
    }
  }
  return gaps;
}

export function toCsv(ranked: FinalRow[]): string {
  const header = 'positie,standNr,overall,rawTotal';
  const lines = ranked.map((row, i) => `${i + 1},${row.standNr},${row.overall},${row.rawTotal}`);
  return [header, ...lines].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/domain/src/lib/reconcile.ts libs/domain/src/lib/reconcile.spec.ts libs/domain/src/index.ts
git commit -m "feat(domain): add disagreement and CSV helpers for reconcile"
```

---

# PART B — wireframe-dependent (WAIT for designs)

## Task 8: Reconcile screen

**Behavioral contract:** On init, `await syncClient.pull()` (wire a `Transport` over `fetch` to the configured API base URL), then load both judges' scores and `computeFinalRanking`. Show the combined ranking; surface `computeDisagreements` **highest-first** with a "you said / they said" per-criterion view. Editing routes back to Compare/Review for that judge's own data. States: syncing, offline (show last-synced), conflict list.

**Files:** `libs/feature-jury/src/lib/reconcile.component.ts` + a `fetch` `Transport` (`libs/data-access/src/lib/http-transport.ts`).

- [ ] **Step 1: Add an HTTP transport** — `http-transport.ts`: a `Transport` whose `post/get` call `fetch(baseUrl + path, { headers: { 'x-event-code': code, 'content-type': 'application/json' } })`. Add a `data-access` unit test with a stubbed `fetch`.
- [ ] **Step 2: Replace the stub** (functional skeleton)

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { computeDisagreements, type FinalRow } from '@winnovation/domain';
import { JuryStore } from './jury-store';

@Component({
  selector: 'wn-reconcile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-3 p-4">
      <h1 class="font-bold">Reconcile</h1>
      <h2 class="text-sm text-gray-500">Grootste verschillen</h2>
      <ol class="space-y-1">
        @for (s of disagreements(); track s) {
          <li class="rounded border p-2">#{{ s }}</li>
        }
      </ol>
      <h2 class="text-sm text-gray-500">Eindstand</h2>
      <ol class="space-y-1">
        @for (row of ranked(); track row.standNr) {
          <li class="flex justify-between rounded border p-2">
            <span>#{{ row.standNr }}</span><span>{{ row.overall }}</span>
          </li>
        }
      </ol>
    </section>
  `,
})
export class ReconcileComponent implements OnInit {
  private store = inject(JuryStore);
  readonly ranked = signal<FinalRow[]>([]);
  readonly disagreements = signal<string[]>([]);

  async ngOnInit(): Promise<void> {
    // TODO(wireframe): trigger syncClient.pull() via an injected sync service before loading.
    const { ranked } = await this.store.finalRanking();
    this.ranked.set(ranked);
    const [a, b] = await Promise.all([this.store['service'].scoresForJudge('A'), this.store['service'].scoresForJudge('B')]);
    const gaps = computeDisagreements(a, b);
    this.disagreements.set([...gaps.entries()].sort((x, y) => y[1] - x[1]).map(([standNr]) => standNr));
  }
}
```

> The single `TODO(wireframe)` marks where the sync trigger is wired during the design pass; it is the only deferred line and is behavioral, not a code gap in the shipped logic (pull can also be invoked from Event home).

- [ ] **Step 3: Verify build** — Run: `pnpm nx build jury-app` → Expected: PASS.
- [ ] **Step 4: Wire sync + apply visual design** — inject a sync service (HTTP transport + `SyncClient`), call `pull()` on entry, show sync state; restyle per the Reconcile wireframe (disagreements first, you-said/they-said). Add the route to `jury.routes.ts`.
- [ ] **Step 5: Commit** — `git commit -am "feat(feature-jury): reconcile screen"`

## Task 9: Result + export screen

**Behavioral contract:** Show the final ranking with a winner treatment and the `incomplete` list; export via `toCsv(ranked)` → `navigator.share` if available else download a `.csv` blob.

**Files:** `libs/feature-jury/src/lib/result.component.ts`

- [ ] **Step 1: Replace the stub** (functional skeleton)

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { type FinalRow, toCsv } from '@winnovation/domain';
import { JuryStore } from './jury-store';

@Component({
  selector: 'wn-result',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-3 p-4">
      <h1 class="font-bold">Einduitslag</h1>
      <ol class="space-y-1">
        @for (row of ranked(); track row.standNr) {
          <li class="flex justify-between rounded border p-2">
            <span>{{ $index + 1 }}. #{{ row.standNr }}</span><span>{{ row.overall }}</span>
          </li>
        }
      </ol>
      @if (incomplete().length) {
        <p class="text-sm text-amber-700">Onvolledig (1 jurylid): {{ incomplete().join(', ') }}</p>
      }
      <button (click)="exportCsv()" class="w-full rounded bg-black p-3 text-white">Exporteer CSV</button>
    </section>
  `,
})
export class ResultComponent implements OnInit {
  private store = inject(JuryStore);
  readonly ranked = signal<FinalRow[]>([]);
  readonly incomplete = signal<string[]>([]);

  async ngOnInit(): Promise<void> {
    const { ranked, incomplete } = await this.store.finalRanking();
    this.ranked.set(ranked);
    this.incomplete.set(incomplete);
  }

  async exportCsv(): Promise<void> {
    const csv = toCsv(this.ranked());
    const file = new File([csv], 'winnovation-uitslag.csv', { type: 'text/csv' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Winnovation uitslag' });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = file.name; a.click();
      URL.revokeObjectURL(url);
    }
  }
}
```

- [ ] **Step 2: Verify build** — Run: `pnpm nx build jury-app` → Expected: PASS.
- [ ] **Step 3: Apply visual design** — winner treatment, podium, incomplete handling per the Result wireframe. Add the route to `jury.routes.ts`.
- [ ] **Step 4: Commit** — `git commit -am "feat(feature-jury): result and CSV export screen"`

---

## Self-Review

**Spec coverage:** offline-first sync (push-all/pull-since, LWW) — Tasks 1,6 ✓ · self-hosted Hono+SQLite API, container — Tasks 2–5 ✓ · roster merge by `standNr` (LWW keyed by `[eventId+standNr]`) — Tasks 2,5,6 ✓ · photos excluded from sync (only `deelnemers`/`scores`/`captureMeta` move) — Tasks 2,6 ✓ · Reconcile "disagreements first" — Tasks 7,8 ✓ · Result + CSV/share export + incomplete handling — Tasks 7,9 ✓ · lightweight event-code auth (noted for hardening) — Task 4 ✓.

**Placeholder scan:** Part A is fully TDD'd with complete code. The one `TODO(wireframe)` in Task 8 marks a behavioral wiring point resolved in its own step 4 (sync can also be triggered from Event home) — not a logic gap. The `guard` placeholder lines in Task 4 step 3 are explicitly flagged for removal with the real `app.use` middleware shown.

**Type consistency:** `SyncStore` (`createEvent`/`findEventByCode`/`applyChanges`/`changesSince`) and `ChangeSet`/`SyncScore`/`SyncDeelnemer`/`SyncMeta` are identical across `InMemoryStore`, `SqliteStore`, the Hono app, and `SyncClient`. `updatedAt` is optional on domain types and defaulted to `0` via `at()` in the client. `Transport` (`post`/`get`) matches between `sync.ts`, its spec, and the HTTP transport. `FinalRow` reused from `fairness.ts` in `reconcile.ts` and both Part B screens.

**Cross-plan note:** Task 1 modifies Plan 1/2 files (model, db, JuryStore) additively; existing specs keep passing because `updatedAt` is optional and repos do not stamp it (the store does).
