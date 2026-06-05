import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/** Consistent 24x24, 1.85-stroke line pictograms (ported from primitives.jsx `P`). */
const PATHS: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  camera:
    "M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.2-1.8A1 1 0 0 1 9 4.8h6a1 1 0 0 1 .8.4L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5zM12 16a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z",
  check: "M20 6 9 17l-5-5",
  chevUp: "M6 15l6-6 6 6",
  chevDown: "M6 9l6 6 6-6",
  chevRight: "M9 6l6 6-6 6",
  chevLeft: "M15 6l-6 6 6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  trophy: "M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 0-3 3M9 20h6M12 13v7",
  share: "M12 15V4M8.5 7.5 12 4l3.5 3.5M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6",
  download: "M12 4v11M8 11l4 4 4-4M5 20h14",
  scale: "M12 4v16M7 20h10M6 8l-3 6h6zM6 8l6-2M18 8l-3 6h6zM18 8l-6-2",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  x: "M6 6l12 12M18 6 6 18",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0",
  users:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 19a6 6 0 0 1 12 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18 19a6 6 0 0 0-3-5.2",
  leaf: "M5 19C5 11 11 5 19 5c0 8-6 14-14 14zM5 19c2.5-5 6-7 9-8",
  wifiOff:
    "M2 8.5 4 7M22 8.5 9 19l-2.5-3.2M5 11.5a11 11 0 0 1 3-1.9M12 5c3.6 0 7 1.4 9.5 3.7M3 3l18 18",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  handshake: "M8 12 5 9l3-3 3 2h3l4 4-2.5 2.5M12 13l2 2M9.5 14.5 12 17l2-1.5",
  inbox: "M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 13h4l1 2h6l1-2h4",
  sliders: "M4 8h10M18 8h2M4 16h2M10 16h10M14 6v4M6 14v4",
  pin: "M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
};

export type IconName = keyof typeof PATHS;

@Component({
  selector: "wn-icon",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      [attr.fill]="fill() ?? 'none'"
      [attr.stroke]="fill() ? 'none' : 'currentColor'"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <path [attr.d]="path()" />
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(22);
  readonly stroke = input(1.85);
  readonly fill = input<string | null>(null);

  protected readonly path = computed(() => PATHS[this.name()] ?? "");
}
