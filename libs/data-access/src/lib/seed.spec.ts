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
    await seedDemo(db, fixedNow);
    for (const judge of ["A", "B"] as const) {
      const scores = await scoresForJudge(db, judge);
      expect(scores).toHaveLength(PROJECT_COUNT * CRITERIA.length);
      expect(scores.every((s) => s.rankPos !== null)).toBe(true);
    }
  });

  it("seeds judge-A drift and A↔B disagreement so the showcase screens light up", async () => {
    await seedDemo(db, fixedNow);
    const a = await scoresForJudge(db, "A");
    const b = await scoresForJudge(db, "B");
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
    expect(await scoresForJudge(db, "A")).toHaveLength(PROJECT_COUNT * CRITERIA.length);
  });
});
