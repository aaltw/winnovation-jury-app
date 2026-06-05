/* ============================================================
   Winnovation — COMPARE (the signature interaction)
   3-way placement: Hoger / Tussen / Lager, all 4 criteria per
   project. Two input modes (knoppen | slepen) to feel-test.
   ============================================================ */
(function (WV) {
  const h = React.createElement;
  const { useState, useEffect, useRef } = React;
  const Icon = WV.Icon;

  /* compact anchor card */
  function Anchor({ d, crit, label, tone, active }) {
    return h("div", { style: {
        display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 14,
        background: active ? tone.soft : "#fff",
        border: "1.5px solid " + (active ? tone.line : "var(--line)"),
        transition: "all .12s", opacity: d ? 1 : .4 } },
      h("span", { style: { fontSize: 10, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: active ? tone.ink : "var(--muted)", width: 42, flex: "none" } }, label),
      d ? h(React.Fragment, null,
        h(WV.Photo, { d, size: 36, radius: 9 }),
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, d.keyword),
          h("div", { style: { fontSize: 11, color: "var(--muted)" } }, WV.fmtStand(d.standNr))),
        h("span", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: crit.hex, flex: "none" } }, d.scoresA[crit.key]))
        : h("div", { style: { fontSize: 12, color: "var(--muted)", fontStyle: "italic" } }, "\u2014 niemand \u2014"));
  }

  WV.CompareScreen = function ({ onNav }) {
    const { state, dispatch } = WV.useStore();
    const [mode, setMode] = useState("buttons"); // buttons | swipe
    const [bracket, setBracket] = useState({ lo: 0, hi: 0 });
    const [drag, setDrag] = useState(0);
    const dragRef = useRef(null);
    const start = useRef(null);

    /* pick focus project: explicit draftFocus if still unplaced, else first unplaced */
    const unplaced = WV.unplaced(state);
    let focus = state.draftFocus ? WV.byId(state, state.draftFocus) : null;
    if (!focus || WV.isPlaced(state, focus.id)) focus = unplaced[0];

    const allDone = !focus;
    /* current criterion = first not yet placed for this focus */
    const currentCrit = !allDone && WV.CRITERIA.find((c) => !(state.orders[c.key] || []).includes(focus.id));
    const placedCount = allDone ? 4 : WV.CRITERIA.filter((c) => (state.orders[c.key] || []).includes(focus.id)).length;

    const order = (currentCrit && (state.orders[currentCrit.key] || []).filter((id) => id !== focus.id)) || [];
    const n = order.length;
    const key = focus ? focus.id + ":" + (currentCrit ? currentCrit.key : "done") : "none";

    /* reset bracket when project / criterion changes */
    useEffect(() => { setBracket({ lo: 0, hi: n }); setDrag(0); }, [key]);

    function commit(index) {
      dispatch({ type: "PLACE", id: focus.id, crit: currentCrit.key, index });
      setDrag(0);
    }
    function decide(dir) {
      const { lo, hi } = bracket;
      const mid = Math.floor((lo + hi) / 2);
      if (dir === "between") return commit(mid);
      if (dir === "above") { if (mid - 1 < lo) return commit(lo); const nhi = mid - 1; return (lo === nhi ? commit(lo) : setBracket({ lo, hi: nhi })); }
      if (dir === "below") { if (mid + 1 > hi) return commit(hi); const nlo = mid + 1; return (nlo === hi ? commit(hi) : setBracket({ lo: nlo, hi })); }
    }

    const tone = currentCrit ? { ink: currentCrit.hex, soft: currentCrit.hex + "1A", line: currentCrit.hex } : {};

    /* —— ALL DONE —— */
    if (allDone) {
      return h(WV.Phone, null,
        compareBar(state, onNav, null, 0),
        h("div", { className: "wv-scroll", style: { display: "flex", alignItems: "center" } },
          h("div", { style: { margin: "auto", width: "100%" } },
            h(WV.Empty, { clean: true, title: "Alles geplaatst" },
              "Elk project staat op zijn plek in alle vier de criteria. Tijd om na te kijken of te verzoenen."))),
        h("div", { className: "wv-dock bordered" },
          h(WV.Btn, { kind: "primary", icon: "list", onClick: () => onNav("review") }, "Naar nakijken"),
          h(WV.Btn, { kind: "ghost", icon: "handshake", onClick: () => onNav("reconcile") }, "Verzoenen met B")));
    }

    /* bracket view */
    const { lo, hi } = bracket;
    const mid = Math.floor((lo + hi) / 2);
    const topId = mid - 1 >= 0 ? order[mid - 1] : null;
    const botId = mid <= n - 1 ? order[mid] : null;
    const top = topId ? WV.byId(state, topId) : null;
    const bot = botId ? WV.byId(state, botId) : null;
    const both = top && bot;
    const single = (!top || !bot);

    /* drag zone from delta */
    const zone = drag < -54 ? "above" : drag > 54 ? "below" : "between";

    function onDown(e) { start.current = e.clientY; dragRef.current && dragRef.current.setPointerCapture(e.pointerId); }
    function onMove(e) { if (start.current == null) return; setDrag(e.clientY - start.current); }
    function onUp() {
      if (start.current == null) return; start.current = null;
      if (single) { if (!top) decide(zone === "above" ? "above" : "below"); else decide(zone === "below" ? "below" : "above"); }
      else decide(zone);
    }

    return h(WV.Phone, null,
      compareBar(state, onNav, currentCrit, placedCount),

      h("div", { className: "wv-scroll", style: { display: "flex", flexDirection: "column" } },
        h("div", { className: "wv-pad", style: { flex: 1, display: "flex", flexDirection: "column", paddingTop: 8 } },

          /* prompt */
          h("div", { style: { textAlign: "center", marginBottom: 12 } },
            h("div", { className: "wv-eyebrow" }, "Waar past dit project?"),
            h("div", { style: { fontSize: 12.5, color: "var(--muted)", marginTop: 3 } },
              "op ", h("b", { style: { color: currentCrit.hex } }, currentCrit.label),
              " \u2014 t.o.v. wat je al zag")),

          /* mode toggle */
          h("div", { style: { display: "flex", gap: 4, background: "var(--bg-2)", padding: 3, borderRadius: 999, marginBottom: 14, alignSelf: "center" } },
            [["buttons", "Knoppen", "target"], ["swipe", "Slepen", "layers"]].map(([m, lbl, ic]) =>
              h("button", { key: m, onClick: () => setMode(m),
                style: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", padding: "7px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-ui)",
                  background: mode === m ? "#fff" : "transparent", color: mode === m ? "var(--ink)" : "var(--muted)", boxShadow: mode === m ? "var(--sh-card)" : "none" } },
                h(Icon, { name: ic, size: 15 }), lbl))),

          /* —— BUTTONS MODE —— */
          mode === "buttons" && h("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: 9, justifyContent: "center" } },
            h(Anchor, { d: top, crit: currentCrit, label: "hoger", tone, active: false }),
            focusCard(focus, currentCrit),
            h(Anchor, { d: bot, crit: currentCrit, label: "lager", tone, active: false }),

            h("div", { style: { display: "grid", gap: 8, marginTop: 6 } },
              both && h("button", { className: "wv-btn", style: { background: currentCrit.hex, color: "#fff", boxShadow: "0 6px 16px " + currentCrit.hex + "44" }, onClick: () => decide("between") },
                h(Icon, { name: "arrowRight", size: 18, style: { transform: "rotate(90deg)" } }), "Hier tussen plaatsen"),
              h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                h(WV.Btn, { kind: "ghost", icon: "chevUp", onClick: () => decide("above") }, single && !top ? "Bovenaan" : "Hoger"),
                h(WV.Btn, { kind: "ghost", icon: "chevDown", onClick: () => decide("below") }, single && !bot ? "Onderaan" : "Lager")))),

          /* —— SWIPE MODE —— */
          mode === "swipe" && h("div", { style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, position: "relative" } },
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 34, borderRadius: 12, color: zone === "above" ? "#fff" : tone.ink, fontWeight: 800, fontSize: 13, letterSpacing: ".04em", textTransform: "uppercase",
              background: zone === "above" ? currentCrit.hex : tone.soft, transition: "all .12s", opacity: top ? 1 : .35 } },
              h(Icon, { name: "chevUp", size: 16 }), top ? "Hoger dan " + top.keyword : "Bovenaan"),

            h("div", { ref: dragRef, onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
              style: { touchAction: "none", cursor: start.current != null ? "grabbing" : "grab", transform: `translateY(${drag}px)`, transition: start.current != null ? "none" : "transform .22s var(--ease, ease)", zIndex: 3 } },
              focusCard(focus, currentCrit, true, zone)),

            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 34, borderRadius: 12, color: zone === "below" ? "#fff" : tone.ink, fontWeight: 800, fontSize: 13, letterSpacing: ".04em", textTransform: "uppercase",
              background: zone === "below" ? currentCrit.hex : tone.soft, transition: "all .12s", opacity: bot ? 1 : .35 } },
              h(Icon, { name: "chevDown", size: 16 }), bot ? "Lager dan " + bot.keyword : "Onderaan"),

            h("div", { style: { textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 4 } },
              both ? "Sleep omhoog/omlaag, of laat los voor \u00abtussen\u00bb" : "Sleep om te plaatsen")))),

      h("div", { className: "wv-dock bordered", style: { paddingTop: 8 } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)" } },
          h("span", null, h("b", { style: { color: "var(--ink)" } }, unplaced.length), " project" + (unplaced.length !== 1 ? "en" : "") + " te plaatsen"),
          h("button", { className: "wv-btn-link", onClick: () => onNav("home") }, "Later afmaken"))));
  };

  /* shared focus card */
  function focusCard(d, crit, draggable, zone) {
    return h("div", { style: {
        background: "#fff", border: "2px solid " + crit.hex, borderRadius: 18, padding: 14,
        boxShadow: draggable ? "var(--sh-pop)" : "0 4px 18px " + crit.hex + "22",
        display: "flex", alignItems: "center", gap: 13, position: "relative" } },
      h(WV.Photo, { d, size: 52, radius: 13 }),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
          h("span", { className: "wv-chip wv-chip-stand", style: { fontSize: 10, padding: "2px 7px" } }, WV.fmtStand(d.standNr)),
          d.vervolg && h(Icon, { name: "leaf", size: 13, style: { color: "var(--mint)" } })),
        h("div", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, lineHeight: 1.1, marginTop: 3, letterSpacing: "-0.01em" } }, d.keyword),
        h("div", { style: { fontSize: 12.5, color: "var(--muted)" } }, d.projectgroep)),
      h("div", { style: { textAlign: "center", flex: "none", paddingLeft: 6 } },
        h("div", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, color: crit.hex, lineHeight: 1 } }, d.scoresA[crit.key]),
        h("div", { style: { fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 2 } }, "jouw cijfer")));
  }

  /* compare top bar with criterion progress dots */
  function compareBar(state, onNav, currentCrit, placedCount) {
    return h(React.Fragment, null,
      h("div", { className: "wv-appbar", style: { paddingBottom: 10 } },
        h("button", { className: "wv-appbar-btn", onClick: () => onNav("home") }, h(Icon, { name: "chevLeft", size: 20 })),
        h("h2", { style: { fontSize: 19 } }, "Vergelijken"),
        h(WV.Sync, { state })),
      currentCrit && h("div", { style: { display: "flex", gap: 6, padding: "0 20px 12px" } },
        WV.CRITERIA.map((c, i) => h("div", { key: c.key, style: { flex: 1, display: "flex", flexDirection: "column", gap: 5, alignItems: "center", opacity: i <= placedCount ? 1 : .4 } },
          h("div", { style: { height: 5, width: "100%", borderRadius: 999, background: i < placedCount ? c.hex : (c.key === currentCrit.key ? c.hex : "var(--line-2)"), opacity: i < placedCount ? 1 : (c.key === currentCrit.key ? 1 : .5) } }),
          h("span", { style: { fontSize: 9.5, fontWeight: 700, color: c.key === currentCrit.key ? c.hex : "var(--muted)" } }, c.short)))));
  }
})(window.WV);
