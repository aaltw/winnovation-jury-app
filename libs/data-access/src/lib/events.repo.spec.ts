import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JuryDb } from "./db";
import { createEvent, findEventByCode } from "./events.repo";

describe("events.repo", () => {
  let db: JuryDb;
  beforeEach(() => {
    db = new JuryDb("test");
  });
  afterEach(async () => {
    await db.delete();
  });

  const fixedGen = { id: () => "evt-1", code: () => "ABC123" };

  it("creates an event with a generated id and code", async () => {
    const event = await createEvent(db, { name: "Winnovation 2026", date: "2026-06-05" }, fixedGen);
    expect(event).toEqual({
      id: "evt-1",
      name: "Winnovation 2026",
      date: "2026-06-05",
      eventCode: "ABC123",
    });
    expect(await db.events.get("evt-1")).toBeTruthy();
  });

  it("finds an event by its code", async () => {
    await createEvent(db, { name: "X", date: "2026-06-05" }, fixedGen);
    const found = await findEventByCode(db, "ABC123");
    expect(found?.id).toBe("evt-1");
  });

  it("returns undefined for an unknown code", async () => {
    expect(await findEventByCode(db, "NOPE99")).toBeUndefined();
  });
});
