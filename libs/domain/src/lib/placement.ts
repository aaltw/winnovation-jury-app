import type { ScoreValue } from "./model";

export interface Placed {
  standNr: string;
  value: ScoreValue;
  rankPos: number;
}
export interface Anchors {
  above: Placed | null;
  below: Placed | null;
  index: number;
}

/** Suggest where `value` slots into the current best→worst ordering. */
export function bracketingAnchors(placed: Placed[], value: ScoreValue): Anchors {
  const ordered = [...placed].sort((a, b) => a.rankPos - b.rankPos);
  const index = ordered.filter((item) => item.value > value).length;
  return {
    above: index > 0 ? ordered[index - 1] : null,
    below: index < ordered.length ? ordered[index] : null,
    index,
  };
}
/** Insert (or move) `standNr` into `order` at `index`; returns a new array. */
export function placeAt(order: string[], standNr: string, index: number): string[] {
  const without = order.filter((s) => s !== standNr);
  const target = Math.max(0, Math.min(index, without.length));
  return [...without.slice(0, target), standNr, ...without.slice(target)];
}
/** Convert a best→worst ordering into dense 1-based rankPos values. */
export function renumber(order: string[]): Map<string, number> {
  return new Map(order.map((standNr, i) => [standNr, i + 1]));
}
