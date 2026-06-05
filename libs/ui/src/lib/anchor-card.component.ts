import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { criterionColor, fmtStand } from "./criteria";
import { PhotoComponent } from "./photo.component";

/**
 * Compact Compare anchor (recreates the `Anchor` cell in screens-compare.jsx):
 * a `hoger`/`lager` eyebrow, photo, keyword + stand, and the criterion score
 * rendered in the criterion colour. Empty (`standNr` unset) shows "— niemand —".
 */
@Component({
  selector: "wn-anchor-card",
  standalone: true,
  imports: [PhotoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      style="display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:14px;transition:all .12s"
      [style.background]="active() ? accentSoft() : '#fff'"
      [style.border]="'1.5px solid ' + (active() ? accentColor() : 'var(--line)')"
      [style.opacity]="standNr() ? 1 : 0.4">
      <span
        style="font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;width:42px;flex:none"
        [style.color]="active() ? accentColor() : 'var(--muted)'">
        {{ label() }}
      </span>
      @if (standNr(); as nr) {
        <wn-photo
          [keyword]="keyword()"
          [projectgroep]="projectgroep()"
          [color]="color()"
          [photoUrl]="photoUrl()"
          [size]="36"
          [radius]="9" />
        <div style="flex:1;min-width:0">
          <div
            style="font-family:var(--font-display);font-weight:700;font-size:14px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            {{ keyword() }}
          </div>
          <div style="font-size:11px;color:var(--muted)">{{ stand() }}</div>
        </div>
        <span
          style="font-family:var(--font-display);font-weight:800;font-size:18px;flex:none"
          [style.color]="accentColor()">
          {{ score() }}
        </span>
      } @else {
        <div style="font-size:12px;color:var(--muted);font-style:italic">&mdash; niemand &mdash;</div>
      }
    </div>
  `,
})
export class AnchorCardComponent {
  readonly label = input<string>("");
  readonly standNr = input<string>("");
  readonly projectgroep = input<string>("");
  readonly keyword = input<string>("");
  readonly photoUrl = input<string | null>(null);
  readonly color = input<string>("#4B3BF5");
  readonly criterion = input<string>("");
  readonly score = input<number | null>(null);
  readonly active = input(false);

  protected readonly stand = computed(() => fmtStand(this.standNr()));
  protected readonly accentColor = computed(() => criterionColor(this.criterion()));
  protected readonly accentSoft = computed(
    () => `color-mix(in srgb, ${this.accentColor()} 12%, #fff)`,
  );
}
