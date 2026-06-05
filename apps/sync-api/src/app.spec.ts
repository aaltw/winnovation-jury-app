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
