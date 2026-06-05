# Winnovation Jury — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the design-independent core of the Winnovation jury PWA — the fairness engine, offline persistence, and a service facade — fully unit-tested, plus a buildable Angular PWA shell.

**Architecture:** An Nx monorepo. Two framework-agnostic TypeScript libraries hold all the logic: `domain` (pure fairness functions, zero dependencies) and `data-access` (Dexie/IndexedDB persistence + a `JuryService` facade composing the two). The Angular PWA app is scaffolded as a shell only — its screens are built later (Plan 2) against the designer's wireframes, consuming `JuryService`.

**Tech Stack:** Nx · Angular v21 (PWA) · TypeScript (strict) · Dexie (IndexedDB) · Vitest + fake-indexeddb (tests) · Biome (lint/format) · pnpm.

**Scope boundary:** This plan deliberately excludes the UI screens (Plan 2) and the sync backend + Reconcile (Plan 3). Those depend on this foundation and, for the UI, on the design deliverables. The fairness logic and persistence are fully exercised here by unit tests, so this plan ships verifiable software on its own.

---

## File Structure

Created in this plan:

| File | Responsibility |
| --- | --- |
| `libs/domain/src/lib/model.ts` | Domain types + `CRITERIA` constant. No logic, no deps. |
| `libs/domain/src/lib/fairness.ts` | Pure fairness functions: raw total, drift detection, common-set ranking, final rank-merge. |
| `libs/domain/src/lib/fairness.spec.ts` | Vitest unit tests for the engine. |
| `libs/domain/src/index.ts` | Public barrel for `@winnovation/domain`. |
| `libs/data-access/src/lib/db.ts` | `JuryDb` Dexie schema (tables + indexes). |
| `libs/data-access/src/lib/events.repo.ts` | Event create / lookup-by-code, judge join. |
| `libs/data-access/src/lib/deelnemers.repo.ts` | Deelnemer roster CRUD, merge-by-`standNr`. |
| `libs/data-access/src/lib/scores.repo.ts` | Score / placement / capture-meta / photo persistence + queries. |
| `libs/data-access/src/lib/jury.service.ts` | `JuryService` facade: composes repos + engine; the API the UI consumes. |
| `libs/data-access/src/lib/*.spec.ts` | Vitest tests (with `fake-indexeddb`). |
| `libs/data-access/src/index.ts` | Public barrel for `@winnovation/data-access`. |
| `apps/jury-app/**` | Angular PWA shell (generated; screens deferred to Plan 2). |
| `biome.json` | Biome config (project uses Biome, never ESLint/Prettier). |

Design rule: `domain` has **zero** runtime dependencies. `data-access` depends on `dexie` and `@winnovation/domain`. The app depends on `data-access`. Never the reverse.

---

## Task 1: Workspace, tooling & PWA shell

**Files:**
- Create: workspace at `/Users/aaltwesthuis/Sources/playground/winnovation-jury-app` (already holds `.git/` + `docs/`)
- Create: `apps/jury-app/**`, `libs/domain/**`, `libs/data-access/**`, `biome.json`

- [ ] **Step 1: Scaffold the Nx Angular workspace into the existing folder**

The folder already contains `.git/` and `docs/`, so generate into a temp dir and merge (preserving git history + docs):

```bash
cd /Users/aaltwesthuis/Sources/playground
pnpm dlx create-nx-workspace@latest jury-workspace-tmp \
  --preset=angular-monorepo --appName=jury-app \
  --style=css --bundler=esbuild --ssr=false \
  --e2eTestRunner=none --unitTestRunner=jest \
  --packageManager=pnpm --no-interactive
rsync -a --exclude='.git' jury-workspace-tmp/ winnovation-jury-app/
rm -rf jury-workspace-tmp
```

Expected: `winnovation-jury-app/` now contains `nx.json`, `package.json`, `apps/jury-app/`, `pnpm-lock.yaml`; `docs/` and `.git/` untouched.

- [ ] **Step 2: Add the PWA service worker + manifest to the app**

```bash
cd /Users/aaltwesthuis/Sources/playground/winnovation-jury-app
pnpm add -D @angular/pwa
pnpm nx g @angular/pwa:ng-add --project=jury-app
```

Expected: `apps/jury-app/public/manifest.webmanifest`, `apps/jury-app/ngsw-config.json` created; `ServiceWorker` registration added to the app config.

- [ ] **Step 3: Generate the two TypeScript libraries (Vitest runner)**

```bash
pnpm nx g @nx/js:library domain --directory=libs/domain \
  --unitTestRunner=vitest --bundler=none --importPath=@winnovation/domain --no-interactive
pnpm nx g @nx/js:library data-access --directory=libs/data-access \
  --unitTestRunner=vitest --bundler=none --importPath=@winnovation/data-access --no-interactive
```

Expected: `libs/domain/` and `libs/data-access/` exist, each with `src/index.ts`, a sample `*.spec.ts`, and a `vite.config.ts`.

- [ ] **Step 4: Install runtime + test dependencies**

