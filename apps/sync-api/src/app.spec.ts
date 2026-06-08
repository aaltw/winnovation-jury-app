import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { ChangeBus } from "./change-bus";
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
    expect(await res.json()).toEqual({
      eventId: "e1",
      name: "W",
      date: "2026-06-05",
      eventCode: "ABC123",
    });
  });

  it("returns 404 for an unknown code", async () => {
    const app = createApp(new InMemoryStore(), gen);
    const res = await app.request("/events/NOPE/join", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("GET /events lists events with project counts", async () => {
    const store = new InMemoryStore();
    const app = createApp(store, gen);
    await app.request("/events", json({ name: "W", date: "2026-06-05" }));
    const res = await app.request("/events");
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list).toEqual([
      { id: "e1", name: "W", date: "2026-06-05", eventCode: "ABC123", projectCount: 0 },
    ]);
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

  it("publishes a change notification after a successful push", async () => {
    const store = new InMemoryStore();
    const bus = new ChangeBus();
    const published: string[] = [];
    const realPublish = bus.publish.bind(bus);
    bus.publish = (id: string) => {
      published.push(id);
      realPublish(id);
    };
    const app = createApp(store, gen, bus);
    await app.request("/events", json({ name: "W", date: "2026-06-05" }));
    const push = {
      ...json({ deelnemers: [], scores: [], captureMeta: [] }),
      headers: { "content-type": "application/json", "x-event-code": "ABC123" },
    };
    await app.request("/events/e1/changes", push);
    expect(published).toEqual(["e1"]);
  });
});

describe("sync-api: SSE stream", () => {
  it("rejects a stream subscription with a wrong code", async () => {
    const store = new InMemoryStore();
    const app = createApp(store, gen);
    await app.request("/events", json({ name: "W", date: "2026-06-05" }));
    const res = await app.request("/events/e1/stream?code=WRONG");
    expect(res.status).toBe(403);
  });
});
