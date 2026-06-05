import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { IconComponent } from "./icon.component";

export type BtnKind = "primary" | "ink" | "coral" | "ghost" | "soft" | "link";

/** Button wrapper (recreates WV.Btn / `.wv-btn`). Bind `(click)` on the host `<wn-btn>`. */
@Component({
  selector: "wn-btn",
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="wv-btn wv-btn-{{ kind() }}"
      [class.wv-btn-sm]="sm()"
      [disabled]="disabled()">
      @if (icon(); as ic) {
        <wn-icon [name]="ic" [size]="iconSize()" />
      }
      <ng-content />
      @if (iconRight(); as ir) {
        <wn-icon [name]="ir" [size]="iconSize()" />
      }
    </button>
  `,
})
export class BtnComponent {
  readonly kind = input<BtnKind>("primary");
  readonly icon = input<string | null>(null);
  readonly iconRight = input<string | null>(null);
  readonly sm = input(false);
  readonly disabled = input(false);

  protected iconSize(): number {
    return this.sm() ? 17 : 19;
  }
}
