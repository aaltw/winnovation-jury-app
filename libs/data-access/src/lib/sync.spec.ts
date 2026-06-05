import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JuryDb } from "./db";
import { saveScore } from "./scores.repo";
import { SyncClient, type Transport } from "./sync";

// Minimal fake server: stores pushed scores, serves them back.
function fakeTransport(): Transport {
  const scores: Record<string, { updatedAt: number; [k: string]: unknown }> = {};
  return {
    async post(
      _path,
      body: {
        scores: Array<{ judge: string; standNr: string; criterion: string; updatedAt: number }>;
      },
    ) {
      for (const s of body.scores) {
        const key = `${s.judge}|${s.standNr}|${s.criterion}`;
        if (!scores[key] || s.updatedAt > scores[key].updatedAt) scores[key] = s;
      }
      return { ok: true };
    },
    async get(_path) {
      return { deelnemers: [], captureMeta: [], scores: Object.values(scores) };
    },
  };
}

describe("SyncClient", () => {
  let db: JuryDb;
  beforeEach(() => {
    db = new JuryDb("test");
  });
  afterEach(async () => {
    await db.delete();
  });

  it("pushes local scores and pulls the other judge back in", async () => {
    await saveScore(db, {
      judge: "A",
      standNr: "7",
      criterion: "impact",
      value: 4,
      rankPos: 1,
      updatedAt: 10,
    });
    const transport = fakeTransport();
    const client = new SyncClient(db, transport, "e1");

    await client.push();
    // simulate judge B's row arriving on the server
    await transport.post("/events/e1/changes", {
      deelnemers: [],
      captureMeta: [],
      scores: [
        {
          eventId: "e1",
          judge: "B",
          standNr: "7",
          criterion: "impact",
          value: 5,
          rankPos: 1,
          updatedAt: 11,
        },
      ],
    });
    await client.pull();

    const all = await db.scores.toArray();
    expect(all.find((s) => s.judge === "B")?.value).toBe(5);
  });
});
