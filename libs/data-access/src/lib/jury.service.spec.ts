import "fake-indexeddb/auto";
import { CRITERIA, type Score } from "@winnovation/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JuryDb } from "./db";
import { JuryService } from "./jury.service";

describe("JuryService", () => {
  let db: JuryDb;
  let service: JuryService;
  beforeEach(() => {
    db = new JuryDb("test");
    service = new JuryService(db);
  });
  afterEach(async () => {
    await db.delete();
  });

  async function seedJudge(
    judge: Score["judge"],
    standNr: string,
    value: Score["value"],
    rankPos: number,
  ) {
    for (const criterion of CRITERIA) {
      await service.saveScore({ judge, standNr, criterion, value, rankPos });
    }
  }

  it("computes the final ranking from persisted scores", async () => {
    await seedJudge("A", "s1", 5, 1);
    await seedJudge("A", "s2", 4, 2);
    await seedJudge("B", "s1", 5, 1);
    await seedJudge("B", "s2", 3, 2);

    const { ranked, incomplete } = await service.finalRanking();
    expect(incomplete).toEqual([]);
    expect(ranked.map((r) => r.standNr)).toEqual(["s1", "s2"]);
    expect(ranked[0].overall).toBe(4);
  });

  it("reports a judge's drift flags", async () => {
    // Judge A on impact: s1 ranked best (1) but scored 3, s2 ranked 2 but scored 4 → drift.
    await service.saveScore({
      judge: "A",
      standNr: "s1",
      criterion: "impact",
      value: 3,
      rankPos: 1,
    });
    await service.saveScore({
      judge: "A",
      standNr: "s2",
      criterion: "impact",
      value: 4,
      rankPos: 2,
    });
    const flags = await service.driftFlags("A");
    expect(flags).toEqual([
      { judge: "A", criterion: "impact", betterRanked: "s1", worseRanked: "s2" },
    ]);
  });

  it("exposes scoresForJudge as a passthrough", async () => {
    await service.saveScore({
      judge: "A",
      standNr: "7",
      criterion: "impact",
      value: 4,
      rankPos: 1,
    });
    await service.saveScore({
      judge: "B",
      standNr: "7",
      criterion: "impact",
      value: 5,
      rankPos: 1,
    });
    const scoresA = await service.scoresForJudge("A");
    expect(scoresA).toHaveLength(1);
    expect(scoresA[0].judge).toBe("A");
  });
});
