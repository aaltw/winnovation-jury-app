import { Hono } from "hono";
import type { SyncStore } from "./store";

export interface IdGen {
  id: () => string;
  code: () => string;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const defaultGen: IdGen = {
  id: () => crypto.randomUUID(),
  code: () =>
    Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      (b) => ALPHABET[b % ALPHABET.length],
    ).join(""),
};

export function createApp(store: SyncStore, gen: IdGen = defaultGen) {
  const app = new Hono();

  app.post("/events", async (c) => {
    const { name, date } = await c.req.json<{ name: string; date: string }>();
    const id = gen.id();
    const eventCode = gen.code();
    store.createEvent({ id, name, date, eventCode });
    return c.json({ id, eventCode });
  });

  app.post("/events/:code/join", (c) => {
    const event = store.findEventByCode(c.req.param("code"));
    if (!event) return c.json({ error: "unknown event" }, 404);
    return c.json({ eventId: event.id, name: event.name });
  });

  return app;
}
