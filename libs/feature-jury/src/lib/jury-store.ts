import { Injectable, computed, signal } from "@angular/core";
import {
  type ChangeStreamHandle,
  type ConnectionState,
  JuryDb,
  JuryService,
  putPhoto,
  type Remote,
  type RemoteEventListItem,
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
  TIEBREAK_STAND,
} from "@winnovation/domain";

export interface CaptureInput {
  standNr: string;
  projectgroep: string;
  isVervolgproject: boolean;
  keyword: string;
  note: string;
  review: string;
  criterionNotes?: Partial<Record<Criterion, string>>;
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

  private storage: Storage | null = typeof localStorage !== "undefined" ? localStorage : null;
  setStorageForTest(s: Storage): void {
    this.storage = s;
  }
  private static readonly SESSION_KEY = "winnovation:session";

  private persistSession(eventId: string, judge: JudgeSlot): void {
    this.storage?.setItem(JuryStore.SESSION_KEY, JSON.stringify({ eventId, judge }));
  }
  private clearSession(): void {
    this.storage?.removeItem(JuryStore.SESSION_KEY);
  }

  async restoreSession(): Promise<boolean> {
    const raw = this.storage?.getItem(JuryStore.SESSION_KEY);
    if (!raw) return false;
    let parsed: { eventId?: string; judge?: JudgeSlot };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }
    if (!parsed.eventId) return false;
    const found = await this.db.events.get(parsed.eventId);
    if (!found) return false;
    this.event.set(found);
    this.judge.set(parsed.judge === "B" ? "B" : "A");
    this.attachSync(found);
    await this.refreshDeelnemers();
    return true;
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
  readonly events = signal<RemoteEventListItem[]>([]);
  readonly revision = signal(0);
  readonly connection = signal<ConnectionState>("offline");
  /** Connection mapped to the UI pill states ("synced" | "syncing" | "offline"). */
  readonly syncState = computed(() => {
    switch (this.connection()) {
      case "live":
        return "synced" as const;
      case "connecting":
        return "syncing" as const;
      default:
        return "offline" as const;
    }
  });

  private stream: ChangeStreamHandle | null = null;
  private liveTick: Promise<void> = Promise.resolve();
  settleLiveForTest(): Promise<void> {
    return this.liveTick;
  }

  async refreshEventList(): Promise<void> {
    this.events.set(await this.remote.listEvents().catch(() => []));
  }

  /** Remove an event everywhere: server (best-effort) + local cache, then refresh the list. */
  async deleteEvent(eventId: string, eventCode: string): Promise<void> {
    await this.remote.deleteEvent(eventId, eventCode).catch(() => {
      // Offline or server-side failure: still clear the local copy.
    });
    await Promise.all([
      this.db.events.delete(eventId),
      this.db.deelnemers.where("eventId").equals(eventId).delete(),
      this.db.scores.where("eventId").equals(eventId).delete(),
      this.db.captureMeta.where("eventId").equals(eventId).delete(),
      this.db.syncMeta.delete(eventId),
    ]);
    if (this.event()?.id === eventId) this.leaveEvent();
    await this.refreshEventList();
  }

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
      this.persistSession(event.id, this.judge());
    } catch {
      // Offline: a local-only event (random id+code, no cross-device sync).
      this.sync = null;
      const local = await this.service.createEvent({ name, date });
      this.event.set(local);
      this.persistSession(local.id, this.judge());
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
    this.persistSession(found.id, slot);
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

  /** Share the deelnemer identity early (before scores) so the other juror can join the booth. */
  async announceDeelnemer(
    standNr: string,
    projectgroep: string,
    isVervolgproject = false,
  ): Promise<void> {
    const event = this.event();
    if (!event || !standNr) return;
    await this.service.upsertDeelnemer({
      eventId: event.id,
      standNr,
      projectgroep,
      isVervolgproject,
      updatedAt: this.clock(),
    });
    await this.refreshDeelnemers();
    this.pushSoon();
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
    // Re-capturing an already-placed project must not wipe its ranking.
    const existing = await this.loadScores(judge);
    for (const criterion of CRITERIA) {
      const prior = existing.find((s) => s.standNr === input.standNr && s.criterion === criterion);
      await this.service.saveScore({
        eventId: event.id,
        judge,
        standNr: input.standNr,
        criterion,
        value: input.scores[criterion],
        rankPos: prior?.rankPos ?? null,
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
      criterionNotes: input.criterionNotes ?? {},
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

  metaFor(standNr: string, judge: JudgeSlot = this.judge()): Promise<CaptureMeta | undefined> {
    const event = this.event();
    if (!event) return Promise.resolve(undefined);
    return this.service.getCaptureMeta(event.id, judge, standNr);
  }

  /** Patch this juror's note/review for a captured stand (used while discussing in Afstemmen). */
  async updateCaptureMeta(
    standNr: string,
    patch: Partial<Pick<CaptureMeta, "note" | "review">>,
  ): Promise<void> {
    const existing = await this.metaFor(standNr);
    if (!existing) return;
    await this.service.saveCaptureMeta({ ...existing, ...patch, updatedAt: this.clock() });
    this.pushSoon();
  }

  /** The jury's manual #1 tie-break choice (standNr), latest writer wins across judges. */
  async tieDecision(): Promise<string | null> {
    const metas = await Promise.all([
      this.metaFor(TIEBREAK_STAND, "A"),
      this.metaFor(TIEBREAK_STAND, "B"),
    ]);
    const latest = metas
      .filter((m): m is CaptureMeta => !!m?.keyword)
      .sort((x, y) => (y.updatedAt ?? 0) - (x.updatedAt ?? 0))[0];
    return latest?.keyword ?? null;
  }

  async decideTie(standNr: string): Promise<void> {
    const event = this.event();
    if (!event) return;
    await this.service.saveCaptureMeta({
      eventId: event.id,
      judge: this.judge(),
      standNr: TIEBREAK_STAND,
      keyword: standNr,
      note: "",
      review: "",
      photoRef: null,
      updatedAt: this.clock(),
    });
    this.pushSoon();
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
    this.openStream(event);
  }

  private openStream(event: JuryEvent): void {
    this.stream?.close();
    this.connection.set("connecting");
    this.stream = this.remote.openChangeStream(
      event.id,
      event.eventCode,
      () => {
        this.liveTick = this.onRemoteChange();
      },
      (s) => this.connection.set(s),
    );
  }

  private async onRemoteChange(): Promise<void> {
    await this.refreshDeelnemers(); // pulls + reloads roster + scores
    await this.refreshDrift();
    this.revision.update((n) => n + 1);
  }

  leaveEvent(): void {
    this.stream?.close();
    this.stream = null;
    this.connection.set("offline");
    this.clearSession();
    this.event.set(null);
    this.deelnemers.set([]);
    this.scores.set([]);
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
