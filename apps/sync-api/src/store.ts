export type JudgeSlot = "A" | "B";
export type Criterion = "innovativiteit" | "relevantie" | "haalbaarheid" | "impact";

export interface EventRow {
  id: string;
  name: string;
  date: string;
  eventCode: string;
}
export interface SyncDeelnemer {
  eventId: string;
  standNr: string;
  projectgroep: string;
  isVervolgproject: boolean;
  updatedAt: number;
}
export interface SyncScore {
  eventId: string;
  judge: JudgeSlot;
  standNr: string;
  criterion: Criterion;
  value: number;
  rankPos: number | null;
  updatedAt: number;
}
export interface SyncMeta {
  eventId: string;
  judge: JudgeSlot;
  standNr: string;
  keyword: string;
  note: string;
  review: string;
  updatedAt: number;
}
export interface ChangeSet {
  deelnemers: SyncDeelnemer[];
  scores: SyncScore[];
  captureMeta: SyncMeta[];
}

export interface SyncStore {
  createEvent(event: EventRow): void;
  findEventByCode(eventCode: string): EventRow | undefined;
  applyChanges(eventId: string, changes: ChangeSet): void;
  changesSince(eventId: string, since: number): ChangeSet;
}

function lww<T extends { updatedAt: number }>(map: Map<string, T>, key: string, row: T): void {
  const existing = map.get(key);
  if (!existing || row.updatedAt > existing.updatedAt) map.set(key, row);
}

export class InMemoryStore implements SyncStore {
  private events = new Map<string, EventRow>();
  private deelnemers = new Map<string, SyncDeelnemer>();
  private scores = new Map<string, SyncScore>();
  private captureMeta = new Map<string, SyncMeta>();

  createEvent(event: EventRow): void {
    this.events.set(event.id, event);
  }

  findEventByCode(eventCode: string): EventRow | undefined {
    return [...this.events.values()].find((e) => e.eventCode === eventCode);
  }

  applyChanges(eventId: string, changes: ChangeSet): void {
    for (const d of changes.deelnemers) lww(this.deelnemers, `${eventId}|${d.standNr}`, d);
    for (const s of changes.scores)
      lww(this.scores, `${eventId}|${s.judge}|${s.standNr}|${s.criterion}`, s);
    for (const m of changes.captureMeta)
      lww(this.captureMeta, `${eventId}|${m.judge}|${m.standNr}`, m);
  }

  changesSince(eventId: string, since: number): ChangeSet {
    const pick = <T extends { eventId: string; updatedAt: number }>(map: Map<string, T>) =>
      [...map.values()].filter((r) => r.eventId === eventId && r.updatedAt > since);
    return {
      deelnemers: pick(this.deelnemers),
      scores: pick(this.scores),
      captureMeta: pick(this.captureMeta),
    };
  }
}
