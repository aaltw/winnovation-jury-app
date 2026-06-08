import { describe, expect, it, vi } from "vitest";
import { ChangeStream, type EventSourceLike } from "./change-stream";

function fakeEventSource() {
  const es = {
    url: "",
    closed: false,
    onopen: null as null | (() => void),
    onmessage: null as null | ((ev: { data: string }) => void),
    onerror: null as null | (() => void),
    close() {
      this.closed = true;
    },
  };
  const factory = (url: string) => {
    es.url = url;
    return es as unknown as EventSourceLike;
  };
  return { es, factory };
}

describe("ChangeStream", () => {
  it("builds the stream URL with eventId and code", () => {
    const { es, factory } = fakeEventSource();
    new ChangeStream("/api", "e1", "ABC123", () => {}, factory);
    expect(es.url).toBe("/api/events/e1/stream?code=ABC123");
  });

  it("fires onChange (debounced/coalesced) when messages arrive", async () => {
    vi.useFakeTimers();
    const { es, factory } = fakeEventSource();
    let hits = 0;
    new ChangeStream(
      "/api",
      "e1",
      "c",
      () => {
        hits += 1;
      },
      factory,
    );
    es.onmessage?.({ data: "changed" });
    es.onmessage?.({ data: "changed" });
    await vi.advanceTimersByTimeAsync(300);
    expect(hits).toBe(1);
    vi.useRealTimers();
  });

  it("fires onChange on (re)connect via onopen, and reports 'live' state", async () => {
    vi.useFakeTimers();
    const { es, factory } = fakeEventSource();
    let hits = 0;
    const states: string[] = [];
    new ChangeStream(
      "/api",
      "e1",
      "c",
      () => {
        hits += 1;
      },
      factory,
      (s) => states.push(s),
    );
    es.onopen?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(hits).toBe(1);
    expect(states).toContain("live");
    vi.useRealTimers();
  });

  it("reports 'connecting' on error and closes the source on close()", () => {
    const { es, factory } = fakeEventSource();
    const states: string[] = [];
    const cs = new ChangeStream(
      "/api",
      "e1",
      "c",
      () => {},
      factory,
      (s) => states.push(s),
    );
    es.onerror?.();
    expect(states).toContain("connecting");
    cs.close();
    expect(es.closed).toBe(true);
  });
});
