import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { IconComponent } from "./icon.component";

export type BannerTone = "amber";

/** Inline banner, e.g. the vervolgproject reminder (recreates WV.Banner / `.wv-banner`). */
@Component({
  selector: "wn-banner",
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-banner wv-banner-{{ tone() }}">
      <wn-icon [name]="icon()" [size]="18" class="ic" />
      <div><ng-content /></div>
    </div>
  `,
})
export class BannerComponent {
  readonly tone = input<BannerTone>("amber");
  readonly icon = input<string>("leaf");
}
