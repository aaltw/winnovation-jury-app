import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { IconComponent } from "./icon.component";

const CRITERION_LABELS: Record<string, string> = {
  innovativiteit: "Innovativiteit",
  relevantie: "Relevantie",
  haalbaarheid: "Haalbaarheid",
  impact: "Impact",
};

/** Drift flag row (recreates WV.DriftFlag / `.wv-drift`). Bind `(click)` on the host. */
@Component({
  selector: "wn-drift-flag",
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-drift">
      <div class="wv-drift-ic"><wn-icon name="flag" [size]="16" [stroke]="2.2" /></div>
      <div class="wv-drift-body">
        <div class="wv-drift-t">{{ keyword() }} &middot; {{ criterionLabel() }}</div>
        <div class="wv-drift-d">{{ severityCopy() }}</div>
      </div>
      <wn-icon name="chevRight" [size]="18" style="color:var(--amber-ink);flex:none" />
    </div>
  `,
})
export class DriftFlagComponent {
  readonly keyword = input<string>("");
  readonly criterion = input<string>("");
  readonly severity = input(1);

  protected readonly criterionLabel = computed(
    () => CRITERION_LABELS[this.criterion()] ?? this.criterion(),
  );

  protected readonly severityCopy = computed(() =>
    this.severity() >= 2
      ? "Cijfer en plaatsing wijken sterk af"
      : "Cijfer en plaatsing spreken elkaar tegen",
  );
}
