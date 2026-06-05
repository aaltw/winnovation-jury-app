import "fake-indexeddb/auto";
import type { CaptureMeta, Score } from "@winnovation/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JuryDb } from "./db";
import {
  getCaptureMeta,
  getPhoto,
  putPhoto,
  saveCaptureMeta,
  saveScore,
  scoresForJudge,
} from "./scores.repo";

const EVENT = "ev1";
const score = (standNr: string, value: Score["value"], rankPos: number | null): Score => ({
  eventId: EVENT,
  judge: "A",
  standNr,
  criterion: "impact",
  value,
  rankPos,
});

describe("scores.repo", () => {
  let db: JuryDb;
  beforeEach(() => {
    db = new JuryDb("test");
  });
  afterEach(async () => {
    await db.delete();
  });

  it("saves and overwrites a score by [eventId+judge+standNr+criterion]", async () => {
    await saveScore(db, score("7", 3, null));
    await saveScore(db, score("7", 4, 1)); // re-save with placement
    const all = await scoresForJudge(db, EVENT, "A");
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(score("7", 4, 1));
  });

  it("queries scores by event + judge", async () => {
    await saveScore(db, score("7", 3, 1));
    await saveScore(db, { ...score("7", 3, 1), judge: "B" });
    await saveScore(db, { ...score("7", 3, 1), eventId: "ev2" }); // same judge+stand, other event
    expect(await scoresForJudge(db, EVENT, "A")).toHaveLength(1);
    expect(await scoresForJudge(db, "ev2", "A")).toHaveLength(1);
  });

  it("saves and reads capture meta", async () => {
    const meta: CaptureMeta = {
      eventId: EVENT,
      judge: "A",
      standNr: "7",
      keyword: "AI-compostbak",
      note: "zwak verdienmodel",
      review: "mooi idee",
      photoRef: null,
    };
    await saveCaptureMeta(db, meta);
    expect(await getCaptureMeta(db, EVENT, "A", "7")).toEqual(meta);
  });

  it("stores and retrieves a photo blob", async () => {
    const blob = new Blob(["x"], { type: "image/jpeg" });
    await putPhoto(db, "photo-1", blob);
    const stored = await getPhoto(db, "photo-1");
    expect(stored?.id).toBe("photo-1");
    expect(stored?.blob.size).toBe(1);
  });
});
