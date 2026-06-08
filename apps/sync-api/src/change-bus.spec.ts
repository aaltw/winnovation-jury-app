import { describe, expect, it } from "vitest";
import { ChangeBus } from "./change-bus";

describe("ChangeBus", () => {
  it("delivers a publish only to subscribers of that eventId", () => {
    const bus = new ChangeBus();
    const hits: string[] = [];
    bus.subscribe("e1", () => hits.push("a"));
    bus.subscribe("e2", () => hits.push("b"));
    bus.publish("e1");
    expect(hits).toEqual(["a"]);
  });

  it("stops delivery after unsubscribe", () => {
    const bus = new ChangeBus();
    let n = 0;
    const off = bus.subscribe("e1", () => {
      n += 1;
    });
    bus.publish("e1");
    off();
    bus.publish("e1");
    expect(n).toBe(1);
  });
});
