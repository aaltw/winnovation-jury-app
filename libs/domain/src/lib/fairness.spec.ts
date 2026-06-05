import { describe, expect, it } from "vitest";
import { CRITERIA, type Criterion, type JudgeSlot, type Score, type ScoreValue } from "./model";
import { rawTotalFor } from "./fairness";

function scores(
  judge: JudgeSlot,
  rows: Array<{ s: string; v: Record<Criterion, ScoreValue>; r: Record<Criterion, number> }>,
): Score[] {
  return rows.flatMap(({ s, v, r }) =>
    CRITERIA.map((c) => ({ judge, standNr: s, criterion: c, value: v[c], rankPos: r[c] })),
  );
}
const v = (
  a: ScoreValue,
  b: ScoreValue,
  c: ScoreValue,
  d: ScoreValue,
): Record<Criterion, ScoreValue> => ({
  innovativiteit: a,
  relevantie: b,
  haalbaarheid: c,
  impact: d,
});
const r = (a: number, b: number, c: number, d: number): Record<Criterion, number> => ({
  innovativiteit: a,
  relevantie: b,
  haalbaarheid: c,
  impact: d,
});

describe("rawTotalFor", () => {
  it("sums all eight numbers (four criteria × two judges) for a deelnemer", () => {
    const a = scores("A", [{ s: "1", v: v(5, 4, 3, 2), r: r(1, 1, 1, 1) }]);
    const b = scores("B", [{ s: "1", v: v(1, 1, 1, 1), r: r(1, 1, 1, 1) }]);
    expect(rawTotalFor("1", a, b)).toBe(5 + 4 + 3 + 2 + 4);
  });
});

export { scores, v, r }; // reused by later specs in this file
