import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { IconComponent, SyncComponent, DeelnemerCardComponent, fmtStand } from "@winnovation/ui";
import { JuryStore } from "./jury-store";

@Component({
  selector: "wn-event-home",
  standalone: true,
  imports: [IconComponent, SyncComponent, DeelnemerCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-screen">
      <div class="wv-scroll">
        <div class="wv-appbar">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px">
              <span
                style="width:22px;height:22px;border-radius:7px;background:var(--brand);display:grid;place-items:center;transform:rotate(-6deg)"
              >
                <wn-icon name="spark" [size]="13" fill="#fff" />
              </span>
              <h2 style="font-size:20px;margin:0">Winnovation</h2>
            </div>
            <div class="sub" style="margin-top:2px">
              Eventcode {{ store.event()?.eventCode ?? "—" }} · Jurylid {{ store.judge() }}
            </div>
          </div>
          <wn-sync state="synced" />
        </div>

        <div class="wv-pad">
          <div class="wv-progress" style="margin-bottom:12px">
            <div class="wv-stat">
              <div class="big">{{ scored() }}</div>
              <div class="lbl">Gescoord</div>
            </div>
            <div class="wv-stat">
              <div class="big">{{ store.placedCount() }}</div>
              <div class="lbl">Geplaatst</div>
            </div>
            <div class="wv-stat flag">
              <div class="big">{{ store.driftItems().length }}</div>
              <div class="lbl">Drift-vlaggen</div>
            </div>
          </div>

          <div
            style="display:flex;justify-content:space-between;align-items:center;margin:4px 2px 7px"
          >
            <span style="font-size:12px;color:var(--muted);font-weight:600">Voortgang vandaag</span>
            <span style="font-size:12px;color:var(--muted);font-weight:700"
              >{{ store.placedCount() }}/{{ scored() }} geplaatst</span
            >
          </div>
          <div class="wv-bar" style="margin-bottom:6px">
            <span [style.width]="pct(store.placedCount())" style="background:var(--brand)"></span>
            <span
              [style.width]="pct(scored() - store.placedCount())"
              style="background:var(--brand-soft)"
            ></span>
          </div>

          @if (store.driftItems().length) {
            <div
              (click)="go('/review')"
              style="display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 12px;border-radius:12px;background:var(--amber-soft);border:1px solid #F4DC9E;cursor:pointer"
            >
              <span
                style="width:26px;height:26px;border-radius:8px;background:var(--amber);color:#fff;display:grid;place-items:center;flex:none"
              >
                <wn-icon name="flag" [size]="15" [stroke]="2.2" />
              </span>
              <span style="flex:1;font-size:13px;font-weight:700;color:var(--amber-ink)">
                {{ store.driftItems().length }} plek{{ store.driftItems().length > 1 ? "ken" : "" }} waar
                je cijfer en plaatsing botsen
              </span>
              <wn-icon name="chevRight" [size]="16" />
            </div>
          }

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:16px">
            @for (e of entries(); track e.route) {
              <button
                (click)="go(e.route)"
                style="background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 12px;text-align:left;cursor:pointer;box-shadow:var(--sh-card)"
              >
                <span
                  [style.background]="e.color"
                  style="width:32px;height:32px;border-radius:9px;color:#fff;display:grid;place-items:center;margin-bottom:9px"
                >
                  <wn-icon [name]="e.icon" [size]="17" />
                </span>
                <div style="font-weight:700;font-size:13.5px;line-height:1.1">{{ e.title }}</div>
                <div style="font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.2">
                  {{ e.sub }}
                </div>
              </button>
            }
          </div>

          <div class="wv-divider-label">
            <span class="t">Gescoord vandaag</span><span class="ln"></span>
          </div>

          @if (recent().length) {
            <div class="wv-list">
              @for (d of recent(); track d.standNr) {
                <wn-deelnemer-card
                  [standNr]="d.standNr"
                  [projectgroep]="d.projectgroep"
                  [keyword]="keywords()[d.standNr] ?? ''"
                  [color]="colorFor(d.standNr)"
                  [drift]="driftSet().has(d.standNr)"
                  [tappable]="true"
                  (click)="go('/review')"
                >
                  <span
                    slot="trailing"
                    [class]="
                      store.isPlaced(d.standNr) ? 'wv-chip wv-chip-mint' : 'wv-chip wv-chip-brand'
                    "
                  >
                    {{ store.isPlaced(d.standNr) ? "Geplaatst" : "Te plaatsen" }}
                  </span>
                </wn-deelnemer-card>
              }
            </div>
          } @else {
            <p style="font-size:13.5px;color:var(--muted);padding:8px 2px">
              Nog niets gescoord. Tik op “Nieuwe deelnemer”.
            </p>
          }
          <div style="height:12px"></div>
        </div>
      </div>

      <div class="wv-dock bordered">
        <button class="wv-btn wv-btn-primary" (click)="go('/stand')">
          <wn-icon name="plus" [size]="19" />
          Nieuwe deelnemer
        </button>
      </div>
    </div>
  `,
})
export class EventHomeComponent {
  protected readonly store = inject(JuryStore);
  private readonly router = inject(Router);

  protected readonly keywords = signal<Record<string, string>>({});
  protected readonly scored = computed(() => this.store.deelnemers().length);
  protected readonly recent = computed(() => [...this.store.deelnemers()].reverse());
  protected readonly driftSet = computed(
    () => new Set(this.store.driftItems().map((d) => d.standNr)),
  );
  protected readonly entries = computed(() => [
    {
      icon: "scale",
      title: "Vergelijken",
      sub: `${this.scored() - this.store.placedCount()} te plaatsen`,
      route: "/compare",
      color: "var(--brand)",
    },
    {
      icon: "list",
      title: "Nakijken",
      sub: `${this.scored()} projecten`,
      route: "/review",
      color: "var(--c-haalb)",
    },
    {
      icon: "handshake",
      title: "Verzoenen",
      sub: "met jurylid B",
      route: "/reconcile",
      color: "var(--coral)",
    },
  ]);

  private readonly palette = ["#4B3BF5", "#FF5A3C", "#00A7C4", "#06BE7E", "#F5A300", "#8A5BE0"];

  async ngOnInit(): Promise<void> {
    await this.store.refreshDeelnemers();
    await this.store.refreshDrift();
    const entries = await Promise.all(
      this.store.deelnemers().map(async (d) => {
        const meta = await this.store.metaFor(d.standNr);
        return [d.standNr, meta?.keyword ?? ""] as const;
      }),
    );
    this.keywords.set(Object.fromEntries(entries));
  }

  protected fmtStand = fmtStand;

  protected pct(n: number): string {
    const total = this.scored();
    return total > 0 ? `${(n / total) * 100}%` : "0%";
  }

  protected colorFor(standNr: string): string {
    const n = Number.parseInt(standNr, 10) || standNr.length;
    return this.palette[n % this.palette.length];
  }

  protected go(route: string): void {
    void this.router.navigate([route]);
  }
}
