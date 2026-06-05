import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { AnchorCardComponent } from "./anchor-card.component";
import { AppBarComponent } from "./app-bar.component";
import { BannerComponent } from "./banner.component";
import { BtnComponent } from "./btn.component";
import { DeelnemerCardComponent } from "./deelnemer-card.component";
import { DriftFlagComponent } from "./drift-flag.component";
import { EmptyComponent } from "./empty.component";
import { IconComponent } from "./icon.component";
import { PhotoComponent } from "./photo.component";
import { SyncComponent } from "./sync.component";

describe("IconComponent", () => {
  it("renders the path for a known icon name", () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput("name", "flag");
    fixture.detectChanges();
    const path = (fixture.nativeElement as HTMLElement).querySelector("path");
    expect(path?.getAttribute("d")).toContain("M5 21V4");
  });
});

describe("PhotoComponent", () => {
  it("shows the keyword initial when no photoUrl is set", () => {
    const fixture = TestBed.createComponent(PhotoComponent);
    fixture.componentRef.setInput("keyword", "compost");
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector("span")?.textContent).toBe("C");
    expect(el.querySelector("img")).toBeNull();
  });

  it("renders an image when photoUrl is provided", () => {
    const fixture = TestBed.createComponent(PhotoComponent);
    fixture.componentRef.setInput("photoUrl", "blob:x");
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector("img")).not.toBeNull();
  });
});

describe("SyncComponent", () => {
  it.each([
    ["synced", "Gesynct", ""],
    ["syncing", "Synct…", "syncing"],
    ["offline", "Offline — lokaal bewaard", "offline"],
  ] as const)("renders the %s state", (state, label, cls) => {
    const fixture = TestBed.createComponent(SyncComponent);
    fixture.componentRef.setInput("state", state);
    fixture.detectChanges();
    const pill = (fixture.nativeElement as HTMLElement).querySelector(".wv-sync");
    expect(pill?.textContent?.trim()).toBe(label);
    if (cls) expect(pill?.classList.contains(cls)).toBe(true);
  });
});

describe("DeelnemerCardComponent", () => {
  it("renders keyword and a zero-padded stand label", () => {
    const fixture = TestBed.createComponent(DeelnemerCardComponent);
    fixture.componentRef.setInput("standNr", "7");
    fixture.componentRef.setInput("keyword", "compost");
    fixture.componentRef.setInput("projectgroep", "AI-compostbak");
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector(".wv-deel-kw")?.textContent?.trim()).toBe("compost");
    expect(el.querySelector(".wv-deel-meta")?.textContent).toContain("Stand 07");
  });

  it("renders a rank pill when rank is set", () => {
    const fixture = TestBed.createComponent(DeelnemerCardComponent);
    fixture.componentRef.setInput("standNr", "3");
    fixture.componentRef.setInput("rank", 2);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(".wv-deel-rank")?.textContent,
    ).toContain("#2");
  });
});

describe("AnchorCardComponent", () => {
  it("renders the score in place when populated", () => {
    const fixture = TestBed.createComponent(AnchorCardComponent);
    fixture.componentRef.setInput("label", "hoger");
    fixture.componentRef.setInput("standNr", "4");
    fixture.componentRef.setInput("criterion", "impact");
    fixture.componentRef.setInput("score", 5);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("hoger");
    expect(el.textContent).toContain("Stand 04");
    expect(el.textContent).toContain("5");
  });

  it("shows the empty placeholder when no standNr is set", () => {
    const fixture = TestBed.createComponent(AnchorCardComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("niemand");
  });
});

describe("DriftFlagComponent", () => {
  it("uses the contradiction copy for mild severity", () => {
    const fixture = TestBed.createComponent(DriftFlagComponent);
    fixture.componentRef.setInput("keyword", "compost");
    fixture.componentRef.setInput("criterion", "impact");
    fixture.componentRef.setInput("severity", 1);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector(".wv-drift-t")?.textContent).toContain("compost · Impact");
    expect(el.querySelector(".wv-drift-d")?.textContent).toContain("spreken elkaar tegen");
  });

  it("uses the strong-deviation copy for severity >= 2", () => {
    const fixture = TestBed.createComponent(DriftFlagComponent);
    fixture.componentRef.setInput("criterion", "relevantie");
    fixture.componentRef.setInput("severity", 3);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(".wv-drift-d")?.textContent,
    ).toContain("wijken sterk af");
  });
});

describe("BannerComponent", () => {
  it("renders the amber tone class and projected content", () => {
    @Component({
      standalone: true,
      imports: [BannerComponent],
      template: `<wn-banner>Let op</wn-banner>`,
    })
    class Host {}
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector(".wv-banner-amber")).not.toBeNull();
    expect(el.textContent).toContain("Let op");
  });
});

describe("BtnComponent", () => {
  it("applies the kind class, sm modifier, and disabled state", () => {
    @Component({
      standalone: true,
      imports: [BtnComponent],
      template: `<wn-btn kind="coral" [sm]="true" [disabled]="true">Opslaan</wn-btn>`,
    })
    class Host {}
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector("button");
    expect(btn?.classList.contains("wv-btn-coral")).toBe(true);
    expect(btn?.classList.contains("wv-btn-sm")).toBe(true);
    expect(btn?.disabled).toBe(true);
    expect(btn?.textContent).toContain("Opslaan");
  });
});

describe("EmptyComponent", () => {
  it("shows the clean check variant and the title", () => {
    @Component({
      standalone: true,
      imports: [EmptyComponent],
      template: `<wn-empty [clean]="true" title="Alles gescoord">Niets open</wn-empty>`,
    })
    class Host {}
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector(".wv-empty.clean")).not.toBeNull();
    expect(el.querySelector("h3")?.textContent?.trim()).toBe("Alles gescoord");
    expect(el.textContent).toContain("Niets open");
  });
});

describe("AppBarComponent", () => {
  it("renders the title, sub, and projected slots", () => {
    @Component({
      standalone: true,
      imports: [AppBarComponent],
      template: `<wn-app-bar title="Winnovation" sub="12 deelnemers" [bordered]="true">
        <button slot="left">L</button>
        <button slot="right">R</button>
      </wn-app-bar>`,
    })
    class Host {}
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector(".wv-appbar.bordered")).not.toBeNull();
    expect(el.querySelector("h2")?.textContent).toContain("Winnovation");
    expect(el.querySelector(".sub")?.textContent?.trim()).toBe("12 deelnemers");
    expect(el.querySelector("[slot=left]")?.textContent).toBe("L");
    expect(el.querySelector("[slot=right]")?.textContent).toBe("R");
  });
});
