import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { InMemoryStore } from "./store";

const gen = { id: () => "e1", code: () => "ABC123" };
const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("sync-api: events", () => {
  it("creates an event and returns id + code", async () => {
    const app = createApp(new InMemoryStore(), gen);
    const res = await app.request("/events", json({ name: "W", date: "2026-06-05" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "e1", eventCode: "ABC123" });
  });

  it("joins by code, returning the eventId", async () => {
    const store = new InMemoryStore();
    const app = createApp(store, gen);
    await app.request("/events", json({ name: "W", date: "2026-06-05" }));
    const res = await app.request("/events/ABC123/join", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ eventId: "e1", name: "W" });
  });

  it("returns 404 for an unknown code", async () => {
    const app = createApp(new InMemoryStore(), gen);
    const res = await app.request("/events/NOPE/join", { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("sync-api: changes", () => {
  const setup = async () => {
    const store = new InMemoryStore();
    const app = createApp(store, gen);
    await app.request("/events", json({ name: "W", date: "2026-06-05" }));
    return app;
  };
  const change = {
    deelnemers: [],
    captureMeta: [],
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

  it("rejects changes without the matching event code", async () => {
    const app = await setup();
    const res = await app.request("/events/e1/changes", json(change)); // no x-event-code
    expect(res.status).toBe(403);
  });

  it("accepts pushed changes and serves them on pull", async () => {
    const app = await setup();
    const push = {
      ...json(change),
      headers: {
        "content-type": "application/json",
        "x-event-code": "ABC123",
      },
    };
    expect((await app.request("/events/e1/changes", push)).status).toBe(200);
    const res = await app.request("/events/e1/changes?since=0", {
      headers: { "x-event-code": "ABC123" },
    });
    expect((await res.json()).scores).toHaveLength(1);
  });
});
