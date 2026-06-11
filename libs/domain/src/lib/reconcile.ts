import { CRITERIA, type Score } from "./model";
import { type FinalRow, commonStandNrs, competitionPositions, ranksWithinSet } from "./fairness";

/** Per deelnemer, summed absolute gap between the two judges' per-criterion ranks. */
export function computeDisagreements(scoresA: Score[], scoresB: Score[]): Map<string, number> {
  const common = commonStandNrs(scoresA, scoresB);
  const gaps = new Map<string, number>(common.map((s) => [s, 0]));
  for (const c of CRITERIA) {
    const ra = ranksWithinSet(
      scoresA.filter((s) => s.criterion === c),
      common,
    );
    const rb = ranksWithinSet(
      scoresB.filter((s) => s.criterion === c),
      common,
    );
    for (const standNr of common) {
      gaps.set(
        standNr,
        (gaps.get(standNr) ?? 0) + Math.abs((ra.get(standNr) ?? 0) - (rb.get(standNr) ?? 0)),
      );
    }
  }
  return gaps;
}
export function toCsv(ranked: FinalRow[]): string {
  const header = "positie,standNr,overall,rawTotal";
  const positions = competitionPositions(ranked);
  const lines = ranked.map(
    (row, i) => `${positions[i]},${row.standNr},${row.overall},${row.rawTotal}`,
  );
  return [header, ...lines].join("\n");
}
