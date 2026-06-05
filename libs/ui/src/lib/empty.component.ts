import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { IconComponent } from "./icon.component";

/** Empty state (recreates WV.Empty / `.wv-empty`). `clean` shows the mint check variant. */
@Component({
  selector: "wn-empty",
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wv-empty" [class.clean]="clean()">
      <div class="ic"><wn-icon [name]="iconName()" [size]="28" /></div>
      <h3>{{ title() }}</h3>
      <p><ng-content /></p>
    </div>
  `,
})
export class EmptyComponent {
  readonly icon = input<string>("inbox");
  readonly title = input<string>("");
  readonly clean = input(false);

  protected readonly iconName = computed(() => (this.clean() ? "check" : this.icon()));
}
