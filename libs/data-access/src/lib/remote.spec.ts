import { describe, expect, it } from "vitest";
import { HttpTransport, RemoteGateway } from "./remote";

type Call = { url: string; init?: RequestInit };

/** Fake fetch that records calls and returns a canned response. */
function fakeFetch(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const impl = (url: string, init?: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return Promise.resolve(handler(call));
  };
  return { impl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("RemoteGateway", () => {
  it("createEvent posts name+date and returns id+code", async () => {
    const { impl, calls } = fakeFetch(() => json({ id: "e1", eventCode: "ABC123" }));
    const gw = new RemoteGateway("/api", impl);
    const out = await gw.createEvent("W", "2026-06-05");
    expect(out).toEqual({ id: "e1", eventCode: "ABC123" });
    expect(calls[0].url).toBe("/api/events");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ name: "W", date: "2026-06-05" });
  });

  it("joinEvent returns the full event on 200", async () => {
    const { impl, calls } = fakeFetch(() =>
      json({ eventId: "e1", name: "W", date: "2026-06-05", eventCode: "ABC123" }),
    );
    const gw = new RemoteGateway("/api", impl);
    const out = await gw.joinEvent("ABC123");
    expect(out).toEqual({ id: "e1", name: "W", date: "2026-06-05", eventCode: "ABC123" });
    expect(calls[0].url).toBe("/api/events/ABC123/join");
  });

  it("joinEvent returns null on 404 (unknown code)", async () => {
    const { impl } = fakeFetch(() => json({ error: "unknown event" }, 404));
    const gw = new RemoteGateway("/api", impl);
    expect(await gw.joinEvent("NOPE")).toBeNull();
  });

  it("joinEvent throws on a server error", async () => {
    const { impl } = fakeFetch(() => json({ error: "boom" }, 500));
    const gw = new RemoteGateway("/api", impl);
    await expect(gw.joinEvent("X")).rejects.toThrow();
  });

  it("listEvents GETs /events and returns the array with project counts", async () => {
    const { impl, calls } = fakeFetch(() =>
      json([{ id: "e1", name: "W", date: "2026-06-05", eventCode: "ABC123", projectCount: 3 }]),
    );
    const gw = new RemoteGateway("/api", impl);
    const out = await gw.listEvents();
    expect(out).toEqual([
      { id: "e1", name: "W", date: "2026-06-05", eventCode: "ABC123", projectCount: 3 },
    ]);
    expect(calls[0].url).toBe("/api/events");
  });

  it("openChangeStream opens an EventSource at the stream URL via the injected factory", () => {
    let url = "";
    const fakeEs = { onopen: null, onmessage: null, onerror: null, close() {} };
    const gw = new RemoteGateway("/api", undefined, (u: string) => {
      url = u;
      return fakeEs as never;
    });
    const handle = gw.openChangeStream("e1", "ABC123", () => {});
    expect(url).toBe("/api/events/e1/stream?code=ABC123");
    handle.close();
  });

  it("transportFor sends the x-event-code header on push and pull", async () => {
    const { impl, calls } = fakeFetch((c) =>
      c.init?.method === "POST"
        ? json({ ok: true })
        : json({ deelnemers: [], scores: [], captureMeta: [] }),
    );
    const gw = new RemoteGateway("/api", impl);
    const transport = gw.transportFor(() => "ABC123");

    await transport.post("/events/e1/changes", { scores: [] });
    await transport.get("/events/e1/changes?since=0");

    expect(calls[0].url).toBe("/api/events/e1/changes");
    expect((calls[0].init?.headers as Record<string, string>)["x-event-code"]).toBe("ABC123");
    expect(calls[1].url).toBe("/api/events/e1/changes?since=0");
    expect((calls[1].init?.headers as Record<string, string>)["x-event-code"]).toBe("ABC123");
  });
});

describe("HttpTransport", () => {
  it("throws when the response is not ok", async () => {
    const t = new HttpTransport(
      "/api",
      () => "X",
      () => Promise.resolve(json({}, 403)),
    );
    await expect(t.get("/events/e1/changes?since=0")).rejects.toThrow();
  });
});
