import "fake-indexeddb/auto";
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
});
