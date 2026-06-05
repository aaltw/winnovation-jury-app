# Winnovation Jury App — Design

- **Date:** 2026-06-05
- **Status:** Draft for review
- **Authors:** Aalt Westhuis + colleague (the two judges)

## 1. Context & goal

Two people jury the **Winnovation Innovation Award** — student innovation projects shown at
stands ("deelnemers"). They walk the floor, visit each stand once, and must produce a *fair*
ranking across **~15–30 projects** seen sequentially over the day.

The real fairness risk is **not** one judge being harsher than the other. It is **scale drift
within a single judge's head**: the `4` you give deelnemer #1 is not anchored to the same
internal yardstick as the `4` you give #10. By the tenth stand you have "forgotten the first,"
and the numbers stop being comparable.

**Goal:** keep each judge's scores internally consistent and mutually comparable across all
deelnemers, then merge the two judges into one defensible result.

### The official scorekaart (what we build on)

Four criteria, each scored **1–5** (`1 slecht · 2 matig · 3 goed · 4 zeer goed · 5 uitstekend`):

1. **Innovativiteit** — how novel, unique, creative; clear added value vs. existing solutions.
2. **Relevantie** — fit with the target group's needs/market; addresses a real, significant
   problem; relation to sustainable development goals (SDGs).
3. **Haalbaarheid** — technically, financially, organisationally realistic; solid plan and
   revenue model; risks mapped.
4. **Impact** — positive social/economic/ecological change; measurable, durable results; scale.

Total = sum of the four. **Vervolgproject** (continuation project): judge only the
extension/improvement, not the whole thing.

## 2. Core concept — the dual read

For every deelnemer, per criterion, a judge records **two independent reads**:

- **The number** — `1–5` on the official scale (labels shown inline). This is the *absolute*
  read and matches the scorekaart handed to the organisatie.
- **The placement** — where this deelnemer sits in the judge's running **per-criterion ranking**,
  chosen by comparison against two already-ranked anchors ("above / below / between"). This is
  the *relative* read, and it is immune to scale drift because it is always judged against real,
  concrete prior projects.

The app continuously cross-checks the two. A **drift flag** fires whenever the number ordering
and the placement ordering disagree for a pair of deelnemers (e.g. you scored A *below* B on
Impact but placed A *above* B). **Resolving drift flags is the fair-judgement act.**

This is *incremental comparative judgment* — effectively insertion-sort where the judge is the
comparator. It removes the cold-start weakness of pure pairwise comparison: by deelnemer #10 you
already have nine placed, so there is always something concrete to compare against.

## 3. User flow — four screens

```
   STAND ──────────► COMPARE ──────────► REVIEW ──────────► RECONCILE
 (fast capture)   (Tinder insertion)  (per-criterion list)  (two judges)
   offline           offline             offline            needs sync
```

### 3.1 Stand — fast capture (offline, ~20 s)

Create a deelnemer on the spot:

- `stand nr` (required — this is the identity that lets the two judges' entries be matched later)
- `projectgroep` (name)
- `vervolgproject?` toggle → when on, shows the reminder *"beoordeel alleen de
  uitbreiding/verbetering."*
- **keyword** — 1–3 word headline ("AI-compostbak") → the instant memory hook in every list
- **four numbers** — 1–5 per criterion, labels inline
- **note** — private rationale ("zwak verdienmodel")
- **review** — constructive feedback for the projectgroep/organisatie
- **photo** — optional; the strongest memory anchor. Stored on-device only.

Placement is **optional here** — do it now while the project is fresh, or defer it to Compare.

### 3.2 Compare — the Tinder-like insertion loop (offline)

The "we have some time" moment. The app serves an unplaced (or under-refined) deelnemer plus a
**bracketing pair** for one criterion — the two already-ranked deelnemers whose numbers straddle
the number you just gave — each shown as a card (photo · keyword · projectgroep). You tap
**above / below / between**. One tap places it; an optional second tap narrows a wide gap.

Repeat across the four criteria. For ~15–30 deelnemers this is a handful of quick taps per
project, never a long manual sort.

### 3.3 Review — the safety net (offline)

Per criterion, a sortable list of *everyone*: `photo · keyword · projectgroep · number · rank`.
**Drift flags surface at the top.** Tap a flagged pair to resolve it by adjusting the number or
re-placing the deelnemer. This is the "did I forget or contradict myself?" check.

### 3.4 Reconcile — the two judges (needs sync)

A shared view of both judges' rankings. **Biggest disagreements first** (where the two merged
ranks differ most). Talk it out, agree the final order. Output: the combined ranking + each
deelnemer's totals, exportable as CSV / share sheet.

## 4. Fairness math (locked)

- **Within a judge & criterion:** the numbers (`1–5`) *and* a strict order (the placements). A
  **drift flag** = any inversion between the number-sort and the placement-sort.
