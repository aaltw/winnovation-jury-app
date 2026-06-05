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
  scores!: Table<Score, [JudgeSlot, string, Criterion]>;
  captureMeta!: Table<CaptureMeta, [JudgeSlot, string]>;
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
  }
}
