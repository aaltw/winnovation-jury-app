import "fake-indexeddb/auto";
import { TestBed } from "@angular/core/testing";
import {
  JuryDb,
  type Remote,
  type RemoteEventInfo,
  type Transport,
} from "@winnovation/data-access";
import {
  type CaptureMeta,
  CRITERIA,
  type Criterion,
  type Deelnemer,
  type Score,
  type ScoreValue,
} from "@winnovation/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CaptureInput, JuryStore } from "./jury-store";

const capture = (
  standNr: string,
  scores: Record<Criterion, ScoreValue>,
  overrides: Partial<CaptureInput> = {},
): CaptureInput => ({
  standNr,
  projectgroep: `groep-${standNr}`,
  isVervolgproject: false,
  keyword: `kw-${standNr}`,
  note: "",
  review: "",
  scores,
  ...overrides,
});

const flat = (v: ScoreValue): Record<Criterion, ScoreValue> => ({
  innovativiteit: v,
  relevantie: v,
  haalbaarheid: v,
  impact: v,
});

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, String(v));
    },
    removeItem: (k) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

/** A remote that always fails — the local-only / offline path. */
const offlineRemote: Remote = {
  createEvent: () => Promise.reject(new Error("offline")),
  joinEvent: () => Promise.resolve(null),
  transportFor: () => ({
    post: () => Promise.reject(new Error("offline")),
    get: () => Promise.reject(new Error("offline")),
  }),
  listEvents: () => Promise.resolve([]),
  deleteEvent: () => Promise.reject(new Error("offline")),
  openChangeStream: () => ({ close() {} }),
};

function lww<T extends { updatedAt?: number }>(map: Map<string, T>, key: string, row: T): void {
  const existing = map.get(key);
  if (!existing || (row.updatedAt ?? 0) > (existing.updatedAt ?? 0)) map.set(key, row);
}

/** An in-memory stand-in for the sync-api: last-write-wins + `since` filtering. */
function fakeBackend() {
  const events = new Map<string, RemoteEventInfo>(); // eventCode → info
  const deelnemers = new Map<string, Deelnemer>();
  const scores = new Map<string, Score>();
  const captureMeta = new Map<string, CaptureMeta>();
  let seq = 0;

  const since = (path: string) => Number(new URL(path, "http://x").searchParams.get("since") ?? 0);
  const pick = <T extends { eventId: string; updatedAt?: number }>(
    map: Map<string, T>,
    id: string,
    after: number,
  ) => [...map.values()].filter((r) => r.eventId === id && (r.updatedAt ?? 0) > after);

  const remote: Remote = {
    createEvent: (name, date) => {
      seq += 1;
      const info: RemoteEventInfo = { id: `srv-${seq}`, name, date, eventCode: `S${seq}` };
      events.set(info.eventCode, info);
      return Promise.resolve({ id: info.id, eventCode: info.eventCode });
    },
    joinEvent: (code) => Promise.resolve(events.get(code) ?? null),
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
    deleteEvent: (eventId) => {
      for (const [code, info] of events) if (info.id === eventId) events.delete(code);
      for (const map of [deelnemers, scores, captureMeta] as Map<string, { eventId: string }>[])
        for (const [key, row] of map) if (row.eventId === eventId) map.delete(key);
      return Promise.resolve();
    },
    openChangeStream: () => ({ close() {} }),
    transportFor: (code) => {
      const eventId = () => {
        const info = events.get(code());
        if (!info) throw new Error("forbidden"); // mirrors the server's x-event-code guard
        return info.id;
      };
      const transport: Transport = {
        post: (_path, body) => {
          const id = eventId();
          const b = body as {
            deelnemers?: Deelnemer[];
            scores?: Score[];
            captureMeta?: CaptureMeta[];
          };
          for (const d of b.deelnemers ?? []) lww(deelnemers, `${id}|${d.standNr}`, d);
          for (const s of b.scores ?? [])
            lww(scores, `${id}|${s.judge}|${s.standNr}|${s.criterion}`, s);
          for (const m of b.captureMeta ?? []) lww(captureMeta, `${id}|${m.judge}|${m.standNr}`, m);
          return Promise.resolve({ ok: true });
        },
        get: (path) => {
          const id = eventId();
          const after = since(path);
          return Promise.resolve({
            deelnemers: pick(deelnemers, id, after),
            scores: pick(scores, id, after),
            captureMeta: pick(captureMeta, id, after),
          });
        },
      };
      return transport;
    },
  };
  return { remote, events, deelnemers, scores, captureMeta };
}

