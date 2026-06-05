import { Injectable, signal } from "@angular/core";
import { JuryDb, JuryService, putPhoto } from "@winnovation/data-access";
import {
  type CaptureMeta,
  CRITERIA,
  type Criterion,
  computeDisagreements,
  type Deelnemer,
  type DriftFlag,
  type DriftListItem,
  detectAllDrift,
  driftList,
  type JudgeSlot,
  type JuryEvent,
  type Placed,
  placeAt,
  renumber,
  type Score,
  type ScoreValue,
} from "@winnovation/domain";

export interface CaptureInput {
  standNr: string;
  projectgroep: string;
  isVervolgproject: boolean;
  keyword: string;
  note: string;
  review: string;
  scores: Record<Criterion, ScoreValue>;
  photoRef?: string | null;
}

@Injectable({ providedIn: "root" })
export class JuryStore {
  private db = new JuryDb();
  private service = new JuryService(this.db);

  private clock: () => number = () => Date.now();
  setClockForTest(fn: () => number): void {
    this.clock = fn;
  }

  readonly event = signal<JuryEvent | null>(null);
  readonly judge = signal<JudgeSlot>("A");
  readonly deelnemers = signal<Deelnemer[]>([]);
  readonly driftFlags = signal<DriftFlag[]>([]);
  readonly driftItems = signal<DriftListItem[]>([]);
  readonly scores = signal<Score[]>([]);

  setJudge(slot: JudgeSlot): void {
    this.judge.set(slot);
  }

  async createEvent(name: string, date: string): Promise<void> {
    this.event.set(await this.service.createEvent({ name, date }));
  }

  async joinEvent(code: string, slot: JudgeSlot): Promise<boolean> {
    const found = await this.service.findEventByCode(code);
    if (!found) return false;
    this.event.set(found);
    this.judge.set(slot);
    await this.refreshDeelnemers();
    return true;
  }

  async refreshDeelnemers(): Promise<void> {
    const event = this.event();
    if (!event) return;
    this.deelnemers.set(await this.service.listDeelnemers(event.id));
    await this.refreshScores();
  }

  async refreshScores(): Promise<void> {
    this.scores.set(await this.service.scoresForJudge(this.judge()));
  }

  async captureDeelnemer(input: CaptureInput): Promise<void> {
    const event = this.event();
    if (!event) throw new Error("No active event");
    const judge = this.judge();
    const updatedAt = this.clock();
    await this.service.upsertDeelnemer({
      eventId: event.id,
      standNr: input.standNr,
      projectgroep: input.projectgroep,
      isVervolgproject: input.isVervolgproject,
      updatedAt,
    });
    for (const criterion of CRITERIA) {
      await this.service.saveScore({
        judge,
        standNr: input.standNr,
        criterion,
        value: input.scores[criterion],
        rankPos: null,
        updatedAt,
      });
    }
    await this.service.saveCaptureMeta({
      judge,
      standNr: input.standNr,
      keyword: input.keyword,
      note: input.note,
      review: input.review,
      photoRef: input.photoRef ?? null,
      updatedAt,
    });
    await this.refreshDeelnemers();
  }

  async placedFor(criterion: Criterion): Promise<Placed[]> {
    const all = await this.service.scoresForJudge(this.judge());
    return all
      .filter((s) => s.criterion === criterion && s.rankPos !== null)
      .map((s) => ({ standNr: s.standNr, value: s.value, rankPos: s.rankPos as number }));
  }

  /** Insert `standNr` at `index` in the criterion ordering and persist new rankPos values. */
  async applyPlacement(criterion: Criterion, standNr: string, index: number): Promise<void> {
    const judge = this.judge();
    const all = await this.service.scoresForJudge(judge);
    const slice = all.filter((s) => s.criterion === criterion);
    const order = slice
      .filter((s) => s.rankPos !== null)
      .sort((a, b) => (a.rankPos as number) - (b.rankPos as number))
      .map((s) => s.standNr);

    const newRanks = renumber(placeAt(order, standNr, index));
    for (const score of slice) {
      const rankPos = newRanks.get(score.standNr) ?? null;
      if (rankPos !== score.rankPos) {
        await this.service.saveScore({ ...score, rankPos, updatedAt: this.clock() });
      }
    }
    await this.refreshScores();
    await this.refreshDrift();
  }

  /** "Placed" = all four criteria carry a non-null rankPos for this standNr. */
  isPlaced(standNr: string): boolean {
    const placed = this.scores().filter((s) => s.standNr === standNr && s.rankPos !== null);
    return CRITERIA.every((c) => placed.some((s) => s.criterion === c));
  }

  placedCount(): number {
    const standNrs = new Set(this.scores().map((s) => s.standNr));
    let count = 0;
    for (const standNr of standNrs) if (this.isPlaced(standNr)) count++;
    return count;
  }

  async updateScoreValue(criterion: Criterion, standNr: string, value: ScoreValue): Promise<void> {
    const all = await this.service.scoresForJudge(this.judge());
    const existing = all.find((s) => s.criterion === criterion && s.standNr === standNr);
    if (!existing) return;
    await this.service.saveScore({ ...existing, value, updatedAt: this.clock() });
    await this.refreshScores();
    await this.refreshDrift();
  }

  scoresForJudge(judge: JudgeSlot): Promise<Score[]> {
    return this.service.scoresForJudge(judge);
  }

  metaFor(standNr: string): Promise<CaptureMeta | undefined> {
    return this.service.getCaptureMeta(this.judge(), standNr);
  }

  async savePhoto(blob: Blob): Promise<string> {
    const id = crypto.randomUUID();
    await putPhoto(this.db, id, blob);
    return id;
  }

  async disagreements(): Promise<Map<string, number>> {
    const [a, b] = await Promise.all([
      this.service.scoresForJudge("A"),
      this.service.scoresForJudge("B"),
    ]);
    return computeDisagreements(a, b);
  }

  async refreshDrift(): Promise<void> {
    const scores = await this.service.scoresForJudge(this.judge());
    this.driftFlags.set(detectAllDrift(scores));
    this.driftItems.set(driftList(scores));
  }

  finalRanking() {
    return this.service.finalRanking();
  }

  /** Test helper: wipe the IndexedDB instance. */
  async resetForTest(): Promise<void> {
    await this.db.delete();
  }
}
