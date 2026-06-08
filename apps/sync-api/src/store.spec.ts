import { describe, expect, it } from "vitest";
import { type ChangeSet, InMemoryStore } from "./store";

const emptyChanges = (): ChangeSet => ({
  deelnemers: [],
  scores: [],
  captureMeta: [],
});

describe("InMemoryStore", () => {
  it("creates and finds an event by code", () => {
    const store = new InMemoryStore();
    store.createEvent({
      id: "e1",
      name: "W",
      date: "2026-06-05",
      eventCode: "ABC123",
    });
    expect(store.findEventByCode("ABC123")?.id).toBe("e1");
    expect(store.findEventByCode("NOPE")).toBeUndefined();
  });
  it("applies a score change and returns it via changesSince", () => {
    const store = new InMemoryStore();
    const change: ChangeSet = {
      ...emptyChanges(),
      scores: [
        {
          eventId: "e1",
          judge: "A",
          standNr: "7",
          criterion: "impact",
          value: 4,
          rankPos: 1,
          updatedAt: 10,
        },
      ],
    };
    store.applyChanges("e1", change);
    expect(store.changesSince("e1", 0).scores).toHaveLength(1);
    expect(store.changesSince("e1", 10).scores).toHaveLength(0);
  });
  it("resolves conflicts last-write-wins by updatedAt", () => {
    const store = new InMemoryStore();
    const base = {
      eventId: "e1",
      judge: "A" as const,
      standNr: "7",
      criterion: "impact" as const,
      rankPos: null,
    };
    store.applyChanges("e1", {
      ...emptyChanges(),
      scores: [{ ...base, value: 3, updatedAt: 5 }],
    });
    store.applyChanges("e1", {
      ...emptyChanges(),
      scores: [{ ...base, value: 5, updatedAt: 9 }],
    });
    store.applyChanges("e1", {
      ...emptyChanges(),
      scores: [{ ...base, value: 1, updatedAt: 2 }],
    });
    expect(store.changesSince("e1", 0).scores[0].value).toBe(5);
  });
});

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
    expect(list[0]).toMatchObject({
      id: "e1",
      name: "Winnovation",
      eventCode: "ABC123",
      projectCount: 2,
    });
  });

  it("reports zero projects for an empty event", () => {
    const store = new InMemoryStore();
    store.createEvent({ id: "e1", name: "Leeg", date: "2026-06-05", eventCode: "EMPTY1" });
    expect(store.listEvents()[0].projectCount).toBe(0);
  });
});
