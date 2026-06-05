import "fake-indexeddb/auto";
import { CRITERIA, computeDisagreements, detectAllDrift, driftList } from "@winnovation/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JuryDb } from "./db";
import { listDeelnemers } from "./deelnemers.repo";
import { findEventByCode } from "./events.repo";
import { scoresForJudge } from "./scores.repo";
import { DEMO_EVENT_CODE, seedDemo } from "./seed";

const PROJECT_COUNT = 6;
const fixedNow = () => 1_700_000_000_000;

describe("seedDemo", () => {
  let db: JuryDb;
  beforeEach(() => {
    db = new JuryDb("seed-test");
  });
  afterEach(async () => {
    await db.delete();
  });

  it("creates the WIN-26 demo event reachable by its code", async () => {
    const event = await seedDemo(db, fixedNow);
    expect(event.eventCode).toBe(DEMO_EVENT_CODE);
    expect(await findEventByCode(db, DEMO_EVENT_CODE)).toMatchObject({
      eventCode: DEMO_EVENT_CODE,
    });
  });

  it("seeds a full roster", async () => {
    const event = await seedDemo(db, fixedNow);
    expect(await listDeelnemers(db, event.id)).toHaveLength(PROJECT_COUNT);
  });

  it("scores every project on all criteria for both judges, fully placed", async () => {
    const event = await seedDemo(db, fixedNow);
    for (const judge of ["A", "B"] as const) {
      const scores = await scoresForJudge(db, event.id, judge);
      expect(scores).toHaveLength(PROJECT_COUNT * CRITERIA.length);
      expect(scores.every((s) => s.rankPos !== null)).toBe(true);
    }
  });

  it("seeds judge-A drift and A↔B disagreement so the showcase screens light up", async () => {
    const event = await seedDemo(db, fixedNow);
    const a = await scoresForJudge(db, event.id, "A");
    const b = await scoresForJudge(db, event.id, "B");
    expect(detectAllDrift(a).length).toBeGreaterThan(0);
    expect(driftList(a).length).toBeGreaterThan(0);
    expect([...computeDisagreements(a, b).values()].some((gap) => gap > 0)).toBe(true);
  });

  it("is idempotent — a second run leaves a single event and the same roster", async () => {
    const first = await seedDemo(db, fixedNow);
    const second = await seedDemo(db, fixedNow);
    expect(second.id).toBe(first.id);
    expect(await db.events.count()).toBe(1);
    expect(await listDeelnemers(db, first.id)).toHaveLength(PROJECT_COUNT);
    expect(await scoresForJudge(db, first.id, "A")).toHaveLength(PROJECT_COUNT * CRITERIA.length);
  });

  it("self-heals when the demo event survives but its scores were wiped (v3→v4 migration)", async () => {
    const event = await seedDemo(db, fixedNow);
    // Simulate the migration: the event/roster survive, scores+meta are dropped.
    await db.scores.clear();
    await db.captureMeta.clear();
    expect(await scoresForJudge(db, event.id, "A")).toHaveLength(0);

    const reseeded = await seedDemo(db, fixedNow);
    expect(reseeded.id).toBe(event.id);
    expect(await db.events.count()).toBe(1); // no duplicate event
    expect(await scoresForJudge(db, event.id, "A")).toHaveLength(PROJECT_COUNT * CRITERIA.length);
  });
});
