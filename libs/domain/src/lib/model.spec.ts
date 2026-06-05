import { describe, expect, it } from "vitest";
import { CRITERIA } from "./model";

describe("CRITERIA", () => {
  it("lists the four official criteria in scorekaart order", () => {
    expect(CRITERIA).toEqual(["innovativiteit", "relevantie", "haalbaarheid", "impact"]);
  });
});
