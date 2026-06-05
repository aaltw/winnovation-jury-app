# Winnovation Jury App — UX/UI Design Brief

- **Date:** 2026-06-05
- **For:** UX/UI designer
- **From:** Aalt Westhuis (product) + jury colleague
- **Companion doc:** `docs/superpowers/specs/2026-06-05-winnovation-jury-app-design.md` (full
  product spec — read for data model and fairness logic; this brief is the design-facing summary)

---

## 1. In one line

A mobile PWA that lets **two judges** fairly rank **15–30 student innovation projects** they
visit one-by-one at an expo — by capturing fast first impressions *and* continuously comparing
each project against the ones already seen.

## 2. The problem we're solving (the "why")

Judges walk a venue floor and score projects sequentially. By the tenth stand, the `4` you gave
the first project no longer means the same thing — your internal yardstick has drifted, and you've
half-forgotten the early ones. Plain scorecards can't fix this.

**The big idea:** every project gets two reads — an **absolute number** (1–5 per criterion) *and*
a **relative placement** (where it ranks against projects already seen). The app shows where those
two disagree, and resolving those disagreements produces a genuinely fair ranking. The design job
is to make this dual model feel effortless — fast at the stand, confident when comparing.

## 3. Who uses it & where (context of use)

- **Two judges (jurylid A & B).** Dutch speakers. Not the same person who set up the event.
- **On their feet**, phone in hand, often **one-handed**, at a busy student expo. Variable
  lighting (windows, spotlights). Possibly noisy, definitely time-pressured *at the stand*.
- **A calmer "deliberation" mode** later, seated, when they compare and reconcile.
- **Connectivity is unreliable** at venues — the app must feel instant and never block on network.

**Design implications:** large tap targets, thumb-reachable primary actions, high contrast,
glanceable layouts, minimal typing, forgiving of interruptions, and a capture flow completable
in **under a minute**.

## 4. Design principles

1. **Speed at the stand.** Capture is the hot path — a project scored in seconds, mostly taps.
2. **Confidence through comparison.** The user should always be able to answer "is this really
   better than that?" against *concrete* prior projects, never a remembered abstraction.
3. **Never lose context.** Keyword + photo + note make every past project instantly recognisable
   in any list.
4. **Honest about conflicts.** Surface contradictions (drift flags) calmly and make them trivial
   to resolve — this is a feature, not an error state.
5. **Offline is invisible.** No spinners-of-doom, no "no connection" walls. Sync status is
   ambient, never blocking.

## 5. Screens & what each must do

> Portrait mobile first. Design these seven surfaces; the four core screens are the priority.

### A. Join / onboarding
- Enter or scan an **event code**, pick a slot (**Jurylid A / B**). No accounts, no passwords.
- Should take ~10 seconds. First-run can briefly explain the capture→compare→reconcile rhythm.

### B. Event home
- The day's working surface: list of deelnemers scored so far, a clear **"+ Nieuwe deelnemer"**
  action, progress sense (how many scored, how many placed, open drift flags), and entry points
  to Compare / Review / Reconcile.

### C. Stand — fast capture *(hot path — optimise hardest)*
Single-screen entry for a new deelnemer:
- `stand nr` (required) · `projectgroep` (name)
- **Keyword** — 1–3 word headline (the memory hook shown everywhere later)
- **Four scores**, each 1–5 with inline labels:
  `Innovativiteit · Relevantie · Haalbaarheid · Impact`
  Scale labels: **1 slecht · 2 matig · 3 goed · 4 zeer goed · 5 uitstekend**
- **Note** (private rationale) · **Review** (constructive feedback for the team) · **Photo**
  (optional, camera)
- **Vervolgproject** toggle → when on, show the reminder banner:
  *"Beoordeel alleen de uitbreiding/verbetering."*
- After saving: offer to place it now (→ Compare) or defer.

### D. Compare — the signature interaction *(see §6)*
- A card-based, gestural loop. Show one deelnemer being placed plus a **bracketing pair** (two
  already-ranked deelnemers, as cards with photo · keyword · projectgroep) for **one criterion**.
- The judge chooses **Above / Below / Between**. One tap places it; an optional second tap
  narrows a wide gap. Repeat across the four criteria and the backlog of unplaced projects.

