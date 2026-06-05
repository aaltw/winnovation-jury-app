# Design Handoff — Reconciliation & Build Notes

- **Date:** 2026-06-05
- **Status:** Design delivered. Lifts the "WAIT for wireframes" gates in Plans 2 & 3.
- **Design source of truth:** `docs/design/handoff/winnovation/project/` (Claude Design handoff).
  Read `app/winnovation.css` for tokens/spacing, `app/screens-*.jsx` for per-screen layout &
  interactions, `app/primitives.jsx` for components. Recreate **pixel-perfect in Angular** —
  match visual output, do not port the React/JSX structure.

## Build vs. skip

**Build (the real app):** the 7 screens (Join · Home · Stand · Compare · Review · Reconcile ·
Result) and the primitives → our `libs/ui`: `Icon`, `Sync` (ambient status pill), `Photo`
(gradient + initial fallback), `DeelCard`, `ScoreInput` (segmented 1–5 pills, accent = criterion
colour, "n · label" readout), `DriftFlag`, `Banner` (vervolgproject reminder), `Btn`, `Empty`
(incl. "clean" check variant), `AppBar`.

**Skip (prototype scaffolding — NOT the app):** the `Phone` frame, `StatusBar` (fake `9:41`),
the `Board`/`chapter`/`Note`/quick-jump presentation wrapper in `app.jsx`, and the React/Babel
CDN bootstrap. These exist only to show all screens on one page.

## Design tokens (summary — `winnovation.css` is authoritative)

- **Fonts:** display = **Bricolage Grotesque** (600/700/800); UI = **Hanken Grotesk** (400–800).
  Self-host both (offline-first PWA — don't depend on the Google Fonts CDN at the venue).
- **Criterion colours:** Innovativiteit `#4B3BF5` · Relevantie `#FF5A3C` · Haalbaarheid `#00A7C4`
  · Impact `#06BE7E`.
- **Drift (amber):** `#F5A300` (+ a darker `--amber-ink` for text/icon — confirm exact in CSS).
- **Scale labels (1–5):** slecht · matig · goed · zeer goed · uitstekend.
- Pull the remaining tokens (`--ink-*`, `--line-*`, `--bg-*`, radii, the `wv-*` class system)
  straight from `winnovation.css`; mirror them as Tailwind theme tokens / CSS variables.

## Reconciliation decisions

1. **Stack:** recreate in **Angular** (our Plans 1–3), not the React prototype.
2. **Drift = adopt the design's model (supersedes Plan 1 Task 4).** Per deelnemer × criterion,
   count **all-pairs inversions** within that judge's placement order (above someone scored
   higher, or below someone scored lower); **severity** = strong when inversions ≥ 3, else mild.
   Expose `computeDrift(state) → { [standNr]: { [criterion]: severity } }` and a flattened
   `driftList` sorted strongest-first (mirrors `data.jsx` `WV.computeDrift`/`WV.driftList`). The
   Plan 1 adjacency check stays valid as the "any drift?" predicate; this adds counts + severity
   for the UI (badges, Review ordering).
3. **Ranking = keep our spec's common-set rank-merge (Plan 1 Task 6) as the authoritative
   engine.** The prototype's `combinedRanking` (summed 0-based order indices) is mockup-only.
   Reproduce the prototype's *presentation* — combined list, complete vs. incomplete split,
   winner treatment — from our engine's output. For "biggest disagreements first" (Reconcile)
   use Plan 3's per-criterion absolute-rank-gap sum (`computeDisagreements`), which is more
   robust than the prototype's `|ptsA − ptsB|`.
4. **Criterion keys:** domain stays `innovativiteit/relevantie/haalbaarheid/impact`; the
   prototype's short keys (`innov/relev/haalb/impact`) are display-only — map in the UI.

## Effect on the plans

- **Plan 1 — Foundation:** unchanged except Task 4 drift is upgraded per decision #2 (all-pairs
  inversions + severity + sorted `driftList`). Build first; still design-independent.
- **Plan 2 — UI:** the **WAIT GATE is lifted**. Part B screens are now built against the handoff
  (above) instead of "functional skeletons." `libs/ui` primitives come straight from
  `primitives.jsx` + `winnovation.css`. Keep Part A (placement engine, `JuryStore`, routing)
  as written.
- **Plan 3 — Sync + Reconcile:** the **WAIT GATE is lifted**. Reconcile/Result screens built
  against `screens-deliberate.jsx`. Part A (sync backend/client) unchanged.

## Turnkey execution (fresh session, in the project folder)

```bash
cd /Users/aaltwesthuis/Sources/playground/winnovation-jury-app
claude
```

Kickoff message:

```
Implement the Winnovation jury PWA in Angular, executing the plans in order with
superpowers:subagent-driven-development:
  1. docs/superpowers/plans/2026-06-05-winnovation-jury-foundation.md
  2. docs/superpowers/plans/2026-06-05-winnovation-jury-ui.md
  3. docs/superpowers/plans/2026-06-05-winnovation-jury-sync.md
The designer's handoff is the visual source of truth: docs/design/handoff/winnovation/project/
(recreate pixel-perfect; read winnovation.css for tokens, screens-*.jsx for layout). Follow the
decisions in docs/design/2026-06-05-handoff-reconciliation.md — especially: adopt the design's
drift severity model, keep our common-set rank-merge as the fairness engine, and skip the
prototype's phone-frame/status-bar/board scaffolding. The WAIT gates in Plans 2 & 3 are lifted.
Commit after each task and check in between tasks.
```
