import {
  type CaptureMeta,
  computeFinalRanking,
  type Deelnemer,
  type DriftFlag,
  detectAllDrift,
  type FinalRanking,
  type JudgeSlot,
  type Score,
} from "@winnovation/domain";
import { JuryDb } from "./db";
import { listDeelnemers, upsertDeelnemer } from "./deelnemers.repo";
import { type CreateEventInput, createEvent, findEventByCode } from "./events.repo";
import { getCaptureMeta, saveCaptureMeta, saveScore, scoresForJudge } from "./scores.repo";

export class JuryService {
  constructor(private readonly db: JuryDb = new JuryDb()) {}

  createEvent(input: CreateEventInput) {
    return createEvent(this.db, input);
  }
  findEventByCode(code: string) {
    return findEventByCode(this.db, code);
  }

  upsertDeelnemer(deelnemer: Deelnemer) {
    return upsertDeelnemer(this.db, deelnemer);
  }
  listDeelnemers(eventId: string) {
    return listDeelnemers(this.db, eventId);
  }

  saveScore(score: Score) {
    return saveScore(this.db, score);
  }
  scoresForJudge(eventId: string, judge: JudgeSlot) {
    return scoresForJudge(this.db, eventId, judge);
  }
  saveCaptureMeta(meta: CaptureMeta) {
    return saveCaptureMeta(this.db, meta);
  }
  getCaptureMeta(eventId: string, judge: JudgeSlot, standNr: string) {
    return getCaptureMeta(this.db, eventId, judge, standNr);
  }

  async driftFlags(eventId: string, judge: JudgeSlot): Promise<DriftFlag[]> {
    return detectAllDrift(await scoresForJudge(this.db, eventId, judge));
  }

  async finalRanking(eventId: string): Promise<FinalRanking> {
    const [a, b] = await Promise.all([
      scoresForJudge(this.db, eventId, "A"),
      scoresForJudge(this.db, eventId, "B"),
    ]);
    return computeFinalRanking(a, b);
  }
}
