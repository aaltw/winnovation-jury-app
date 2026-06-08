import { Injectable, signal } from "@angular/core";
import {
  JuryDb,
  JuryService,
  putPhoto,
  type Remote,
  RemoteGateway,
  SyncClient,
} from "@winnovation/data-access";
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

  /** Best-effort mirror to the sync-api. Null until an event is created/joined online. */
  private remote: Remote = new RemoteGateway("/api");
  private sync: SyncClient | null = null;
  private pushing = false;
  private pushQueued = false;
  private pushLoop: Promise<void> = Promise.resolve();

  setRemoteForTest(remote: Remote): void {
    this.remote = remote;
  }

  /** Swap in an isolated DB (separate IndexedDB name) to simulate a second device in tests. */
  setDbForTest(db: JuryDb): void {
    this.db = db;
    this.service = new JuryService(db);
    this.sync = null;
  }

  /** Test helper: await any in-flight/queued push so assertions see the pushed state. */
  settleSyncForTest(): Promise<void> {
    return this.pushLoop;
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
    try {
      // Server-authoritative: it mints the id+code both devices must share.
      const { id, eventCode } = await this.remote.createEvent(name, date);
      const event: JuryEvent = { id, name, date, eventCode };
      await this.db.events.put(event);
      this.event.set(event);
      this.attachSync(event);
    } catch {
      // Offline: a local-only event (random id+code, no cross-device sync).
      this.sync = null;
      this.event.set(await this.service.createEvent({ name, date }));
    }
  }

  async joinEvent(code: string, slot: JudgeSlot): Promise<boolean> {
    // Local first (already on this device, e.g. the seeded demo or after a reload);
    // otherwise ask the server, which returns the full event to persist.
    let found = await this.service.findEventByCode(code);
    if (!found) {
      const info = await this.remote.joinEvent(code).catch(() => null);
      if (!info) return false;
      found = { id: info.id, name: info.name, date: info.date, eventCode: info.eventCode };
      await this.db.events.put(found);
    }
    this.event.set(found);
    this.judge.set(slot);
    this.attachSync(found);
    await this.refreshDeelnemers(); // pulls remote rows, then loads from local
    return true;
  }

  async refreshDeelnemers(): Promise<void> {
    const event = this.event();
    if (!event) return;
    await this.pullNow();
    this.deelnemers.set(await this.service.listDeelnemers(event.id));
    await this.refreshScores();
  }

  async refreshScores(): Promise<void> {
    this.scores.set(await this.loadScores(this.judge()));
  }

  /** Scores for `judge` in the active event; empty when no event is joined. */
  private loadScores(judge: JudgeSlot): Promise<Score[]> {
    const event = this.event();
    return event ? this.service.scoresForJudge(event.id, judge) : Promise.resolve([]);
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
        eventId: event.id,
        judge,
        standNr: input.standNr,
        criterion,
        value: input.scores[criterion],
        rankPos: null,
        updatedAt,
      });
    }
    await this.service.saveCaptureMeta({
      eventId: event.id,
      judge,
      standNr: input.standNr,
      keyword: input.keyword,
      note: input.note,
      review: input.review,
      photoRef: input.photoRef ?? null,
      updatedAt,
    });
    await this.refreshDeelnemers();
    this.pushSoon();
  }

  async placedFor(criterion: Criterion): Promise<Placed[]> {
    const all = await this.loadScores(this.judge());
    return all
      .filter((s) => s.criterion === criterion && s.rankPos !== null)
      .map((s) => ({ standNr: s.standNr, value: s.value, rankPos: s.rankPos as number }));
  }

  /** Insert `standNr` at `index` in the criterion ordering and persist new rankPos values. */
  async applyPlacement(criterion: Criterion, standNr: string, index: number): Promise<void> {
    const judge = this.judge();
    const all = await this.loadScores(judge);
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
    this.pushSoon();
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
    const all = await this.loadScores(this.judge());
    const existing = all.find((s) => s.criterion === criterion && s.standNr === standNr);
    if (!existing) return;
    await this.service.saveScore({ ...existing, value, updatedAt: this.clock() });
    await this.refreshScores();
    await this.refreshDrift();
    this.pushSoon();
  }

  scoresForJudge(judge: JudgeSlot): Promise<Score[]> {
    return this.loadScores(judge);
  }

  metaFor(standNr: string): Promise<CaptureMeta | undefined> {
    const event = this.event();
    if (!event) return Promise.resolve(undefined);
    return this.service.getCaptureMeta(event.id, this.judge(), standNr);
  }

  async savePhoto(blob: Blob): Promise<string> {
    const id = crypto.randomUUID();
    await putPhoto(this.db, id, blob);
    return id;
  }

  async disagreements(): Promise<Map<string, number>> {
    await this.pullNow();
    const [a, b] = await Promise.all([this.loadScores("A"), this.loadScores("B")]);
    return computeDisagreements(a, b);
  }

  async refreshDrift(): Promise<void> {
    const scores = await this.loadScores(this.judge());
    this.driftFlags.set(detectAllDrift(scores));
    this.driftItems.set(driftList(scores));
  }

  async finalRanking() {
    await this.pullNow();
    // An empty eventId scopes to zero scores → an empty ranking, which is the
    // correct shape to render before an event is joined.
    return this.service.finalRanking(this.event()?.id ?? "");
  }

  /** Point the sync client at `event`; subsequent push/pull mirror it to the server. */
  private attachSync(event: JuryEvent): void {
    this.sync = new SyncClient(
      this.db,
      this.remote.transportFor(() => event.eventCode),
      event.id,
    );
  }

  /** Pull remote changes into the local cache. Best-effort: silent when offline. */
  private async pullNow(): Promise<void> {
    try {
      await this.sync?.pull();
    } catch {
      // Offline or server unreachable: keep working from the local cache.
    }
  }

  /**
   * Schedule a push. Non-blocking and coalescing: a burst of writes results in at
   * most one in-flight push plus one queued follow-up (which sends the final
   * snapshot). Errors are swallowed — the local IndexedDB stays the source of truth.
   */
  private pushSoon(): void {
    if (!this.sync) return;
    this.pushQueued = true;
    if (this.pushing) return;
    this.pushing = true;
    this.pushLoop = this.runPushLoop();
  }

  private async runPushLoop(): Promise<void> {
    try {
      while (this.pushQueued) {
        this.pushQueued = false;
        try {
          await this.sync?.push();
        } catch {
          // Best-effort; the queued snapshot will retry on the next write.
        }
      }
    } finally {
      this.pushing = false;
    }
  }

  /** Test helper: wipe the IndexedDB instance. */
  async resetForTest(): Promise<void> {
    await this.db.delete();
  }
}
