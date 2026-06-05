import type { CaptureMeta, JudgeSlot, Score } from "@winnovation/domain";
import type { JuryDb, StoredPhoto } from "./db";

export async function saveScore(db: JuryDb, score: Score): Promise<void> {
  await db.scores.put(score);
}

export async function scoresForJudge(db: JuryDb, judge: JudgeSlot): Promise<Score[]> {
  return db.scores.where("judge").equals(judge).toArray();
}

export async function scoresForStand(
  db: JuryDb,
  judge: JudgeSlot,
  standNr: string,
): Promise<Score[]> {
  return (await scoresForJudge(db, judge)).filter((s) => s.standNr === standNr);
}

export async function saveCaptureMeta(db: JuryDb, meta: CaptureMeta): Promise<void> {
  await db.captureMeta.put(meta);
}

export async function getCaptureMeta(
  db: JuryDb,
  judge: JudgeSlot,
  standNr: string,
): Promise<CaptureMeta | undefined> {
  return db.captureMeta.get([judge, standNr]);
}

export async function putPhoto(db: JuryDb, id: string, blob: Blob): Promise<void> {
  const photo: StoredPhoto = { id, blob };
  await db.photos.put(photo);
}

export async function getPhoto(db: JuryDb, id: string): Promise<StoredPhoto | undefined> {
  return db.photos.get(id);
}
