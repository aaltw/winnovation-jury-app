import type { CaptureMeta, Deelnemer, Score } from "@winnovation/domain";
import type { JuryDb } from "./db";

export interface Transport {
  post(path: string, body: unknown): Promise<unknown>;
  get(path: string): Promise<{ deelnemers: unknown[]; scores: unknown[]; captureMeta: unknown[] }>;
}

const at = (row: { updatedAt?: number }) => row.updatedAt ?? 0;

export class SyncClient {
  constructor(
    private db: JuryDb,
    private transport: Transport,
    private eventId: string,
  ) {}

  async push(): Promise<void> {
    // Read all three tables in one transaction so the pushed snapshot is a
    // single consistent view, even if a write lands mid-read.
    const { deelnemers, scores, captureMeta } = await this.db.transaction(
      "r",
      this.db.deelnemers,
      this.db.scores,
      this.db.captureMeta,
      async () => {
        const [d, s, m] = await Promise.all([
          this.db.deelnemers.where("eventId").equals(this.eventId).toArray(),
          this.db.scores.where("eventId").equals(this.eventId).toArray(),
          this.db.captureMeta.where("eventId").equals(this.eventId).toArray(),
        ]);
        return { deelnemers: d, scores: s, captureMeta: m };
      },
    );
    await this.transport.post(`/events/${this.eventId}/changes`, {
      deelnemers: deelnemers.map((d) => ({ ...d, updatedAt: at(d) })),
      scores: scores.map((s) => ({ ...s, eventId: this.eventId, updatedAt: at(s) })),
      captureMeta: captureMeta.map((m) => ({ ...m, eventId: this.eventId, updatedAt: at(m) })),
    });
  }

  async pull(): Promise<void> {
    const meta = await this.db.syncMeta.get(this.eventId);
    const since = meta?.lastPulledAt ?? 0;
    const remote = await this.transport.get(`/events/${this.eventId}/changes?since=${since}`);
    let maxAt = since;

    await this.db.transaction(
      "rw",
      this.db.deelnemers,
      this.db.scores,
      this.db.captureMeta,
      async () => {
        for (const raw of remote.deelnemers as Deelnemer[]) {
          maxAt = Math.max(maxAt, at(raw));
          const local = await this.db.deelnemers.get([this.eventId, raw.standNr]);
          if (!local || at(local) < at(raw))
            await this.db.deelnemers.put({ ...raw, eventId: this.eventId });
        }
        for (const raw of remote.scores as Score[]) {
          maxAt = Math.max(maxAt, at(raw));
          const local = await this.db.scores.get([
            this.eventId,
            raw.judge,
            raw.standNr,
            raw.criterion,
          ]);
          if (!local || at(local) < at(raw))
            await this.db.scores.put({ ...raw, eventId: this.eventId });
        }
        for (const raw of remote.captureMeta as CaptureMeta[]) {
          maxAt = Math.max(maxAt, at(raw));
          const local = await this.db.captureMeta.get([this.eventId, raw.judge, raw.standNr]);
          if (!local || at(local) < at(raw))
            await this.db.captureMeta.put({ ...raw, eventId: this.eventId });
        }
      },
    );

    await this.db.syncMeta.put({ eventId: this.eventId, lastPulledAt: maxAt });
  }
}