### E. Review — the safety net
- Per criterion, a sortable list of *everyone*: `photo · keyword · projectgroep · number · rank`.
- **Drift flags surface at the top** (where a judge's numbers and placements disagree). Tapping a
  flag opens a calm resolve step: adjust the number or re-place the project.

### F. Reconcile — the two judges together
- Shared view of both judges' merged ranking. **Biggest disagreements first.** Support a
  side-by-side "you said / they said" comparison per project to talk through and lock a final
  order.

### G. Result / export
- The final combined ranking with totals; a clear "winner" treatment; export/share (CSV / share
  sheet). Show *incomplete* deelnemers (scored by only one judge) separately, not hidden.

## 6. The signature interaction — get this one right

The **Compare** placement is the heart of the product and deserves the most design love.

- **Metaphor:** card-based and quick, Tinder-adjacent — but it is a **3-way placement**
  (above / below / between two anchors), *not* a binary like/dislike swipe. Don't force a swipe
  gesture if buttons read clearer; explore both.
- **Feel:** fast, light, confident, a little playful. The user should be able to do a dozen
  placements in a flow state.
- **Clarity:** at a glance the user must understand "I'm deciding where THIS fits relative to
  THESE TWO, on THIS criterion." Make the active criterion and the two anchors unmistakable.
- **Prototype this** (clickable) so we can feel the rhythm before hi-fi.

## 7. Recurring UI elements & states to design

- **Score input** (1–5 with labels) — must be fast and one-handed; show the same control on Stand
  and in drift-resolution.
- **Deelnemer card** — the reusable unit (photo/keyword/projectgroep/stand nr); appears in lists,
  Compare anchors, Reconcile. Design its empty-photo fallback.
- **Drift flag** — a badge/indicator that reads as "attention, not error," plus its resolve view.
- **Vervolgproject reminder banner.**
- **Offline / sync status** — ambient, reassuring, non-blocking.
- **Empty states** — no deelnemers yet, nothing to compare yet, no drift flags (the "all clean"
  reward state).
- **Progress** — scored vs. placed vs. flagged at a glance on Event home.

## 8. Visual direction & brand  *(needs your input — see §11)*

- Audience & tone: a **student innovation award** — energetic, optimistic, modern, credible.
  Should feel like a tool that takes fairness seriously without feeling bureaucratic.
- **Open:** is there existing **Winnovation** branding (logo, colours, type) the designer must
  follow, or creative freedom? Please supply assets or confirm freedom.

## 9. Platform & constraints

- **PWA, installable**, full-screen, **portrait mobile** as the primary form factor.
- **Offline-first** — every screen except Reconcile works with no connection.
- **Accessibility:** WCAG AA contrast (venue lighting), large tap targets, legible at arm's
  length, supports system text scaling.
- **Language:** **Dutch** UI (criteria, labels, microcopy). Keep copy short.
- **Performance:** capture and placement must feel instant; no perceptible lag on a mid-range
  phone.

## 10. Scope & non-goals for design v1

- **In:** the seven surfaces above.
- **Out (don't design yet):** criterion weighting, more than 2 judges, multiple concurrent
  events, a tablet/desktop layout, dark mode (nice-to-have, not required), PDF reports.

## 11. Inputs we (client) still need to provide

- [ ] Winnovation brand assets (logo, colour, type) **or** confirmation of creative freedom.
- [ ] Design tool & handoff expectation (assumed **Figma** — confirm).
- [ ] Timeline / milestone date for first wireframes.
- [ ] 2–3 real example deelnemers (name + keyword + a photo) to make mockups concrete.

## 12. Deliverables we'd like from the designer

1. **User-flow diagram** across the four core screens (capture → compare → review → reconcile).
2. **Wireframes** for all seven surfaces (greyscale, structure & content first).
3. **Clickable prototype of the Compare interaction** for feel-testing.
4. **Hi-fi mockups** once direction is approved, including the element states in §7.
5. A lightweight **component inventory** (the deelnemer card, score input, buttons, banners) to
   hand to front-end (Angular + Tailwind).

## 13. Open questions for the designer

- Compare: buttons vs. drag/swipe for above/below/between — which reads faster one-handed?
- Should Compare work one-criterion-across-all-projects, or all-four-criteria-per-project? (We
  lean per-criterion; validate with a prototype.)
- How prominent should drift flags be without feeling like nagging?
- Best one-handed pattern for the 1–5 score input (segmented buttons, slider, stepper)?
