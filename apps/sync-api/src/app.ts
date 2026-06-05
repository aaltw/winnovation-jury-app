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

  // Lightweight guard: the event code is the shared secret (v1; harden later).
  app.use("/events/:eventId/changes", async (c, next) => {
    const eventId = c.req.param("eventId");
    const code = c.req.header("x-event-code");
    const event = store.findEventByCode(code ?? "");
    if (!event || event.id !== eventId) return c.json({ error: "forbidden" }, 403);
    await next();
  });

  app.post("/events/:eventId/changes", async (c) => {
    store.applyChanges(c.req.param("eventId"), await c.req.json());
    return c.json({ ok: true });
  });

  app.get("/events/:eventId/changes", (c) => {
    const since = Number(c.req.query("since") ?? 0);
    return c.json(store.changesSince(c.req.param("eventId"), since));
  });

  return app;
}
