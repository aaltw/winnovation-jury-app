import { describe, expect, it } from "vitest";
import type { ScoreValue } from "./model";
import { type Placed, bracketingAnchors, placeAt, renumber } from "./placement";

const p = (standNr: string, value: ScoreValue, rankPos: number): Placed => ({
  standNr,
  value,
  rankPos,
});

describe("bracketingAnchors", () => {
  it("returns null anchors when nothing is placed yet", () => {
    expect(bracketingAnchors([], 4)).toEqual({ above: null, below: null, index: 0 });
  });
  it("suggests a slot between the better- and worse-valued neighbours", () => {
    const placed = [p("A", 5, 1), p("B", 3, 2)];
    expect(bracketingAnchors(placed, 4)).toEqual({ above: placed[0], below: placed[1], index: 1 });
  });
  it("suggests the top slot when the value beats everything", () => {
    const placed = [p("A", 4, 1), p("B", 3, 2)];
    expect(bracketingAnchors(placed, 5)).toEqual({ above: null, below: placed[0], index: 0 });
  });
  it("suggests the bottom slot when the value loses to everything", () => {
    const placed = [p("A", 4, 1), p("B", 3, 2)];
    expect(bracketingAnchors(placed, 1)).toEqual({ above: placed[1], below: null, index: 2 });
  });
});
describe("placeAt", () => {
  it("inserts a new standNr at the target index", () => {
    expect(placeAt(["A", "B"], "C", 1)).toEqual(["A", "C", "B"]);
  });
  it("moves an already-present standNr to the target index", () => {
    expect(placeAt(["A", "B", "C"], "C", 0)).toEqual(["C", "A", "B"]);
  });
  it("clamps an out-of-range index to the end", () => {
    expect(placeAt(["A"], "B", 99)).toEqual(["A", "B"]);
  });
});
describe("renumber", () => {
  it("maps an ordering to dense 1-based rankPos (1 = best)", () => {
    expect(renumber(["X", "Y", "Z"])).toEqual(
      new Map([
        ["X", 1],
        ["Y", 2],
        ["Z", 3],
      ]),
    );
  });
});
