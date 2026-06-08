import Database from "better-sqlite3";
import type { ChangeSet, EventListItem, EventRow, SyncStore } from "./store";

export class SqliteStore implements SyncStore {
  private db: Database.Database;
  constructor(path = "jury.db") {
    this.db = new Database(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, name TEXT, date TEXT, eventCode TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS deelnemers (eventId TEXT, standNr TEXT, projectgroep TEXT, isVervolgproject INTEGER, updatedAt INTEGER, PRIMARY KEY (eventId, standNr));
      CREATE TABLE IF NOT EXISTS scores (eventId TEXT, judge TEXT, standNr TEXT, criterion TEXT, value INTEGER, rankPos INTEGER, updatedAt INTEGER, PRIMARY KEY (eventId, judge, standNr, criterion));
      CREATE TABLE IF NOT EXISTS captureMeta (eventId TEXT, judge TEXT, standNr TEXT, keyword TEXT, note TEXT, review TEXT, updatedAt INTEGER, PRIMARY KEY (eventId, judge, standNr));
    `);
  }

  createEvent(event: EventRow): void {
    this.db
      .prepare("INSERT OR REPLACE INTO events (id,name,date,eventCode) VALUES (?,?,?,?)")
      .run(event.id, event.name, event.date, event.eventCode);
  }

  findEventByCode(eventCode: string): EventRow | undefined {
    return this.db.prepare("SELECT * FROM events WHERE eventCode = ?").get(eventCode) as
      | EventRow
      | undefined;
  }

  applyChanges(eventId: string, changes: ChangeSet): void {
    const newer = (table: string, keys: string[]) =>
      this.db.prepare(
        `SELECT updatedAt FROM ${table} WHERE ${keys.map((k) => `${k}=?`).join(" AND ")}`,
      );
    const tx = this.db.transaction(() => {
      for (const d of changes.deelnemers) {
        const cur = newer("deelnemers", ["eventId", "standNr"]).get(eventId, d.standNr) as
          | { updatedAt: number }
          | undefined;
        if (!cur || d.updatedAt > cur.updatedAt)
          this.db
            .prepare("INSERT OR REPLACE INTO deelnemers VALUES (?,?,?,?,?)")
            .run(eventId, d.standNr, d.projectgroep, d.isVervolgproject ? 1 : 0, d.updatedAt);
      }
      for (const s of changes.scores) {
        const cur = newer("scores", ["eventId", "judge", "standNr", "criterion"]).get(
          eventId,
          s.judge,
          s.standNr,
          s.criterion,
        ) as { updatedAt: number } | undefined;
        if (!cur || s.updatedAt > cur.updatedAt)
          this.db
            .prepare("INSERT OR REPLACE INTO scores VALUES (?,?,?,?,?,?,?)")
            .run(eventId, s.judge, s.standNr, s.criterion, s.value, s.rankPos, s.updatedAt);
      }
      for (const m of changes.captureMeta) {
        const cur = newer("captureMeta", ["eventId", "judge", "standNr"]).get(
          eventId,
          m.judge,
          m.standNr,
        ) as { updatedAt: number } | undefined;
        if (!cur || m.updatedAt > cur.updatedAt)
          this.db
            .prepare("INSERT OR REPLACE INTO captureMeta VALUES (?,?,?,?,?,?,?)")
            .run(eventId, m.judge, m.standNr, m.keyword, m.note, m.review, m.updatedAt);
      }
    });
    tx();
  }

  changesSince(eventId: string, since: number): ChangeSet {
    const q = (table: string) =>
      this.db.prepare(`SELECT * FROM ${table} WHERE eventId=? AND updatedAt>?`).all(eventId, since);
    const deelnemers = (q("deelnemers") as Array<{ isVervolgproject: number }>).map((r) => ({
      ...r,
      isVervolgproject: !!r.isVervolgproject,
    })) as ChangeSet["deelnemers"];
    return {
      deelnemers,
      scores: q("scores") as ChangeSet["scores"],
      captureMeta: q("captureMeta") as ChangeSet["captureMeta"],
    };
  }

  listEvents(): EventListItem[] {
    return this.db
      .prepare(
        `SELECT e.id, e.name, e.date, e.eventCode, COUNT(d.standNr) AS projectCount
         FROM events e
         LEFT JOIN deelnemers d ON d.eventId = e.id
         GROUP BY e.id, e.name, e.date, e.eventCode
         ORDER BY e.name`,
      )
      .all() as EventListItem[];
  }
}
