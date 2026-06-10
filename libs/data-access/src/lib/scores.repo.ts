import type { CaptureMeta, JudgeSlot, Score } from "@winnovation/domain";
import type { JuryDb, StoredPhoto } from "./db";

export async function saveScore(db: JuryDb, score: Score): Promise<void> {
  await db.scores.put(score);
}

export async function scoresForJudge(
  db: JuryDb,
  eventId: string,
  judge: JudgeSlot,
): Promise<Score[]> {
  return db.scores.where("[eventId+judge]").equals([eventId, judge]).toArray();
}

export async function saveCaptureMeta(db: JuryDb, meta: CaptureMeta): Promise<void> {
  await db.captureMeta.put(meta);
}

export async function getCaptureMeta(
  db: JuryDb,
  eventId: string,
  judge: JudgeSlot,
  standNr: string,
): Promise<CaptureMeta | undefined> {
  return db.captureMeta.get([eventId, judge, standNr]);
}

export async function putPhoto(db: JuryDb, id: string, blob: Blob): Promise<void> {
  const photo: StoredPhoto = { id, blob };
  await db.photos.put(photo);
}

export async function getPhoto(db: JuryDb, id: string): Promise<StoredPhoto | undefined> {
  return db.photos.get(id);
}
