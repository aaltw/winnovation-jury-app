# Winnovation Jury — UI Screens Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline judging UI — Join, Event home, Stand capture, Compare (the signature insertion interaction), and Review — as Angular standalone components wired to the `JuryService` foundation.

**Architecture:** A pure **placement engine** in `@winnovation/domain` drives the Compare interaction. An Angular signal store (`JuryStore`, `providedIn: 'root'`) wraps `@winnovation/data-access`'s `JuryService` and exposes reactive state to standalone components. Smart screen components live in `libs/feature-jury`; reusable presentational components in `libs/ui`. Tailwind for styling, Angular Router for navigation, zoneless change detection.

**Tech Stack:** Angular v21 (standalone, signals, `input()`/`output()`, `@if`/`@for`, OnPush, zoneless) · Tailwind · Vitest (logic) · the Plan 1 libraries.

**Depends on:** Plan 1 (Foundation) merged.

---

## Scope: two parts

This plan splits cleanly by design-dependency:

- **Part A — build now (design-independent):** Tasks 1–5. The placement engine, the `JuryStore` signal layer, a facade extension, routing, and the reusable dumb components' *logic/contracts*. Fully TDD'd. **Not blocked by wireframes.**
- **Part B — build when wireframes land (design-dependent):** Tasks 6–10. The five screens. Each task gives a **behavioral contract** (what it reads/writes through `JuryStore`, which states it handles) and a **functional skeleton component** (complete, runnable TypeScript + a lean structural template), then a final **"apply visual design"** step. The skeletons are working code, not placeholders — the designer's system refines layout/spacing/colour/typography, not the data flow.

> **WAIT GATE:** Do not start Part B until the UX/UI wireframes are delivered (see `docs/design/2026-06-05-ux-ui-brief.md` §12). Part A may proceed immediately.

---

## File Structure

| File | Responsibility | Part |
| --- | --- | --- |
| `libs/domain/src/lib/placement.ts` (+spec) | Pure insertion: bracketing-anchor suggestion + reorder/renumber. | A |
| `libs/data-access/src/lib/jury.service.ts` (modify) | Add `scoresForJudge` passthrough used by the store. | A |
| `libs/feature-jury/src/lib/jury-store.ts` (+spec) | Angular signal facade over `JuryService`. | A |
| `libs/feature-jury/src/lib/jury.routes.ts` | Route table for the screens. | A |
| `libs/ui/src/lib/score-input.component.ts` (+spec) | Reusable 1–5 score control with labels. | A |
| `libs/ui/src/lib/deelnemer-card.component.ts` | Reusable card (photo · keyword · projectgroep · stand nr). | A |
| `libs/ui/src/lib/anchor-card.component.ts` | Compare anchor card. | A |
| `libs/feature-jury/src/lib/join.component.ts` | Join screen. | B |
| `libs/feature-jury/src/lib/event-home.component.ts` | Event home screen. | B |
| `libs/feature-jury/src/lib/stand.component.ts` | Stand capture screen. | B |
| `libs/feature-jury/src/lib/compare.component.ts` | Compare insertion screen (centrepiece). | B |
| `libs/feature-jury/src/lib/review.component.ts` | Review + drift-resolution screen. | B |
| `apps/jury-app/src/app/app.routes.ts` (modify) | Mount `jury.routes`. | A |

---

# PART A — design-independent

## Task 1: Placement engine — bracketing anchors

The Compare screen, when placing deelnemer D (with score `value`) on a criterion, shows the two already-ranked deelnemers that bracket where D's number suggests it belongs. This task computes that suggestion. Pure, no Angular.

**Files:**
- Create: `libs/domain/src/lib/placement.ts`
- Create: `libs/domain/src/lib/placement.spec.ts`
- Modify: `libs/domain/src/index.ts`

- [ ] **Step 1: Write the failing test**

`libs/domain/src/lib/placement.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ScoreValue } from './model';
import { type Placed, bracketingAnchors } from './placement';

const p = (standNr: string, value: ScoreValue, rankPos: number): Placed => ({ standNr, value, rankPos });

describe('bracketingAnchors', () => {
  it('returns null anchors when nothing is placed yet', () => {
    expect(bracketingAnchors([], 4)).toEqual({ above: null, below: null, index: 0 });
  });

  it('suggests a slot between the better- and worse-valued neighbours', () => {
    // best→worst: A(5,1), B(3,2). Value 4 slots between them.
    const placed = [p('A', 5, 1), p('B', 3, 2)];
    expect(bracketingAnchors(placed, 4)).toEqual({ above: placed[0], below: placed[1], index: 1 });
  });

  it('suggests the top slot when the value beats everything', () => {
    const placed = [p('A', 4, 1), p('B', 3, 2)];
    expect(bracketingAnchors(placed, 5)).toEqual({ above: null, below: placed[0], index: 0 });
  });

  it('suggests the bottom slot when the value loses to everything', () => {
    const placed = [p('A', 4, 1), p('B', 3, 2)];
    expect(bracketingAnchors(placed, 1)).toEqual({ above: placed[1], below: null, index: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test domain`
