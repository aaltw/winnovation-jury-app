import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { fmtStand } from "./criteria";
import { IconComponent } from "./icon.component";
import { PhotoComponent } from "./photo.component";

/**
 * The reusable deelnemer unit (recreates WV.DeelCard / `.wv-deel`):
 * photo · keyword · "projectgroep · Stand NN", with an optional drift badge
 * and either a rank pill or an arbitrary trailing slot.
 *
 * Trailing precedence: projected `[slot=trailing]` content > `rank` pill.
 * Set `tappable` to get the hover/press affordance; bind `(click)` on the host.
 */
@Component({
  selector: "wn-deelnemer-card",
  standalone: true,
  imports: [PhotoComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-deel" [class.tappable]="tappable()">
      <wn-photo
        [keyword]="keyword()"
        [projectgroep]="projectgroep()"
        [color]="color()"
        [photoUrl]="photoUrl()" />
      <div class="wv-deel-body">
        <div class="wv-deel-kw">{{ keyword() }}</div>
        <div class="wv-deel-meta">
          <span>{{ projectgroep() }}</span>
          <span class="dot"></span>
          <span style="font-variant-numeric:tabular-nums">{{ stand() }}</span>
          @if (drift()) {
            <span class="dot"></span>
            <span
              style="color:var(--amber-ink);font-weight:700;display:inline-flex;align-items:center;gap:3px">
              <wn-icon name="flag" [size]="12" [stroke]="2.2" />drift
            </span>
          }
        </div>
      </div>
      <ng-content select="[slot=trailing]">
        @if (rank() != null) {
          <div class="wv-deel-rank">
            <span class="lbl">{{ rankLabel() }}</span>#{{ rank() }}
          </div>
        }
      </ng-content>
    </div>
  `,
})
export class DeelnemerCardComponent {
  readonly standNr = input.required<string>();
  readonly projectgroep = input<string>("");
  readonly keyword = input<string>("");
  readonly photoUrl = input<string | null>(null);
  readonly color = input<string>("#4B3BF5");
  readonly drift = input(false);
  readonly rank = input<number | null>(null);
  readonly rankLabel = input<string>("rang");
  readonly tappable = input(false);

  protected readonly stand = computed(() => fmtStand(this.standNr()));
}
