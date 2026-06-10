import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";
import type { ScoreValue } from "@winnovation/domain";
import { criterionColor, SCALE_LABELS } from "./criteria";

/**
 * Segmented 1–5 score control (recreates WV.ScoreInput / `.wv-score`).
 * The active pill + swatch use the criterion accent colour.
 */
@Component({
  selector: "wn-score-input",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-score" role="radiogroup" [attr.aria-label]="label() || criterion()">
      <div class="wv-score-head">
        <div class="wv-score-name">
          <span class="swatch" [style.background]="accentColor()"></span>
          {{ label() || criterion() }}
          @if (infoQuestions().length) {
            <button
              type="button"
              (click)="infoOpen.set(!infoOpen())"
              aria-label="Waar let je op?"
              [style.border-color]="infoOpen() ? accentColor() : 'var(--line-2)'"
              [style.color]="infoOpen() ? accentColor() : 'var(--muted)'"
              style="width:18px;height:18px;border-radius:999px;border:1.5px solid;background:#fff;font-size:11px;font-weight:800;display:inline-grid;place-items:center;cursor:pointer;margin-left:5px;line-height:1"
            >
              i
            </button>
          }
        </div>
        <div class="wv-score-read" [class.set]="value() !== null">
          @if (value(); as v) {
            {{ v }} &middot; {{ labelFor(v) }}
          } @else {
            &mdash;
          }
        </div>
      </div>
      @if (infoOpen()) {
        <div
          [style.border-color]="accentColor() + '44'"
          style="border:1px solid;border-radius:11px;padding:10px 12px;margin-bottom:9px;background:var(--bg-2)"
        >
          <div
            [style.color]="accentColor()"
            style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px"
          >
            Waar let je op?
          </div>
          <ul style="margin:0;padding-left:16px;font-size:12.5px;line-height:1.6;color:var(--ink-2)">
            @for (q of infoQuestions(); track q) {
              <li>{{ q }}</li>
            }
          </ul>
        </div>
      }
      <div class="wv-seg">
        @for (n of values; track n) {
          <button
            type="button"
            role="radio"
            class="wv-seg-pill"
            [class.on]="value() === n"
            [attr.aria-checked]="value() === n"
            [style.--accent]="accentColor()"
            (click)="choose(n)">
            <span class="num">{{ n }}</span>
            <span class="tip">{{ labelFor(n) }}</span>
          </button>
        }
      </div>
      @if (withNote()) {
        @if (noteOpen() || note()) {
          <textarea
            class="wv-textarea"
            rows="1"
            [placeholder]="'Notitie bij ' + (label() || criterion()) + '…'"
            [value]="note()"
            (input)="onNote($any($event.target).value)"
            style="margin-top:8px;font-size:13px"
          ></textarea>
        } @else {
          <button
            type="button"
            class="wv-btn-link"
            (click)="noteOpen.set(true)"
            style="margin-top:6px;font-size:12px;color:var(--muted)"
          >
            + notitie
          </button>
        }
      }
    </div>
  `,
})
export class ScoreInputComponent {
  readonly criterion = input<string>("");
  readonly value = input<ScoreValue | null>(null);
  /** Optional explicit accent hex; falls back to the criterion colour. */
  readonly accent = input<string | null>(null);
  /** Optional human label shown instead of the raw criterion key. */
  readonly label = input<string>("");
  /** Juror guidance shown behind the ⓘ toggle; omit to hide the button. */
  readonly infoQuestions = input<string[]>([]);
  /** When true, offers a small per-criterion note field below the scale. */
  readonly withNote = input<boolean>(false);
  readonly note = input<string>("");

  readonly valueChange = output<ScoreValue>();
  readonly noteChange = output<string>();

  readonly values: ScoreValue[] = [1, 2, 3, 4, 5];
  protected readonly infoOpen = signal(false);
  protected readonly noteOpen = signal(false);

  protected readonly accentColor = computed(
    () => this.accent() ?? criterionColor(this.criterion()),
  );

  labelFor(n: ScoreValue): string {
    return SCALE_LABELS[n];
  }

  choose(n: ScoreValue): void {
    this.valueChange.emit(n);
  }

  protected onNote(value: string): void {
    this.noteChange.emit(value);
  }
}