Expected: FAIL — `Cannot find module './placement'`.

- [ ] **Step 3: Write the implementation**

`libs/domain/src/lib/placement.ts`:

```ts
import type { ScoreValue } from './model';

export interface Placed {
  standNr: string;
  value: ScoreValue;
  rankPos: number; // 1 = best
}

export interface Anchors {
  above: Placed | null; // better-ranked neighbour (lower rankPos)
  below: Placed | null; // worse-ranked neighbour
  index: number; // suggested insertion index in best→worst order (0 = top)
}

/** Suggest where `value` slots into the current best→worst ordering. */
export function bracketingAnchors(placed: Placed[], value: ScoreValue): Anchors {
  const ordered = [...placed].sort((a, b) => a.rankPos - b.rankPos);
  const index = ordered.filter((item) => item.value > value).length;
  return {
    above: index > 0 ? ordered[index - 1] : null,
    below: index < ordered.length ? ordered[index] : null,
    index,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/domain/src/lib/placement.ts libs/domain/src/lib/placement.spec.ts
git commit -m "feat(domain): suggest bracketing anchors for placement"
```

---

## Task 2: Placement engine — reorder & renumber

When the judge chooses above/below/between, we insert D at a target index and renumber `rankPos` densely (1..N). Pure function over an ordered list of standNrs.

**Files:**
- Modify: `libs/domain/src/lib/placement.ts`
- Modify: `libs/domain/src/lib/placement.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `libs/domain/src/lib/placement.spec.ts`:

```ts
import { placeAt, renumber } from './placement';

describe('placeAt', () => {
  it('inserts a new standNr at the target index', () => {
    expect(placeAt(['A', 'B'], 'C', 1)).toEqual(['A', 'C', 'B']);
  });

  it('moves an already-present standNr to the target index', () => {
    expect(placeAt(['A', 'B', 'C'], 'C', 0)).toEqual(['C', 'A', 'B']);
  });

  it('clamps an out-of-range index to the end', () => {
    expect(placeAt(['A'], 'B', 99)).toEqual(['A', 'B']);
  });
});

