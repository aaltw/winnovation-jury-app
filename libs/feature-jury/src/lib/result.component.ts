import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { CRITERIA, type Criterion, type FinalRow, toCsv } from "@winnovation/domain";
import {
  AppBarComponent,
  IconComponent,
  PhotoComponent,
  criterionColor,
  fmtStand,
} from "@winnovation/ui";
import { JuryStore } from "./jury-store";

const SHORT: Record<Criterion, string> = {
  innovativiteit: "Innov.",
  relevantie: "Relev.",
  haalbaarheid: "Haalb.",
  impact: "Impact",
};

interface RankRow {
  standNr: string;
  keyword: string;
  projectgroep: string;
  rawTotal: number;
}
interface Winner extends RankRow {
  perCriterion: { criterion: Criterion; total: number }[];
}
interface IncompleteRow {
  standNr: string;
  keyword: string;
  projectgroep: string;
  onlyJudge: "A" | "B";
}

@Component({
  selector: "wn-result",
  standalone: true,
  imports: [AppBarComponent, IconComponent, PhotoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-screen">
      <wn-app-bar title="Uitslag" sub="definitief">
        <button slot="left" class="wv-appbar-btn" (click)="go('/reconcile')">
          <wn-icon name="chevLeft" [size]="20" />
        </button>
        <button slot="right" class="wv-appbar-btn" (click)="share()">
          <wn-icon name="share" [size]="19" />
        </button>
      </wn-app-bar>

      <div class="wv-scroll">
        <div class="wv-pad" style="padding-top:2px">
          @if (winner(); as w) {
            <div
              style="position:relative;border-radius:22px;padding:22px 18px;margin-bottom:8px;overflow:hidden;background:linear-gradient(135deg, var(--ink) 0%, #24202E 60%, #2E1F2A 100%);color:#fff"
            >
              <div style="position:absolute;top:-30px;right:-20px;opacity:.12;transform:rotate(8deg)">
                <wn-icon name="trophy" [size]="150" [stroke]="1" />
              </div>
              <div
                style="display:inline-flex;align-items:center;gap:7px;background:var(--coral);color:#fff;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.03em"
              >
                <wn-icon name="trophy" [size]="14" />
                WINNAAR
              </div>
              <div style="display:flex;align-items:center;gap:13px;margin-top:16px;position:relative">
                <wn-photo
                  [keyword]="w.keyword"
                  [projectgroep]="w.projectgroep"
                  [color]="colorForStand(w.standNr)"
                  [size]="60"
                  [radius]="15"
                />
                <div style="min-width:0">
                  <div
                    style="font-family:var(--font-display);font-weight:800;font-size:24px;line-height:1.08;letter-spacing:-0.02em"
                  >
                    {{ w.keyword || fmt(w.standNr) }}
                  </div>
                  <div style="font-size:13px;color:rgba(255,255,255,.6);margin-top:6px">
                    {{ w.projectgroep }} · {{ fmt(w.standNr) }}
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:16px;margin-top:16px;position:relative">
                @for (pc of w.perCriterion; track pc.criterion) {
                  <div>
                    <div style="font-family:var(--font-display);font-weight:800;font-size:18px;color:#fff">
                      {{ pc.total }}
                    </div>
                    <div
                      style="font-size:9.5px;color:rgba(255,255,255,.5);font-weight:700;text-transform:uppercase;letter-spacing:.03em;margin-top:2px"
                    >
                      {{ short[pc.criterion] }}
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <div class="wv-divider-label">
            <span class="t">Eindklassement</span><span class="ln"></span>
          </div>
          <div class="wv-list">
            @for (r of rest(); track r.standNr; let i = $index) {
              <div
                style="display:flex;align-items:center;gap:11px;padding:10px 12px;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh-card)"
              >
                <span
                  style="font-family:var(--font-display);font-weight:800;font-size:18px;width:26px;text-align:center;color:var(--muted);flex:none"
                  >{{ i + 2 }}</span
                >
                <wn-photo
                  [keyword]="r.keyword"
                  [projectgroep]="r.projectgroep"
                  [color]="colorForStand(r.standNr)"
                  [size]="42"
                  [radius]="11"
                />
                <div style="flex:1;min-width:0">
                  <div style="font-family:var(--font-display);font-weight:700;font-size:15px">
                    {{ r.keyword || fmt(r.standNr) }}
                  </div>
                  <div style="font-size:12px;color:var(--muted)">{{ r.projectgroep }}</div>
                </div>
                <div style="text-align:right;flex:none">
                  <div style="font-family:var(--font-display);font-weight:800;font-size:18px">
                    {{ r.rawTotal }}
                  </div>
                  <div
                    style="font-size:9.5px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.03em"
                  >
                    punten
                  </div>
                </div>
              </div>
            }
          </div>

          @if (incomplete().length) {
            <div class="wv-divider-label">
              <span class="t">Niet meegeteld</span><span class="ln"></span>
              <span style="font-size:11px;color:var(--muted)">1 jurylid</span>
            </div>
            <div class="wv-list">
              @for (r of incomplete(); track r.standNr) {
                <div
                  style="display:flex;align-items:center;gap:13px;padding:12px;background:#fff;border:1px solid var(--line);border-radius:14px"
                >
                  <wn-photo
                    [keyword]="r.keyword"
                    [projectgroep]="r.projectgroep"
                    [color]="colorForStand(r.standNr)"
                    [size]="44"
                    [radius]="11"
                  />
                  <div style="flex:1;min-width:0">
                    <div style="font-family:var(--font-display);font-weight:700;font-size:15px">
                      {{ r.keyword || fmt(r.standNr) }}
                    </div>
                    <div style="font-size:12px;color:var(--muted)">{{ r.projectgroep }}</div>
                  </div>
                  <span class="wv-chip wv-chip-line"
                    >{{ r.onlyJudge === "A" ? "Alleen jij" : "Alleen B" }}</span
                  >
                </div>
              }
            </div>
          }
          <div style="height:8px"></div>
        </div>
      </div>

      <div class="wv-dock bordered">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="wv-btn wv-btn-ghost" (click)="exportCsv()">
            <wn-icon name="download" [size]="19" />
            CSV
          </button>
          <button class="wv-btn wv-btn-primary" (click)="share()">
            <wn-icon name="share" [size]="19" />
            Deel uitslag
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ResultComponent {
  private readonly store = inject(JuryStore);
  private readonly router = inject(Router);

  protected readonly short = SHORT;
  protected readonly winner = signal<Winner | null>(null);
  protected readonly rest = signal<RankRow[]>([]);
  protected readonly incomplete = signal<IncompleteRow[]>([]);
  private ranked: FinalRow[] = [];

  protected fmt = fmtStand;
  protected color = criterionColor;
  private readonly palette = ["#4B3BF5", "#FF5A3C", "#00A7C4", "#06BE7E", "#F5A300", "#8A5BE0"];

  async ngOnInit(): Promise<void> {
    await this.store.refreshDeelnemers();
    const byStand = new Map(this.store.deelnemers().map((d) => [d.standNr, d]));
    const keywords = new Map(
      await Promise.all(
        this.store
          .deelnemers()
          .map(
            async (d) => [d.standNr, (await this.store.metaFor(d.standNr))?.keyword ?? ""] as const,
          ),
      ),
    );
    const [scoresA, scoresB] = await Promise.all([
      this.store.scoresForJudge("A"),
      this.store.scoresForJudge("B"),
    ]);
    const standsA = new Set(scoresA.map((s) => s.standNr));
    const valueMap = new Map<string, number>();
    for (const [judge, list] of [
      ["A", scoresA],
      ["B", scoresB],
    ] as const) {
      for (const s of list) {
        valueMap.set(`${judge}|${s.standNr}|${s.criterion}`, s.value);
      }
    }
    const combined = (standNr: string, criterion: Criterion): number =>
      (valueMap.get(`A|${standNr}|${criterion}`) ?? 0) +
      (valueMap.get(`B|${standNr}|${criterion}`) ?? 0);

    const { ranked, incomplete } = await this.store.finalRanking();
    this.ranked = ranked;

    const row = (r: FinalRow): RankRow => ({
      standNr: r.standNr,
      keyword: keywords.get(r.standNr) ?? "",
      projectgroep: byStand.get(r.standNr)?.projectgroep ?? "",
      rawTotal: r.rawTotal,
    });

    if (ranked.length) {
      this.winner.set({
        ...row(ranked[0]),
        perCriterion: CRITERIA.map((c) => ({
          criterion: c,
          total: combined(ranked[0].standNr, c),
        })),
      });
      this.rest.set(ranked.slice(1).map(row));
    }
    this.incomplete.set(
      incomplete.map((standNr) => ({
        standNr,
        keyword: keywords.get(standNr) ?? "",
        projectgroep: byStand.get(standNr)?.projectgroep ?? "",
        onlyJudge: standsA.has(standNr) ? "A" : "B",
      })),
    );
  }

  protected colorForStand(standNr: string): string {
    const n = Number.parseInt(standNr, 10) || standNr.length;
    return this.palette[n % this.palette.length];
  }

  private csvFile(): File {
    return new File([toCsv(this.ranked)], "winnovation-uitslag.csv", { type: "text/csv" });
  }

  protected async share(): Promise<void> {
    const file = this.csvFile();
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Winnovation uitslag" });
    } else {
      this.download(file);
    }
  }

  protected exportCsv(): void {
    this.download(this.csvFile());
  }

  private download(file: File): void {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected go(route: string): void {
    void this.router.navigate([route]);
  }
}
