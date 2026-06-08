/** Minimal surface of the browser `EventSource` we depend on (injectable for tests). */
export interface EventSourceLike {
  onopen: ((this: EventSourceLike, ev: unknown) => void) | null;
  onmessage: ((this: EventSourceLike, ev: { data: string }) => void) | null;
  onerror: ((this: EventSourceLike, ev: unknown) => void) | null;
  close(): void;
}

export type EventSourceFactory = (url: string) => EventSourceLike;
export type ConnectionState = "offline" | "connecting" | "live";

export interface ChangeStreamHandle {
  close(): void;
}

const defaultFactory: EventSourceFactory = (url) =>
  new EventSource(url) as unknown as EventSourceLike;

/** Subscribes to the sync-api SSE stream. On any notification (or reconnect) it
 *  calls `onChange`, debounced so a burst collapses into one pull. The caller
 *  reacts by pulling — a dropped socket self-heals because EventSource reconnects
 *  and `onopen` re-fires `onChange`. */
export class ChangeStream implements ChangeStreamHandle {
  private readonly es: EventSourceLike;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    base: string,
    eventId: string,
    code: string,
    private readonly onChange: () => void,
    factory: EventSourceFactory = defaultFactory,
    private readonly onState?: (s: ConnectionState) => void,
  ) {
    const url = `${base}/events/${encodeURIComponent(eventId)}/stream?code=${encodeURIComponent(code)}`;
    this.es = factory(url);
    this.es.onopen = () => {
      this.onState?.("live");
      this.fire();
    };
    this.es.onmessage = () => this.fire();
    this.es.onerror = () => this.onState?.("connecting");
  }

  private fire(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onChange();
    }, 250);
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.es.close();
  }
}
