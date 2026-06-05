import { describe, expect, it } from "vitest";
import { CRITERIA, type Criterion, type JudgeSlot, type Score, type ScoreValue } from "./model";
import { computeDisagreements, toCsv } from "./reconcile";
import type { FinalRow } from "./fairness";

function scores(
  judge: JudgeSlot,
  rows: Array<{ s: string; r: Record<Criterion, number> }>,
): Score[] {
  return rows.flatMap(({ s, r }) =>
    CRITERIA.map((c) => ({
      eventId: "e",
      judge,
      standNr: s,
      criterion: c,
      value: 3 as ScoreValue,
      rankPos: r[c],
    })),
  );
}
const r = (a: number, b: number, c: number, d: number) => ({
  innovativiteit: a,
  relevantie: b,
  haalbaarheid: c,
  impact: d,
});

describe("computeDisagreements", () => {
  it("sums absolute per-criterion rank gaps between the two judges", () => {
    const a = scores("A", [
      { s: "s1", r: r(1, 1, 1, 1) },
      { s: "s2", r: r(2, 2, 2, 2) },
    ]);
    const b = scores("B", [
      { s: "s1", r: r(2, 2, 1, 1) },
      { s: "s2", r: r(1, 1, 2, 2) },
    ]);
    const gaps = computeDisagreements(a, b);
    expect(gaps.get("s1")).toBe(2);
    expect(gaps.get("s2")).toBe(2);
  });
});
describe("toCsv", () => {
  it("renders ranked rows as CSV with a header", () => {
    const ranked: FinalRow[] = [
      {
        standNr: "7",
        mergedByCriterion: r(1, 1, 1, 1) as Record<Criterion, number>,
        overall: 4,
        rawTotal: 40,
      },
    ];
    expect(toCsv(ranked)).toBe("positie,standNr,overall,rawTotal\n1,7,4,40");
  });
});
