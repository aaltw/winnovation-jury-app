/* ============================================================
   Winnovation — capture screens: Join, Event Home, Stand
   ============================================================ */
(function (WV) {
  const h = React.createElement;
  const { useState } = React;
  const Icon = WV.Icon;

  /* ============================================================
     A · JOIN / ONBOARDING
     ============================================================ */
  WV.JoinScreen = function () {
    const { state, dispatch } = WV.useStore();
    const steps = [
      ["camera", "Vastleggen", "Scoor elk project in seconden, aan de stand."],
      ["scale", "Vergelijken", "Plaats het t.o.v. projecten die je al zag."],
      ["handshake", "Verzoenen", "Leg samen de eerlijke eindstand vast."],
    ];
    return h(WV.Phone, { dark: true, bg: "var(--ink)" },
      h("div", { className: "wv-scroll", style: { padding: "8px 26px 26px", color: "#fff" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 8 } },
          h("span", { className: "wv-spark", style: { width: 30, height: 30, borderRadius: 9, background: "var(--brand)", display: "grid", placeItems: "center", transform: "rotate(-6deg)" } },
            h(Icon, { name: "spark", size: 18, fill: "#fff" })),
          h("span", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 21, letterSpacing: "-0.02em" } }, "Winnovation")),

        h("div", { style: { marginTop: 56 } },
          h("h1", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 38, lineHeight: 1.02, letterSpacing: "-0.03em", margin: 0 } },
            "Eerlijk jureren,", h("br"), h("span", { style: { color: "var(--brand)" } }, "project voor project.")),
          h("p", { style: { color: "rgba(255,255,255,.6)", fontSize: 15, lineHeight: 1.5, margin: "14px 0 0", maxWidth: 300 } },
            "Geen account. Voer de eventcode in en kies je plek als jurylid.")),

        /* event code */
        h("div", { style: { marginTop: 32 } },
          h("label", { className: "wv-label", style: { color: "rgba(255,255,255,.55)" } }, "Eventcode"),
          h("div", { style: { display: "flex", gap: 10 } },
            h("input", { className: "wv-input big", value: state.eventCode, readOnly: true,
              style: { background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.16)", color: "#fff", letterSpacing: "0.08em", textAlign: "center" } }),
            h("button", { className: "wv-appbar-btn", style: { width: 52, height: 52, background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.16)", color: "#fff" } },
              h(Icon, { name: "qr", size: 22 })))),

        /* slot picker */
        h("div", { style: { marginTop: 22 } },
          h("label", { className: "wv-label", style: { color: "rgba(255,255,255,.55)" } }, "Kies je plek"),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
            ["A", "B"].map((j) => {
              const on = state.judge === j;
              return h("button", { key: j, onClick: () => dispatch({ type: "SET_JUDGE", judge: j }),
                style: { padding: "16px 14px", borderRadius: 16, cursor: "pointer", textAlign: "left",
                  border: on ? "1.5px solid var(--brand)" : "1.5px solid rgba(255,255,255,.16)",
                  background: on ? "var(--brand)" : "rgba(255,255,255,.05)", color: "#fff", transition: "all .15s" } },
                h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                  h("span", { style: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26 } }, "Jurylid " + j),
                  on && h(Icon, { name: "check", size: 20 })),
                h("div", { style: { fontSize: 12.5, color: on ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.45)", marginTop: 2 } },
                  j === "A" ? "Jij" : "Collega"));
            }))),

        /* rhythm */
        h("div", { style: { marginTop: 30, display: "flex", flexDirection: "column", gap: 2 } },
          h("div", { className: "wv-eyebrow", style: { color: "rgba(255,255,255,.4)", marginBottom: 12 } }, "Het ritme van de dag"),
          steps.map(([ic, t, d], i) => h("div", { key: i, style: { display: "flex", gap: 13, alignItems: "flex-start", padding: "11px 0", borderTop: i ? "1px solid rgba(255,255,255,.08)" : "none" } },
            h("span", { style: { width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.08)", display: "grid", placeItems: "center", flex: "none", color: "var(--brand)" } },
              h(Icon, { name: ic, size: 18 })),
            h("div", null,
              h("div", { style: { fontWeight: 700, fontSize: 15 } }, (i + 1) + ". " + t),
              h("div", { style: { fontSize: 12.5, color: "rgba(255,255,255,.5)", marginTop: 1 } }, d)))))),

      h("div", { className: "wv-dock", style: { background: "var(--ink)" } },
        h(WV.Btn, { kind: "primary", iconRight: "arrowRight" }, "Start als jurylid " + state.judge)));
  };

  /* ============================================================
     B · EVENT HOME
     ============================================================ */
  WV.HomeScreen = function ({ onNav }) {
    const { state } = WV.useStore();
    const drift = WV.driftList(state);
    const scored = state.deelnemers.length;
    const placed = WV.placedCount(state);
    const recent = state.deelnemers.slice().reverse();

    const entries = [
      ["scale", "Vergelijken", WV.unplaced(state).length + " te plaatsen", "compare", "var(--brand)"],
      ["list", "Nakijken", scored + " projecten", "review", "var(--c-haalb)"],
      ["handshake", "Verzoenen", "met jurylid B", "reconcile", "var(--coral)"],
    ];

    return h(WV.Phone, null,
      h("div", { className: "wv-scroll" },
        h("div", { className: "wv-appbar" },
          h("div", { style: { flex: 1 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
              h("span", { style: { width: 22, height: 22, borderRadius: 7, background: "var(--brand)", display: "grid", placeItems: "center", transform: "rotate(-6deg)" } }, h(Icon, { name: "spark", size: 13, fill: "#fff" })),
              h("h2", { style: { fontSize: 20, margin: 0 } }, "Winnovation")),
            h("div", { className: "sub", style: { marginTop: 2 } }, "Eventcode " + state.eventCode + " \u00b7 Jurylid " + state.judge)),
          h(WV.Sync, { state })),

        h("div", { className: "wv-pad" },
          /* progress */
          h("div", { className: "wv-progress", style: { marginBottom: 12 } },
            h("div", { className: "wv-stat" }, h("div", { className: "big" }, scored), h("div", { className: "lbl" }, "Gescoord")),
            h("div", { className: "wv-stat" }, h("div", { className: "big" }, placed), h("div", { className: "lbl" }, "Geplaatst")),
            h("div", { className: "wv-stat flag" }, h("div", { className: "big" }, drift.length), h("div", { className: "lbl" }, "Drift-vlaggen"))),

          /* progress bar */
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 2px 7px" } },
            h("span", { style: { fontSize: 12, color: "var(--muted)", fontWeight: 600 } }, "Voortgang vandaag"),
            h("span", { style: { fontSize: 12, color: "var(--muted)", fontWeight: 700 } }, placed + "/" + scored + " geplaatst")),
          h("div", { className: "wv-bar", style: { marginBottom: 6 } },
            h("span", { style: { width: (placed / scored * 100) + "%", background: "var(--brand)" } }),
            h("span", { style: { width: ((scored - placed) / scored * 100) + "%", background: "var(--brand-soft)" } })),

          drift.length > 0 && h("div", { onClick: () => onNav("review"),
            style: { display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 12px", borderRadius: 12, background: "var(--amber-soft)", border: "1px solid #F4DC9E", cursor: "pointer" } },
            h("span", { style: { width: 26, height: 26, borderRadius: 8, background: "var(--amber)", color: "#fff", display: "grid", placeItems: "center", flex: "none" } }, h(Icon, { name: "flag", size: 15, stroke: 2.2 })),
            h("span", { style: { flex: 1, fontSize: 13, fontWeight: 700, color: "var(--amber-ink)" } }, drift.length + " plek" + (drift.length > 1 ? "ken" : "") + " waar je cijfer en plaatsing botsen"),
            h(Icon, { name: "chevRight", size: 16, style: { color: "var(--amber-ink)" } })),

          /* nav entries */
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 } },
            entries.map(([ic, t, d, key, col]) => h("button", { key, onClick: () => onNav(key),
              style: { background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 12px", textAlign: "left", cursor: "pointer", boxShadow: "var(--sh-card)" } },
              h("span", { style: { width: 32, height: 32, borderRadius: 9, background: col, color: "#fff", display: "grid", placeItems: "center", marginBottom: 9 } }, h(Icon, { name: ic, size: 17 })),
              h("div", { style: { fontWeight: 700, fontSize: 13.5, lineHeight: 1.1 } }, t),
              h("div", { style: { fontSize: 10.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.2 } }, d)))),

          /* list */
          h("div", { className: "wv-divider-label" }, h("span", { className: "t" }, "Gescoord vandaag"), h("span", { className: "ln" })),
          h("div", { className: "wv-list" },
            recent.map((d) => {
              const placedD = WV.isPlaced(state, d.id);
              const dft = drift.find((x) => x.id === d.id);
              return h(WV.DeelCard, { key: d.id, d, drift: !!dft, onClick: () => onNav("review"),
                trailing: h("span", { className: placedD ? "wv-chip wv-chip-mint" : "wv-chip wv-chip-brand" },
                  placedD ? "Geplaatst" : "Te plaatsen") });
            }))),
        h("div", { style: { height: 12 } })),

      h("div", { className: "wv-dock bordered" },
        h(WV.Btn, { kind: "primary", icon: "plus", onClick: () => onNav("stand") }, "Nieuwe deelnemer")));
  };

  /* ============================================================
     C · STAND — fast capture (hot path)
     ============================================================ */
  WV.StandScreen = function ({ onSaved }) {
    const { state, dispatch } = WV.useStore();
    const [standNr, setStandNr] = useState("");
    const [groep, setGroep] = useState("");
    const [keyword, setKeyword] = useState("");
    const [scores, setScores] = useState({ innov: 0, relev: 0, haalb: 0, impact: 0 });
    const [note, setNote] = useState("");
    const [review, setReview] = useState("");
    const [vervolg, setVervolg] = useState(false);
    const [photo, setPhoto] = useState(false);

    const scoredCount = WV.CRITERIA.filter((c) => scores[c.key]).length;
    const canSave = standNr && keyword && scoredCount === 4;

    function save() {
      dispatch({ type: "ADD_DEELNEMER", deelnemer: {
        standNr: parseInt(standNr, 10) || 0, projectgroep: groep || "Naamloos team", keyword,
        scoresA: { ...scores }, scoresB: null, note, review, vervolg, photo: null } });
      onSaved && onSaved();
    }

    return h(WV.Phone, null,
      h(WV.AppBar, { title: "Nieuwe deelnemer", sub: scoredCount + "/4 criteria \u00b7 < 1 min",
        left: h("button", { className: "wv-appbar-btn", onClick: () => onSaved && onSaved() }, h(Icon, { name: "chevLeft", size: 20 })),
        right: h(WV.Sync, { state }), bordered: true }),

      h("div", { className: "wv-scroll" },
        h("div", { className: "wv-pad" },
          /* identity row */
          h("div", { style: { display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, marginBottom: 16 } },
            h("div", null,
              h("label", { className: "wv-label" }, "Stand nr ", h("span", { className: "req" }, "*")),
              h("input", { className: "wv-input big", inputMode: "numeric", placeholder: "00", value: standNr,
                onChange: (e) => setStandNr(e.target.value.replace(/\D/g, "").slice(0, 2)), style: { textAlign: "center" } })),
            h("div", null,
              h("label", { className: "wv-label" }, "Projectgroep"),
              h("input", { className: "wv-input", placeholder: "Teamnaam", value: groep, onChange: (e) => setGroep(e.target.value) }))),

          h("div", { className: "wv-field" },
            h("label", { className: "wv-label" }, "Keyword ", h("span", { className: "req" }, "*"), h("span", { className: "opt" }, "  \u2014 1\u20133 woorden, je geheugensteun")),
            h("input", { className: "wv-input big", placeholder: "bv. Slimme watermeter", value: keyword,
              onChange: (e) => setKeyword(e.target.value), maxLength: 28 })),

          /* photo */
          h("button", { onClick: () => setPhoto(!photo),
            style: { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 18, borderRadius: 13, cursor: "pointer",
              border: photo ? "1.5px solid var(--brand)" : "1.5px dashed var(--line-2)", background: photo ? "var(--brand-soft)" : "#fff" } },
            h("span", { style: { width: 40, height: 40, borderRadius: 10, background: photo ? "var(--brand)" : "var(--bg-2)", color: photo ? "#fff" : "var(--muted)", display: "grid", placeItems: "center", flex: "none" } }, h(Icon, { name: "camera", size: 20 })),
            h("span", { style: { flex: 1, textAlign: "left" } },
              h("div", { style: { fontWeight: 700, fontSize: 14, color: photo ? "var(--brand-ink)" : "var(--ink)" } }, photo ? "Foto vastgelegd" : "Foto maken"),
              h("div", { style: { fontSize: 12, color: "var(--muted)" } }, "optioneel \u2014 helpt je herinneren")),
            photo && h(Icon, { name: "check", size: 20, style: { color: "var(--brand)" } })),

          /* scores */
          h("div", { className: "wv-eyebrow", style: { marginBottom: 12 } }, "Beoordeling \u00b7 1 slecht \u2192 5 uitstekend"),
          WV.CRITERIA.map((c) => h(WV.ScoreInput, { key: c.key, crit: c, value: scores[c.key],
            onChange: (v) => setScores((s) => ({ ...s, [c.key]: v })) })),

          /* vervolg */
          h("div", { className: "wv-toggle-row" + (vervolg ? " on" : ""), style: { marginTop: 4, marginBottom: vervolg ? 10 : 18 } },
            h("span", { style: { width: 36, height: 36, borderRadius: 10, background: vervolg ? "var(--brand)" : "var(--bg-2)", color: vervolg ? "#fff" : "var(--muted)", display: "grid", placeItems: "center", flex: "none" } }, h(Icon, { name: "leaf", size: 18 })),
            h("div", { className: "lbl" }, h("div", { className: "t" }, "Vervolgproject"), h("div", { className: "d" }, "Bouwt voort op vorig jaar")),
            h("button", { className: "wv-switch" + (vervolg ? " on" : ""), onClick: () => setVervolg(!vervolg) }, h("span", { className: "knob" }))),
          vervolg && h("div", { style: { marginBottom: 18 } }, h(WV.Banner, { tone: "amber", icon: "leaf" },
            h(React.Fragment, null, "Beoordeel alleen de ", h("b", null, "uitbreiding of verbetering"), " t.o.v. vorig jaar."))),

          /* note + review */
          h("div", { className: "wv-field" },
            h("label", { className: "wv-label" }, "Notitie ", h("span", { className: "opt" }, "  \u2014 privé, voor jezelf")),
            h("textarea", { className: "wv-textarea", rows: 2, placeholder: "Korte reden voor je oordeel\u2026", value: note, onChange: (e) => setNote(e.target.value) })),
          h("div", { className: "wv-field" },
            h("label", { className: "wv-label" }, "Review ", h("span", { className: "opt" }, "  \u2014 feedback voor het team")),
            h("textarea", { className: "wv-textarea", rows: 2, placeholder: "Opbouwende tip voor de deelnemers\u2026", value: review, onChange: (e) => setReview(e.target.value) })))),

      h("div", { className: "wv-dock bordered" },
        h(WV.Btn, { kind: "primary", icon: "check", disabled: !canSave, onClick: save },
          canSave ? "Opslaan & plaatsen" : (standNr && keyword ? `Nog ${4 - scoredCount} criteria` : "Vul stand nr + keyword in"))));
  };
})(window.WV);
