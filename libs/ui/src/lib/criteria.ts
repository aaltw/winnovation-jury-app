import type { Criterion, ScoreValue } from "@winnovation/domain";

/** 1–5 scorekaart labels (slecht → uitstekend). */
export const SCALE_LABELS: Record<ScoreValue, string> = {
  1: "slecht",
  2: "matig",
  3: "goed",
  4: "zeer goed",
  5: "uitstekend",
};

/** Questions a juror should weigh per criterion — shown behind the ⓘ while scoring. */
export const CRITERION_QUESTIONS: Record<Criterion, string[]> = {
  innovativiteit: [
    "Is dit idee nieuw, of een frisse draai aan iets bestaands?",
    "Hebben de makers zelf iets bedacht of vooral nagemaakt?",
    "Verrast het project je?",
  ],
  relevantie: [
    "Lost dit een echt probleem op? Voor wie?",
    "Speelt het probleem nu, hier, voor deze doelgroep?",
    "Kunnen de makers uitleggen waarom dit nodig is?",
  ],
  haalbaarheid: [
    "Werkt er al iets — een demo, prototype of proefopstelling?",
    "Is het realistisch te maken met beschikbare middelen?",
    "Hebben de makers nagedacht over wat er mis kan gaan?",
  ],
  impact: [
    "Hoeveel mensen schieten hier iets mee op?",
    "Wat verandert er als dit project slaagt?",
    "Blijft het effect bestaan, ook na vandaag?",
  ],
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
