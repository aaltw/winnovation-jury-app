import type { Deelnemer } from "@winnovation/domain";
import type { JuryDb } from "./db";

/** Upsert keyed by [eventId+standNr]; last write wins (the roster-merge rule). */
export async function upsertDeelnemer(db: JuryDb, deelnemer: Deelnemer): Promise<void> {
  await db.deelnemers.put(deelnemer);
}

export async function listDeelnemers(db: JuryDb, eventId: string): Promise<Deelnemer[]> {
  return db.deelnemers.where("eventId").equals(eventId).toArray();
}

export async function getDeelnemer(
  db: JuryDb,
  eventId: string,
  standNr: string,
): Promise<Deelnemer | undefined> {
  return db.deelnemers.get([eventId, standNr]);
}
