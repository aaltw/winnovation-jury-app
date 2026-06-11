import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  type OnInit,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { CRITERIA, type Criterion, type ScoreValue } from "@winnovation/domain";
import {
  AppBarComponent,
  BannerComponent,
  CRITERION_QUESTIONS,
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

@Component({
  selector: "wn-stand",
  standalone: true,
  imports: [
    FormsModule,
    AppBarComponent,
    BannerComponent,
    IconComponent,
    ScoreInputComponent,
    SyncComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-screen">
      <wn-app-bar
        [title]="editing() ? 'Deelnemer bewerken' : 'Nieuwe deelnemer'"
        [sub]="scoredCount() + '/4 criteria · < 1 min'"
        [bordered]="true"
      >
        <button slot="left" class="wv-appbar-btn" (click)="back()">
          <wn-icon name="chevLeft" [size]="20" />
        </button>
        <wn-sync slot="right" [state]="store.syncState()" />
      </wn-app-bar>

      <div class="wv-scroll">
        <div class="wv-pad">
          <div style="display:grid;grid-template-columns:110px 1fr;gap:10px;margin-bottom:16px">
            <div>
              <label class="wv-label">Stand nr <span class="req">*</span></label>
              <input
                class="wv-input big"
                inputmode="numeric"
                placeholder="00"
                [ngModel]="standNr()"
                (ngModelChange)="standNr.set($any($event).replace(/\\D/g, '').slice(0, 2))"
                style="text-align:center"
              />
            </div>
            <div>
              <label class="wv-label">Projectgroep</label>
              <input
                class="wv-input"
                placeholder="Teamnaam"
                [ngModel]="projectgroep()"
                (ngModelChange)="projectgroep.set($event)"
              />
            </div>
          </div>

          <div class="wv-field">
            <label class="wv-label"
              >Keyword <span class="req">*</span>
              <span class="opt">— 1–3 woorden, je geheugensteun</span></label
            >
            <input
              class="wv-input big"
              placeholder="bv. Slimme watermeter"
              maxlength="28"
              [ngModel]="keyword()"
              (ngModelChange)="keyword.set($event)"
            />
          </div>

          <label
            [style.border]="photoRef() ? '1.5px solid var(--brand)' : '1.5px dashed var(--line-2)'"
            [style.background]="photoRef() ? 'var(--brand-soft)' : '#fff'"
            style="width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;margin-bottom:18px;border-radius:13px;cursor:pointer"
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              (change)="onPhoto($event)"
              style="display:none"
            />
            <span
              [style.background]="photoRef() ? 'var(--brand)' : 'var(--bg-2)'"
              [style.color]="photoRef() ? '#fff' : 'var(--muted)'"
              style="width:40px;height:40px;border-radius:10px;display:grid;place-items:center;flex:none"
            >
              <wn-icon name="camera" [size]="20" />
            </span>
            <span style="flex:1;text-align:left">
              <div
                [style.color]="photoRef() ? 'var(--brand-ink)' : 'var(--ink)'"
                style="font-weight:700;font-size:14px"
              >
                {{ photoRef() ? "Foto vastgelegd" : "Foto maken" }}
              </div>
              <div style="font-size:12px;color:var(--muted)">
                optioneel — blijft alleen op dit toestel
              </div>
            </span>
            @if (photoRef()) {
              <wn-icon name="check" [size]="20" />
            }
          </label>

          <div class="wv-eyebrow" style="margin-bottom:12px">Beoordeling · 1 slecht → 5 uitstekend</div>
          @for (c of criteria; track c) {
            <wn-score-input
              [criterion]="c"
              [label]="labels[c]"
              [accent]="color(c)"
              [value]="scores()[c] ?? null"
              [infoQuestions]="questions[c]"
              [withNote]="true"
              [note]="criterionNotes()[c] ?? ''"
              (valueChange)="setScore(c, $event)"
              (noteChange)="setCriterionNote(c, $event)"
            />
          }

          <div class="wv-toggle-row" [class.on]="vervolg()" style="margin-top:4px;margin-bottom:18px">
            <span
              [style.background]="vervolg() ? 'var(--brand)' : 'var(--bg-2)'"
              [style.color]="vervolg() ? '#fff' : 'var(--muted)'"
              style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex:none"
            >
              <wn-icon name="leaf" [size]="18" />
            </span>
            <div class="lbl">
              <div class="t">Vervolgproject</div>
              <div class="d">Bouwt voort op vorig jaar</div>
            </div>
            <button class="wv-switch" [class.on]="vervolg()" (click)="vervolg.set(!vervolg())">
              <span class="knob"></span>
            </button>
          </div>
          @if (vervolg()) {
            <div style="margin-bottom:18px">
              <wn-banner tone="amber" icon="leaf">
                Beoordeel alleen de <b>uitbreiding of verbetering</b> t.o.v. vorig jaar.
              </wn-banner>
            </div>
          }

          <div class="wv-field">
            <label class="wv-label">Notitie <span class="opt">— privé, voor jezelf</span></label>
            <textarea
              class="wv-textarea"
              rows="2"
              placeholder="Korte reden voor je oordeel…"
              [ngModel]="note()"
              (ngModelChange)="note.set($event)"
            ></textarea>
          </div>
          <div class="wv-field">
            <label class="wv-label">Review <span class="opt">— feedback voor het team</span></label>
            <textarea
              class="wv-textarea"
              rows="2"
              placeholder="Opbouwende tip voor de deelnemers…"
              [ngModel]="review()"
              (ngModelChange)="review.set($event)"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="wv-dock bordered">
        <button class="wv-btn wv-btn-primary" [disabled]="!canSave()" (click)="save()">
          <wn-icon name="check" [size]="19" />
          {{ saveLabel() }}
        </button>
      </div>
    </div>
  `,
})
export class StandComponent implements OnInit {
  protected readonly store = inject(JuryStore);
  private readonly router = inject(Router);

  protected readonly criteria = CRITERIA;
  protected readonly labels = LABELS;
  protected readonly standNr = signal("");
  protected readonly projectgroep = signal("");
  protected readonly keyword = signal("");
  protected readonly note = signal("");
  protected readonly review = signal("");
  protected readonly vervolg = signal(false);
  protected readonly photoRef = signal<string | null>(null);
  protected readonly scores = signal<Partial<Record<Criterion, ScoreValue>>>({});
  protected readonly criterionNotes = signal<Partial<Record<Criterion, string>>>({});
  protected readonly questions = CRITERION_QUESTIONS;

  protected readonly editing = signal(false);
  private announceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Prefilled when arriving from a booth the other juror already entered, so
    // this juror keeps the shared standNr/projectgroep and just adds own scores.
    const qp = inject(ActivatedRoute).snapshot.queryParamMap;
    const std = qp.get("standNr");
    const pg = qp.get("projectgroep");
    if (std) this.standNr.set(std.replace(/\D/g, "").slice(0, 2));
    if (pg) this.projectgroep.set(pg);

    // Sync the deelnemer identity as soon as nr + teamnaam are known, so the
    // other juror sees the booth (and gets prefill) before this juror saves.
    effect(() => {
      const standNr = this.standNr().trim();
      const projectgroep = this.projectgroep().trim();
      const vervolg = this.vervolg();
      if (!standNr || !projectgroep) return;
      if (this.announceTimer) clearTimeout(this.announceTimer);
      this.announceTimer = setTimeout(() => {
        void this.store.announceDeelnemer(standNr, projectgroep, vervolg);
      }, 800);
    });
  }

  async ngOnInit(): Promise<void> {
    // Opened for a booth this juror already captured → load it as an edit.
    const standNr = this.standNr().trim();
    if (!standNr) return;
    const mine = (await this.store.scoresForJudge(this.store.judge())).filter(
      (s) => s.standNr === standNr,
    );
    if (!mine.length) return;
    this.editing.set(true);
    this.scores.set(Object.fromEntries(mine.map((s) => [s.criterion, s.value])));
    const deelnemer = this.store.deelnemers().find((d) => d.standNr === standNr);
    if (deelnemer) {
      this.projectgroep.set(deelnemer.projectgroep);
      this.vervolg.set(deelnemer.isVervolgproject);
    }
    const meta = await this.store.metaFor(standNr);
    if (meta) {
      this.keyword.set(meta.keyword);
      this.note.set(meta.note);
      this.review.set(meta.review);
      this.criterionNotes.set(meta.criterionNotes ?? {});
      this.photoRef.set(meta.photoRef ?? null);
    }
  }

  protected readonly scoredCount = computed(
    () => CRITERIA.filter((c) => this.scores()[c] != null).length,
  );
  protected readonly canSave = computed(
    () => this.standNr().trim() !== "" && this.keyword().trim() !== "" && this.scoredCount() === 4,
  );
  protected readonly saveLabel = computed(() => {
    if (this.canSave()) {
      return this.editing() && this.store.isPlaced(this.standNr().trim())
        ? "Wijzigingen opslaan"
        : "Opslaan & plaatsen";
    }
    if (this.standNr().trim() && this.keyword().trim()) {
      return `Nog ${4 - this.scoredCount()} criteria`;
    }
    return "Vul stand nr + keyword in";
  });

  protected color = criterionColor;

  protected setScore(c: Criterion, v: ScoreValue): void {
    this.scores.update((s) => ({ ...s, [c]: v }));
  }

  protected setCriterionNote(c: Criterion, note: string): void {
    this.criterionNotes.update((n) => ({ ...n, [c]: note }));
  }

  protected async onPhoto(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.photoRef.set(await this.store.savePhoto(file));
  }

  protected back(): void {
    void this.router.navigate(["/home"]);
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    await this.store.captureDeelnemer({
      standNr: this.standNr().trim(),
      projectgroep: this.projectgroep().trim() || "Naamloos team",
      isVervolgproject: this.vervolg(),
      keyword: this.keyword().trim(),
      note: this.note(),
      review: this.review(),
      criterionNotes: this.criterionNotes(),
      scores: this.scores() as Record<Criterion, ScoreValue>,
      photoRef: this.photoRef(),
    });
    // Edits keep their placement (rankPos preserved) → home; new captures go place.
    const done = this.editing() && this.store.isPlaced(this.standNr().trim());
    await this.router.navigate([done ? "/home" : "/compare"]);
  }
}
