import {
  ChangeStream,
  type ChangeStreamHandle,
  type ConnectionState,
  type EventSourceFactory,
} from "./change-stream";
import type { Transport } from "./sync";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const defaultFetch: FetchLike = (url, init) => fetch(url, init);

/** Full event as returned by the server's join endpoint. */
export interface RemoteEventInfo {
  id: string;
  name: string;
  date: string;
  eventCode: string;
}

/** One row from the server's `GET /events` listing. */
export interface RemoteEventListItem {
  id: string;
  name: string;
  date: string;
  eventCode: string;
  projectCount: number;
}

type ChangeResponse = { deelnemers: unknown[]; scores: unknown[]; captureMeta: unknown[] };

/** `Transport` over HTTP. Sends the event code as the `x-event-code` guard header. */
export class HttpTransport implements Transport {
  constructor(
    private readonly base: string,
    private readonly code: () => string,
    private readonly fetchImpl: FetchLike = defaultFetch,
  ) {}

  private headers(): Record<string, string> {
    return { "content-type": "application/json", "x-event-code": this.code() };
  }

  async post(path: string, body: unknown): Promise<unknown> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return res.json();
  }

  async get(path: string): Promise<ChangeResponse> {
    const res = await this.fetchImpl(`${this.base}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json() as Promise<ChangeResponse>;
  }
}

/** What `JuryStore` needs from the sync backend. Lets tests inject a fake. */
export interface Remote {
  createEvent(name: string, date: string): Promise<{ id: string; eventCode: string }>;
  joinEvent(code: string): Promise<RemoteEventInfo | null>;
  transportFor(code: () => string): Transport;
  listEvents(): Promise<RemoteEventListItem[]>;
  openChangeStream(
    eventId: string,
    code: string,
    onChange: () => void,
    onState?: (s: ConnectionState) => void,
  ): ChangeStreamHandle;
}

/** Talks to the Hono sync-api (same-origin under `/api` in the browser). */
export class RemoteGateway implements Remote {
  constructor(
    private readonly base: string,
    private readonly fetchImpl: FetchLike = defaultFetch,
    private readonly eventSourceFactory?: EventSourceFactory,
  ) {}

  async createEvent(name: string, date: string): Promise<{ id: string; eventCode: string }> {
    const res = await this.fetchImpl(`${this.base}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, date }),
    });
    if (!res.ok) throw new Error(`create event → ${res.status}`);
    return res.json() as Promise<{ id: string; eventCode: string }>;
  }

  async joinEvent(code: string): Promise<RemoteEventInfo | null> {
    const res = await this.fetchImpl(`${this.base}/events/${encodeURIComponent(code)}/join`, {
      method: "POST",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`join event → ${res.status}`);
    const body = (await res.json()) as {
      eventId: string;
      name: string;
      date: string;
      eventCode: string;
    };
    return { id: body.eventId, name: body.name, date: body.date, eventCode: body.eventCode };
  }

  transportFor(code: () => string): Transport {
    return new HttpTransport(this.base, code, this.fetchImpl);
  }

  async listEvents(): Promise<RemoteEventListItem[]> {
    const res = await this.fetchImpl(`${this.base}/events`);
    if (!res.ok) throw new Error(`list events → ${res.status}`);
    return res.json() as Promise<RemoteEventListItem[]>;
  }

  openChangeStream(
    eventId: string,
    code: string,
    onChange: () => void,
    onState?: (s: ConnectionState) => void,
  ): ChangeStreamHandle {
    return new ChangeStream(this.base, eventId, code, onChange, this.eventSourceFactory, onState);
  }
}