```bash
pnpm add dexie --filter @winnovation/data-access || pnpm add dexie -w
pnpm add -D fake-indexeddb @biomejs/biome -w
```

Expected: `dexie` in dependencies, `fake-indexeddb` + `@biomejs/biome` in devDependencies.

- [ ] **Step 5: Add Biome config**

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "files": { "ignore": ["dist", ".nx", "node_modules"] }
}
```

- [ ] **Step 6: Delete the generated sample files and verify the toolchain**

```bash
rm -f libs/domain/src/lib/*.ts libs/data-access/src/lib/*.ts
pnpm nx build jury-app
```

Expected: app builds successfully (the shell renders the default Angular page). The empty libs are wired but currently export nothing — that's fixed in later tasks.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Nx Angular PWA workspace with domain + data-access libs"
```

---

## Task 2: Domain model & criteria

**Files:**
- Create: `libs/domain/src/lib/model.ts`
- Create: `libs/domain/src/lib/model.spec.ts`
- Modify: `libs/domain/src/index.ts`

- [ ] **Step 1: Write the failing test**

`libs/domain/src/lib/model.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CRITERIA } from './model';

describe('CRITERIA', () => {
  it('lists the four official criteria in scorekaart order', () => {
    expect(CRITERIA).toEqual(['innovativiteit', 'relevantie', 'haalbaarheid', 'impact']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test domain`
Expected: FAIL — `Cannot find module './model'`.

- [ ] **Step 3: Write the model**

`libs/domain/src/lib/model.ts`:

```ts
export const CRITERIA = ['innovativiteit', 'relevantie', 'haalbaarheid', 'impact'] as const;
export type Criterion = (typeof CRITERIA)[number];

export type JudgeSlot = 'A' | 'B';
export type ScoreValue = 1 | 2 | 3 | 4 | 5;

/** Renamed from "Event" to avoid clashing with the DOM `Event` type. */
export interface JuryEvent {
  id: string;
  name: string;
  date: string; // ISO date
  eventCode: string;
}

export interface Deelnemer {
  eventId: string;
  standNr: string; // identity within an event; the join key between the two judges
  projectgroep: string;
  isVervolgproject: boolean;
}

export interface Score {
  judge: JudgeSlot;
  standNr: string;
  criterion: Criterion;
  value: ScoreValue; // 1–5, the absolute read
  rankPos: number | null; // 1 = best; null = not yet placed
}

export interface CaptureMeta {
  judge: JudgeSlot;
  standNr: string;
  keyword: string;
  note: string;
  review: string;
  photoRef: string | null; // id into the local photos table; null when no photo
}
```

- [ ] **Step 4: Export from the barrel and run the test**

`libs/domain/src/index.ts`:

```ts
export * from './lib/model';
export * from './lib/fairness';
```

Run: `pnpm nx test domain`
Expected: PASS. (The `./lib/fairness` export will resolve in Task 3; if running now, create an empty `libs/domain/src/lib/fairness.ts` first.)

- [ ] **Step 5: Commit**

```bash
git add libs/domain/src/lib/model.ts libs/domain/src/lib/model.spec.ts libs/domain/src/index.ts
git commit -m "feat(domain): add jury domain model and criteria constant"
```

---

## Task 3: Raw total

**Files:**
- Create: `libs/domain/src/lib/fairness.ts`
- Create: `libs/domain/src/lib/fairness.spec.ts`

- [ ] **Step 1: Write the failing test**

`libs/domain/src/lib/fairness.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CRITERIA, type Criterion, type JudgeSlot, type Score, type ScoreValue } from './model';
import { rawTotalFor } from './fairness';

function scores(
  judge: JudgeSlot,
  rows: Array<{ s: string; v: Record<Criterion, ScoreValue>; r: Record<Criterion, number> }>,
): Score[] {
  return rows.flatMap(({ s, v, r }) =>
    CRITERIA.map((c) => ({ judge, standNr: s, criterion: c, value: v[c], rankPos: r[c] })),
  );
}

const v = (a: ScoreValue, b: ScoreValue, c: ScoreValue, d: ScoreValue): Record<Criterion, ScoreValue> => ({
  innovativiteit: a, relevantie: b, haalbaarheid: c, impact: d,
});
const r = (a: number, b: number, c: number, d: number): Record<Criterion, number> => ({
  innovativiteit: a, relevantie: b, haalbaarheid: c, impact: d,
});

describe('rawTotalFor', () => {
  it('sums all eight numbers (four criteria × two judges) for a deelnemer', () => {
    const a = scores('A', [{ s: '1', v: v(5, 4, 3, 2), r: r(1, 1, 1, 1) }]);
    const b = scores('B', [{ s: '1', v: v(1, 1, 1, 1), r: r(1, 1, 1, 1) }]);
    expect(rawTotalFor('1', a, b)).toBe(5 + 4 + 3 + 2 + 4);
  });
});

export { scores, v, r }; // reused by later specs in this file
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test domain`
Expected: FAIL — `rawTotalFor is not a function`.

- [ ] **Step 3: Write the implementation**

`libs/domain/src/lib/fairness.ts`:

```ts
import type { Score } from './model';