describe('renumber', () => {
  it('maps an ordering to dense 1-based rankPos (1 = best)', () => {
    expect(renumber(['X', 'Y', 'Z'])).toEqual(
      new Map([['X', 1], ['Y', 2], ['Z', 3]]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test domain`
Expected: FAIL — `placeAt is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `libs/domain/src/lib/placement.ts`:

```ts
/** Insert (or move) `standNr` into `order` at `index`; returns a new array. */
export function placeAt(order: string[], standNr: string, index: number): string[] {
  const without = order.filter((s) => s !== standNr);
  const target = Math.max(0, Math.min(index, without.length));
  return [...without.slice(0, target), standNr, ...without.slice(target)];
}

/** Convert a best→worst ordering into dense 1-based rankPos values. */
export function renumber(order: string[]): Map<string, number> {
  return new Map(order.map((standNr, i) => [standNr, i + 1]));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/domain/src/lib/placement.ts libs/domain/src/lib/placement.spec.ts
git commit -m "feat(domain): reorder and renumber placements"
```

---

## Task 3: Facade extension + `JuryStore` signal layer

**Files:**
- Modify: `libs/data-access/src/lib/jury.service.ts`
- Generate: `libs/feature-jury` (Angular lib)
- Create: `libs/feature-jury/src/lib/jury-store.ts`
- Create: `libs/feature-jury/src/lib/jury-store.spec.ts`

- [ ] **Step 1: Expose `scoresForJudge` on the facade**

Add to the `JuryService` class in `libs/data-access/src/lib/jury.service.ts` (import `scoresForJudge` already present from Task 10/11):

```ts
  scoresForJudge(judge: JudgeSlot) { return scoresForJudge(this.db, judge); }
```

- [ ] **Step 2: Generate the feature library**

```bash
cd /Users/aaltwesthuis/Sources/playground/winnovation-jury-app
pnpm nx g @nx/angular:library feature-jury --directory=libs/feature-jury \
  --standalone --unitTestRunner=vitest --importPath=@winnovation/feature-jury --no-interactive
```

Expected: `libs/feature-jury/` created. Delete generated sample component files: `rm -f libs/feature-jury/src/lib/*.component.ts libs/feature-jury/src/lib/*.spec.ts`.

- [ ] **Step 3: Write the failing store test**

`libs/feature-jury/src/lib/jury-store.spec.ts`:

```ts
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CRITERIA } from '@winnovation/domain';
import { JuryStore } from './jury-store';

describe('JuryStore', () => {
  let store: JuryStore;
  beforeEach(() => { store = TestBed.inject(JuryStore); });
  afterEach(async () => { await store.resetForTest(); });

  it('captures a deelnemer: writes roster, four scores, and meta', async () => {
    store.setJudge('A');
    await store.createEvent('Winnovation', '2026-06-05');
    await store.captureDeelnemer({
      standNr: '7', projectgroep: 'AI-compostbak', isVervolgproject: false,
      keyword: 'compost', note: '', review: '',
      scores: { innovativiteit: 5, relevantie: 4, haalbaarheid: 3, impact: 4 },
    });
    await store.refreshDeelnemers();
    expect(store.deelnemers().map((d) => d.standNr)).toEqual(['7']);
    const scores = await store['service'].scoresForJudge('A');
    expect(scores).toHaveLength(CRITERIA.length);
  });

  it('places a deelnemer on a criterion and renumbers rankPos', async () => {
    store.setJudge('A');
    await store.createEvent('Winnovation', '2026-06-05');
    await store.captureDeelnemer({ standNr: '1', projectgroep: 'One', isVervolgproject: false, keyword: 'a', note: '', review: '', scores: { innovativiteit: 5, relevantie: 5, haalbaarheid: 5, impact: 5 } });
    await store.captureDeelnemer({ standNr: '2', projectgroep: 'Two', isVervolgproject: false, keyword: 'b', note: '', review: '', scores: { innovativiteit: 3, relevantie: 3, haalbaarheid: 3, impact: 3 } });
    await store.applyPlacement('impact', '1', 0); // best
    await store.applyPlacement('impact', '2', 1); // worse
    const scores = await store['service'].scoresForJudge('A');
    const impact = scores.filter((s) => s.criterion === 'impact');
    expect(impact.find((s) => s.standNr === '1')?.rankPos).toBe(1);
    expect(impact.find((s) => s.standNr === '2')?.rankPos).toBe(2);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm nx test feature-jury`
Expected: FAIL — `Cannot find module './jury-store'`.

- [ ] **Step 5: Write the store**

`libs/feature-jury/src/lib/jury-store.ts`:

```ts
import { Injectable, signal } from '@angular/core';
import {
  CRITERIA, type Criterion, type Deelnemer, type DriftFlag, type JudgeSlot, type JuryEvent,
  type Placed, type ScoreValue, placeAt, renumber,
} from '@winnovation/domain';
import { JuryDb, JuryService } from '@winnovation/data-access';

export interface CaptureInput {
  standNr: string;
  projectgroep: string;
  isVervolgproject: boolean;
  keyword: string;
  note: string;
  review: string;
  scores: Record<Criterion, ScoreValue>;
  photoRef?: string | null;
}

@Injectable({ providedIn: 'root' })
export class JuryStore {
  private db = new JuryDb();
  private service = new JuryService(this.db);

  readonly event = signal<JuryEvent | null>(null);
  readonly judge = signal<JudgeSlot>('A');
  readonly deelnemers = signal<Deelnemer[]>([]);
  readonly driftFlags = signal<DriftFlag[]>([]);

  setJudge(slot: JudgeSlot) { this.judge.set(slot); }

  async createEvent(name: string, date: string): Promise<void> {
    this.event.set(await this.service.createEvent({ name, date }));
  }

  async joinEvent(code: string, slot: JudgeSlot): Promise<boolean> {
    const found = await this.service.findEventByCode(code);
    if (!found) return false;
    this.event.set(found);
    this.judge.set(slot);
    await this.refreshDeelnemers();
    return true;
  }

  async refreshDeelnemers(): Promise<void> {
    const event = this.event();
    if (!event) return;
    this.deelnemers.set(await this.service.listDeelnemers(event.id));
  }

  async captureDeelnemer(input: CaptureInput): Promise<void> {
    const event = this.event();
    if (!event) throw new Error('No active event');
    const judge = this.judge();
    await this.service.upsertDeelnemer({
      eventId: event.id, standNr: input.standNr,
      projectgroep: input.projectgroep, isVervolgproject: input.isVervolgproject,
    });
    for (const criterion of CRITERIA) {
      await this.service.saveScore({
        judge, standNr: input.standNr, criterion, value: input.scores[criterion], rankPos: null,
      });
    }
    await this.service.saveCaptureMeta({
      judge, standNr: input.standNr, keyword: input.keyword, note: input.note,
      review: input.review, photoRef: input.photoRef ?? null,
    });
    await this.refreshDeelnemers();
  }

  async placedFor(criterion: Criterion): Promise<Placed[]> {
    const all = await this.service.scoresForJudge(this.judge());
    return all
      .filter((s) => s.criterion === criterion && s.rankPos !== null)
      .map((s) => ({ standNr: s.standNr, value: s.value, rankPos: s.rankPos as number }));
  }

  /** Insert `standNr` at `index` in the criterion ordering and persist new rankPos values. */
  async applyPlacement(criterion: Criterion, standNr: string, index: number): Promise<void> {
    const judge = this.judge();
    const all = await this.service.scoresForJudge(judge);
    const slice = all.filter((s) => s.criterion === criterion);
    const order = slice
      .filter((s) => s.rankPos !== null)
      .sort((a, b) => (a.rankPos as number) - (b.rankPos as number))
      .map((s) => s.standNr);

    const newRanks = renumber(placeAt(order, standNr, index));
    for (const score of slice) {
      const rankPos = newRanks.get(score.standNr) ?? null;
      if (rankPos !== score.rankPos) {
        await this.service.saveScore({ ...score, rankPos });
      }
    }
    await this.refreshDrift();
  }

  async refreshDrift(): Promise<void> {
    this.driftFlags.set(await this.service.driftFlags(this.judge()));
  }

  finalRanking() { return this.service.finalRanking(); }

  /** Test helper: wipe the IndexedDB instance. */
  async resetForTest(): Promise<void> { await this.db.delete(); }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm nx test feature-jury`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/data-access/src/lib/jury.service.ts libs/feature-jury
git commit -m "feat(feature-jury): add JuryStore signal layer over JuryService"
```

---

## Task 4: Routing skeleton

**Files:**
- Create: `libs/feature-jury/src/lib/jury.routes.ts`
- Modify: `apps/jury-app/src/app/app.routes.ts`

- [ ] **Step 1: Define the routes** (components are created in Part B; use `loadComponent` so the table compiles before they exist by creating empty stub files first)

Create empty stubs so the app compiles now:

```bash
for f in join event-home stand compare review; do
  printf "import { Component } from '@angular/core';\n@Component({ standalone: true, template: '' })\nexport class %sComponent {}\n" \
    "$(echo $f | sed -E 's/(^|-)([a-z])/\U\2/g')" \
    > libs/feature-jury/src/lib/$f.component.ts
done
```

`libs/feature-jury/src/lib/jury.routes.ts`:

```ts
import type { Routes } from '@angular/router';

export const juryRoutes: Routes = [
  { path: '', loadComponent: () => import('./join.component').then((m) => m.JoinComponent) },
  { path: 'home', loadComponent: () => import('./event-home.component').then((m) => m.EventHomeComponent) },
  { path: 'stand', loadComponent: () => import('./stand.component').then((m) => m.StandComponent) },
  { path: 'compare', loadComponent: () => import('./compare.component').then((m) => m.CompareComponent) },
  { path: 'review', loadComponent: () => import('./review.component').then((m) => m.ReviewComponent) },
];
```

- [ ] **Step 2: Mount in the app**

`apps/jury-app/src/app/app.routes.ts`:

```ts
import type { Routes } from '@angular/router';
import { juryRoutes } from '@winnovation/feature-jury';

export const appRoutes: Routes = [...juryRoutes];
```

- [ ] **Step 3: Verify the app builds**

Run: `pnpm nx build jury-app`
Expected: build succeeds (routes resolve to empty stub components).

- [ ] **Step 4: Commit**

```bash
git add libs/feature-jury/src/lib apps/jury-app/src/app/app.routes.ts
git commit -m "feat(feature-jury): add routing skeleton and screen stubs"
```

---

## Task 5: Reusable presentational components

**Files:**
- Generate: `libs/ui` (Angular lib)
- Create: `libs/ui/src/lib/score-input.component.ts` (+spec)
- Create: `libs/ui/src/lib/deelnemer-card.component.ts`
- Create: `libs/ui/src/lib/anchor-card.component.ts`

> Visual styling here is intentionally minimal/structural; the designer's system is applied in Part B's styling passes. The **component API** (`input()`/`output()`) is the stable contract.

- [ ] **Step 1: Generate the UI library**

```bash
pnpm nx g @nx/angular:library ui --directory=libs/ui \
  --standalone --unitTestRunner=vitest --importPath=@winnovation/ui --no-interactive
rm -f libs/ui/src/lib/*.component.ts libs/ui/src/lib/*.spec.ts
```

- [ ] **Step 2: Write the failing test for `ScoreInputComponent`**

`libs/ui/src/lib/score-input.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ScoreInputComponent } from './score-input.component';

describe('ScoreInputComponent', () => {
  it('emits the chosen value 1–5', () => {
    const fixture = TestBed.createComponent(ScoreInputComponent);
    let emitted: number | undefined;
    fixture.componentInstance.valueChange.subscribe((v) => (emitted = v));
    fixture.componentInstance.choose(4);
    expect(emitted).toBe(4);
  });

  it('exposes the scorekaart label for a value', () => {
    const fixture = TestBed.createComponent(ScoreInputComponent);
    expect(fixture.componentInstance.labelFor(1)).toBe('slecht');
    expect(fixture.componentInstance.labelFor(5)).toBe('uitstekend');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm nx test ui`
Expected: FAIL — `Cannot find module './score-input.component'`.

- [ ] **Step 4: Write `ScoreInputComponent`**

`libs/ui/src/lib/score-input.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ScoreValue } from '@winnovation/domain';

const LABELS: Record<ScoreValue, string> = {
  1: 'slecht', 2: 'matig', 3: 'goed', 4: 'zeer goed', 5: 'uitstekend',
};

@Component({
  selector: 'wn-score-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex gap-2" role="radiogroup" [attr.aria-label]="criterion()">
      @for (n of values; track n) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="value() === n"
          class="flex-1 rounded-lg border py-3 text-center"
          [class.font-bold]="value() === n"
          (click)="choose(n)">
          <span class="block text-lg">{{ n }}</span>
          <span class="block text-xs">{{ labelFor(n) }}</span>
        </button>
      }
    </div>
  `,
})
export class ScoreInputComponent {
  readonly criterion = input<string>('');
  readonly value = input<ScoreValue | null>(null);
  readonly valueChange = output<ScoreValue>();

  readonly values: ScoreValue[] = [1, 2, 3, 4, 5];
  labelFor(n: ScoreValue): string { return LABELS[n]; }
  choose(n: ScoreValue): void { this.valueChange.emit(n); }
}
```

- [ ] **Step 5: Run the test, then add the two card components**

Run: `pnpm nx test ui` → Expected: PASS.

`libs/ui/src/lib/deelnemer-card.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'wn-deelnemer-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="flex items-center gap-3 rounded-xl border p-3">
      @if (photoUrl()) {
        <img [src]="photoUrl()" alt="" class="h-12 w-12 rounded-lg object-cover" />
      } @else {
        <div class="h-12 w-12 rounded-lg bg-gray-200"></div>
      }
      <div class="min-w-0">
        <p class="truncate font-semibold">{{ keyword() }}</p>
        <p class="truncate text-sm text-gray-500">#{{ standNr() }} · {{ projectgroep() }}</p>
      </div>
    </article>
  `,
})
export class DeelnemerCardComponent {
  readonly standNr = input.required<string>();
  readonly projectgroep = input.required<string>();
  readonly keyword = input<string>('');
  readonly photoUrl = input<string | null>(null);
}
```

`libs/ui/src/lib/anchor-card.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'wn-anchor-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl border-2 p-4 text-center">
      <p class="font-semibold">{{ keyword() || ('#' + standNr()) }}</p>
      <p class="text-sm text-gray-500">{{ projectgroep() }}</p>
    </div>
  `,
})
export class AnchorCardComponent {
  readonly standNr = input.required<string>();
  readonly projectgroep = input<string>('');
  readonly keyword = input<string>('');
}
```

- [ ] **Step 6: Commit**

```bash
git add libs/ui
git commit -m "feat(ui): add score input and card components"
```

---

# PART B — wireframe-dependent (WAIT for designs)

Each screen below lists its **behavioral contract** and ships a **functional skeleton**. After the skeleton works, the final step applies the designer's visual system. Templates here are deliberately minimal.

## Task 6: Join screen

**Behavioral contract:** Collect an event code + judge slot → `JuryStore.joinEvent(code, slot)`; on success navigate to `/home`. Offer a "create a new event" path → `JuryStore.createEvent(name, date)` → `/home`. States: idle, invalid code, creating.

**Files:** `libs/feature-jury/src/lib/join.component.ts`

- [ ] **Step 1: Replace the stub with a functional component**

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { JudgeSlot } from '@winnovation/domain';
import { JuryStore } from './jury-store';

@Component({
  selector: 'wn-join',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-sm space-y-4 p-6">
      <h1 class="text-xl font-bold">Winnovation jury</h1>
      <input [(ngModel)]="code" placeholder="Event-code" class="w-full rounded border p-3" />
      <div class="flex gap-2">
        <button (click)="join('A')" class="flex-1 rounded border p-3">Jurylid A</button>
        <button (click)="join('B')" class="flex-1 rounded border p-3">Jurylid B</button>
      </div>
      @if (error()) { <p class="text-red-600">Onbekende code</p> }
    </section>
  `,
})
export class JoinComponent {
  private store = inject(JuryStore);
  private router = inject(Router);
  code = '';
  readonly error = signal(false);

  async join(slot: JudgeSlot): Promise<void> {
    const ok = await this.store.joinEvent(this.code.trim(), slot);
    if (ok) this.router.navigate(['/home']);
    else this.error.set(true);
  }
}
```

- [ ] **Step 2: Verify build** — Run: `pnpm nx build jury-app` → Expected: PASS.
- [ ] **Step 3: Apply visual design** — restyle template per the Join wireframe (event-code entry, judge-slot picker, create-event affordance). Keep the `JuryStore` calls unchanged.
- [ ] **Step 4: Commit** — `git commit -am "feat(feature-jury): join screen"`

## Task 7: Event home screen

**Behavioral contract:** Show `JuryStore.deelnemers()` as cards; a "+ Nieuwe deelnemer" → `/stand`; progress (scored / placed / open drift via `driftFlags()`); nav to `/compare` and `/review`. On init: `refreshDeelnemers()` + `refreshDrift()`.

**Files:** `libs/feature-jury/src/lib/event-home.component.ts`

- [ ] **Step 1: Replace the stub**

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DeelnemerCardComponent } from '@winnovation/ui';
import { JuryStore } from './jury-store';

@Component({
  selector: 'wn-event-home',
  standalone: true,
  imports: [RouterLink, DeelnemerCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-3 p-4">
      <header class="flex items-center justify-between">
        <h1 class="font-bold">{{ store.event()?.name }}</h1>
        <span class="text-sm">Drift: {{ store.driftFlags().length }}</span>
      </header>
      <a routerLink="/stand" class="block rounded border p-3 text-center">+ Nieuwe deelnemer</a>
      @for (d of store.deelnemers(); track d.standNr) {
        <wn-deelnemer-card [standNr]="d.standNr" [projectgroep]="d.projectgroep" />
      }
      <nav class="flex gap-2 pt-2">
        <a routerLink="/compare" class="flex-1 rounded border p-3 text-center">Vergelijk</a>
        <a routerLink="/review" class="flex-1 rounded border p-3 text-center">Review</a>
      </nav>
    </section>
  `,
})
export class EventHomeComponent implements OnInit {
  readonly store = inject(JuryStore);
  async ngOnInit(): Promise<void> {
    await this.store.refreshDeelnemers();
    await this.store.refreshDrift();
  }
}
```

- [ ] **Step 2: Verify build** — Run: `pnpm nx build jury-app` → Expected: PASS.
- [ ] **Step 3: Apply visual design** — restyle per Event-home wireframe (progress treatment, list, primary action). Keep store calls unchanged.
- [ ] **Step 4: Commit** — `git commit -am "feat(feature-jury): event home screen"`

## Task 8: Stand capture screen

**Behavioral contract:** A form (`standNr`, `projectgroep`, `isVervolgproject` toggle → reminder banner, `keyword`, four `ScoreInputComponent`s, `note`, `review`, optional photo via `<input type="file" capture>`) → `JuryStore.captureDeelnemer(input)` → offer "place now" (`/compare`) or "next" (`/stand`). Validation: `standNr` + four scores required.

**Files:** `libs/feature-jury/src/lib/stand.component.ts`

- [ ] **Step 1: Replace the stub** (functional skeleton)

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CRITERIA, type Criterion, type ScoreValue } from '@winnovation/domain';
import { ScoreInputComponent } from '@winnovation/ui';
import { JuryStore } from './jury-store';

@Component({
  selector: 'wn-stand',
  standalone: true,
  imports: [FormsModule, ScoreInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-4 p-4">
      <input [(ngModel)]="standNr" placeholder="Stand nr" class="w-full rounded border p-3" />
      <input [(ngModel)]="projectgroep" placeholder="Projectgroep" class="w-full rounded border p-3" />
      <label class="flex items-center gap-2">
        <input type="checkbox" [(ngModel)]="isVervolg" /> Vervolgproject
      </label>
      @if (isVervolg) {
        <p class="rounded bg-amber-100 p-2 text-sm">Beoordeel alleen de uitbreiding/verbetering.</p>
      }
      <input [(ngModel)]="keyword" placeholder="Keyword" class="w-full rounded border p-3" />
      @for (c of criteria; track c) {
        <div>
          <p class="mb-1 font-medium capitalize">{{ c }}</p>
          <wn-score-input [criterion]="c" [value]="scores[c] ?? null" (valueChange)="scores[c] = $event" />
        </div>
      }
      <textarea [(ngModel)]="note" placeholder="Notitie (privé)" class="w-full rounded border p-3"></textarea>
      <textarea [(ngModel)]="review" placeholder="Feedback voor de groep" class="w-full rounded border p-3"></textarea>
      <button [disabled]="!valid()" (click)="save()" class="w-full rounded bg-black p-3 text-white">Opslaan</button>
    </section>
  `,
})
export class StandComponent {
  private store = inject(JuryStore);
  private router = inject(Router);

  readonly criteria = CRITERIA;
  standNr = '';
  projectgroep = '';
  isVervolg = false;
  keyword = '';
  note = '';
  review = '';
  scores: Partial<Record<Criterion, ScoreValue>> = {};

  valid(): boolean {
    return this.standNr.trim() !== '' && CRITERIA.every((c) => this.scores[c] != null);
  }

  async save(): Promise<void> {
    await this.store.captureDeelnemer({
      standNr: this.standNr.trim(), projectgroep: this.projectgroep.trim(),
      isVervolgproject: this.isVervolg, keyword: this.keyword.trim(),
      note: this.note, review: this.review,
      scores: this.scores as Record<Criterion, ScoreValue>,
    });
    this.router.navigate(['/compare']);
  }
}
```

- [ ] **Step 2: Verify build** — Run: `pnpm nx build jury-app` → Expected: PASS.
- [ ] **Step 3: Add photo capture** — add `<input type="file" accept="image/*" capture="environment">`, store the blob via a new `JuryStore.savePhoto(blob)` helper (wrapping `putPhoto`, returns a ref id) and pass `photoRef` into `captureDeelnemer`. Write the helper + a store test mirroring Task 3's pattern.
- [ ] **Step 4: Apply visual design** — restyle per Stand wireframe; this is the hot path, optimise tap targets/one-handed reach. Keep store calls unchanged.
- [ ] **Step 5: Commit** — `git commit -am "feat(feature-jury): stand capture screen"`

## Task 9: Compare screen (the centrepiece)

**Behavioral contract:** Pick an unplaced (or under-refined) deelnemer + a criterion. Compute `bracketingAnchors(await store.placedFor(criterion), value)`. Show the `above`/`below` anchors with three actions:
- **Boven** (above both) → `index = anchors.index - 1` clamped to ≥ 0 (i.e. before `above`); if `above` is null, `index = 0`.
- **Tussen** (between) → `index = anchors.index`.
- **Onder** (below both) → `index = anchors.index + 1`; if `below` is null, `index = anchors.index`.

Then `await store.applyPlacement(criterion, standNr, index)` and advance to the next criterion/deelnemer. Loop across the four criteria, then the next unplaced deelnemer.

**Files:** `libs/feature-jury/src/lib/compare.component.ts`

- [ ] **Step 1: Replace the stub** (functional skeleton — full logic, lean template)

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { type Anchors, CRITERIA, type Criterion, type ScoreValue, bracketingAnchors } from '@winnovation/domain';
import { AnchorCardComponent } from '@winnovation/ui';
import { JuryStore } from './jury-store';

interface Task { standNr: string; criterion: Criterion; value: ScoreValue; }

@Component({
  selector: 'wn-compare',
  standalone: true,
  imports: [AnchorCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (current(); as t) {
      <section class="space-y-4 p-4">
        <p class="text-center text-sm capitalize text-gray-500">{{ t.criterion }}</p>
        <p class="text-center font-bold">Plaats #{{ t.standNr }}</p>
        @if (anchors()?.above; as a) { <wn-anchor-card [standNr]="a.standNr" /> }
        <div class="flex flex-col gap-2">
          <button (click)="choose('boven')" class="rounded border p-3">Boven</button>
          <button (click)="choose('tussen')" class="rounded border p-3">Tussen</button>
          <button (click)="choose('onder')" class="rounded border p-3">Onder</button>
        </div>
        @if (anchors()?.below; as b) { <wn-anchor-card [standNr]="b.standNr" /> }
      </section>
    } @else {
      <p class="p-6 text-center">Niets meer te vergelijken.</p>
    }
  `,
})
export class CompareComponent implements OnInit {
  private store = inject(JuryStore);
  readonly queue = signal<Task[]>([]);
  readonly current = signal<Task | null>(null);
  readonly anchors = signal<Anchors | null>(null);

  async ngOnInit(): Promise<void> { await this.buildQueue(); await this.advance(); }

  private async buildQueue(): Promise<void> {
    const all = await this.store['service'].scoresForJudge(this.store.judge());
    const tasks = all
      .filter((s) => s.rankPos === null)
      .map((s) => ({ standNr: s.standNr, criterion: s.criterion, value: s.value }));
    this.queue.set(tasks);
  }

  private async advance(): Promise<void> {
    const [next, ...rest] = this.queue();
    this.queue.set(rest);
    this.current.set(next ?? null);
    if (next) {
      this.anchors.set(bracketingAnchors(await this.store.placedFor(next.criterion), next.value));
    }
  }

  async choose(where: 'boven' | 'tussen' | 'onder'): Promise<void> {
    const t = this.current();
    const a = this.anchors();
    if (!t || !a) return;
    const index =
      where === 'boven' ? Math.max(0, a.above ? a.index - 1 : 0)
      : where === 'tussen' ? a.index
      : a.below ? a.index + 1 : a.index;
    await this.store.applyPlacement(t.criterion, t.standNr, index);
    await this.advance();
  }
}
```

- [ ] **Step 2: Verify build** — Run: `pnpm nx build jury-app` → Expected: PASS.
- [ ] **Step 3: Enrich anchor cards** — pass `projectgroep`/`keyword`/photo into `wn-anchor-card` by looking up `store.deelnemers()` + capture meta (add a `store.metaFor(standNr)` helper). The placement *logic* stays as-is.
- [ ] **Step 4: Apply visual design** — this is the signature interaction; build it per the Compare wireframe/prototype (card stack, gesture vs. buttons, active-criterion emphasis). Keep `bracketingAnchors`/`applyPlacement` calls unchanged.
- [ ] **Step 5: Commit** — `git commit -am "feat(feature-jury): compare insertion screen"`

## Task 10: Review screen

**Behavioral contract:** For a selected criterion, list everyone sorted by `rankPos` with `value`; surface `store.driftFlags()` for that criterion at the top; tapping a flag opens a resolve action (re-show `ScoreInputComponent` to adjust `value`, or jump to Compare to re-place). On any change: `refreshDrift()`.

**Files:** `libs/feature-jury/src/lib/review.component.ts`

- [ ] **Step 1: Replace the stub** (functional skeleton)

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CRITERIA, type Criterion, type Score } from '@winnovation/domain';
import { JuryStore } from './jury-store';

@Component({
  selector: 'wn-review',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-3 p-4">
      <div class="flex gap-2">
        @for (c of criteria; track c) {
          <button (click)="select(c)" class="rounded border px-2 py-1 text-xs capitalize"
                  [class.font-bold]="criterion() === c">{{ c }}</button>
        }
      </div>
      @if (flagsForCriterion().length) {
        <div class="rounded bg-amber-100 p-2 text-sm">
          {{ flagsForCriterion().length }} drift-conflict(en) op dit criterium
        </div>
      }
      <ol class="space-y-1">
        @for (s of rows(); track s.standNr) {
          <li class="flex justify-between rounded border p-2">
            <span>#{{ s.rankPos }} · {{ s.standNr }}</span><span>{{ s.value }}</span>
          </li>
        }
      </ol>
    </section>
  `,
})
export class ReviewComponent implements OnInit {
  private store = inject(JuryStore);
  readonly criteria = CRITERIA;
  readonly criterion = signal<Criterion>('innovativiteit');
  readonly rows = signal<Score[]>([]);

  async ngOnInit(): Promise<void> { await this.store.refreshDrift(); await this.load(); }

  flagsForCriterion() {
    return this.store.driftFlags().filter((f) => f.criterion === this.criterion());
  }

  async select(c: Criterion): Promise<void> { this.criterion.set(c); await this.load(); }

  private async load(): Promise<void> {
    const all = await this.store['service'].scoresForJudge(this.store.judge());
    this.rows.set(
      all.filter((s) => s.criterion === this.criterion() && s.rankPos !== null)
         .sort((a, b) => (a.rankPos as number) - (b.rankPos as number)),
    );
  }
}
```

- [ ] **Step 2: Verify build** — Run: `pnpm nx build jury-app` → Expected: PASS.
- [ ] **Step 3: Add inline resolve** — make a flagged pair tappable: open `ScoreInputComponent` to adjust the `value` (persist via a `store.updateScoreValue(...)` helper) or route to `/compare` to re-place; call `refreshDrift()` + `load()` after.
- [ ] **Step 4: Apply visual design** — restyle per Review wireframe (flag prominence calibrated to "attention, not nagging"). Keep store calls unchanged.
- [ ] **Step 5: Commit** — `git commit -am "feat(feature-jury): review and drift-resolution screen"`

---

## Self-Review

**Spec/brief coverage:** Join, Event home, Stand, Compare, Review (brief §5 A–F minus Reconcile/Result → Plan 3) ✓ · 1–5 score input with labels (brief §7) ✓ · vervolgproject reminder ✓ · drift flags surfaced + resolvable ✓ · Compare 3-way insertion as signature interaction (brief §6) ✓ · offline (all screens use local `JuryStore`) ✓ · Dutch microcopy ✓.

**Placeholder scan:** Part A is fully TDD'd with complete code. Part B components are complete, runnable skeletons; their final markup is explicitly a "apply visual design" step gated on wireframes — a documented dependency, not a code placeholder.

**Type consistency:** `JuryStore` methods (`captureDeelnemer`, `applyPlacement`, `placedFor`, `driftFlags`, `finalRanking`) and engine functions (`bracketingAnchors`, `placeAt`, `renumber`) are referenced identically across tasks. `CaptureInput.scores` is `Record<Criterion, ScoreValue>` everywhere. `ScoreValue`, `Criterion`, `Anchors`, `Placed` reused from `@winnovation/domain`.

**Note:** `store['service']` access in specs/components is a deliberate test/skeleton convenience; the visual-design pass may promote frequently-used reads (e.g. `scoresForJudge`) to first-class `JuryStore` signals.
