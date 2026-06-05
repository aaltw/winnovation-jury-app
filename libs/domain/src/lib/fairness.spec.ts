import { describe, expect, it } from "vitest";
import { CRITERIA, type Criterion, type JudgeSlot, type Score, type ScoreValue } from "./model";
import { rawTotalFor } from "./fairness";
import { detectAllDrift, detectDriftForCriterion } from "./fairness";
import { computeDriftSeverity, driftList } from "./fairness";

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

describe("detectDriftForCriterion", () => {
  const mk = (standNr: string, value: number, rankPos: number): Score => ({
    judge: "A",
    standNr,
    criterion: "impact",
    value: value as Score["value"],
    rankPos,
  });
  it("flags a deelnemer ranked better but scored lower than its neighbour", () => {
    const flags = detectDriftForCriterion([mk("x", 3, 1), mk("y", 4, 2)]);
    expect(flags).toEqual([
      { judge: "A", criterion: "impact", betterRanked: "x", worseRanked: "y" },
    ]);
  });
  it("returns no flags when values are monotonic with rank", () => {
    expect(detectDriftForCriterion([mk("x", 5, 1), mk("y", 4, 2), mk("z", 4, 3)])).toEqual([]);
  });
  it("ignores unplaced deelnemers (rankPos null)", () => {
    const unplaced: Score = {
      judge: "A",
      standNr: "q",
      criterion: "impact",
      value: 1,
      rankPos: null,
    };
    expect(detectDriftForCriterion([mk("x", 5, 1), unplaced])).toEqual([]);
  });
});

describe("detectAllDrift", () => {
  it("groups by judge and criterion", () => {
    const aImpact: Score[] = [
      { judge: "A", standNr: "x", criterion: "impact", value: 3, rankPos: 1 },
      { judge: "A", standNr: "y", criterion: "impact", value: 4, rankPos: 2 },
    ];
    const bImpact: Score[] = [
      { judge: "B", standNr: "x", criterion: "impact", value: 5, rankPos: 1 },
      { judge: "B", standNr: "y", criterion: "impact", value: 4, rankPos: 2 },
    ];
    expect(detectAllDrift([...aImpact, ...bImpact])).toEqual([
      { judge: "A", criterion: "impact", betterRanked: "x", worseRanked: "y" },
    ]);
  });
});

describe("computeDriftSeverity / driftList", () => {
  const mk = (standNr: string, value: number, rankPos: number | null): Score => ({
    judge: "A",
    standNr,
    criterion: "impact",
    value: value as Score["value"],
    rankPos,
  });
  it("marks both sides of a single mild inversion with severity 1", () => {
    const scores = [mk("x", 3, 1), mk("y", 4, 2)];
    const map = computeDriftSeverity(scores);
    expect(map["x"]?.impact).toBe(1);
    expect(map["y"]?.impact).toBe(1);
    const list = driftList(scores);
    expect(list).toHaveLength(2);
    expect(list.every((item) => item.severity === 1)).toBe(true);
  });
  it("marks a triple inversion as strong (severity 2) and sorts strongest first", () => {
    const scores = [mk("a", 1, 1), mk("b", 2, 2), mk("c", 3, 3), mk("d", 4, 4)];
    const map = computeDriftSeverity(scores);
    expect(map["a"]?.impact).toBe(2);
    const list = driftList(scores);
    expect(list[0].severity).toBe(2);
  });
  it("returns empty for a monotonic ordering", () => {
    const scores = [mk("x", 5, 1), mk("y", 4, 2), mk("z", 3, 3)];
    expect(computeDriftSeverity(scores)).toEqual({});
    expect(driftList(scores)).toEqual([]);
  });
  it("ignores unplaced scores (rankPos null)", () => {
    const scores = [mk("x", 5, 1), mk("y", 4, 2), mk("z", 3, 3), mk("q", 1, null)];
    expect(computeDriftSeverity(scores)).toEqual({});
    expect(driftList(scores)).toEqual([]);
  });
});

export { scores, v, r }; // reused by later specs in this file