- **Common set:** the final computation uses only deelnemers that **both** judges scored.
  Single-judge deelnemers are listed separately as *incomplete* (not silently dropped, not
  silently included). Within the common set, each judge's per-criterion rank positions are
  recomputed so both are on the same `1..N` scale (**rank 1 = best**; `rankPos` follows this
  convention everywhere).
- **Per criterion:** merged rank `R_c(d) = mean( rankA_c(d), rankB_c(d) )`.
- **Overall:** `S(d) = Σ_c R_c(d)` over the four criteria. **Lower = better.** Final ranking
  sorts by `S` ascending.
- **Cross-check & tie-break:** the classic total `T(d) = Σ (all eight 1–5 numbers)` is shown
  beside `S`. Ties in `S` break on higher `T`.

Rank-merge is what neutralises "one of us just scores higher" — even if the two judges use the
1–5 scale differently, their *orderings* combine cleanly.

> **v1 keeps criteria equally weighted** (matching the official scorekaart). Weighting is a
> later option.

## 5. Architecture

- **App:** Angular v21 **PWA** — standalone components, signals for state, Tailwind, Biome.
  Installable to the home screen, full-screen, works with **zero signal** at the venue.
- **Local-first store:** **IndexedDB (via Dexie)** is the source of truth *on each phone*. Every
  screen works fully offline; sync is a background nicety, never a blocker.
- **Photos stay on-device.** They are a personal memory aid; the colleague does not need them to
  reconcile. This keeps the synced payload tiny (numbers, ranks, keywords, notes for ~30
  deelnemers × 2 judges).
- **No accounts.** Open app → enter/scan an **event code** → pick a slot (*Jurylid A / B*). The
  event code is the shared secret; joining issues a lightweight per-judge token.
- **Sync backend (self-hosted):** a small portable REST sync API — **Hono** (runs on Bun/Deno/
  Node/Cloudflare) + **SQLite**. Deployed as one container to **Azure Container Apps** (primary),
  Cloudflare Workers + D1 as the fallback. Final runtime/host confirmed in planning.

## 6. Data model

| Entity | Identity | Fields |
| --- | --- | --- |
| **Event** | `id` | `name`, `date`, `eventCode` |
| **Deelnemer** *(shared roster)* | `eventId + standNr` | `projectgroep`, `isVervolgproject` |
| **Score** *(per judge × deelnemer × criterion)* | `judge + standNr + criterion` | `number (1–5)`, `rankPos` |
| **CaptureMeta** *(per judge × deelnemer)* | `judge + standNr` | `keyword`, `note`, `review`, `photoRef (local)` |

- **Roster is shared; scoring is private** until reconcile. Whoever reaches a stand first creates
  the deelnemer; entries **merge by `standNr`**.
- Every synced record carries `updatedAt` for conflict resolution.

## 7. Sync protocol

- **Offline-first.** All writes hit IndexedDB immediately. A background task pushes/pulls when a
  connection is available; the user never waits on it.
- **Endpoints (sketch):** `POST /events` (create → returns code) · `POST /events/:code/join`
  (→ judge token) · `GET /events/:code/changes?since=<ts>` (pull) · `POST /events/:code/changes`
  (push).
- **Conflict resolution:** `Score` and `CaptureMeta` rows are owned by exactly one judge → no
  cross-judge conflict. The only shared-write surface is the `Deelnemer` roster, merged by
  `standNr` with last-write-wins per field on `projectgroep` / `isVervolgproject`.

## 8. Tech stack

- **Frontend:** Angular v21 (standalone, signals), Tailwind, Biome, pnpm. PWA via Angular service
  worker.
- **Local store:** IndexedDB through Dexie.
- **Backend:** Hono + SQLite, TypeScript, run on Bun or Deno.
- **Deploy:** PWA as static assets; API as a container (Azure Container Apps / Cloudflare).
- **Language:** Dutch UI for v1 (the criteria and audience are Dutch).

## 9. Scope

**v1:** one event at a time · 2 judges · the four screens · offline-first · vervolgproject toggle
· drift flags · rank-merge result with raw-total cross-check · incomplete-deelnemer handling ·
export final ranking (CSV / share) · Dutch UI.

**Later (YAGNI for now):** criterion weighting · more than 2 judges · multiple concurrent events ·
photo sync · PDF report · binary-search insertion for large lists · i18n.

## 10. Open questions (for planning)

- Exact backend runtime (Bun vs Deno) and host (Azure Container Apps vs Cloudflare).
- Compare-screen anchor algorithm: single bracketing-pair tap vs. optional binary-narrowing for
  precision, and how aggressively to nudge deferred placements.
- Drift-flag presentation: per-pair resolution vs. a per-criterion "fix-up" wizard.

## 11. Success criteria

- A judge can capture a deelnemer in well under a minute, fully offline.
- At any point a judge can answer "is this project really better than that one?" against concrete
  prior projects, not a remembered abstraction.
- The app surfaces every internal contradiction (drift flag) before the result is finalised.
- The two judges produce one combined ranking that is robust to differences in how each uses the
  1–5 scale.
- The whole thing deploys as a static PWA + one small self-hosted container.
