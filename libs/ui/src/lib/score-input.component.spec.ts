import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { ScoreInputComponent } from "./score-input.component";

describe("ScoreInputComponent", () => {
  it("emits the chosen value 1–5", () => {
    const fixture = TestBed.createComponent(ScoreInputComponent);
    let emitted: number | undefined;
    fixture.componentInstance.valueChange.subscribe((v) => (emitted = v));
    fixture.componentInstance.choose(4);
    expect(emitted).toBe(4);
  });

  it("exposes the scorekaart label for a value", () => {
    const fixture = TestBed.createComponent(ScoreInputComponent);
    expect(fixture.componentInstance.labelFor(1)).toBe("slecht");
    expect(fixture.componentInstance.labelFor(5)).toBe("uitstekend");
  });

  it("renders five segmented pills with the criterion accent and a readout", () => {
    const fixture = TestBed.createComponent(ScoreInputComponent);
    fixture.componentRef.setInput("criterion", "impact");
    fixture.componentRef.setInput("value", 3);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll(".wv-seg-pill")).toHaveLength(5);
    expect(el.querySelector(".wv-seg-pill.on .num")?.textContent?.trim()).toBe("3");
    expect(el.querySelector(".wv-score-read")?.textContent).toContain("goed");
  });
});
