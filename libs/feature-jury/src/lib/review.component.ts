import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { CRITERIA, type Criterion, type ScoreValue, bracketingAnchors } from "@winnovation/domain";
import {
  AppBarComponent,
  DeelnemerCardComponent,
  DriftFlagComponent,
  IconComponent,
  ScoreInputComponent,
  SyncComponent,
  criterionColor,
} from "@winnovation/ui";
import { JuryStore } from "./jury-store";

const LABELS: Record<Criterion, string> = {
  innovativiteit: "Innovativiteit",
  relevantie: "Relevantie",
  haalbaarheid: "Haalbaarheid",
  impact: "Impact",
};

interface Row {
  standNr: string;
  value: ScoreValue;
  drift: boolean;
  keyword: string;
  projectgroep: string;
}

@Component({
  selector: "wn-review",
  standalone: true,
  imports: [
    AppBarComponent,
    DeelnemerCardComponent,
    DriftFlagComponent,
    IconComponent,
    ScoreInputComponent,
    SyncComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-screen">
      <wn-app-bar title="Nakijken" sub="per criterium">
        <button slot="left" class="wv-appbar-btn" (click)="go('/home')">
          <wn-icon name="chevLeft" [size]="20" />
        </button>
        <wn-sync slot="right" state="synced" />
      </wn-app-bar>

      <div style="display:flex;gap:6px;padding:0 16px 12px;overflow-x:auto">
        @for (c of criteria; track c) {
          <button
            (click)="select(c)"
            [style.border]="'1.5px solid ' + (criterion() === c ? color(c) : 'var(--line-2)')"
            [style.background]="criterion() === c ? color(c) : '#fff'"
            [style.color]="criterion() === c ? '#fff' : 'var(--ink-2)'"
            style="display:inline-flex;align-items:center;gap:6px;flex:none;padding:8px 13px;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer"
          >
            {{ labels[c] }}
            @if (countFor(c)) {
              <span
                [style.background]="criterion() === c ? 'rgba(255,255,255,.25)' : 'var(--amber)'"
                style="color:#fff;border-radius:999px;min-width:18px;height:18px;display:grid;place-items:center;font-size:11px;padding:0 5px"
                >{{ countFor(c) }}</span
              >
            }
          </button>
        }
      </div>

      <div class="wv-scroll">
        <div class="wv-pad" style="padding-top:4px">
          @if (driftRows().length) {
            <div class="wv-divider-label" style="margin-top:4px">
              <span class="t" style="color:var(--amber-ink)">Even checken</span><span class="ln"></span>
            </div>
            <div class="wv-list" style="margin-bottom:4px">
              @for (r of driftRows(); track r.standNr) {
                <wn-drift-flag
                  [keyword]="r.keyword || fmtStand(r.standNr)"
                  [criterion]="criterion()"
                  [severity]="severityFor(r.standNr)"
                  (click)="open(r.standNr)"
                  style="cursor:pointer"
                />
              }
            </div>
          } @else {
            <div style="margin-bottom:6px">
              <div
                style="display:flex;align-items:center;gap:9px;padding:11px 13px;border-radius:12px;background:var(--mint-soft);color:#066b48;font-size:13px;font-weight:700"
              >
                <wn-icon name="check" [size]="17" />
                Geen drift op {{ labels[criterion()] }} — cijfers en plaatsing kloppen
              </div>
            </div>
          }

          <div class="wv-divider-label">
            <span class="t">Ranglijst · {{ labels[criterion()] }}</span><span class="ln"></span>
            <span style="font-size:11px;color:var(--muted);font-weight:600"
              >{{ rows().length }} projecten</span
            >
          </div>

          <div class="wv-list">
            @for (r of rows(); track r.standNr; let i = $index) {
              <div style="display:flex;align-items:center;gap:10px">
                <span
                  style="font-family:var(--font-display);font-weight:800;font-size:16px;color:var(--muted);width:26px;text-align:center;flex:none;font-variant-numeric:tabular-nums"
                  >{{ i + 1 }}</span
                >
                <div style="flex:1">
                  <wn-deelnemer-card
                    [standNr]="r.standNr"
                    [projectgroep]="r.projectgroep"
                    [keyword]="r.keyword"
                    [color]="colorForStand(r.standNr)"
                    [drift]="r.drift"
                    [tappable]="r.drift"
                    (click)="r.drift ? open(r.standNr) : null"
                  >
                    <div slot="trailing" style="display:flex;align-items:center;gap:8px;flex:none">
                      <span
                        [style.color]="color(criterion())"
                        style="font-family:var(--font-display);font-weight:800;font-size:22px"
                        >{{ r.value }}</span
                      >
                      <wn-icon
                        [name]="r.drift ? 'chevRight' : 'check'"
                        [size]="16"
                        [fill]="null"
                        [style.color]="r.drift ? 'var(--amber-ink)' : 'var(--line-2)'"
                      />
                    </div>
                  </wn-deelnemer-card>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      @if (resolve(); as target) {
        <div
          (click)="resolve.set(null)"
          style="position:absolute;inset:0;background:rgba(22,23,29,.5);z-index:20;display:flex;align-items:flex-end"
        >
          <div
            (click)="$event.stopPropagation()"
            style="background:var(--bg);width:100%;border-radius:26px 26px 0 0;padding:10px 20px 26px;max-height:88%;overflow-y:auto"
          >
            <div
              style="width:40px;height:4px;border-radius:999px;background:var(--line-2);margin:0 auto 14px"
            ></div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
              <span
                [style.background]="stillDrift(target) ? 'var(--amber)' : 'var(--mint)'"
                style="width:30px;height:30px;border-radius:9px;color:#fff;display:grid;place-items:center"
              >
                <wn-icon [name]="stillDrift(target) ? 'flag' : 'check'" [size]="16" [stroke]="2.2" />
              </span>
              <h3 style="font-family:var(--font-display);font-weight:700;font-size:19px;margin:0">
                {{ stillDrift(target) ? "Drift oplossen" : "Opgelost" }}
              </h3>
            </div>
            <p style="font-size:13.5px;color:var(--muted);margin:8px 0 16px;line-height:1.5">
              @if (stillDrift(target)) {
                Je cijfer en plaatsing voor
                <b style="color:var(--ink)">{{ kw(target) || fmtStand(target) }}</b> op
                {{ labels[criterion()] }} spreken elkaar tegen. Wat klopt er?
              } @else {
                Cijfer en plaatsing zijn weer met elkaar in lijn. Mooi.
              }
            </p>
            @if (stillDrift(target)) {
              <div style="display:grid;gap:10px;margin-bottom:14px">
                <button
                  class="wv-card"
                  (click)="followPlacement(target)"
                  style="display:flex;align-items:center;gap:12px;padding:14px;text-align:left;cursor:pointer;border:1.5px solid var(--line)"
                >
                  <span
                    style="width:34px;height:34px;border-radius:10px;background:var(--brand-soft);color:var(--brand-ink);display:grid;place-items:center;flex:none"
                  >
                    <wn-icon name="scale" [size]="17" />
                  </span>
                  <span style="flex:1">
                    <span style="display:block;font-weight:700;font-size:14px">Mijn plaatsing klopt</span>
                    <span style="display:block;font-size:12px;color:var(--muted);margin-top:2px"
                      >cijfer wordt {{ valueFor(target) }} → {{ suggestedValue(target) }}</span
                    >
                  </span>
                </button>
                <button
                  class="wv-card"
                  (click)="followScore(target)"
                  style="display:flex;align-items:center;gap:12px;padding:14px;text-align:left;cursor:pointer;border:1.5px solid var(--line)"
                >
                  <span
                    style="width:34px;height:34px;border-radius:10px;background:var(--mint-soft);color:#066b48;display:grid;place-items:center;flex:none"
                  >
                    <wn-icon name="check" [size]="17" />
                  </span>
                  <span style="flex:1">
                    <span style="display:block;font-weight:700;font-size:14px">Mijn cijfer klopt</span>
                    <span style="display:block;font-size:12px;color:var(--muted);margin-top:2px"
                      >plaatsing wordt plek {{ rankFor(target) }} → {{ suggestedRank(target) }}</span
                    >
                  </span>
                </button>
              </div>
              <div class="wv-divider-label"><span class="t">Of stel zelf bij</span><span class="ln"></span></div>
            }
            <div class="wv-card" style="padding:16px;margin-bottom:14px">
              <wn-score-input
                [criterion]="criterion()"
                [label]="labels[criterion()]"
                [accent]="color(criterion())"
                [value]="valueFor(target)"
                (valueChange)="changeValue(target, $event)"
              />
            </div>
            <button
              [class]="stillDrift(target) ? 'wv-btn wv-btn-ghost' : 'wv-btn wv-btn-primary'"
              (click)="stillDrift(target) ? replaceIn(target) : resolve.set(null)"
            >
              <wn-icon [name]="stillDrift(target) ? 'scale' : 'check'" [size]="19" />
              {{ stillDrift(target) ? "Liever herplaatsen in Vergelijken" : "Klaar" }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ReviewComponent {
  private readonly store = inject(JuryStore);
  private readonly router = inject(Router);

  protected readonly criteria = CRITERIA;
  protected readonly labels = LABELS;
  protected readonly criterion = signal<Criterion>("innovativiteit");
  protected readonly rows = signal<Row[]>([]);
  protected readonly resolve = signal<string | null>(null);
  private readonly keywords = signal<Record<string, string>>({});

  protected readonly driftRows = computed(() => this.rows().filter((r) => r.drift));

  protected color = criterionColor;
  protected fmtStand = (s: string) => `Stand ${s.padStart(2, "0")}`;
  private readonly palette = ["#4B3BF5", "#FF5A3C", "#00A7C4", "#06BE7E", "#F5A300", "#8A5BE0"];

  async ngOnInit(): Promise<void> {
    await this.store.refreshDeelnemers();
    await this.store.refreshDrift();
    const metas = await Promise.all(
      this.store
        .deelnemers()
        .map(
          async (d) => [d.standNr, (await this.store.metaFor(d.standNr))?.keyword ?? ""] as const,
        ),
    );
    this.keywords.set(Object.fromEntries(metas));
    await this.load();
  }

  protected async select(c: Criterion): Promise<void> {
    this.criterion.set(c);
    await this.load();
  }

  private async load(): Promise<void> {
    const crit = this.criterion();
    const all = await this.store.scoresForJudge(this.store.judge());
    const driftSet = new Set(
      this.store
        .driftItems()
        .filter((d) => d.criterion === crit)
        .map((d) => d.standNr),
    );
    const byStand = new Map(this.store.deelnemers().map((d) => [d.standNr, d]));
    const rows = all
      .filter((s) => s.criterion === crit && s.rankPos !== null)
      .sort((a, b) => (a.rankPos as number) - (b.rankPos as number))
      .map((s) => ({
        standNr: s.standNr,
        value: s.value,
        drift: driftSet.has(s.standNr),
        keyword: this.keywords()[s.standNr] ?? "",
        projectgroep: byStand.get(s.standNr)?.projectgroep ?? "",
      }));
    this.rows.set(rows);
  }

  protected countFor(c: Criterion): number {
    return this.store.driftItems().filter((d) => d.criterion === c).length;
  }

  protected severityFor(standNr: string): number {
    return (
      this.store.driftItems().find((d) => d.standNr === standNr && d.criterion === this.criterion())
        ?.severity ?? 1
    );
  }

  protected stillDrift(standNr: string): boolean {
    return this.store
      .driftItems()
      .some((d) => d.standNr === standNr && d.criterion === this.criterion());
  }

  protected valueFor(standNr: string): ScoreValue | null {
    return this.rows().find((r) => r.standNr === standNr)?.value ?? null;
  }

  protected kw(standNr: string): string {
    return this.keywords()[standNr] ?? "";
  }

  protected colorForStand(standNr: string): string {
    const n = Number.parseInt(standNr, 10) || standNr.length;
    return this.palette[n % this.palette.length];
  }

  protected open(standNr: string): void {
    this.resolve.set(standNr);
  }

  protected async changeValue(standNr: string, value: ScoreValue): Promise<void> {
    await this.store.updateScoreValue(this.criterion(), standNr, value);
    await this.load();
  }

  protected rankFor(standNr: string): number {
    return this.rows().findIndex((r) => r.standNr === standNr) + 1;
  }

  /** Score that makes the current placement inversion-free: clamp between neighbours' values. */
  protected suggestedValue(standNr: string): ScoreValue {
    const rows = this.rows();
    const idx = rows.findIndex((r) => r.standNr === standNr);
    const current = rows[idx]?.value ?? 3;
    const above = rows.slice(0, idx).map((r) => r.value);
    const below = rows.slice(idx + 1).map((r) => r.value);
    const hi = above.length ? Math.min(...above) : 5;
    const lo = below.length ? Math.max(...below) : 1;
    const v = Math.min(hi, Math.max(lo, current));
    return Math.min(5, Math.max(1, v)) as ScoreValue;
  }

  /** 1-based rank the project lands on when re-placed to match its score. */
  protected suggestedRank(standNr: string): number {
    const rows = this.rows();
    const value = rows.find((r) => r.standNr === standNr)?.value ?? 3;
    const others = rows
      .filter((r) => r.standNr !== standNr)
      .map((r, i) => ({ standNr: r.standNr, value: r.value, rankPos: i + 1 }));
    return bracketingAnchors(others, value).index + 1;
  }

  protected async followPlacement(standNr: string): Promise<void> {
    await this.store.updateScoreValue(this.criterion(), standNr, this.suggestedValue(standNr));
    await this.load();
  }

  protected async followScore(standNr: string): Promise<void> {
    await this.store.applyPlacement(this.criterion(), standNr, this.suggestedRank(standNr) - 1);
    await this.load();
  }

  protected go(route: string): void {
    void this.router.navigate([route]);
  }

  protected replaceIn(standNr: string): void {
    void this.router.navigate(["/compare"], {
      queryParams: { standNr, criterion: this.criterion() },
    });
  }
}
