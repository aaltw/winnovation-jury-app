import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";
import {
  CRITERIA,
  type Criterion,
  type JudgeSlot,
  type Score,
  type ScoreValue,
} from "@winnovation/domain";
import {
  AppBarComponent,
  IconComponent,
  PhotoComponent,
  SyncComponent,
  criterionColor,
  fmtStand,
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
  keyword: string;
  projectgroep: string;
  gap: number;
  ptsA: number;
  ptsB: number;
  hot: boolean;
}
interface IncompleteRow {
  standNr: string;
  keyword: string;
  projectgroep: string;
  onlyJudge: "A" | "B";
}

@Component({
  selector: "wn-reconcile",
  standalone: true,
  imports: [AppBarComponent, IconComponent, PhotoComponent, SyncComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-screen">
      <wn-app-bar title="Afstemmen" [sub]="'jij + jurylid ' + other()">
        <button slot="left" class="wv-appbar-btn" (click)="go('/home')">
          <wn-icon name="chevLeft" [size]="20" />
        </button>
        <wn-sync slot="right" state="syncing" />
      </wn-app-bar>

      <div class="wv-scroll">
        <div class="wv-pad" style="padding-top:4px">
          <p style="font-size:13px;color:var(--muted);margin:0 0 14px;line-height:1.5">
            Doe dit samen, aan het eind van de dag.
            <b style="color:var(--ink)">Grootste meningsverschillen eerst</b> — open een project,
            bespreek het verschil en pas je eigen cijfers aan met − en +. De lijst werkt live bij op
            beide telefoons. Eens? Leg dan de eindstand vast.
          </p>

          <div class="wv-list">
            @for (r of rows(); track r.standNr; let i = $index) {
              <div
                class="wv-card"
                style="padding:0;overflow:hidden"
                [style.border-color]="r.hot ? '#F4DC9E' : 'var(--line)'"
              >
                <div
                  (click)="toggle(r.standNr)"
                  style="display:flex;align-items:center;gap:11px;padding:12px;cursor:pointer"
                >
                  <span
                    style="font-family:var(--font-display);font-weight:800;font-size:17px;width:24px;text-align:center;color:var(--muted);flex:none"
                    >{{ i + 1 }}</span
                  >
                  <wn-photo
                    [keyword]="r.keyword"
                    [projectgroep]="r.projectgroep"
                    [color]="colorForStand(r.standNr)"
                    [size]="44"
                    [radius]="11"
                  />
                  <div style="flex:1;min-width:0">
                    <div
                      style="font-family:var(--font-display);font-weight:700;font-size:15.5px;line-height:1.1"
                    >
                      {{ r.keyword || fmt(r.standNr) }}
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                      <span style="font-size:11px;font-weight:700;color:var(--brand-ink)">Jij</span>
                      <div class="wv-bar" style="flex:1;max-width:80px;height:6px">
                        <span [style.width]="barW(mine(r))" style="background:var(--brand)"></span>
                      </div>
                      <span style="font-size:11px;font-weight:700;color:var(--coral)">{{ other() }}</span>
                      <div class="wv-bar" style="flex:1;max-width:80px;height:6px">
                        <span [style.width]="barW(theirs(r))" style="background:var(--coral)"></span>
                      </div>
                    </div>
                  </div>
                  @if (r.hot) {
                    <span class="wv-chip wv-chip-amber" style="flex:none">bespreken</span>
                  } @else {
                    <wn-icon
                      [name]="open() === r.standNr ? 'chevUp' : 'chevDown'"
                      [size]="18"
                      [style.color]="'var(--muted)'"
                    />
                  }
                </div>

                @if (open() === r.standNr) {
                  <div style="border-top:1px solid var(--line);padding:14px;background:var(--bg-2)">
                    <div
                      style="display:grid;grid-template-columns:1fr auto auto;gap:8px 14px;align-items:center;font-size:13px"
                    >
                      <span
                        style="font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)"
                        >Criterium</span
                      >
                      <span
                        style="font-size:10.5px;font-weight:800;color:var(--brand-ink);text-transform:uppercase"
                        >Jij</span
                      >
                      <span
                        style="font-size:10.5px;font-weight:800;color:var(--coral);text-transform:uppercase"
                        >{{ other() }}</span
                      >
                      @for (c of criteria; track c) {
                        <span style="display:flex;align-items:center;gap:7px;font-weight:600">
                          <span
                            [style.background]="color(c)"
                            style="width:9px;height:9px;border-radius:3px"
                          ></span>
                          {{ labels[c] }}
                        </span>
                        <span style="display:inline-flex;align-items:center;gap:6px">
                          <button
                            type="button"
                            (click)="bump(r.standNr, c, -1)"
                            [disabled]="numVal(r.standNr, c, me()) <= 1"
                            style="width:26px;height:26px;border-radius:8px;border:1px solid var(--line-2);background:#fff;color:var(--ink-2);font-weight:800;cursor:pointer;display:grid;place-items:center"
                          >
                            −
                          </button>
                          <span
                            [style.color]="color(c)"
                            style="font-weight:800;font-family:var(--font-display);min-width:14px;text-align:center"
                            >{{ val(r.standNr, c, me()) }}</span
                          >
                          <button
                            type="button"
                            (click)="bump(r.standNr, c, 1)"
                            [disabled]="numVal(r.standNr, c, me()) >= 5"
                            style="width:26px;height:26px;border-radius:8px;border:1px solid var(--line-2);background:#fff;color:var(--ink-2);font-weight:800;cursor:pointer;display:grid;place-items:center"
                          >
                            +
                          </button>
                        </span>
                        <span style="font-weight:800;font-family:var(--font-display);color:var(--ink-2)">{{
                          val(r.standNr, c, other())
                        }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          @if (incomplete().length) {
            <div class="wv-divider-label">
              <span class="t">Incompleet</span><span class="ln"></span>
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
        <button class="wv-btn wv-btn-primary" (click)="go('/result')">
          <wn-icon name="trophy" [size]="19" />
          Eindstand vastleggen
        </button>
      </div>
    </div>
  `,
})
export class ReconcileComponent {
  private readonly store = inject(JuryStore);
  private readonly router = inject(Router);

  protected readonly criteria = CRITERIA;
  protected readonly labels = LABELS;
  protected readonly rows = signal<Row[]>([]);
  protected readonly incomplete = signal<IncompleteRow[]>([]);
  protected readonly open = signal<string | null>(null);
  private valueMap = new Map<string, number>();

  protected readonly me = this.store.judge;
  protected readonly other = computed<JudgeSlot>(() => (this.me() === "A" ? "B" : "A"));

  protected color = criterionColor;
  protected fmt = fmtStand;
  private readonly palette = ["#4B3BF5", "#FF5A3C", "#00A7C4", "#06BE7E", "#F5A300", "#8A5BE0"];

  constructor() {
    // Re-derive the merged ranking whenever a live remote change bumps the revision.
    effect(() => {
      this.store.revision();
      void this.load();
    });
  }

  private async load(): Promise<void> {
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
    const standsB = new Set(scoresB.map((s) => s.standNr));
    this.valueMap = new Map<string, number>();
    for (const s of [
      ...scoresA.map((s) => ["A", s] as const),
      ...scoresB.map((s) => ["B", s] as const),
    ]) {
      this.valueMap.set(`${s[0]}|${s[1].standNr}|${s[1].criterion}`, s[1].value);
    }
    const pts = (scores: Score[], standNr: string): number =>
      scores
        .filter((s) => s.standNr === standNr && s.rankPos !== null)
        .reduce((sum, s) => sum + ((s.rankPos as number) - 1), 0);

    const { ranked, incomplete } = await this.store.finalRanking();
    const gaps = await this.store.disagreements();
    const maxGap = Math.max(1, ...ranked.map((r) => gaps.get(r.standNr) ?? 0));

    const rows: Row[] = ranked
      .map((r) => {
        const gap = gaps.get(r.standNr) ?? 0;
        return {
          standNr: r.standNr,
          keyword: keywords.get(r.standNr) ?? "",
          projectgroep: byStand.get(r.standNr)?.projectgroep ?? "",
          gap,
          ptsA: pts(scoresA, r.standNr),
          ptsB: pts(scoresB, r.standNr),
          hot: gap >= maxGap * 0.6 && gap > 1,
        };
      })
      .sort((a, b) => b.gap - a.gap);
    this.rows.set(rows);

    this.incomplete.set(
      incomplete.map((standNr) => ({
        standNr,
        keyword: keywords.get(standNr) ?? "",
        projectgroep: byStand.get(standNr)?.projectgroep ?? "",
        onlyJudge: standsA.has(standNr) && !standsB.has(standNr) ? "A" : "B",
      })),
    );
  }

  protected barW(pts: number): string {
    return `${100 - Math.min(90, pts * 4)}%`;
  }

  protected val(standNr: string, criterion: Criterion, judge: JudgeSlot): string {
    const v = this.valueMap.get(`${judge}|${standNr}|${criterion}`);
    return v == null ? "—" : String(v);
  }

  protected mine(r: Row): number {
    return this.me() === "A" ? r.ptsA : r.ptsB;
  }

  protected theirs(r: Row): number {
    return this.me() === "A" ? r.ptsB : r.ptsA;
  }

  protected numVal(standNr: string, criterion: Criterion, judge: JudgeSlot): number {
    return this.valueMap.get(`${judge}|${standNr}|${criterion}`) ?? 0;
  }

  protected async bump(standNr: string, criterion: Criterion, delta: number): Promise<void> {
    const cur = this.numVal(standNr, criterion, this.me());
    if (cur === 0) return;
    const next = Math.min(5, Math.max(1, cur + delta));
    if (next === cur) return;
    await this.store.updateScoreValue(criterion, standNr, next as ScoreValue);
    await this.load();
  }

  protected colorForStand(standNr: string): string {
    const n = Number.parseInt(standNr, 10) || standNr.length;
    return this.palette[n % this.palette.length];
  }

  protected toggle(standNr: string): void {
    this.open.set(this.open() === standNr ? null : standNr);
  }

  protected go(route: string): void {
    void this.router.navigate([route]);
  }
}
