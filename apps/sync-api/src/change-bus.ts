/** In-process pub/sub: notify SSE subscribers when an event's data changes.
 *  Single-container only — a multi-process deploy would need a shared bus. */
export class ChangeBus {
  private subs = new Map<string, Set<() => void>>();

  subscribe(eventId: string, fn: () => void): () => void {
    const set = this.subs.get(eventId) ?? new Set<() => void>();
    set.add(fn);
    this.subs.set(eventId, set);
    return () => {
      set.delete(fn);
      if (set.size === 0) this.subs.delete(eventId);
    };
  }

  publish(eventId: string): void {
    for (const fn of this.subs.get(eventId) ?? []) fn();
  }
}
