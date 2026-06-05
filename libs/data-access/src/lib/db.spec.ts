import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JuryDb } from "./db";

describe("JuryDb", () => {
  let db: JuryDb;
  beforeEach(() => {
    db = new JuryDb("test");
  });
  afterEach(async () => {
    await db.delete();
  });

  it("opens with the six expected tables", async () => {
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ["captureMeta", "deelnemers", "events", "photos", "scores", "syncMeta"].sort(),
    );
  });

  it("event-scopes scores by [eventId+judge] and supports the compound index", async () => {
    await db.open();
    await db.scores.bulkPut([
      { eventId: "e1", judge: "A", standNr: "1", criterion: "impact", value: 5, rankPos: 1 },
      { eventId: "e2", judge: "A", standNr: "1", criterion: "impact", value: 2, rankPos: 1 },
    ]);
    // Same judge + standNr + criterion across two events must NOT collide.
    expect(await db.scores.count()).toBe(2);
    const e1 = await db.scores.where("[eventId+judge]").equals(["e1", "A"]).toArray();
    expect(e1.map((s) => s.value)).toEqual([5]);
  });
});

// Migration from the pre-fix v2 schema (un-scoped scores) up to the current
// event-scoped schema. Dexie cannot change a primary key in place, so v3 drops
// the table and v4 recreates it; this guards that the drop-then-recreate path
// opens cleanly and yields the new compound index.
describe("JuryDb migration v2 → current", () => {
  const NAME = "migration-test";
  afterEach(async () => {
    await new JuryDb(NAME).delete();
  });

  it("upgrades a populated v2 database without error and recreates event-scoped scores + captureMeta", async () => {
    const legacy = new Dexie(NAME);
    legacy.version(2).stores({
      events: "id, eventCode",
      deelnemers: "[eventId+standNr], eventId, updatedAt",
      scores: "[judge+standNr+criterion], judge, standNr, criterion, updatedAt",
      captureMeta: "[judge+standNr], judge, standNr, updatedAt",
      photos: "id",
      syncMeta: "eventId",
    });
    await legacy.open();
    await legacy
      .table("scores")
      .bulkPut([{ judge: "A", standNr: "1", criterion: "impact", value: 5, rankPos: 1 }]);
    await legacy
      .table("captureMeta")
      .bulkPut([
        { judge: "A", standNr: "1", keyword: "legacy", note: "", review: "", photoRef: null },
      ]);
    legacy.close();

    const db = new JuryDb(NAME);
    await db.open(); // runs v2 → v3 (drop) → v4 (recreate)
    // The migration is symmetric: both tables are nulled in v3 and recreated
    // event-scoped in v4. Assert both halves so a mistyped captureMeta PK or a
    // missing drop is caught, not just the scores path.
    expect(await db.scores.count()).toBe(0); // contaminated rows dropped
    expect(await db.captureMeta.count()).toBe(0);
    await db.scores.put({
      eventId: "e1",
      judge: "A",
      standNr: "1",
      criterion: "impact",
      value: 4,
      rankPos: 1,
    });
    await db.captureMeta.put({
      eventId: "e1",
      judge: "A",
      standNr: "1",
      keyword: "AI-compostbak",
      note: "",
      review: "",
      photoRef: null,
    });
    const got = await db.scores.where("[eventId+judge]").equals(["e1", "A"]).toArray();
    expect(got).toHaveLength(1);
    const meta = await db.captureMeta.get(["e1", "A", "1"]);
    expect(meta?.keyword).toBe("AI-compostbak");
    db.close();
  });
});
