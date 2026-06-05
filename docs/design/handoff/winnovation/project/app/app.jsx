/* ============================================================
   Winnovation — review board: all 7 surfaces as a live set
   sharing one store. "Navigation" = smooth-scroll to a frame.
   ============================================================ */
(function (WV) {
  const h = React.createElement;
  const { useRef } = React;
  const Icon = WV.Icon;

  /* annotation card beside a single frame */
  function Note({ eyebrow, title, points, color }) {
    return h("div", { style: { width: 300, alignSelf: "flex-start", marginTop: 38 } },
      h("div", { className: "wv-eyebrow", style: { color: color || "var(--brand-ink)" } }, eyebrow),
      h("h3", { style: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", margin: "8px 0 14px", lineHeight: 1.1 } }, title),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 11 } },
        points.map((p, i) => h("div", { key: i, style: { display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.45, color: "var(--ink-2)" } },
          h("span", { style: { width: 6, height: 6, borderRadius: 2, background: color || "var(--brand)", flex: "none", marginTop: 7 } }),
          h("span", null, p)))));
  }

  function Slot({ tag, name, note, setRef, screenKey, children }) {
    return h("div", { className: "wv-slot", ref: (el) => setRef && setRef(screenKey, el) },
      h("div", { className: "wv-slot-label" }, h("span", { className: "tag" }, tag), name),
      children,
      note && h("div", { className: "wv-slot-note" }, note));
  }

  function Board() {
    const { state } = WV.useStore();
    const refs = useRef({});
    const setRef = (k, el) => { if (el) refs.current[k] = el; };
    const nav = (k) => {
      const el = refs.current[k];
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: "smooth" });
    };

    const jump = [["join", "Join"], ["home", "Home"], ["stand", "Stand"], ["compare", "Vergelijken"], ["review", "Nakijken"], ["reconcile", "Verzoenen"], ["result", "Uitslag"]];

    return h("div", { className: "wv-board-inner" },
      /* masthead */
      h("div", { className: "wv-mast" },
        h("div", { className: "wv-mast-lede" },
          h("div", { className: "wv-wordmark" },
            h("span", { className: "wv-spark" }, h(Icon, { name: "spark", size: 18, fill: "#fff" })), "Winnovation"),
          h("h1", null, "Jury-app \u2014 ", h("em", null, "hi-fi prototype")),
          h("p", null, "Twee juryleden ranken 15\u201330 studentprojecten eerlijk: snelle eerste indruk \u00e9n doorlopend vergelijken. Alle zeven schermen staan hieronder als \u00e9\u00e9n live prototype \u2014 ", h("b", null, "scoor een project bij Stand en zie Home, Vergelijken en de Uitslag meteen meebewegen."))),
        h("div", { className: "wv-legend" },
          WV.CRITERIA.map((c) => h("div", { key: c.key, className: "wv-legend-row" },
            h("span", { className: "wv-legend-dot", style: { background: c.hex } }), c.label)),
          h("div", { className: "wv-legend-row" }, h("span", { className: "wv-legend-dot", style: { background: "var(--amber)" } }), "Drift \u2014 cijfer \u2260 plaatsing"))),

      /* quick jump */
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 26 } },
        jump.map(([k, l]) => h("button", { key: k, onClick: () => nav(k),
          style: { border: "1px solid var(--line-2)", background: "#fff", color: "var(--ink-2)", padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)" } }, l))),

      /* rationale */
      h("div", { className: "wv-rationale" },
        [["1", "Snelheid bij de stand", "Scoren is het hete pad \u2014 grote tikdoelen, segment-knoppen, < 1 minuut per project, \u00e9\u00e9nhandig."],
         ["2", "Zekerheid door vergelijken", "Elk project krijgt een cijfer \u00e9n een plek t.o.v. concrete eerdere projecten \u2014 nooit een vaag geheugen."],
         ["3", "Eerlijk over conflicten", "Drift (cijfer \u2260 plaatsing) verschijnt rustig: telmerk op Home, badge in lijsten. Aandacht, geen fout."],
         ["4", "Offline is onzichtbaar", "Sync-status is ambient en blokkeert nooit. Geen spinners, geen \u00abgeen verbinding\u00bb-muren."]]
          .map(([n, t, d]) => h("div", { key: n, className: "cell" },
            h("h4", null, h("span", { className: "n" }, n), t), h("p", null, d)))),

      /* —— Chapter 1 —— */
      chapter("01", "Aan de slag", "Binnenkomen en de werkdag overzien."),
      h("div", { className: "wv-row" },
        h(Slot, { tag: "A", name: "Join / onboarding", setRef, screenKey: "join",
          note: "Geen account. Eventcode + kies jurylid A/B. ~10 sec. Eerste keer: het ritme van de dag." },
          h(WV.JoinScreen, null)),
        h(Slot, { tag: "B", name: "Event home", setRef, screenKey: "home",
          note: "De werkdag: voortgang (gescoord \u00b7 geplaatst \u00b7 drift), \u00ab+ Nieuwe deelnemer\u00bb en ingangen naar de rest." },
          h(WV.HomeScreen, { onNav: nav }))),

      /* —— Chapter 2 —— */
      chapter("02", "De hot path", "Een nieuw project vastleggen in seconden."),
      h("div", { className: "wv-row" },
        h(Slot, { tag: "C", name: "Stand \u2014 snelle capture", setRef, screenKey: "stand" },
          h(WV.StandScreen, { onSaved: () => nav("compare") })),
        h(Note, { eyebrow: "Ontwerpkeuzes", title: "Alles op \u00e9\u00e9n scherm, tikken i.p.v. typen",
          points: [
            "Score-input = vijf segment-knoppen met labels (1 slecht \u2192 5 uitstekend) \u2014 snel en \u00e9\u00e9nhandig.",
            "Keyword is de geheugensteun die overal terugkomt \u2014 in lijsten en als anker bij Vergelijken.",
            "Vervolgproject-schakelaar toont meteen de herinnering: beoordeel alleen de uitbreiding.",
            "Na opslaan: direct plaatsen (\u2192 Vergelijken) of later." ] })),

      /* —— Chapter 3 —— */
      chapter("03", "Vergelijken \u2014 de kerninteractie", "Het hart van het product. Hier zit de meeste ontwerpaandacht."),
      h("div", { className: "wv-row" },
        h(Slot, { tag: "D", name: "Compare \u00b7 3-weg plaatsing", setRef, screenKey: "compare",
          note: "Probeer beide modi met de toggle. Plaats FietsFlow (net gescoord) \u2014 alle vier criteria, \u00e9\u00e9n project tegelijk." },
          h(WV.CompareScreen, { onNav: nav })),
        h(Note, { eyebrow: "De signature move", title: "Boven / tussen / onder \u2014 t.o.v. een paar ankers", color: "var(--brand-ink)",
          points: [
            "Geen binaire swipe: een 3-weg plaatsing tegen twee al-geplaatste projecten.",
            "Feel-test ingebouwd: schakel tussen Knoppen en Slepen om te voelen wat sneller leest.",
            "\u00c9\u00e9n tik plaatst (\u00abtussen\u00bb); Hoger/Lager versmalt de gok in stappen.",
            "Per project alle vier criteria; jouw cijfer staat erbij, zodat tegenspraak meteen zichtbaar is.",
            "Voortgangsbalk bovenaan toont welk criterium en hoeveel projecten nog." ] })),

      /* —— Chapter 4 —— */
      chapter("04", "Beslissen & afronden", "Tegenspraak oplossen, samenkomen, en de winnaar bekronen."),
      h("div", { className: "wv-row" },
        h(Slot, { tag: "E", name: "Review \u2014 vangnet", setRef, screenKey: "review",
          note: "Per criterium een ranglijst van iedereen. Drift bovenaan; tik om rustig op te lossen (cijfer of herplaatsen)." },
          h(WV.ReviewScreen, { onNav: nav })),
        h(Slot, { tag: "F", name: "Reconcile \u2014 samen", setRef, screenKey: "reconcile",
          note: "Samengevoegde ranglijst, grootste meningsverschillen eerst. \u00abJij / B\u00bb naast elkaar per criterium." },
          h(WV.ReconcileScreen, { onNav: nav })),
        h(Slot, { tag: "G", name: "Result / export", setRef, screenKey: "result",
          note: "Eindklassement met duidelijke winnaar. Incomplete projecten (\u00e9\u00e9n jurylid) apart, niet verstopt. CSV / deel." },
          h(WV.ResultScreen, { onNav: nav }))),

      h("div", { style: { marginTop: 70, paddingTop: 24, borderTop: "1px solid var(--line-2)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, color: "var(--muted)", fontSize: 13 } },
        h("span", null, "Winnovation Jury-app \u00b7 hi-fi interactief prototype \u00b7 portret-mobiel, offline-first PWA"),
        h("span", null, "Eén gedeelde staat \u2014 alle schermen zijn live.")));
  }

  function chapter(idx, title, sub) {
    return h("div", { className: "wv-section" },
      h("div", { className: "wv-section-head" },
        h("span", { className: "idx" }, idx),
        h("div", null, h("h2", null, title), h("p", null, sub)),
        h("span", { className: "divider" })));
  }

  WV.mount = function () {
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(h(WV.StoreProvider, null, h(Board, null)));
  };
})(window.WV);
