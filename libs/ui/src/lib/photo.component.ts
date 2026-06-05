import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/**
 * Deelnemer photo with a gradient + initial fallback (recreates WV.Photo / `.wv-deel-photo`).
 * When `photoUrl` is set it renders the image; otherwise a coloured gradient + initial.
 */
@Component({
  selector: "wn-photo",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="wv-deel-photo"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.border-radius.px]="radius()"
      [style.background]="background()"
      [style.font-size.px]="size() * 0.4">
      @if (photoUrl()) {
        <img [src]="photoUrl()" alt="" />
      } @else {
        <span style="color:#fff;opacity:.95">{{ initial() }}</span>
      }
    </div>
  `,
})
export class PhotoComponent {
  readonly keyword = input<string>("");
  readonly projectgroep = input<string>("");
  readonly color = input<string>("#4B3BF5");
  readonly photoUrl = input<string | null>(null);
  readonly size = input(54);
  readonly radius = input(12);

  protected readonly initial = computed(() => {
    const source = (this.keyword() || this.projectgroep() || "?").trim();
    return (source[0] ?? "?").toUpperCase();
  });

  protected readonly background = computed(() =>
    this.photoUrl()
      ? "var(--bg-2)"
      : `linear-gradient(140deg, ${this.color()}, ${this.color()} 60%, rgba(0,0,0,.18))`,
  );
}