describe("JuryStore", () => {
  let store: JuryStore;
  beforeEach(() => {
    store = TestBed.inject(JuryStore);
    store.setRemoteForTest(offlineRemote); // local-only: unit tests never hit the network
  });
  afterEach(async () => {
    await store.resetForTest();
  });

  it("captures a deelnemer: writes roster, four scores, and meta", async () => {
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer({
      standNr: "7",
      projectgroep: "AI-compostbak",
      isVervolgproject: false,
      keyword: "compost",
      note: "",
      review: "",
      scores: { innovativiteit: 5, relevantie: 4, haalbaarheid: 3, impact: 4 },
    });
    await store.refreshDeelnemers();
    expect(store.deelnemers().map((d) => d.standNr)).toEqual(["7"]);
    const scores = await store.scoresForJudge("A");
    expect(scores).toHaveLength(CRITERIA.length);
    const meta = await store.metaFor("7");
    expect(meta?.keyword).toBe("compost");
  });

  it("places a deelnemer on a criterion and renumbers rankPos", async () => {
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer(capture("1", flat(5)));
    await store.captureDeelnemer(capture("2", flat(3)));
    await store.applyPlacement("impact", "1", 0); // best
    await store.applyPlacement("impact", "2", 1); // worse
    const scores = await store.scoresForJudge("A");
    const impact = scores.filter((s) => s.criterion === "impact");
    expect(impact.find((s) => s.standNr === "1")?.rankPos).toBe(1);
    expect(impact.find((s) => s.standNr === "2")?.rankPos).toBe(2);
  });

  it("stamps updatedAt on captured rows using the injectable clock", async () => {
    store.setClockForTest(() => 1234);
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer(capture("7", flat(5)));
    const scores = await store.scoresForJudge("A");
    expect(scores.every((s) => s.updatedAt === 1234)).toBe(true);
    const meta = await store.metaFor("7");
    expect(meta?.updatedAt).toBe(1234);
    await store.refreshDeelnemers();
    expect(store.deelnemers().every((d) => d.updatedAt === 1234)).toBe(true);
  });

  it("counts placed deelnemers (all four criteria ranked)", async () => {
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer(capture("1", flat(5)));
    await store.captureDeelnemer(capture("2", flat(3)));
    expect(store.placedCount()).toBe(0);
    expect(store.isPlaced("1")).toBe(false);
    for (const c of CRITERIA) {
      await store.applyPlacement(c, "1", 0);
    }
    await store.refreshDeelnemers();
    expect(store.isPlaced("1")).toBe(true);
    expect(store.isPlaced("2")).toBe(false);
    expect(store.placedCount()).toBe(1);
  });

  it("refreshDrift sets both adjacency flags and the severity list", async () => {
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    // standNr 1 has the lower value but is ranked best => inversion (drift).
    await store.captureDeelnemer(capture("1", flat(2)));
    await store.captureDeelnemer(capture("2", flat(5)));
    await store.applyPlacement("impact", "1", 0); // best, but lower value
    await store.applyPlacement("impact", "2", 1); // worse rank, higher value
    await store.refreshDrift();
    expect(store.driftFlags().some((f) => f.criterion === "impact")).toBe(true);
    expect(store.driftItems().some((i) => i.criterion === "impact")).toBe(true);
    // severity list is sorted strongest-first
    const severities = store.driftItems().map((i) => i.severity);
    expect([...severities].sort((a, b) => b - a)).toEqual(severities);
  });

  it("updateScoreValue changes the stored value, stamps the clock, and refreshes drift", async () => {
    store.setClockForTest(() => 999);
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer(capture("1", flat(3)));
    await store.updateScoreValue("impact", "1", 5);
    const scores = await store.scoresForJudge("A");
    const impact = scores.find((s) => s.criterion === "impact" && s.standNr === "1");
    expect(impact?.value).toBe(5);
    expect(impact?.updatedAt).toBe(999);
  });

  it("savePhoto stores a blob and returns a ref id", async () => {
    const ref = await store.savePhoto(new Blob(["x"], { type: "image/png" }));
    expect(typeof ref).toBe("string");
    expect(ref.length).toBeGreaterThan(0);
  });

  it("computes disagreements between the two judges", async () => {
    await store.createEvent("Winnovation", "2026-06-05");
    store.setJudge("A");
    await store.captureDeelnemer(capture("1", flat(5)));
    await store.captureDeelnemer(capture("2", flat(3)));
    await store.applyPlacement("impact", "1", 0);
    await store.applyPlacement("impact", "2", 1);
    store.setJudge("B");
    await store.captureDeelnemer(capture("1", flat(5)));
    await store.captureDeelnemer(capture("2", flat(3)));
    await store.applyPlacement("impact", "2", 0); // B ranks them oppositely
    await store.applyPlacement("impact", "1", 1);
    const gaps = await store.disagreements();
    expect(gaps.get("1")).toBeGreaterThan(0);
  });
});

