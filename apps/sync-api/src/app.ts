import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ChangeBus } from "./change-bus";
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

export function createApp(
  store: SyncStore,
  gen: IdGen = defaultGen,
  bus: ChangeBus = new ChangeBus(),
) {
  const app = new Hono();

  app.post("/events", async (c) => {
    const { name, date } = await c.req.json<{ name: string; date: string }>();
    const id = gen.id();
    const eventCode = gen.code();
    store.createEvent({ id, name, date, eventCode });
    return c.json({ id, eventCode });
  });

  app.get("/events", (c) => c.json(store.listEvents()));

  app.post("/events/:code/join", (c) => {
    const event = store.findEventByCode(c.req.param("code"));
    if (!event) return c.json({ error: "unknown event" }, 404);
    // Return the full event so the joining device can persist a complete
    // JuryEvent locally (it only had the code typed in by the user).
    return c.json({
      eventId: event.id,
      name: event.name,
      date: event.date,
      eventCode: event.eventCode,
    });
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
    const eventId = c.req.param("eventId");
    store.applyChanges(eventId, await c.req.json());
    bus.publish(eventId);
    return c.json({ ok: true });
  });

  app.get("/events/:eventId/changes", (c) => {
    const since = Number(c.req.query("since") ?? 0);
    return c.json(store.changesSince(c.req.param("eventId"), since));
  });

  app.get("/events/:eventId/stream", (c) => {
    const eventId = c.req.param("eventId");
    // EventSource cannot set custom headers, so the code guard is a query param.
    const event = store.findEventByCode(c.req.query("code") ?? "");
    if (!event || event.id !== eventId) return c.json({ error: "forbidden" }, 403);
    return streamSSE(c, async (stream) => {
      const unsubscribe = bus.subscribe(eventId, () => {
        void stream.writeSSE({ data: "changed" });
      });
      const ping = setInterval(() => {
        void stream.writeSSE({ data: "ping", event: "ping" });
      }, 25000);
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(ping);
          unsubscribe();
          resolve();
        });
      });
    });
  });

  return app;
}