/** Sum of every 1–5 value recorded for a deelnemer across both judges. Higher = better. */
export function rawTotalFor(standNr: string, scoresA: Score[], scoresB: Score[]): number {
  return [...scoresA, ...scoresB]
    .filter((s) => s.standNr === standNr)
    .reduce((sum, s) => sum + s.value, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/domain/src/lib/fairness.ts libs/domain/src/lib/fairness.spec.ts
git commit -m "feat(domain): add raw total computation"
```

---

## Task 4: Drift detection

A drift flag fires when, within one judge × criterion, a deelnemer is ranked **better** (lower `rankPos`) than another but scored **lower**. Checking adjacent pairs in rank order is sufficient: if no adjacent pair is inverted, the values are monotonic along the whole order.

**Files:**
- Modify: `libs/domain/src/lib/fairness.ts`
- Modify: `libs/domain/src/lib/fairness.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `libs/domain/src/lib/fairness.spec.ts`:

```ts
import { detectAllDrift, detectDriftForCriterion } from './fairness';
import type { Score } from './model';

describe('detectDriftForCriterion', () => {
  const mk = (standNr: string, value: number, rankPos: number): Score => ({
    judge: 'A', standNr, criterion: 'impact', value: value as Score['value'], rankPos,
  });

  it('flags a deelnemer ranked better but scored lower than its neighbour', () => {
    // rankPos 1 (best) has value 3, rankPos 2 has value 4 → inversion
    const flags = detectDriftForCriterion([mk('x', 3, 1), mk('y', 4, 2)]);
    expect(flags).toEqual([
      { judge: 'A', criterion: 'impact', betterRanked: 'x', worseRanked: 'y' },
    ]);
  });

  it('returns no flags when values are monotonic with rank', () => {
    expect(detectDriftForCriterion([mk('x', 5, 1), mk('y', 4, 2), mk('z', 4, 3)])).toEqual([]);
  });

  it('ignores unplaced deelnemers (rankPos null)', () => {
    const unplaced: Score = { judge: 'A', standNr: 'q', criterion: 'impact', value: 1, rankPos: null };
    expect(detectDriftForCriterion([mk('x', 5, 1), unplaced])).toEqual([]);
  });
});

describe('detectAllDrift', () => {
  it('groups by judge and criterion', () => {
    const aImpact: Score[] = [
      { judge: 'A', standNr: 'x', criterion: 'impact', value: 3, rankPos: 1 },
      { judge: 'A', standNr: 'y', criterion: 'impact', value: 4, rankPos: 2 },
    ];
    const bImpact: Score[] = [
      { judge: 'B', standNr: 'x', criterion: 'impact', value: 5, rankPos: 1 },
      { judge: 'B', standNr: 'y', criterion: 'impact', value: 4, rankPos: 2 },
    ];
    expect(detectAllDrift([...aImpact, ...bImpact])).toEqual([
      { judge: 'A', criterion: 'impact', betterRanked: 'x', worseRanked: 'y' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test domain`
Expected: FAIL — `detectDriftForCriterion is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `libs/domain/src/lib/fairness.ts`:

```ts
import { type Criterion, type JudgeSlot } from './model';

export interface DriftFlag {
  judge: JudgeSlot;
  criterion: Criterion;
  betterRanked: string; // standNr ranked better (lower rankPos) but scored lower
  worseRanked: string;
}

/** All scores must share one judge and one criterion. Unplaced scores are ignored. */
export function detectDriftForCriterion(scores: Score[]): DriftFlag[] {
  const placed = scores
    .filter((s): s is Score & { rankPos: number } => s.rankPos !== null)
    .sort((a, b) => a.rankPos - b.rankPos);

  const flags: DriftFlag[] = [];
  for (let i = 0; i < placed.length - 1; i++) {
    const better = placed[i];
    const worse = placed[i + 1];
    if (better.value < worse.value) {
      flags.push({
        judge: better.judge,
        criterion: better.criterion,
        betterRanked: better.standNr,
        worseRanked: worse.standNr,
      });
    }
  }
  return flags;
}

export function detectAllDrift(scores: Score[]): DriftFlag[] {
  const groups = new Map<string, Score[]>();
  for (const s of scores) {
    const key = `${s.judge}|${s.criterion}`;
    const group = groups.get(key);
    if (group) group.push(s);
    else groups.set(key, [s]);
  }
  return [...groups.values()].flatMap(detectDriftForCriterion);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/domain/src/lib/fairness.ts libs/domain/src/lib/fairness.spec.ts
git commit -m "feat(domain): detect number-vs-rank drift flags"
```

---

## Task 5: Common set & ranks within the set

**Files:**
- Modify: `libs/domain/src/lib/fairness.ts`
- Modify: `libs/domain/src/lib/fairness.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `libs/domain/src/lib/fairness.spec.ts`:

```ts
import { commonStandNrs, ranksWithinSet } from './fairness';

describe('commonStandNrs', () => {
  it('returns standNrs scored by both judges, sorted', () => {
    const a = scores('A', [
      { s: '2', v: v(3, 3, 3, 3), r: r(1, 1, 1, 1) },
      { s: '1', v: v(4, 4, 4, 4), r: r(2, 2, 2, 2) },
    ]);
    const b = scores('B', [
      { s: '1', v: v(5, 5, 5, 5), r: r(1, 1, 1, 1) },
      { s: '3', v: v(2, 2, 2, 2), r: r(2, 2, 2, 2) },
    ]);
    expect(commonStandNrs(a, b)).toEqual(['1']);
  });
});

describe('ranksWithinSet', () => {
  it('recomputes 1..N ranks over the allowed set, preserving order, 1 = best', () => {
    // single criterion slice for judge A: impact placements 1,2,3 for x,y,z
    const slice: Score[] = [
      { judge: 'A', standNr: 'x', criterion: 'impact', value: 5, rankPos: 1 },
      { judge: 'A', standNr: 'y', criterion: 'impact', value: 4, rankPos: 2 },
      { judge: 'A', standNr: 'z', criterion: 'impact', value: 3, rankPos: 3 },
    ];
    // drop 'y' (not in common set) → x stays best (1), z becomes 2
    const ranks = ranksWithinSet(slice, ['x', 'z']);
    expect(ranks.get('x')).toBe(1);
    expect(ranks.get('z')).toBe(2);
    expect(ranks.has('y')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test domain`
Expected: FAIL — `commonStandNrs is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `libs/domain/src/lib/fairness.ts`:

```ts
/** standNrs that appear in BOTH judges' scores, sorted ascending. */
export function commonStandNrs(scoresA: Score[], scoresB: Score[]): string[] {
  const setB = new Set(scoresB.map((s) => s.standNr));
  const inBoth = new Set<string>();
  for (const s of scoresA) if (setB.has(s.standNr)) inBoth.add(s.standNr);
  return [...inBoth].sort((x, y) => x.localeCompare(y));
}

/**
 * Given one judge's scores for ONE criterion, restrict to `allowed` standNrs and
 * recompute ranks 1..N in placement order (1 = best). Unplaced scores are ignored.
 */
export function ranksWithinSet(criterionScores: Score[], allowed: string[]): Map<string, number> {
  const allowedSet = new Set(allowed);
  const placed = criterionScores
    .filter((s): s is Score & { rankPos: number } => s.rankPos !== null && allowedSet.has(s.standNr))
    .sort((a, b) => a.rankPos - b.rankPos);

  const ranks = new Map<string, number>();
  placed.forEach((s, i) => ranks.set(s.standNr, i + 1));
  return ranks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/domain/src/lib/fairness.ts libs/domain/src/lib/fairness.spec.ts
git commit -m "feat(domain): compute common set and ranks within set"
```

---

## Task 6: Final ranking (rank-merge + overall + tie-break)

**Files:**
- Modify: `libs/domain/src/lib/fairness.ts`
- Modify: `libs/domain/src/lib/fairness.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `libs/domain/src/lib/fairness.spec.ts`:

```ts
import { computeFinalRanking } from './fairness';

describe('computeFinalRanking', () => {
  it('merges per-criterion ranks across judges; lower overall = better; lists incompletes', () => {
    // Common set: s1, s2. s3 scored only by A → incomplete.
    const a = scores('A', [
      { s: 's1', v: v(5, 5, 5, 5), r: r(1, 1, 1, 1) },
      { s: 's2', v: v(4, 4, 4, 4), r: r(2, 2, 2, 2) },
      { s: 's3', v: v(1, 1, 1, 1), r: r(3, 3, 3, 3) },
    ]);
    const b = scores('B', [
      { s: 's1', v: v(5, 5, 5, 5), r: r(1, 1, 1, 1) },
      { s: 's2', v: v(3, 3, 3, 3), r: r(2, 2, 2, 2) },
    ]);

    const { ranked, incomplete } = computeFinalRanking(a, b);

    expect(incomplete).toEqual(['s3']);
    expect(ranked.map((row) => row.standNr)).toEqual(['s1', 's2']);
    // s1 ranked 1 by both on all four criteria → merged 1 each → overall 4
    expect(ranked[0].overall).toBe(4);
    // s2 ranked 2 by both on all four → merged 2 each → overall 8
    expect(ranked[1].overall).toBe(8);
  });

  it('breaks overall ties on higher raw total', () => {
    // Both deelnemers get rank 1 on two criteria and rank 2 on the other two → equal overall (6).
    const a = scores('A', [
      { s: 'hi', v: v(5, 5, 5, 5), r: r(1, 1, 2, 2) },
      { s: 'lo', v: v(2, 2, 2, 2), r: r(2, 2, 1, 1) },
    ]);
    const b = scores('B', [
      { s: 'hi', v: v(5, 5, 5, 5), r: r(1, 1, 2, 2) },
      { s: 'lo', v: v(2, 2, 2, 2), r: r(2, 2, 1, 1) },
    ]);
    const { ranked } = computeFinalRanking(a, b);
    expect(ranked[0].overall).toBe(ranked[1].overall); // tie on merged ranks
    expect(ranked[0].standNr).toBe('hi'); // higher raw total wins the tie
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test domain`
Expected: FAIL — `computeFinalRanking is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `libs/domain/src/lib/fairness.ts`:

```ts
import { CRITERIA } from './model';

export interface FinalRow {
  standNr: string;
  mergedByCriterion: Record<Criterion, number>; // averaged rank per criterion (lower = better)
  overall: number; // sum of merged criterion ranks (lower = better)
  rawTotal: number; // sum of all 1–5 values across both judges (higher = better)
}

export interface FinalRanking {
  ranked: FinalRow[];
  incomplete: string[]; // standNrs scored by only one judge
}

function forCriterion(scores: Score[], criterion: Criterion): Score[] {
  return scores.filter((s) => s.criterion === criterion);
}

export function computeFinalRanking(scoresA: Score[], scoresB: Score[]): FinalRanking {
  const common = commonStandNrs(scoresA, scoresB);
  const standsA = new Set(scoresA.map((s) => s.standNr));
  const standsB = new Set(scoresB.map((s) => s.standNr));
  const incomplete = [...new Set([...standsA, ...standsB])]
    .filter((s) => !(standsA.has(s) && standsB.has(s)))
    .sort((x, y) => x.localeCompare(y));

  // Merged rank per criterion, computed once per criterion.
  const mergedMaps = {} as Record<Criterion, Map<string, number>>;
  for (const c of CRITERIA) {
    const ranksA = ranksWithinSet(forCriterion(scoresA, c), common);
    const ranksB = ranksWithinSet(forCriterion(scoresB, c), common);
    const merged = new Map<string, number>();
    for (const standNr of common) {
      merged.set(standNr, ((ranksA.get(standNr) ?? 0) + (ranksB.get(standNr) ?? 0)) / 2);
    }
    mergedMaps[c] = merged;
  }

  const rows: FinalRow[] = common.map((standNr) => {
    const mergedByCriterion = {} as Record<Criterion, number>;
    let overall = 0;
    for (const c of CRITERIA) {
      const value = mergedMaps[c].get(standNr) ?? 0;
      mergedByCriterion[c] = value;
      overall += value;
    }
    return { standNr, mergedByCriterion, overall, rawTotal: rawTotalFor(standNr, scoresA, scoresB) };
  });

  rows.sort(
    (x, y) => x.overall - y.overall || y.rawTotal - x.rawTotal || x.standNr.localeCompare(y.standNr),
  );
  return { ranked: rows, incomplete };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test domain`
Expected: PASS (all `domain` specs green).

- [ ] **Step 5: Commit**

```bash
git add libs/domain/src/lib/fairness.ts libs/domain/src/lib/fairness.spec.ts
git commit -m "feat(domain): compute final rank-merged ranking with tie-break"
```

---

## Task 7: Dexie schema (`JuryDb`)

**Files:**
- Create: `libs/data-access/src/lib/db.ts`
- Create: `libs/data-access/src/lib/db.spec.ts`
- Modify: `libs/data-access/src/index.ts`

- [ ] **Step 1: Write the failing test**

`libs/data-access/src/lib/db.spec.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JuryDb } from './db';

describe('JuryDb', () => {
  let db: JuryDb;
  beforeEach(() => { db = new JuryDb('test'); });
  afterEach(async () => { await db.delete(); });

  it('opens with the five expected tables', async () => {
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['captureMeta', 'deelnemers', 'events', 'photos', 'scores'].sort(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test data-access`
Expected: FAIL — `Cannot find module './db'`.

- [ ] **Step 3: Write the implementation**

`libs/data-access/src/lib/db.ts`:

```ts
import type { CaptureMeta, Criterion, Deelnemer, JudgeSlot, JuryEvent, Score } from '@winnovation/domain';
import Dexie, { type Table } from 'dexie';

export interface StoredPhoto {
  id: string;
  blob: Blob;
}

export class JuryDb extends Dexie {
  events!: Table<JuryEvent, string>;
  deelnemers!: Table<Deelnemer, [string, string]>;
  scores!: Table<Score, [JudgeSlot, string, Criterion]>;
  captureMeta!: Table<CaptureMeta, [JudgeSlot, string]>;
  photos!: Table<StoredPhoto, string>;

  constructor(name = 'winnovation-jury') {
    super(name);
    this.version(1).stores({
      events: 'id, eventCode',
      deelnemers: '[eventId+standNr], eventId',
      scores: '[judge+standNr+criterion], judge, standNr, criterion',
      captureMeta: '[judge+standNr], judge, standNr',
      photos: 'id',
    });
  }
}
```

- [ ] **Step 4: Export and run the test**

`libs/data-access/src/index.ts`:

```ts
export * from './lib/db';
export * from './lib/events.repo';
export * from './lib/deelnemers.repo';
export * from './lib/scores.repo';
export * from './lib/jury.service';
```

> If running before later tasks exist, temporarily comment out the not-yet-created exports, or create empty placeholder files. They are all created by Task 11.

Run: `pnpm nx test data-access`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/data-access/src/lib/db.ts libs/data-access/src/lib/db.spec.ts libs/data-access/src/index.ts
git commit -m "feat(data-access): add Dexie JuryDb schema"
```

---

## Task 8: Events repository

**Files:**
- Create: `libs/data-access/src/lib/events.repo.ts`
- Create: `libs/data-access/src/lib/events.repo.spec.ts`

- [ ] **Step 1: Write the failing test**

`libs/data-access/src/lib/events.repo.spec.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JuryDb } from './db';
import { createEvent, findEventByCode } from './events.repo';

describe('events.repo', () => {
  let db: JuryDb;
  beforeEach(() => { db = new JuryDb('test'); });
  afterEach(async () => { await db.delete(); });

  const fixedGen = { id: () => 'evt-1', code: () => 'ABC123' };

  it('creates an event with a generated id and code', async () => {
    const event = await createEvent(db, { name: 'Winnovation 2026', date: '2026-06-05' }, fixedGen);
    expect(event).toEqual({ id: 'evt-1', name: 'Winnovation 2026', date: '2026-06-05', eventCode: 'ABC123' });
    expect(await db.events.get('evt-1')).toBeTruthy();
  });

  it('finds an event by its code', async () => {
    await createEvent(db, { name: 'X', date: '2026-06-05' }, fixedGen);
    const found = await findEventByCode(db, 'ABC123');
    expect(found?.id).toBe('evt-1');
  });

  it('returns undefined for an unknown code', async () => {
    expect(await findEventByCode(db, 'NOPE99')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test data-access`
Expected: FAIL — `Cannot find module './events.repo'`.

- [ ] **Step 3: Write the implementation**

`libs/data-access/src/lib/events.repo.ts`:

```ts
import type { JuryEvent } from '@winnovation/domain';
import type { JuryDb } from './db';

export interface CreateEventInput {
  name: string;
  date: string; // ISO
}

export interface IdGen {
  id: () => string;
  code: () => string;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

export function generateCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

export const defaultGen: IdGen = {
  id: () => crypto.randomUUID(),
  code: () => generateCode(),
};

export async function createEvent(db: JuryDb, input: CreateEventInput, gen: IdGen = defaultGen): Promise<JuryEvent> {
  const event: JuryEvent = { id: gen.id(), name: input.name, date: input.date, eventCode: gen.code() };
  await db.events.add(event);
  return event;
}

export async function findEventByCode(db: JuryDb, eventCode: string): Promise<JuryEvent | undefined> {
  return db.events.where('eventCode').equals(eventCode).first();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test data-access`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/data-access/src/lib/events.repo.ts libs/data-access/src/lib/events.repo.spec.ts
git commit -m "feat(data-access): add events repository with code generation"
```

---

## Task 9: Deelnemers repository (merge by standNr)

**Files:**
- Create: `libs/data-access/src/lib/deelnemers.repo.ts`
- Create: `libs/data-access/src/lib/deelnemers.repo.spec.ts`

- [ ] **Step 1: Write the failing test**

`libs/data-access/src/lib/deelnemers.repo.spec.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Deelnemer } from '@winnovation/domain';
import { JuryDb } from './db';
import { listDeelnemers, upsertDeelnemer } from './deelnemers.repo';

const d = (standNr: string, projectgroep: string, isVervolgproject = false): Deelnemer => ({
  eventId: 'evt-1', standNr, projectgroep, isVervolgproject,
});

describe('deelnemers.repo', () => {
  let db: JuryDb;
  beforeEach(() => { db = new JuryDb('test'); });
  afterEach(async () => { await db.delete(); });

  it('creates and lists deelnemers for an event', async () => {
    await upsertDeelnemer(db, d('7', 'AI-compostbak'));
    await upsertDeelnemer(db, d('8', 'Slimme tuin'));
    const list = await listDeelnemers(db, 'evt-1');
    expect(list.map((x) => x.standNr).sort()).toEqual(['7', '8']);
  });

  it('merges by standNr — same eventId+standNr overwrites, never duplicates', async () => {
    await upsertDeelnemer(db, d('7', 'Old name'));
    await upsertDeelnemer(db, d('7', 'New name', true));
    const list = await listDeelnemers(db, 'evt-1');
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(d('7', 'New name', true));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test data-access`
Expected: FAIL — `Cannot find module './deelnemers.repo'`.

- [ ] **Step 3: Write the implementation**

`libs/data-access/src/lib/deelnemers.repo.ts`:

```ts
import type { Deelnemer } from '@winnovation/domain';
import type { JuryDb } from './db';

/** Upsert keyed by [eventId+standNr]; last write wins (the roster-merge rule). */
export async function upsertDeelnemer(db: JuryDb, deelnemer: Deelnemer): Promise<void> {
  await db.deelnemers.put(deelnemer);
}

export async function listDeelnemers(db: JuryDb, eventId: string): Promise<Deelnemer[]> {
  return db.deelnemers.where('eventId').equals(eventId).toArray();
}

export async function getDeelnemer(db: JuryDb, eventId: string, standNr: string): Promise<Deelnemer | undefined> {
  return db.deelnemers.get([eventId, standNr]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test data-access`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/data-access/src/lib/deelnemers.repo.ts libs/data-access/src/lib/deelnemers.repo.spec.ts
git commit -m "feat(data-access): add deelnemers repository with merge-by-standNr"
```

---

## Task 10: Scores, capture-meta & photos repository

**Files:**
- Create: `libs/data-access/src/lib/scores.repo.ts`
- Create: `libs/data-access/src/lib/scores.repo.spec.ts`

- [ ] **Step 1: Write the failing test**

`libs/data-access/src/lib/scores.repo.spec.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CaptureMeta, Score } from '@winnovation/domain';
import { JuryDb } from './db';
import {
  getCaptureMeta, getPhoto, putPhoto, saveCaptureMeta, saveScore, scoresForJudge,
} from './scores.repo';

const score = (standNr: string, value: Score['value'], rankPos: number | null): Score => ({
  judge: 'A', standNr, criterion: 'impact', value, rankPos,
});

describe('scores.repo', () => {
  let db: JuryDb;
  beforeEach(() => { db = new JuryDb('test'); });
  afterEach(async () => { await db.delete(); });

  it('saves and overwrites a score by [judge+standNr+criterion]', async () => {
    await saveScore(db, score('7', 3, null));
    await saveScore(db, score('7', 4, 1)); // re-save with placement
    const all = await scoresForJudge(db, 'A');
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(score('7', 4, 1));
  });

  it('queries scores by judge only', async () => {
    await saveScore(db, score('7', 3, 1));
    await saveScore(db, { ...score('7', 3, 1), judge: 'B' });
    expect(await scoresForJudge(db, 'A')).toHaveLength(1);
  });

  it('saves and reads capture meta', async () => {
    const meta: CaptureMeta = {
      judge: 'A', standNr: '7', keyword: 'AI-compostbak', note: 'zwak verdienmodel', review: 'mooi idee', photoRef: null,
    };
    await saveCaptureMeta(db, meta);
    expect(await getCaptureMeta(db, 'A', '7')).toEqual(meta);
  });

  it('stores and retrieves a photo blob', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await putPhoto(db, 'photo-1', blob);
    const stored = await getPhoto(db, 'photo-1');
    expect(stored?.id).toBe('photo-1');
    expect(stored?.blob.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test data-access`
Expected: FAIL — `Cannot find module './scores.repo'`.

- [ ] **Step 3: Write the implementation**

`libs/data-access/src/lib/scores.repo.ts`:

```ts
import type { CaptureMeta, JudgeSlot, Score } from '@winnovation/domain';
import type { JuryDb, StoredPhoto } from './db';

export async function saveScore(db: JuryDb, score: Score): Promise<void> {
  await db.scores.put(score);
}

export async function scoresForJudge(db: JuryDb, judge: JudgeSlot): Promise<Score[]> {
  return db.scores.where('judge').equals(judge).toArray();
}

export async function scoresForStand(db: JuryDb, judge: JudgeSlot, standNr: string): Promise<Score[]> {
  return (await scoresForJudge(db, judge)).filter((s) => s.standNr === standNr);
}

export async function saveCaptureMeta(db: JuryDb, meta: CaptureMeta): Promise<void> {
  await db.captureMeta.put(meta);
}

export async function getCaptureMeta(db: JuryDb, judge: JudgeSlot, standNr: string): Promise<CaptureMeta | undefined> {
  return db.captureMeta.get([judge, standNr]);
}

export async function putPhoto(db: JuryDb, id: string, blob: Blob): Promise<void> {
  const photo: StoredPhoto = { id, blob };
  await db.photos.put(photo);
}

export async function getPhoto(db: JuryDb, id: string): Promise<StoredPhoto | undefined> {
  return db.photos.get(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test data-access`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/data-access/src/lib/scores.repo.ts libs/data-access/src/lib/scores.repo.spec.ts
git commit -m "feat(data-access): add scores, capture-meta and photo persistence"
```

---

## Task 11: `JuryService` facade

The single object the UI (Plan 2) will consume. It owns a `JuryDb` instance and exposes the workflows the screens need, delegating math to `@winnovation/domain`.

**Files:**
- Create: `libs/data-access/src/lib/jury.service.ts`
- Create: `libs/data-access/src/lib/jury.service.spec.ts`

- [ ] **Step 1: Write the failing test**

`libs/data-access/src/lib/jury.service.spec.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CRITERIA, type Score } from '@winnovation/domain';
import { JuryDb } from './db';
import { JuryService } from './jury.service';

describe('JuryService', () => {
  let db: JuryDb;
  let service: JuryService;
  beforeEach(() => { db = new JuryDb('test'); service = new JuryService(db); });
  afterEach(async () => { await db.delete(); });

  async function seedJudge(judge: Score['judge'], standNr: string, value: Score['value'], rankPos: number) {
    for (const criterion of CRITERIA) {
      await service.saveScore({ judge, standNr, criterion, value, rankPos });
    }
  }

  it('computes the final ranking from persisted scores', async () => {
    await seedJudge('A', 's1', 5, 1);
    await seedJudge('A', 's2', 4, 2);
    await seedJudge('B', 's1', 5, 1);
    await seedJudge('B', 's2', 3, 2);

    const { ranked, incomplete } = await service.finalRanking();
    expect(incomplete).toEqual([]);
    expect(ranked.map((r) => r.standNr)).toEqual(['s1', 's2']);
    expect(ranked[0].overall).toBe(4);
  });

  it('reports a judge's drift flags', async () => {
    // Judge A on impact: s1 ranked best (1) but scored 3, s2 ranked 2 but scored 4 → drift.
    await service.saveScore({ judge: 'A', standNr: 's1', criterion: 'impact', value: 3, rankPos: 1 });
    await service.saveScore({ judge: 'A', standNr: 's2', criterion: 'impact', value: 4, rankPos: 2 });
    const flags = await service.driftFlags('A');
    expect(flags).toEqual([
      { judge: 'A', criterion: 'impact', betterRanked: 's1', worseRanked: 's2' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test data-access`
Expected: FAIL — `Cannot find module './jury.service'`.

- [ ] **Step 3: Write the implementation**

`libs/data-access/src/lib/jury.service.ts`:

```ts
import {
  type CaptureMeta, type Deelnemer, type DriftFlag, type FinalRanking, type JudgeSlot, type Score,
  computeFinalRanking, detectAllDrift,
} from '@winnovation/domain';
import { JuryDb } from './db';
import { type CreateEventInput, createEvent, findEventByCode } from './events.repo';
import { listDeelnemers, upsertDeelnemer } from './deelnemers.repo';
import { getCaptureMeta, saveCaptureMeta, saveScore, scoresForJudge } from './scores.repo';

export class JuryService {
  constructor(private readonly db: JuryDb = new JuryDb()) {}

  createEvent(input: CreateEventInput) { return createEvent(this.db, input); }
  findEventByCode(code: string) { return findEventByCode(this.db, code); }

  upsertDeelnemer(deelnemer: Deelnemer) { return upsertDeelnemer(this.db, deelnemer); }
  listDeelnemers(eventId: string) { return listDeelnemers(this.db, eventId); }

  saveScore(score: Score) { return saveScore(this.db, score); }
  saveCaptureMeta(meta: CaptureMeta) { return saveCaptureMeta(this.db, meta); }
  getCaptureMeta(judge: JudgeSlot, standNr: string) { return getCaptureMeta(this.db, judge, standNr); }

  async driftFlags(judge: JudgeSlot): Promise<DriftFlag[]> {
    return detectAllDrift(await scoresForJudge(this.db, judge));
  }

  async finalRanking(): Promise<FinalRanking> {
    const [a, b] = await Promise.all([scoresForJudge(this.db, 'A'), scoresForJudge(this.db, 'B')]);
    return computeFinalRanking(a, b);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test data-access`
Expected: PASS (all `data-access` specs green).

- [ ] **Step 5: Final verification + commit**

```bash
pnpm nx run-many -t test          # domain + data-access all green
pnpm nx build jury-app            # PWA shell still builds
pnpm biome check .                # lint/format clean
git add libs/data-access/src/lib/jury.service.ts libs/data-access/src/lib/jury.service.spec.ts
git commit -m "feat(data-access): add JuryService facade"
```

Expected: all tests pass, app builds, Biome reports no errors.

---

## Self-Review

**Spec coverage (foundation slice):**
- Dual read (value + rankPos) → `model.ts` (Task 2), persisted in `scores.repo` (Task 10) ✓
- Drift flags → `detectDrift*` (Task 4), surfaced via `JuryService.driftFlags` (Task 11) ✓
- Common set + per-criterion rank-merge + overall + tie-break + incompletes → Tasks 5–6 ✓
- Roster merge by `standNr` → Task 9 ✓
- Offline-first persistence (IndexedDB/Dexie) → Tasks 7–11 ✓
- Vervolgproject flag → `Deelnemer.isVervolgproject` (Tasks 2, 9) ✓
- Photos local-only → `photos` table + `putPhoto/getPhoto` (Tasks 7, 10) ✓
- PWA shell → Task 1 ✓
- **Intentionally deferred:** UI screens → Plan 2; sync protocol + Reconcile/Result → Plan 3. Documented in the scope boundary above.

**Placeholder scan:** none — every code step contains complete, runnable code.

**Type consistency:** `Score.value`/`Score.rankPos`, `JudgeSlot`, `Criterion`, `DriftFlag`, `FinalRow`/`FinalRanking`, `JuryDb` table types, and repo signatures are used identically across tasks. `JuryEvent` (not `Event`) is used everywhere to avoid the DOM clash.

---

## Roadmap (subsequent plans)

- **Plan 2 — UI screens.** Angular standalone components + signals wrapping `JuryService`, Tailwind styling, built against the designer's wireframes: Join · Event home · Stand · Compare · Review (offline screens). The Compare insertion (bracketing-pair → above/below/between → write `rankPos`) is the centrepiece.
- **Plan 3 — Sync + Reconcile.** Hono + SQLite sync service, offline-first push/pull (last-write-wins; roster merge by `standNr`), the Reconcile screen (disagreements first), and Result/export (CSV / share).
