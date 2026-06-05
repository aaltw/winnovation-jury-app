import type { Criterion, ScoreValue } from "@winnovation/domain";

/** 1–5 scorekaart labels (slecht → uitstekend). */
export const SCALE_LABELS: Record<ScoreValue, string> = {
  1: "slecht",
  2: "matig",
  3: "goed",
  4: "zeer goed",
  5: "uitstekend",
};

/** Per-criterion accent colours (mirrors winnovation.css --c-* tokens). */
export const CRITERION_COLORS: Record<Criterion, string> = {
  innovativiteit: "#4B3BF5",
  relevantie: "#FF5A3C",
  haalbaarheid: "#00A7C4",
  impact: "#06BE7E",
};

/** Resolve a criterion accent colour, accepting either a domain key or a free string. */
export function criterionColor(criterion: string): string {
  return CRITERION_COLORS[criterion as Criterion] ?? "#4B3BF5";
}

/** Format a stand number as "Stand NN" (zero-padded to two digits). Mirrors WV.fmtStand. */
export function fmtStand(standNr: string | number): string {
  return `Stand ${String(standNr).padStart(2, "0")}`;
}
