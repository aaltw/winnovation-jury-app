export const CRITERIA = ["innovativiteit", "relevantie", "haalbaarheid", "impact"] as const;
export type Criterion = (typeof CRITERIA)[number];

export type JudgeSlot = "A" | "B";
export type ScoreValue = 1 | 2 | 3 | 4 | 5;

/** Renamed from "Event" to avoid clashing with the DOM `Event` type. */
export interface JuryEvent {
  id: string;
  name: string;
  date: string; // ISO date
  eventCode: string;
}

export interface Deelnemer {
  eventId: string;
  standNr: string; // identity within an event; the join key between the two judges
  projectgroep: string;
  isVervolgproject: boolean;
}

export interface Score {
  judge: JudgeSlot;
  standNr: string;
  criterion: Criterion;
  value: ScoreValue; // 1–5, the absolute read
  rankPos: number | null; // 1 = best; null = not yet placed
}

export interface CaptureMeta {
  judge: JudgeSlot;
  standNr: string;
  keyword: string;
  note: string;
  review: string;
  photoRef: string | null; // id into the local photos table; null when no photo
}
