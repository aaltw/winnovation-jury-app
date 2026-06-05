import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

export type SyncState = "synced" | "syncing" | "offline";

const SYNC_LABELS: Record<SyncState, string> = {
  synced: "Gesynct",
  syncing: "Synct…",
  offline: "Offline — lokaal bewaard",
};

const SYNC_CLASS: Record<SyncState, string> = {
  synced: "",
  syncing: "syncing",
  offline: "offline",
};

/** Ambient sync status pill (recreates WV.Sync / `.wv-sync`). */
@Component({
  selector: "wn-sync",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="wv-sync {{ stateClass() }}">
      <span class="pip"></span>{{ label() }}
    </span>
  `,
})
export class SyncComponent {
  readonly state = input<SyncState>("synced");

  protected readonly label = computed(() => SYNC_LABELS[this.state()]);
  protected readonly stateClass = computed(() => SYNC_CLASS[this.state()]);
}
