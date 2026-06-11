import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import {
  CRITERIA,
  type CaptureMeta,
  type Criterion,
  type FinalRow,
  type JudgeSlot,
  breakTie,
  competitionPositions,
  toCsv,
} from "@winnovation/domain";
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
  pos: number;
  tied: boolean;
}
interface CritWinner {
  criterion: Criterion;
  standNr: string;
  keyword: string;
  projectgroep: string;
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
  imports: [AppBarComponent, IconComponent, NgTemplateOutlet, PhotoComponent],
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
                {{ w.tied ? "GEDEELDE WINNAAR" : "WINNAAR" }}
              </div>
              @if (tieReason(); as reason) {
                <div
                  style="position:relative;margin-top:10px;font-size:12px;color:rgba(255,255,255,.65);line-height:1.45"
                >
                  {{ reason }}
                </div>
              }
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
              <div
                (click)="toggle(w.standNr)"
                style="display:flex;gap:16px;margin-top:16px;position:relative;cursor:pointer"
              >
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
            @if (expanded() === w.standNr) {
              <div
                style="border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--bg-2);margin-bottom:8px"
              >
                <ng-container *ngTemplateOutlet="notesPanel; context: { standNr: w.standNr }" />
              </div>
            }
          }

          @if (tieOptions().length) {
            <div
              style="border:1.5px solid var(--amber);border-radius:14px;padding:14px;background:var(--amber-soft);margin-bottom:14px"
            >
              <div style="font-weight:800;font-size:14px;color:var(--amber-ink)">
                Gelijkspel op de eerste plaats
              </div>
              <div style="font-size:12.5px;color:var(--amber-ink);line-height:1.5;margin:4px 0 10px">
                Geen rekenregel geeft de doorslag — bespreek het samen en kies de winnaar. De keuze
                verschijnt op beide telefoons.
              </div>
              <div style="display:grid;gap:8px">
                @for (t of tieOptions(); track t.standNr) {
                  <button
                    type="button"
                    (click)="decide(t.standNr)"
                    style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;border:1px solid var(--line-2);background:#fff;cursor:pointer;text-align:left;font-weight:700;font-size:14px"
                  >
                    <wn-icon name="trophy" [size]="16" [style.color]="'var(--amber-ink)'" />
                    {{ t.keyword || fmt(t.standNr) }}
                    <span style="font-weight:500;font-size:12px;color:var(--muted)">{{
                      t.projectgroep
                    }}</span>
                  </button>
                }
              </div>
            </div>
          }

          @if (critWinners().length) {
            <div class="wv-divider-label">
              <span class="t">Beste per criterium</span><span class="ln"></span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
              @for (cw of critWinners(); track cw.criterion) {
                <div
                  style="display:flex;align-items:center;gap:9px;padding:9px 10px;background:#fff;border:1px solid var(--line);border-radius:12px;min-width:0"
                >
                  <span
                    [style.background]="color(cw.criterion)"
                    style="width:9px;height:9px;border-radius:3px;flex:none"
                  ></span>
                  <div style="min-width:0">
                    <div
                      style="font-size:9.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--muted)"
                    >
                      {{ short[cw.criterion] }}
                    </div>
                    <div
                      style="font-family:var(--font-display);font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                    >
                      {{ cw.keyword || fmt(cw.standNr) }}
                    </div>
                  </div>
                </div>
              }
            </div>
          }

          <div class="wv-divider-label">
            <span class="t">Eindklassement</span><span class="ln"></span>
          </div>
          <div class="wv-list">
            @for (r of rest(); track r.standNr; let i = $index) {
              <div
                style="background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh-card);overflow:hidden"
              >
                <div
                  (click)="toggle(r.standNr)"
                  style="display:flex;align-items:center;gap:11px;padding:10px 12px;cursor:pointer"
                >
                  <span
                    style="width:26px;text-align:center;flex:none"
                  >
                    <span
                      style="font-family:var(--font-display);font-weight:800;font-size:18px;color:var(--muted)"
                      >{{ r.pos }}</span
                    >
                    @if (r.tied) {
                      <span style="display:block;font-size:8.5px;font-weight:800;color:var(--amber-ink);text-transform:uppercase;letter-spacing:.02em"
                        >gedeeld</span
                      >
                    }
                  </span>
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
                @if (expanded() === r.standNr) {
                  <div style="border-top:1px solid var(--line);padding:12px;background:var(--bg-2)">
                    <ng-container
                      *ngTemplateOutlet="notesPanel; context: { standNr: r.standNr }"
                    />
                  </div>
                }
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
        <button class="wv-btn wv-btn-ghost" (click)="shareStory()" style="margin-bottom:10px">
          <wn-icon name="share" [size]="19" />
          {{ storyCopied() ? "Gekopieerd — plak in Gemini" : "Juryverhaal (voor Gemini)" }}
        </button>
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

      <ng-template #notesPanel let-standNr="standNr">
        @for (judge of judges; track judge) {
          <div style="margin-bottom:10px">
            <div
              style="font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:4px"
            >
              {{ judge === myJudge() ? "Jij" : "Jurylid " + judge }}
            </div>
            @if (metaOf(standNr, judge); as m) {
              @if (m.note) {
                <div style="font-size:13px;line-height:1.5;margin-bottom:3px">
                  <b style="font-size:11px;color:var(--muted)">Notitie</b> — {{ m.note }}
                </div>
              }
              @if (m.review) {
                <div style="font-size:13px;line-height:1.5;margin-bottom:3px">
                  <b style="font-size:11px;color:var(--muted)">Review</b> — {{ m.review }}
                </div>
              }
              @for (c of criteria; track c) {
                @if (m.criterionNotes?.[c]; as cn) {
                  <div style="font-size:12.5px;line-height:1.5;color:var(--ink-2)">
                    <b [style.color]="color(c)" style="font-size:11px">{{ short[c] }}</b> — {{ cn }}
                  </div>
                }
              }
              @if (!m.note && !m.review && !hasCriterionNotes(m)) {
                <div style="font-size:12.5px;color:var(--muted)">Geen notities</div>
              }
            } @else {
              <div style="font-size:12.5px;color:var(--muted)">Geen notities</div>
            }
          </div>
        }
      </ng-template>
    </div>
  `,
})
export class ResultComponent {
  private readonly store = inject(JuryStore);
  private readonly router = inject(Router);

  protected readonly short = SHORT;
  protected readonly criteria = CRITERIA;
  protected readonly judges: JudgeSlot[] = ["A", "B"];
  protected readonly winner = signal<Winner | null>(null);
  protected readonly rest = signal<RankRow[]>([]);
  protected readonly critWinners = signal<CritWinner[]>([]);
  protected readonly tieReason = signal<string | null>(null);
  protected readonly tieOptions = signal<
    { standNr: string; keyword: string; projectgroep: string }[]
  >([]);
  protected readonly incomplete = signal<IncompleteRow[]>([]);
  protected readonly expanded = signal<string | null>(null);
  protected readonly storyCopied = signal(false);
  protected readonly myJudge = this.store.judge;
  private readonly metas = signal<Record<string, Partial<Record<JudgeSlot, CaptureMeta>>>>({});
  private ranked: FinalRow[] = [];

  protected fmt = fmtStand;
  protected color = criterionColor;
  private readonly palette = ["#4B3BF5", "#FF5A3C", "#00A7C4", "#06BE7E", "#F5A300", "#8A5BE0"];

  constructor() {
    // Re-derive the final ranking whenever a live remote change bumps the revision.
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
    this.metas.set(
      Object.fromEntries(
        await Promise.all(
          this.store.deelnemers().map(
            async (d) =>
              [
                d.standNr,
                {
                  A: await this.store.metaFor(d.standNr, "A"),
                  B: await this.store.metaFor(d.standNr, "B"),
                },
              ] as const,
          ),
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

    // A tie on the #1 spot is resolved by the cascade in `breakTie`
    // (criterium-zeges → totaalpunten → eerste plaatsen); when every rule
    // draws, the jury chooses manually and that choice syncs to both phones.
    const name = (standNr: string): string => keywords.get(standNr) || fmtStand(standNr);
    const topTied = ranked.filter((r) => r.overall === ranked[0]?.overall);
    let order = ranked;
    let reason: string | null = null;
    let resolved = false;
    let options: FinalRow[] = [];
    if (topTied.length > 1) {
      const decision = await this.store.tieDecision();
      const winnerFirst = (standNr: string): FinalRow[] => [
        ...ranked.filter((r) => r.standNr === standNr),
        ...ranked.filter((r) => r.standNr !== standNr),
      ];
      if (decision && topTied.some((t) => t.standNr === decision)) {
        order = winnerFirst(decision);
        reason = "Gelijkspel — winnaar samen gekozen door de jury";
        resolved = true;
      } else if (topTied.length === 2) {
        const tb = breakTie(topTied[0], topTied[1], scoresA, scoresB);
        if (tb.winner && tb.tally) {
          order = winnerFirst(tb.winner);
          const loser = topTied.find((t) => t.standNr !== tb.winner) as FinalRow;
          const rule = {
            criteria: "criterium-zeges",
            punten: "totaalpunten",
            eerstePlaatsen: "eerste plaatsen",
          }[tb.rule as "criteria" | "punten" | "eerstePlaatsen"];
          reason = `Wint het gelijkspel met ${name(loser.standNr)} op ${rule} (${tb.tally[0]}–${tb.tally[1]})`;
          resolved = true;
        } else {
          options = topTied;
        }
      } else {
        options = topTied;
      }
    }
    this.ranked = order;
    this.tieReason.set(reason);
    this.tieOptions.set(
      options.map((r) => ({
        standNr: r.standNr,
        keyword: keywords.get(r.standNr) ?? "",
        projectgroep: byStand.get(r.standNr)?.projectgroep ?? "",
      })),
    );

    // Competition ranking (1, 2, 2, 4); when the #1 tie is resolved the
    // winner takes 1 alone and the other tied projects share 2.
    const positions = competitionPositions(order);
    const tiedFlags = order.map(
      (r, i) =>
        (i > 0 && r.overall === order[i - 1].overall) ||
        (i < order.length - 1 && r.overall === order[i + 1].overall),
    );
    if (resolved) {
      tiedFlags[0] = false;
      for (let i = 1; i < topTied.length; i++) {
        positions[i] = 2;
        tiedFlags[i] = topTied.length > 2;
      }
    }

    const row = (r: FinalRow, i: number): RankRow => ({
      standNr: r.standNr,
      keyword: keywords.get(r.standNr) ?? "",
      projectgroep: byStand.get(r.standNr)?.projectgroep ?? "",
      rawTotal: r.rawTotal,
      pos: positions[i],
      tied: tiedFlags[i],
    });

    if (order.length) {
      this.winner.set({
        ...row(order[0], 0),
        perCriterion: CRITERIA.map((c) => ({
          criterion: c,
          total: combined(order[0].standNr, c),
        })),
      });
      this.rest.set(order.slice(1).map((r, i) => row(r, i + 1)));
      this.critWinners.set(
        CRITERIA.map((c) => {
          const best = ranked.reduce((a, b) =>
            b.mergedByCriterion[c] < a.mergedByCriterion[c] ? b : a,
          );
          return {
            criterion: c,
            standNr: best.standNr,
            keyword: keywords.get(best.standNr) ?? "",
            projectgroep: byStand.get(best.standNr)?.projectgroep ?? "",
          };
        }),
      );
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

  protected toggle(standNr: string): void {
    this.expanded.set(this.expanded() === standNr ? null : standNr);
  }

  protected async decide(standNr: string): Promise<void> {
    await this.store.decideTie(standNr);
    await this.load();
  }

  protected metaOf(standNr: string, judge: JudgeSlot): CaptureMeta | undefined {
    return this.metas()[standNr]?.[judge];
  }

  protected hasCriterionNotes(m: CaptureMeta): boolean {
    return Object.values(m.criterionNotes ?? {}).some((n) => !!n);
  }

  /** Dutch prompt for Gemini: data + instructions for an exciting award-ceremony story. */
  private buildStoryPrompt(): string {
    const w = this.winner();
    const lines: string[] = [];
    const all = w ? [w, ...this.rest()] : [];
    for (const r of all) {
      lines.push(
        `\n## ${r.pos}.${r.tied ? " (gedeeld)" : ""} ${r.keyword || fmtStand(r.standNr)} (${r.projectgroep}, ${fmtStand(r.standNr)}) — ${r.rawTotal} punten`,
      );
      for (const judge of this.judges) {
        const m = this.metaOf(r.standNr, judge);
        if (!m) continue;
        if (m.note) lines.push(`- Jurylid ${judge}, notitie: ${m.note}`);
        if (m.review) lines.push(`- Jurylid ${judge}, feedback voor het team: ${m.review}`);
        for (const c of CRITERIA) {
          const cn = m.criterionNotes?.[c];
          if (cn) lines.push(`- Jurylid ${judge}, over ${c}: ${cn}`);
        }
      }
    }
    return [
      "Jij bent de jury van Winnovation, een innovatie-wedstrijd voor studententeams.",
      "Schrijf een kort juryverhaal in het Nederlands om voor te lezen bij de prijsuitreiking (±2 minuten).",
      "Maak het spannend: bouw op naar de winnaar, die je pas aan het einde onthult.",
      "Noem elk project met iets oprecht positiefs en verwerk de observaties van de juryleden op een natuurlijke manier — citeer cijfers niet letterlijk.",
      "Sluit af met een felicitatie aan de winnaar en een compliment aan alle teams.",
      ...(this.tieReason()
        ? [
            `Bijzonderheid: de eerste plaats was een gelijkspel. ${this.tieReason()}. Benoem dit als spannend detail.`,
          ]
        : []),
      ...(all.some((r) => r.tied)
        ? [
            "Posities gemarkeerd met (gedeeld) zijn gedeelde plaatsen — behandel ze als gelijkwaardig.",
          ]
        : []),
      "\n# Jurydata (gesorteerd op eindklassement, 1 = winnaar)",
      ...lines,
    ].join("\n");
  }

  protected async shareStory(): Promise<void> {
    const text = this.buildStoryPrompt();
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ text })) {
      await navigator.share({ text, title: "Winnovation juryverhaal" });
    } else {
      await navigator.clipboard.writeText(text);
      this.storyCopied.set(true);
      setTimeout(() => this.storyCopied.set(false), 4000);
    }
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
