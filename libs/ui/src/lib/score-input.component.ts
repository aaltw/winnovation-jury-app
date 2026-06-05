import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
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
        </div>
        <div class="wv-score-read" [class.set]="value() !== null">
          @if (value(); as v) {
            {{ v }} &middot; {{ labelFor(v) }}
          } @else {
            &mdash;
          }
        </div>
      </div>
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

  readonly valueChange = output<ScoreValue>();

  readonly values: ScoreValue[] = [1, 2, 3, 4, 5];

  protected readonly accentColor = computed(
    () => this.accent() ?? criterionColor(this.criterion()),
  );

  labelFor(n: ScoreValue): string {
    return SCALE_LABELS[n];
  }

  choose(n: ScoreValue): void {
    this.valueChange.emit(n);
  }
}
