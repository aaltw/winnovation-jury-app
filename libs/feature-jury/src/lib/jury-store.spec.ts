import "fake-indexeddb/auto";
import { TestBed } from "@angular/core/testing";
import { CRITERIA, type Criterion, type ScoreValue } from "@winnovation/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CaptureInput, JuryStore } from "./jury-store";

const capture = (
  standNr: string,
  scores: Record<Criterion, ScoreValue>,
  overrides: Partial<CaptureInput> = {},
): CaptureInput => ({
  standNr,
  projectgroep: `groep-${standNr}`,
  isVervolgproject: false,
  keyword: `kw-${standNr}`,
  note: "",
  review: "",
  scores,
  ...overrides,
});

const flat = (v: ScoreValue): Record<Criterion, ScoreValue> => ({
  innovativiteit: v,
  relevantie: v,
  haalbaarheid: v,
  impact: v,
});

describe("JuryStore", () => {
  let store: JuryStore;
  beforeEach(() => {
    store = TestBed.inject(JuryStore);
  });
  afterEach(async () => {
    await store.resetForTest();
  });

  it("captures a deelnemer: writes roster, four scores, and meta", async () => {
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer({
      standNr: "7",
      projectgroep: "AI-compostbak",
      isVervolgproject: false,
      keyword: "compost",
      note: "",
      review: "",
      scores: { innovativiteit: 5, relevantie: 4, haalbaarheid: 3, impact: 4 },
    });
    await store.refreshDeelnemers();
    expect(store.deelnemers().map((d) => d.standNr)).toEqual(["7"]);
    const scores = await store.scoresForJudge("A");
    expect(scores).toHaveLength(CRITERIA.length);
    const meta = await store.metaFor("7");
    expect(meta?.keyword).toBe("compost");
  });

  it("places a deelnemer on a criterion and renumbers rankPos", async () => {
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer(capture("1", flat(5)));
    await store.captureDeelnemer(capture("2", flat(3)));
    await store.applyPlacement("impact", "1", 0); // best
    await store.applyPlacement("impact", "2", 1); // worse
    const scores = await store.scoresForJudge("A");
    const impact = scores.filter((s) => s.criterion === "impact");
    expect(impact.find((s) => s.standNr === "1")?.rankPos).toBe(1);
    expect(impact.find((s) => s.standNr === "2")?.rankPos).toBe(2);
  });

  it("stamps updatedAt on captured rows using the injectable clock", async () => {
    store.setClockForTest(() => 1234);
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer(capture("7", flat(5)));
    const scores = await store.scoresForJudge("A");
    expect(scores.every((s) => s.updatedAt === 1234)).toBe(true);
    const meta = await store.metaFor("7");
    expect(meta?.updatedAt).toBe(1234);
    await store.refreshDeelnemers();
    expect(store.deelnemers().every((d) => d.updatedAt === 1234)).toBe(true);
  });

  it("counts placed deelnemers (all four criteria ranked)", async () => {
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer(capture("1", flat(5)));
    await store.captureDeelnemer(capture("2", flat(3)));
    expect(store.placedCount()).toBe(0);
    expect(store.isPlaced("1")).toBe(false);
    for (const c of CRITERIA) {
      await store.applyPlacement(c, "1", 0);
    }
    await store.refreshDeelnemers();
    expect(store.isPlaced("1")).toBe(true);
    expect(store.isPlaced("2")).toBe(false);
    expect(store.placedCount()).toBe(1);
  });

  it("refreshDrift sets both adjacency flags and the severity list", async () => {
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    // standNr 1 has the lower value but is ranked best => inversion (drift).
    await store.captureDeelnemer(capture("1", flat(2)));
    await store.captureDeelnemer(capture("2", flat(5)));
    await store.applyPlacement("impact", "1", 0); // best, but lower value
    await store.applyPlacement("impact", "2", 1); // worse rank, higher value
    await store.refreshDrift();
    expect(store.driftFlags().some((f) => f.criterion === "impact")).toBe(true);
    expect(store.driftItems().some((i) => i.criterion === "impact")).toBe(true);
    // severity list is sorted strongest-first
    const severities = store.driftItems().map((i) => i.severity);
    expect([...severities].sort((a, b) => b - a)).toEqual(severities);
  });

  it("updateScoreValue changes the stored value, stamps the clock, and refreshes drift", async () => {
    store.setClockForTest(() => 999);
    store.setJudge("A");
    await store.createEvent("Winnovation", "2026-06-05");
    await store.captureDeelnemer(capture("1", flat(3)));
    await store.updateScoreValue("impact", "1", 5);
    const scores = await store.scoresForJudge("A");
    const impact = scores.find((s) => s.criterion === "impact" && s.standNr === "1");
    expect(impact?.value).toBe(5);
    expect(impact?.updatedAt).toBe(999);
  });

  it("savePhoto stores a blob and returns a ref id", async () => {
    const ref = await store.savePhoto(new Blob(["x"], { type: "image/png" }));
    expect(typeof ref).toBe("string");
    expect(ref.length).toBeGreaterThan(0);
  });

  it("computes disagreements between the two judges", async () => {
    await store.createEvent("Winnovation", "2026-06-05");
    store.setJudge("A");
    await store.captureDeelnemer(capture("1", flat(5)));
    await store.captureDeelnemer(capture("2", flat(3)));
    await store.applyPlacement("impact", "1", 0);
    await store.applyPlacement("impact", "2", 1);
    store.setJudge("B");
    await store.captureDeelnemer(capture("1", flat(5)));
    await store.captureDeelnemer(capture("2", flat(3)));
    await store.applyPlacement("impact", "2", 0); // B ranks them oppositely
    await store.applyPlacement("impact", "1", 1);
    const gaps = await store.disagreements();
    expect(gaps.get("1")).toBeGreaterThan(0);
  });
});