describe("JuryStore sync", () => {
  let dbSeq = 0;
  const created: JuryStore[] = [];

  // Fresh store, isolated IndexedDB (a distinct name = a distinct "device").
  const freshStore = (remote: Remote, clockBase: number): JuryStore => {
    dbSeq += 1;
    const store = new JuryStore();
    store.setDbForTest(new JuryDb(`sync-test-${dbSeq}`));
    store.setRemoteForTest(remote);
    let t = clockBase;
    store.setClockForTest(() => ++t); // distinct, monotonic stamps so LWW is deterministic
    created.push(store);
    return store;
  };

  afterEach(async () => {
    for (const s of created) await s.resetForTest();
    created.length = 0;
  });

  it("refreshEventList loads the server's event listing", async () => {
    const backend = fakeBackend();
    const store = freshStore(backend.remote, 1000);
    await store.createEvent("Winnovation", "2026-06-05");
    await store.refreshEventList();
    expect(store.events().map((e) => e.name)).toContain("Winnovation");
  });

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

  it("createEvent registers with the server and pushes captured rows", async () => {
    const backend = fakeBackend();
    const store = freshStore(backend.remote, 1000);
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");

    expect(store.event()?.id).toBe("srv-1");
    expect(backend.events.has(store.event()?.eventCode ?? "")).toBe(true);

    await store.captureDeelnemer(capture("1", flat(5)));
    await store.settleSyncForTest();

    expect([...backend.deelnemers.values()].map((d) => d.standNr)).toEqual(["1"]);
    expect(backend.scores.size).toBe(CRITERIA.length);
  });

  it("createEvent falls back to a local-only event when the server is unreachable", async () => {
    const store = freshStore(offlineRemote, 1000);
    await store.createEvent("Winnovation", "2026-06-05");

    expect(store.event()).not.toBeNull();
    expect(store.event()?.id.startsWith("srv-")).toBe(false);

    store.setJudge("A");
    await store.captureDeelnemer(capture("1", flat(5)));
    await store.settleSyncForTest();
    expect(await store.scoresForJudge("A")).toHaveLength(CRITERIA.length);
  });

  it("joinEvent returns false for an unknown code", async () => {
    const backend = fakeBackend();
    const store = freshStore(backend.remote, 1000);
    expect(await store.joinEvent("NOPE", "B")).toBe(false);
  });

  it("shares one event across two devices (A captures, B joins and pulls, both reconcile)", async () => {
    const backend = fakeBackend();
    const deviceA = freshStore(backend.remote, 1_000);
    const deviceB = freshStore(backend.remote, 100_000); // strictly later stamps

    // Device A creates the event online, captures two stands, ranks them on impact.
    await deviceA.createEvent("Winnovation", "2026-06-05");
    deviceA.setJudge("A");
    await deviceA.captureDeelnemer(capture("1", flat(5)));
    await deviceA.captureDeelnemer(capture("2", flat(3)));
    await deviceA.applyPlacement("impact", "1", 0);
    await deviceA.applyPlacement("impact", "2", 1);
    await deviceA.settleSyncForTest();

    const code = deviceA.event()?.eventCode ?? "";

    // Device B joins by code → pulls A's roster and A's scores.
    expect(await deviceB.joinEvent(code, "B")).toBe(true);
    expect(deviceB.event()?.id).toBe(deviceA.event()?.id);
    expect(
      deviceB
        .deelnemers()
        .map((d) => d.standNr)
        .sort(),
    ).toEqual(["1", "2"]);
    expect(await deviceB.scoresForJudge("A")).toHaveLength(2 * CRITERIA.length);

    // B scores the same stands oppositely; disagreements span both devices on B.
    await deviceB.captureDeelnemer(capture("1", flat(5)));
    await deviceB.captureDeelnemer(capture("2", flat(3)));
    await deviceB.applyPlacement("impact", "2", 0);
    await deviceB.applyPlacement("impact", "1", 1);
    await deviceB.settleSyncForTest();
    expect((await deviceB.disagreements()).get("1") ?? 0).toBeGreaterThan(0);

    // A refreshes → now sees B's scores pulled from the server.
    await deviceA.refreshDeelnemers();
    expect(await deviceA.scoresForJudge("B")).toHaveLength(2 * CRITERIA.length);
  });
});
