import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  type Anchors,
  CRITERIA,
  type Criterion,
  type ScoreValue,
  bracketingAnchors,
} from "@winnovation/domain";
import {
  AnchorCardComponent,
  EmptyComponent,
  IconComponent,
  PhotoComponent,
  SyncComponent,
  criterionColor,
  fmtStand,
} from "@winnovation/ui";
import { JuryStore } from "./jury-store";

interface Task {
  standNr: string;
  criterion: Criterion;
  value: ScoreValue;
}

const SHORT: Record<Criterion, string> = {
  innovativiteit: "Innov.",
  relevantie: "Relev.",
  haalbaarheid: "Haalb.",
  impact: "Impact",
};
const LABELS: Record<Criterion, string> = {
  innovativiteit: "Innovativiteit",
  relevantie: "Relevantie",
  haalbaarheid: "Haalbaarheid",
  impact: "Impact",
};

@Component({
  selector: "wn-compare",
  standalone: true,
  imports: [AnchorCardComponent, EmptyComponent, IconComponent, PhotoComponent, SyncComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-screen">
      <div class="wv-appbar" style="padding-bottom:10px">
        <button class="wv-appbar-btn" (click)="go('/home')">
          <wn-icon name="chevLeft" [size]="20" />
        </button>
        <h2 style="font-size:19px">Vergelijken</h2>
        <wn-sync [state]="store.syncState()" />
      </div>

      @if (current(); as t) {
        <div style="display:flex;gap:6px;padding:0 20px 12px">
          @for (c of criteria; track c) {
            <div
              style="flex:1;display:flex;flex-direction:column;gap:5px;align-items:center"
              [style.opacity]="isPlaced(t.standNr, c) || c === t.criterion ? 1 : 0.4"
            >
              <div
                style="height:5px;width:100%;border-radius:999px"
                [style.background]="
                  isPlaced(t.standNr, c) || c === t.criterion ? color(c) : 'var(--line-2)'
                "
              ></div>
              <span
                style="font-size:9.5px;font-weight:700"
                [style.color]="c === t.criterion ? color(c) : 'var(--muted)'"
                >{{ short[c] }}</span
              >
            </div>
          }
        </div>

        <div class="wv-scroll" style="display:flex;flex-direction:column">
          <div class="wv-pad" style="flex:1;display:flex;flex-direction:column;padding-top:8px">
            <div style="text-align:center;margin-bottom:12px">
              <div class="wv-eyebrow">Waar past dit project?</div>
              <div style="font-size:12.5px;color:var(--muted);margin-top:3px">
                op <b [style.color]="color(t.criterion)">{{ labels[t.criterion] }}</b> — t.o.v. wat je
                al zag
              </div>
            </div>

            <div style="flex:1;display:flex;flex-direction:column;gap:9px;justify-content:center">
              <wn-anchor-card
                label="hoger"
                [criterion]="t.criterion"
                [color]="color(t.criterion)"
                [standNr]="anchors()?.above?.standNr ?? ''"
                [keyword]="kw(anchors()?.above?.standNr)"
                [projectgroep]="pg(anchors()?.above?.standNr)"
                [score]="anchors()?.above?.value ?? null"
              />

              <div
                [style.border]="'2px solid ' + color(t.criterion)"
                [style.box-shadow]="'0 4px 18px ' + color(t.criterion) + '22'"
                style="background:#fff;border-radius:18px;padding:14px;display:flex;align-items:center;gap:13px"
              >
                <wn-photo
                  [keyword]="kw(t.standNr)"
                  [projectgroep]="pg(t.standNr)"
                  [color]="colorForStand(t.standNr)"
                  [size]="52"
                  [radius]="13"
                />
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:7px">
                    <span class="wv-chip wv-chip-stand" style="font-size:10px;padding:2px 7px">{{
                      fmt(t.standNr)
                    }}</span>
                    @if (isVervolg(t.standNr)) {
                      <wn-icon name="leaf" [size]="13" fill="var(--mint)" />
                    }
                  </div>
                  <div
                    style="font-family:var(--font-display);font-weight:800;font-size:19px;line-height:1.1;margin-top:3px;letter-spacing:-0.01em"
                  >
                    {{ kw(t.standNr) || fmt(t.standNr) }}
                  </div>
                  <div style="font-size:12.5px;color:var(--muted)">{{ pg(t.standNr) }}</div>
                </div>
                <div style="text-align:center;flex:none;padding-left:6px">
                  <div
                    [style.color]="color(t.criterion)"
                    style="font-family:var(--font-display);font-weight:800;font-size:30px;line-height:1"
                  >
                    {{ t.value }}
                  </div>
                  <div
                    style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:2px"
                  >
                    jouw cijfer
                  </div>
                </div>
              </div>

              <wn-anchor-card
                label="lager"
                [criterion]="t.criterion"
                [color]="color(t.criterion)"
                [standNr]="anchors()?.below?.standNr ?? ''"
                [keyword]="kw(anchors()?.below?.standNr)"
                [projectgroep]="pg(anchors()?.below?.standNr)"
                [score]="anchors()?.below?.value ?? null"
              />

              <div style="display:grid;gap:8px;margin-top:6px">
                @if (anchors(); as a) {
                  @if (!a.above && !a.below) {
                    <!-- First/only project on this criterion: nothing to compare yet. -->
                    <button
                      class="wv-btn"
                      [style.background]="color(t.criterion)"
                      [style.box-shadow]="'0 6px 16px ' + color(t.criterion) + '44'"
                      style="color:#fff"
                      (click)="decide('tussen')"
                    >
                      <wn-icon name="check" [size]="18" />
                      Plaatsen
                    </button>
                  } @else {
                    @if (a.above && a.below) {
                      <button
                        class="wv-btn"
                        [style.background]="color(t.criterion)"
                        [style.box-shadow]="'0 6px 16px ' + color(t.criterion) + '44'"
                        style="color:#fff"
                        (click)="decide('tussen')"
                      >
                        <wn-icon name="arrowRight" [size]="18" />
                        Hier tussen plaatsen
                      </button>
                    }
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                      <button class="wv-btn wv-btn-ghost" (click)="decide('boven')">
                        <wn-icon name="chevUp" [size]="18" />
                        {{ a.above ? "Hoger" : "Bovenaan" }}
                      </button>
                      <button class="wv-btn wv-btn-ghost" (click)="decide('onder')">
                        <wn-icon name="chevDown" [size]="18" />
                        {{ a.below ? "Lager" : "Onderaan" }}
                      </button>
                    </div>
                  }
                }
                @if (history().length) {
                  <button
                    class="wv-btn-link"
                    (click)="back()"
                    style="justify-self:center;margin-top:2px;display:inline-flex;align-items:center;gap:4px"
                  >
                    <wn-icon name="chevLeft" [size]="15" />
                    Vorige stap
                  </button>
                }
              </div>
            </div>
          </div>
        </div>

        <div class="wv-dock bordered" style="padding-top:8px">
          <div
            style="display:flex;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--muted)"
          >
            <span
              ><b style="color:var(--ink)">{{ remaining() }}</b> project{{
                remaining() === 1 ? "" : "en"
              }}
              te plaatsen</span
            >
            <button class="wv-btn-link" (click)="go('/home')">Later afmaken</button>
          </div>
        </div>
      } @else {
        <div class="wv-scroll" style="display:flex;align-items:center">
          <div style="margin:auto;width:100%">
            <wn-empty [clean]="true" title="Alles geplaatst">
              Elk project staat op zijn plek in alle vier de criteria. Door naar de volgende stand,
              of rond af vanaf home.
            </wn-empty>
          </div>
        </div>
        <div class="wv-dock bordered">
          @if (history().length) {
            <button class="wv-btn wv-btn-ghost" (click)="back()">
              <wn-icon name="chevLeft" [size]="19" />
              Vorige stap herzien
            </button>
          }
          <button class="wv-btn wv-btn-primary" (click)="go('/stand')">
            <wn-icon name="plus" [size]="19" />
            Volgende deelnemer
          </button>
          <button class="wv-btn wv-btn-ghost" (click)="go('/home')">Naar home</button>
        </div>
      }
    </div>
  `,
})
export class CompareComponent {
  protected readonly store = inject(JuryStore);
  private readonly router = inject(Router);

  protected readonly criteria = CRITERIA;
  protected readonly short = SHORT;
  protected readonly labels = LABELS;
  protected readonly queue = signal<Task[]>([]);
  protected readonly current = signal<Task | null>(null);
  protected readonly anchors = signal<Anchors | null>(null);
  // Decided tasks, newest last — lets the juror step back and re-place.
  protected readonly history = signal<Task[]>([]);
  private readonly keywords = signal<Record<string, string>>({});

  protected readonly remaining = computed(() => {
    const set = new Set(this.queue().map((t) => t.standNr));
    const cur = this.current();
    if (cur) {
      set.add(cur.standNr);
    }
    return set.size;
  });

  protected color = criterionColor;
  protected fmt = fmtStand;
  private readonly palette = ["#4B3BF5", "#FF5A3C", "#00A7C4", "#06BE7E", "#F5A300", "#8A5BE0"];

  // Arriving from "Liever herplaatsen" on Nakijken: re-open this already-placed score.
  private readonly replace = (() => {
    const qp = inject(ActivatedRoute).snapshot.queryParamMap;
    const standNr = qp.get("standNr");
    const criterion = qp.get("criterion") as Criterion | null;
    return standNr && criterion && CRITERIA.includes(criterion) ? { standNr, criterion } : null;
  })();

  protected colorForStand(standNr: string): string {
    const n = Number.parseInt(standNr, 10) || standNr.length;
    return this.palette[n % this.palette.length];
  }

  async ngOnInit(): Promise<void> {
    await this.store.refreshDeelnemers();
    const metas = await Promise.all(
      this.store
        .deelnemers()
        .map(
          async (d) => [d.standNr, (await this.store.metaFor(d.standNr))?.keyword ?? ""] as const,
        ),
    );
    this.keywords.set(Object.fromEntries(metas));

    const all = await this.store.scoresForJudge(this.store.judge());
    const order = new Map(this.store.deelnemers().map((d, i) => [d.standNr, i]));
    const tasks = all
      .filter((s) => s.rankPos === null)
      .sort(
        (a, b) =>
          (order.get(a.standNr) ?? 99) - (order.get(b.standNr) ?? 99) ||
          CRITERIA.indexOf(a.criterion) - CRITERIA.indexOf(b.criterion),
      )
      .map((s) => ({ standNr: s.standNr, criterion: s.criterion, value: s.value }));
    if (this.replace) {
      const score = all.find(
        (s) => s.standNr === this.replace?.standNr && s.criterion === this.replace?.criterion,
      );
      if (score) {
        tasks.unshift({ standNr: score.standNr, criterion: score.criterion, value: score.value });
      }
    }
    this.queue.set(tasks);
    await this.advance();
  }

  private async advance(): Promise<void> {
    const [next, ...rest] = this.queue();
    this.queue.set(rest);
    this.current.set(next ?? null);
    await this.setAnchors(next ?? null);
  }

  /** Anchors for `task`, excluding its own (possibly already-placed) row so a
   * re-visited placement compares against the *other* projects, not itself. */
  private async setAnchors(task: Task | null): Promise<void> {
    if (!task) {
      this.anchors.set(null);
      return;
    }
    const others = (await this.store.placedFor(task.criterion)).filter(
      (p) => p.standNr !== task.standNr,
    );
    this.anchors.set(bracketingAnchors(others, task.value));
  }

  /** Step back to the previously decided task and re-open it for placement. */
  protected async back(): Promise<void> {
    const hist = this.history();
    if (!hist.length) return;
    const prev = hist[hist.length - 1];
    this.history.set(hist.slice(0, -1));
    const cur = this.current();
    this.queue.update((q) => (cur ? [cur, ...q] : q));
    this.current.set(prev);
    await this.setAnchors(prev);
  }

  protected async decide(where: "boven" | "tussen" | "onder"): Promise<void> {
    const t = this.current();
    const a = this.anchors();
    if (!t || !a) {
      return;
    }
    const index =
      where === "boven"
        ? a.above
          ? Math.max(0, a.index - 1)
          : 0
        : where === "tussen"
          ? a.index
          : a.below
            ? a.index + 1
            : a.index;
    await this.store.applyPlacement(t.criterion, t.standNr, index);
    this.history.update((h) => [...h, t]);
    await this.advance();
  }

  protected isPlaced(standNr: string, criterion: Criterion): boolean {
    return this.store
      .scores()
      .some((s) => s.standNr === standNr && s.criterion === criterion && s.rankPos !== null);
  }

  protected kw(standNr: string | undefined): string {
    return standNr ? (this.keywords()[standNr] ?? "") : "";
  }

  protected pg(standNr: string | undefined): string {
    return standNr
      ? (this.store.deelnemers().find((d) => d.standNr === standNr)?.projectgroep ?? "")
      : "";
  }

  protected isVervolg(standNr: string): boolean {
    return this.store.deelnemers().find((d) => d.standNr === standNr)?.isVervolgproject ?? false;
  }

  protected go(route: string): void {
    void this.router.navigate([route]);
  }
}
