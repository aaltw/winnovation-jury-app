/* ============================================================
   Winnovation — deliberation screens: Review, Reconcile, Result
   ============================================================ */
(function (WV) {
  const h = React.createElement;
  const { useState } = React;
  const Icon = WV.Icon;

  /* ============================================================
     E · REVIEW — per-criterion safety net
     ============================================================ */
  WV.ReviewScreen = function ({ onNav }) {
    const { state, dispatch } = WV.useStore();
    const [crit, setCrit] = useState("innov");
    const [resolve, setResolve] = useState(null); // {id, crit}
    const c = WV.CRITERIA.find((x) => x.key === crit);
    const driftAll = WV.driftList(state);
    const driftHere = driftAll.filter((d) => d.crit === crit);
    const order = state.orders[crit] || [];

    return h(WV.Phone, null,
      h(WV.AppBar, { title: "Nakijken", sub: "per criterium",
        left: h("button", { className: "wv-appbar-btn", onClick: () => onNav("home") }, h(Icon, { name: "chevLeft", size: 20 })),
        right: h(WV.Sync, { state }) }),

      /* criterion tabs */
      h("div", { style: { display: "flex", gap: 6, padding: "0 16px 12px", overflowX: "auto" } },
        WV.CRITERIA.map((x) => {
          const cnt = driftAll.filter((d) => d.crit === x.key).length;
          const on = x.key === crit;
          return h("button", { key: x.key, onClick: () => setCrit(x.key),
            style: { display: "inline-flex", alignItems: "center", gap: 6, flex: "none", border: "1.5px solid " + (on ? x.hex : "var(--line-2)"), background: on ? x.hex : "#fff", color: on ? "#fff" : "var(--ink-2)", padding: "8px 13px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-ui)" } },
            x.label,
            cnt > 0 && h("span", { style: { background: on ? "rgba(255,255,255,.25)" : "var(--amber)", color: "#fff", borderRadius: 999, minWidth: 18, height: 18, display: "grid", placeItems: "center", fontSize: 11, padding: "0 5px" } }, cnt));
        })),

      h("div", { className: "wv-scroll" },
        h("div", { className: "wv-pad", style: { paddingTop: 4 } },
          driftHere.length > 0 ? h(React.Fragment, null,
            h("div", { className: "wv-divider-label", style: { marginTop: 4 } },
              h("span", { className: "t", style: { color: "var(--amber-ink)" } }, "Even checken"), h("span", { className: "ln" })),
            h("div", { className: "wv-list", style: { marginBottom: 4 } },
              driftHere.map((d) => h(WV.DriftFlag, { key: d.id, d: WV.byId(state, d.id), crit: d.crit, severity: d.severity, onClick: () => setResolve({ id: d.id, crit: d.crit }) }))))
          : h("div", { style: { marginBottom: 6 } }, h("div", { style: { display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderRadius: 12, background: "var(--mint-soft)", color: "#066b48", fontSize: 13, fontWeight: 700 } },
              h(Icon, { name: "check", size: 17 }), "Geen drift op ", c.label, " \u2014 cijfers en plaatsing kloppen")),

          h("div", { className: "wv-divider-label" },
            h("span", { className: "t" }, "Ranglijst \u00b7 " + c.label), h("span", { className: "ln" }),
            h("span", { style: { fontSize: 11, color: "var(--muted)", fontWeight: 600 } }, order.length + " projecten")),

          h("div", { className: "wv-list" },
            order.map((id, i) => {
              const d = WV.byId(state, id);
              const dft = driftHere.find((x) => x.id === id);
              return h("div", { key: id, style: { display: "flex", alignItems: "center", gap: 10 } },
                h("span", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--muted)", width: 26, textAlign: "center", flex: "none", fontVariantNumeric: "tabular-nums" } }, i + 1),
                h("div", { style: { flex: 1 } },
                  h(WV.DeelCard, { d, drift: !!dft, onClick: dft ? () => setResolve({ id, crit }) : undefined,
                    trailing: h("div", { style: { display: "flex", alignItems: "center", gap: 8, flex: "none" } },
                      h("span", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: c.hex } }, d.scoresA[crit]),
                      h(Icon, { name: dft ? "chevRight" : "check", size: 16, style: { color: dft ? "var(--amber-ink)" : "var(--line-2)" } })) })));
            })))),

      resolve && h(ResolveSheet, { resolve, onClose: () => setResolve(null), onNav }));
  };

  function ResolveSheet({ resolve, onClose, onNav }) {
    const { state, dispatch } = WV.useStore();
    const d = WV.byId(state, resolve.id);
    const c = WV.CRITERIA.find((x) => x.key === resolve.crit);
    const order = state.orders[resolve.crit] || [];
    const rank = order.indexOf(resolve.id) + 1;
    const drift = WV.computeDrift(state);
    const stillDrift = drift[resolve.id] && drift[resolve.id][resolve.crit];

    return h("div", { onClick: onClose, style: { position: "absolute", inset: 0, background: "rgba(22,23,29,.5)", zIndex: 20, display: "flex", alignItems: "flex-end", borderRadius: "var(--r-screen)", overflow: "hidden" } },
      h("div", { onClick: (e) => e.stopPropagation(), style: { background: "var(--bg)", width: "100%", borderRadius: "26px 26px 0 0", padding: "10px 20px 26px", maxHeight: "88%", overflowY: "auto" } },
        h("div", { style: { width: 40, height: 4, borderRadius: 999, background: "var(--line-2)", margin: "0 auto 14px" } }),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 } },
          h("span", { style: { width: 30, height: 30, borderRadius: 9, background: stillDrift ? "var(--amber)" : "var(--mint)", color: "#fff", display: "grid", placeItems: "center" } }, h(Icon, { name: stillDrift ? "flag" : "check", size: 16, stroke: 2.2 })),
          h("h3", { style: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, margin: 0 } }, stillDrift ? "Drift oplossen" : "Opgelost")),
        h("p", { style: { fontSize: 13.5, color: "var(--muted)", margin: "8px 0 16px", lineHeight: 1.5 } },
          stillDrift ? h(React.Fragment, null, "Je plaatste ", h("b", { style: { color: "var(--ink)" } }, d.keyword), " op rang ", h("b", { style: { color: "var(--ink)" } }, "#" + rank), " bij ", c.label, ", maar je cijfer (", h("b", { style: { color: c.hex } }, d.scoresA[resolve.crit]), ") spreekt dat tegen. Pas één van beide aan.")
            : "Cijfer en plaatsing zijn weer met elkaar in lijn. Mooi.")),

        h("div", { className: "wv-card", style: { padding: 16, marginBottom: 14 } },
          h(WV.ScoreInput, { crit: c, value: d.scoresA[resolve.crit], onChange: (v) => dispatch({ type: "SET_SCORE", id: resolve.id, crit: resolve.crit, value: v }) })),

        h(WV.Btn, { kind: stillDrift ? "ghost" : "primary", icon: stillDrift ? "scale" : "check", onClick: () => { if (stillDrift) { dispatch({ type: "REPLACE_ORDER", crit: resolve.crit, order: order.filter((x) => x !== resolve.id) }); dispatch({ type: "SET_FOCUS", id: resolve.id }); onNav("compare"); } else onClose(); } },
          stillDrift ? "Liever herplaatsen in Vergelijken" : "Klaar"));
  }

  /* ============================================================
     F · RECONCILE — two judges together
     ============================================================ */
  WV.ReconcileScreen = function ({ onNav }) {
    const { state, dispatch } = WV.useStore();
    const [open, setOpen] = useState(null);
    const rk = WV.combinedRanking(state);
    const rows = rk.complete.slice().sort((a, b) => b.disagree - a.disagree);
    const maxDis = Math.max(1, ...rows.map((r) => r.disagree));

    return h(WV.Phone, null,
      h(WV.AppBar, { title: "Verzoenen", sub: "jij + jurylid B",
        left: h("button", { className: "wv-appbar-btn", onClick: () => onNav("home") }, h(Icon, { name: "chevLeft", size: 20 })),
        right: h(WV.Sync, { state: { ...state, sync: "syncing" } }) }),

      h("div", { className: "wv-scroll" },
        h("div", { className: "wv-pad", style: { paddingTop: 4 } },
          h("p", { style: { fontSize: 13, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 } },
            "Samengevoegde ranglijst. ", h("b", { style: { color: "var(--ink)" } }, "Grootste meningsverschillen eerst"), " \u2014 bespreek die en leg de eindstand vast."),

          h("div", { className: "wv-list" },
            rows.map((r, i) => {
              const isOpen = open === r.d.id;
              const hot = r.disagree >= maxDis * 0.6 && r.disagree > 1;
              return h("div", { key: r.d.id, className: "wv-card", style: { padding: 0, overflow: "hidden", borderColor: hot ? "#F4DC9E" : "var(--line)" } },
                h("div", { onClick: () => setOpen(isOpen ? null : r.d.id), style: { display: "flex", alignItems: "center", gap: 11, padding: 12, cursor: "pointer" } },
                  h("span", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, width: 24, textAlign: "center", color: "var(--muted)", flex: "none" } }, i + 1),
                  h(WV.Photo, { d: r.d, size: 44, radius: 11 }),
                  h("div", { style: { flex: 1, minWidth: 0 } },
                    h("div", { style: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15.5, lineHeight: 1.1 } }, r.d.keyword),
                    h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
                      h("span", { style: { fontSize: 11, fontWeight: 700, color: "var(--brand-ink)" } }, "Jij"),
                      h("div", { className: "wv-bar", style: { flex: 1, maxWidth: 80, height: 6 } }, h("span", { style: { width: (r.ptsA ? 100 - Math.min(90, r.ptsA * 4) : 100) + "%", background: "var(--brand)" } })),
                      h("span", { style: { fontSize: 11, fontWeight: 700, color: "var(--coral)" } }, "B"),
                      h("div", { className: "wv-bar", style: { flex: 1, maxWidth: 80, height: 6 } }, h("span", { style: { width: (r.ptsB ? 100 - Math.min(90, r.ptsB * 4) : 100) + "%", background: "var(--coral)" } })))),
                  hot ? h("span", { className: "wv-chip wv-chip-amber", style: { flex: "none" } }, "bespreken")
                      : h(Icon, { name: isOpen ? "chevUp" : "chevDown", size: 18, style: { color: "var(--muted)", flex: "none" } })),

                isOpen && h("div", { style: { borderTop: "1px solid var(--line)", padding: 14, background: "var(--bg-2)" } },
                  h("div", { style: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px 14px", alignItems: "center", fontSize: 13 } },
                    h("span", { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--muted)" } }, "Criterium"),
                    h("span", { style: { fontSize: 10.5, fontWeight: 800, color: "var(--brand-ink)", textTransform: "uppercase" } }, "Jij"),
                    h("span", { style: { fontSize: 10.5, fontWeight: 800, color: "var(--coral)", textTransform: "uppercase" } }, "B"),
                    WV.CRITERIA.map((cc) => h(React.Fragment, { key: cc.key },
                      h("span", { style: { display: "flex", alignItems: "center", gap: 7, fontWeight: 600 } }, h("span", { style: { width: 9, height: 9, borderRadius: 3, background: cc.hex } }), cc.label),
                      h("span", { style: { fontWeight: 800, fontFamily: "var(--font-display)", color: cc.hex } }, r.d.scoresA[cc.key]),
                      h("span", { style: { fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--ink-2)" } }, r.d.scoresB ? r.d.scoresB[cc.key] : "\u2014")))),
                  h("div", { style: { display: "flex", gap: 8, marginTop: 14 } },
                    h(WV.Btn, { kind: "soft", sm: true, icon: "check" }, "Eens \u2014 vergrendel"),
                    h(WV.Btn, { kind: "ghost", sm: true, icon: "users" }, "Praat het uit"))));
            }))),

        rk.incomplete.length > 0 && h("div", { className: "wv-pad-x", style: { paddingBottom: 8 } },
          h("div", { className: "wv-divider-label" }, h("span", { className: "t" }, "Incompleet"), h("span", { className: "ln" })),
          h("div", { className: "wv-list" }, rk.incomplete.map((r) =>
            h(WV.DeelCard, { key: r.d.id, d: r.d, trailing: h("span", { className: "wv-chip wv-chip-line" }, r.scoredB ? "Alleen B" : "Alleen jij") }))))),

      h("div", { className: "wv-dock bordered" },
        h(WV.Btn, { kind: "primary", icon: "trophy", onClick: () => { dispatch({ type: "LOCK_FINAL" }); onNav("result"); } }, "Eindstand vastleggen")));
  };

  /* ============================================================
     G · RESULT / EXPORT
     ============================================================ */
  WV.ResultScreen = function ({ onNav }) {
    const { state } = WV.useStore();
    const rk = WV.combinedRanking(state);
    const winner = rk.complete[0];
    const rest = rk.complete.slice(1);

    return h(WV.Phone, null,
      h(WV.AppBar, { title: "Uitslag", sub: state.finalLocked ? "definitief" : "voorlopig",
        left: h("button", { className: "wv-appbar-btn", onClick: () => onNav("reconcile") }, h(Icon, { name: "chevLeft", size: 20 })),
        right: h("button", { className: "wv-appbar-btn" }, h(Icon, { name: "share", size: 19 })) }),

      h("div", { className: "wv-scroll" },
        h("div", { className: "wv-pad", style: { paddingTop: 2 } },
          /* winner */
          winner && h("div", { style: { position: "relative", borderRadius: 22, padding: "22px 18px", marginBottom: 8, overflow: "hidden",
              background: "linear-gradient(135deg, var(--ink) 0%, #24202E 60%, #2E1F2A 100%)", color: "#fff" } },
            h("div", { style: { position: "absolute", top: -30, right: -20, opacity: .12, transform: "rotate(8deg)" } }, h(Icon, { name: "trophy", size: 150, stroke: 1 })),
            h("div", { style: { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--coral)", color: "#fff", padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, letterSpacing: ".03em" } },
              h(Icon, { name: "trophy", size: 14 }), "WINNAAR"),
            h("div", { style: { display: "flex", alignItems: "center", gap: 13, marginTop: 16, position: "relative" } },
              h(WV.Photo, { d: winner.d, size: 60, radius: 15 }),
              h("div", { style: { minWidth: 0 } },
                h("div", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, lineHeight: 1.08, letterSpacing: "-0.02em" } }, winner.d.keyword),
                h("div", { style: { fontSize: 13, color: "rgba(255,255,255,.6)", marginTop: 6 } }, winner.d.projectgroep + " \u00b7 " + WV.fmtStand(winner.d.standNr)))),
            h("div", { style: { display: "flex", gap: 16, marginTop: 16, position: "relative" } },
              WV.CRITERIA.map((c) => h("div", { key: c.key },
                h("div", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#fff" } }, (winner.d.scoresA[c.key] + (winner.d.scoresB ? winner.d.scoresB[c.key] : 0))),
                h("div", { style: { fontSize: 9.5, color: "rgba(255,255,255,.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", marginTop: 2 } }, c.short))))),

          /* ranking list */
          h("div", { className: "wv-divider-label" }, h("span", { className: "t" }, "Eindklassement"), h("span", { className: "ln" })),
          h("div", { className: "wv-list" },
            rest.map((r, i) => h("div", { key: r.d.id, style: { display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", background: "#fff", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "var(--sh-card)" } },
              h("span", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, width: 26, textAlign: "center", color: "var(--muted)", flex: "none" } }, i + 2),
              h(WV.Photo, { d: r.d, size: 42, radius: 11 }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 } }, r.d.keyword),
                h("div", { style: { fontSize: 12, color: "var(--muted)" } }, r.d.projectgroep)),
              h("div", { style: { textAlign: "right", flex: "none" } },
                h("div", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 } }, r.total),
                h("div", { style: { fontSize: 9.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" } }, "punten"))))),

          /* incomplete */
          rk.incomplete.length > 0 && h(React.Fragment, null,
            h("div", { className: "wv-divider-label" }, h("span", { className: "t" }, "Niet meegeteld"), h("span", { className: "ln" }), h("span", { style: { fontSize: 11, color: "var(--muted)" } }, "1 jurylid")),
            h("div", { className: "wv-list" }, rk.incomplete.map((r) =>
              h(WV.DeelCard, { key: r.d.id, d: r.d, trailing: h("span", { className: "wv-chip wv-chip-line" }, r.scoredB ? "Alleen B" : "Alleen jij") })))))),

      h("div", { className: "wv-dock bordered" },
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
          h(WV.Btn, { kind: "ghost", icon: "download" }, "CSV"),
          h(WV.Btn, { kind: "primary", icon: "share" }, "Deel uitslag"))));
  };
})(window.WV);
