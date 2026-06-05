import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * In-screen top app bar (recreates WV.AppBar / `.wv-appbar`).
 * Project leading/trailing controls into `[slot=left]` / `[slot=right]`.
 */
@Component({
  selector: "wn-app-bar",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-appbar" [class.bordered]="bordered()">
      <ng-content select="[slot=left]" />
      <h2>
        {{ title() }}
        @if (sub()) {
          <div class="sub">{{ sub() }}</div>
        }
      </h2>
      <ng-content select="[slot=right]" />
    </div>
  `,
})
export class AppBarComponent {
  readonly title = input<string>("");
  readonly sub = input<string>("");
  readonly bordered = input(false);
}
