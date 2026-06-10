import type {
  CaptureMeta,
  Criterion,
  Deelnemer,
  JudgeSlot,
  JuryEvent,
  Score,
} from "@winnovation/domain";
import Dexie, { type Table } from "dexie";

export interface StoredPhoto {
  id: string;
  blob: Blob;
}

export interface SyncMetaRow {
  eventId: string;
  lastPulledAt: number;
}

export class JuryDb extends Dexie {
  events!: Table<JuryEvent, string>;
  deelnemers!: Table<Deelnemer, [string, string]>;
  scores!: Table<Score, [string, JudgeSlot, string, Criterion]>;
  captureMeta!: Table<CaptureMeta, [string, JudgeSlot, string]>;
  photos!: Table<StoredPhoto, string>;
  syncMeta!: Table<SyncMetaRow, string>;

  constructor(name = "winnovation-jury") {
    super(name);
    this.version(1).stores({
      events: "id, eventCode",
      deelnemers: "[eventId+standNr], eventId",
      scores: "[judge+standNr+criterion], judge, standNr, criterion",
      captureMeta: "[judge+standNr], judge, standNr",
      photos: "id",
    });
    this.version(2).stores({
      events: "id, eventCode",
      deelnemers: "[eventId+standNr], eventId, updatedAt",
      scores: "[judge+standNr+criterion], judge, standNr, criterion, updatedAt",
      captureMeta: "[judge+standNr], judge, standNr, updatedAt",
      photos: "id",
      syncMeta: "eventId",
    });
    // v3 → v4: event-scope `scores` and `captureMeta` so two events that reuse a
    // standNr no longer collide. The primary key gains `eventId` as its first
    // component. IndexedDB key paths are immutable and Dexie refuses an in-place
    // primary-key change ("UpgradeError: Not yet support for changing primary
    // key"), so the only path is drop-then-recreate: v3 drops the two tables, v4
    // recreates them event-scoped. The dropped rows are the pre-fix, cross-event
    // contaminated data; preserving them would carry the bug forward (and their
    // owning event is ambiguous by construction). `seedDemo` repopulates the
    // WIN-26 demo on next boot; real events re-sync from the server.
    this.version(3).stores({
      scores: null,
      captureMeta: null,
    });
    this.version(4).stores({
      events: "id, eventCode",
      deelnemers: "[eventId+standNr], eventId, updatedAt",
      scores:
        "[eventId+judge+standNr+criterion], [eventId+judge], eventId, judge, standNr, criterion, updatedAt",
      captureMeta: "[eventId+judge+standNr], [eventId+judge], eventId, judge, standNr, updatedAt",
      photos: "id",
      syncMeta: "eventId",
    });
  }
}
