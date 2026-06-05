import { type Criterion, type JudgeSlot, type Score } from "./model";

/** Sum of every 1–5 value recorded for a deelnemer across both judges. Higher = better. */
export function rawTotalFor(standNr: string, scoresA: Score[], scoresB: Score[]): number {
  return [...scoresA, ...scoresB]
    .filter((s) => s.standNr === standNr)
    .reduce((sum, s) => sum + s.value, 0);
}

export interface DriftFlag {
  judge: JudgeSlot;
  criterion: Criterion;
  betterRanked: string;
  worseRanked: string;
}
/** All scores must share one judge and one criterion. Unplaced scores are ignored. */
export function detectDriftForCriterion(scores: Score[]): DriftFlag[] {
  const placed = scores
    .filter((s): s is Score & { rankPos: number } => s.rankPos !== null)
    .sort((a, b) => a.rankPos - b.rankPos);
  const flags: DriftFlag[] = [];
  for (let i = 0; i < placed.length - 1; i++) {
    const better = placed[i];
    const worse = placed[i + 1];
    if (better.value < worse.value) {
      flags.push({
        judge: better.judge,
        criterion: better.criterion,
        betterRanked: better.standNr,
        worseRanked: worse.standNr,
      });
    }
  }
  return flags;
}
export function detectAllDrift(scores: Score[]): DriftFlag[] {
  const groups = new Map<string, Score[]>();
  for (const s of scores) {
    const key = `${s.judge}|${s.criterion}`;
    const group = groups.get(key);
    if (group) group.push(s);
    else groups.set(key, [s]);
  }
  return [...groups.values()].flatMap(detectDriftForCriterion);
}

export type DriftSeverity = 1 | 2; // 1 = mild, 2 = strong
export interface DriftListItem {
  standNr: string;
  criterion: Criterion;
  severity: DriftSeverity;
}
export type DriftSeverityMap = Record<string, Partial<Record<Criterion, DriftSeverity>>>;

/** Per-standNr × criterion drift severity for ONE judge's scores (all-pairs inversions). */
export function computeDriftSeverity(scores: Score[]): DriftSeverityMap {
  const byCriterion = new Map<Criterion, Score[]>();
  for (const s of scores) {
    const group = byCriterion.get(s.criterion);
    if (group) group.push(s);
    else byCriterion.set(s.criterion, [s]);
  }
  const map: DriftSeverityMap = {};
  for (const [criterion, group] of byCriterion) {
    const placed = group
      .filter((s): s is Score & { rankPos: number } => s.rankPos !== null)
      .sort((a, b) => a.rankPos - b.rankPos);
    placed.forEach((current, i) => {
      let inv = 0;
      placed.forEach((other, j) => {
        if (i < j && current.value < other.value) inv++;
        else if (i > j && current.value > other.value) inv++;
      });
      if (inv > 0) {
        const severity: DriftSeverity = inv >= 3 ? 2 : 1;
        (map[current.standNr] ??= {})[criterion] = severity;
      }
    });
  }
  return map;
}

/** Flattened drift entries, strongest-first (severity desc). */
export function driftList(scores: Score[]): DriftListItem[] {
  const map = computeDriftSeverity(scores);
  const items: DriftListItem[] = [];
  for (const standNr of Object.keys(map)) {
    for (const criterion of Object.keys(map[standNr]) as Criterion[]) {
      const severity = map[standNr][criterion];
      if (severity !== undefined) items.push({ standNr, criterion, severity });
    }
  }
  return items.sort((a, b) => b.severity - a.severity);
}
