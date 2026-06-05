import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import type { JudgeSlot } from "@winnovation/domain";
import { IconComponent } from "@winnovation/ui";
import { JuryStore } from "./jury-store";

const STEPS: ReadonlyArray<readonly [string, string, string]> = [
  ["camera", "Vastleggen", "Scoor elk project in seconden, aan de stand."],
  ["scale", "Vergelijken", "Plaats het t.o.v. projecten die je al zag."],
  ["handshake", "Verzoenen", "Leg samen de eerlijke eindstand vast."],
];

@Component({
  selector: "wn-join",
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="background:var(--ink);min-height:100vh;display:flex;flex-direction:column;color:#fff">
      <div style="flex:1;overflow-y:auto;padding:24px 26px 26px">
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
          <span
            style="width:30px;height:30px;border-radius:9px;background:var(--brand);display:grid;place-items:center;transform:rotate(-6deg)"
          >
            <wn-icon name="spark" [size]="18" fill="#fff" />
          </span>
          <span
            style="font-family:var(--font-display);font-weight:800;font-size:21px;letter-spacing:-0.02em"
            >Winnovation</span
          >
        </div>

        <div style="margin-top:48px">
          <h1
            style="font-family:var(--font-display);font-weight:800;font-size:38px;line-height:1.02;letter-spacing:-0.03em;margin:0"
          >
            Eerlijk jureren,<br /><span style="color:var(--brand)">project voor project.</span>
          </h1>
          <p
            style="color:rgba(255,255,255,.6);font-size:15px;line-height:1.5;margin:14px 0 0;max-width:300px"
          >
            Geen account. Voer de eventcode in en kies je plek als jurylid.
          </p>
        </div>

        <div style="margin-top:32px">
          <label class="wv-label" style="color:rgba(255,255,255,.55)">Eventcode</label>
          <input
            class="wv-input big"
            [(ngModel)]="code"
            (ngModelChange)="error.set(false)"
            placeholder="WIN-26"
            autocapitalize="characters"
            style="background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.16);color:#fff;letter-spacing:0.08em;text-align:center;text-transform:uppercase"
          />
          @if (error()) {
            <p style="color:#FF8A73;font-size:13px;font-weight:600;margin:8px 2px 0">Onbekende code</p>
          }
        </div>

        <div style="margin-top:22px">
          <label class="wv-label" style="color:rgba(255,255,255,.55)">Kies je plek</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            @for (slot of slots; track slot) {
              <button
                type="button"
                (click)="pick(slot)"
                [style.border]="
                  judge() === slot ? '1.5px solid var(--brand)' : '1.5px solid rgba(255,255,255,.16)'
                "
                [style.background]="judge() === slot ? 'var(--brand)' : 'rgba(255,255,255,.05)'"
                style="padding:16px 14px;border-radius:16px;cursor:pointer;text-align:left;color:#fff;transition:all .15s"
              >
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-family:var(--font-display);font-weight:800;font-size:26px"
                    >Jurylid {{ slot }}</span
                  >
                  @if (judge() === slot) {
                    <wn-icon name="check" [size]="20" />
                  }
                </div>
                <div
                  [style.color]="judge() === slot ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.45)'"
                  style="font-size:12.5px;margin-top:2px"
                >
                  {{ slot === "A" ? "Jij" : "Collega" }}
                </div>
              </button>
            }
          </div>
        </div>

        <div style="margin-top:30px;display:flex;flex-direction:column;gap:2px">
          <div class="wv-eyebrow" style="color:rgba(255,255,255,.4);margin-bottom:12px">
            Het ritme van de dag
          </div>
          @for (step of steps; track step[1]; let i = $index) {
            <div
              style="display:flex;gap:13px;align-items:flex-start;padding:11px 0"
              [style.border-top]="i ? '1px solid rgba(255,255,255,.08)' : 'none'"
            >
              <span
                style="width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.08);display:grid;place-items:center;flex:none;color:var(--brand)"
              >
                <wn-icon [name]="step[0]" [size]="18" />
              </span>
              <div>
                <div style="font-weight:700;font-size:15px">{{ i + 1 }}. {{ step[1] }}</div>
                <div style="font-size:12.5px;color:rgba(255,255,255,.5);margin-top:1px">{{ step[2] }}</div>
              </div>
            </div>
          }

          @if (creating()) {
            <div style="margin-top:18px;display:flex;gap:10px">
              <input
                class="wv-input"
                [(ngModel)]="newName"
                placeholder="Naam van het event"
                style="background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.16);color:#fff"
              />
              <button class="wv-btn wv-btn-soft" style="width:auto;padding:0 18px" (click)="create()">
                Maak
              </button>
            </div>
          } @else {
            <button
              class="wv-btn-link"
              style="color:rgba(255,255,255,.7);align-self:flex-start;margin-top:14px;padding-left:0"
              (click)="creating.set(true)"
            >
              Nieuw event aanmaken
            </button>
          }
        </div>
      </div>

      <div class="wv-dock" style="background:var(--ink)">
        <button class="wv-btn wv-btn-primary" [disabled]="!code.trim()" (click)="start()">
          Start als jurylid {{ judge() }}
          <wn-icon name="arrowRight" [size]="19" />
        </button>
      </div>
    </div>
  `,
})
export class JoinComponent {
  private readonly store = inject(JuryStore);
  private readonly router = inject(Router);

  protected readonly judge = this.store.judge;
  protected readonly slots: JudgeSlot[] = ["A", "B"];
  protected readonly steps = STEPS;
  protected code = "";
  protected newName = "";
  protected readonly error = signal(false);
  protected readonly creating = signal(false);

  protected pick(slot: JudgeSlot): void {
    this.store.setJudge(slot);
  }

  protected async start(): Promise<void> {
    const ok = await this.store.joinEvent(this.code.trim().toUpperCase(), this.judge());
    if (ok) {
      await this.router.navigate(["/home"]);
    } else {
      this.error.set(true);
    }
  }

  protected async create(): Promise<void> {
    const name = this.newName.trim();
    if (!name) {
      return;
    }
    await this.store.createEvent(name, new Date().toISOString().slice(0, 10));
    this.store.setJudge("A");
    await this.router.navigate(["/home"]);
  }
}
