import {
  type CaptureMeta,
  CRITERIA,
  type Criterion,
  type Deelnemer,
  type JudgeSlot,
  type JuryEvent,
  type Score,
  type ScoreValue,
} from "@winnovation/domain";
import { JuryDb } from "./db";

/** The code printed on the join screen — the demo dataset is reachable with this. */
export const DEMO_EVENT_CODE = "WIN-26";
const DEMO_EVENT_ID = "demo-win-26";

interface DemoProject {
  standNr: string;
  projectgroep: string;
  isVervolgproject: boolean;
  keyword: string;
  note: string;
  review: string;
}

const PROJECTS: readonly DemoProject[] = [
  {
    standNr: "1",
    projectgroep: "Zonnewende",
    isVervolgproject: false,
    keyword: "zonne-gordijn",
    note: "Raamfolie die overdag oogst en 's avonds isoleert.",
    review: "Sterk verhaal, prototype draait al op het schoolraam.",
  },
  {
    standNr: "2",
    projectgroep: "AquaSense",
    isVervolgproject: true,
    keyword: "watersensor",
    note: "Goedkope sensor die slootwater realtime meet.",
    review: "Vervolg op vorig jaar; nu met open dataportaal.",
  },
  {
    standNr: "3",
    projectgroep: "BijenBoost",
    isVervolgproject: false,
    keyword: "bijenhotel",
    note: "Modulair bijenhotel met sensoren voor drukte.",
    review: "Mooi uitgewerkt, maar impact lastig te meten.",
  },
  {
    standNr: "4",
    projectgroep: "DeelDoos",
    isVervolgproject: false,
    keyword: "buurtdelen",
    note: "Buurtkastje om gereedschap te delen.",
    review: "Simpel idee, sterke uitvoering en adoptie.",
  },
  {
    standNr: "5",
    projectgroep: "ReparaTech",
    isVervolgproject: true,
    keyword: "repair-robot",
    note: "Robotarm die kapotte koptelefoons soldeert.",
    review: "Technisch indrukwekkend; haalbaarheid nog wankel.",
  },
  {
    standNr: "6",
    projectgroep: "Stadstuin AI",
    isVervolgproject: false,
    keyword: "stadslandbouw",
    note: "AI die balkonoogst voorspelt per zonuren.",
    review: "Leuk concept, dataset is nog erg dun.",
  },
];

/** Per judge → per stand → values for [innovativiteit, relevantie, haalbaarheid, impact]. */
const VALUES: Record<JudgeSlot, Record<string, readonly ScoreValue[]>> = {
  A: {
    "1": [5, 4, 4, 5],
    "2": [4, 5, 3, 4],
    "3": [3, 4, 5, 3],
    "4": [4, 3, 4, 4],
    "5": [5, 4, 3, 5],
    "6": [3, 3, 4, 3],
  },
  B: {
    "1": [4, 4, 5, 5],
    "2": [5, 5, 3, 3],
    "3": [3, 3, 5, 4],
    "4": [4, 4, 4, 3],
    "5": [5, 3, 3, 5],
    "6": [2, 4, 4, 4],
  },
};

/**
 * Per judge → per criterion, the best→worst ordering of standNrs (drives rankPos).
 * Judge A's `innovativiteit` deliberately ranks stand 2 above stand 1 despite a lower
 * value — that single inversion seeds a drift flag so the review screen has something
 * to show. Judge B is internally consistent; A↔B order differences feed the reconcile
 * and result screens.
 */
const ORDER: Record<JudgeSlot, Record<Criterion, readonly string[]>> = {
  A: {
    innovativiteit: ["5", "2", "1", "4", "3", "6"],
    relevantie: ["2", "1", "3", "5", "4", "6"],
    haalbaarheid: ["3", "1", "4", "6", "2", "5"],
    impact: ["1", "5", "4", "2", "3", "6"],
  },
  B: {
    innovativiteit: ["2", "5", "1", "4", "3", "6"],
    relevantie: ["2", "1", "4", "6", "3", "5"],
    haalbaarheid: ["1", "3", "4", "6", "2", "5"],
    impact: ["1", "5", "3", "6", "2", "4"],
  },
};

const JUDGES: readonly JudgeSlot[] = ["A", "B"];

/**
 * Populate `db` with the WIN-26 demo event and a complete, two-judge dataset.
 * Idempotent: if an event with {@link DEMO_EVENT_CODE} already exists it is returned
 * untouched. `now` is injectable so tests get deterministic timestamps.
 */
export async function seedDemo(
  db: JuryDb = new JuryDb(),
  now: () => number = () => Date.now(),
): Promise<JuryEvent> {
  const existing = await db.events.where("eventCode").equals(DEMO_EVENT_CODE).first();
  if (existing) return existing;

  let tick = now();
  const stamp = () => tick++;

  const event: JuryEvent = {
    id: DEMO_EVENT_ID,
    name: "Winnovation Demo 2026",
    date: "2026-06-05",
    eventCode: DEMO_EVENT_CODE,
  };

  const deelnemers: Deelnemer[] = PROJECTS.map((p) => ({
    eventId: DEMO_EVENT_ID,
    standNr: p.standNr,
    projectgroep: p.projectgroep,
    isVervolgproject: p.isVervolgproject,
    updatedAt: stamp(),
  }));

  const scores: Score[] = [];
  const captureMeta: CaptureMeta[] = [];

  for (const judge of JUDGES) {
    for (const p of PROJECTS) {
      CRITERIA.forEach((criterion, i) => {
        scores.push({
          judge,
          standNr: p.standNr,
          criterion,
          value: VALUES[judge][p.standNr][i],
          rankPos: ORDER[judge][criterion].indexOf(p.standNr) + 1,
          updatedAt: stamp(),
        });
      });
      captureMeta.push({
        judge,
        standNr: p.standNr,
        keyword: p.keyword,
        note: judge === "A" ? p.note : "",
        review: judge === "A" ? p.review : "",
        photoRef: null,
        updatedAt: stamp(),
      });
    }
  }

  await db.transaction("rw", db.events, db.deelnemers, db.scores, db.captureMeta, async () => {
    await db.events.add(event);
    await db.deelnemers.bulkPut(deelnemers);
    await db.scores.bulkPut(scores);
    await db.captureMeta.bulkPut(captureMeta);
  });

  return event;
}
