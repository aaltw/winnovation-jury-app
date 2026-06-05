import "fake-indexeddb/auto";
import type { Deelnemer } from "@winnovation/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JuryDb } from "./db";
import { listDeelnemers, upsertDeelnemer } from "./deelnemers.repo";

const d = (standNr: string, projectgroep: string, isVervolgproject = false): Deelnemer => ({
  eventId: "evt-1",
  standNr,
  projectgroep,
  isVervolgproject,
});

describe("deelnemers.repo", () => {
  let db: JuryDb;
  beforeEach(() => {
    db = new JuryDb("test");
  });
  afterEach(async () => {
    await db.delete();
  });

  it("creates and lists deelnemers for an event", async () => {
    await upsertDeelnemer(db, d("7", "AI-compostbak"));
    await upsertDeelnemer(db, d("8", "Slimme tuin"));
    const list = await listDeelnemers(db, "evt-1");
    expect(list.map((x) => x.standNr).sort()).toEqual(["7", "8"]);
  });

  it("merges by standNr — same eventId+standNr overwrites, never duplicates", async () => {
    await upsertDeelnemer(db, d("7", "Old name"));
    await upsertDeelnemer(db, d("7", "New name", true));
    const list = await listDeelnemers(db, "evt-1");
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(d("7", "New name", true));
  });
});
