/* ============================================================
   Winnovation — UI primitives & icons  (window.WV.*)
   ============================================================ */
(function (WV) {
  const h = React.createElement;

  /* ——— Icons: consistent 24x24, 1.85 stroke line pictograms ——— */
  const P = {
    plus:        "M12 5v14M5 12h14",
    camera:      "M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.2-1.8A1 1 0 0 1 9 4.8h6a1 1 0 0 1 .8.4L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5zM12 16a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z",
    check:       "M20 6 9 17l-5-5",
    chevUp:      "M6 15l6-6 6 6",
    chevDown:    "M6 9l6 6 6-6",
    chevRight:   "M9 6l6 6-6 6",
    chevLeft:    "M15 6l-6 6 6 6",
    arrowRight:  "M5 12h14M13 6l6 6-6 6",
    flag:        "M5 21V4M5 4h11l-2 4 2 4H5",
    trophy:      "M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 0-3 3M9 20h6M12 13v7",
    share:       "M12 15V4M8.5 7.5 12 4l3.5 3.5M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6",
    download:    "M12 4v11M8 11l4 4 4-4M5 20h14",
    scale:       "M12 4v16M7 20h10M6 8l-3 6h6zM6 8l6-2M18 8l-3 6h6zM18 8l-6-2",
    layers:      "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5",
    qr:          "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
    x:           "M6 6l12 12M18 6 6 18",
    edit:        "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
    spark:       "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
    user:        "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0",
    users:       "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 19a6 6 0 0 1 12 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18 19a6 6 0 0 0-3-5.2",
    leaf:        "M5 19C5 11 11 5 19 5c0 8-6 14-14 14zM5 19c2.5-5 6-7 9-8",
    wifiOff:     "M2 8.5 4 7M22 8.5 9 19l-2.5-3.2M5 11.5a11 11 0 0 1 3-1.9M12 5c3.6 0 7 1.4 9.5 3.7M3 3l18 18",
    clock:       "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
    list:        "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    target:      "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
    grid:        "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    handshake:   "M8 12 5 9l3-3 3 2h3l4 4-2.5 2.5M12 13l2 2M9.5 14.5 12 17l2-1.5",
    inbox:       "M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 13h4l1 2h6l1-2h4",
    sliders:     "M4 8h10M18 8h2M4 16h2M10 16h10M14 6v4M6 14v4",
    pin:         "M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  };

  WV.Icon = function ({ name, size = 22, stroke = 1.85, fill, style, className }) {
    const d = P[name];
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: fill || "none",
      stroke: fill ? "none" : "currentColor", strokeWidth: stroke, strokeLinecap: "round",
      strokeLinejoin: "round", style, className, "aria-hidden": true }, h("path", { d }));
  };
  const Icon = WV.Icon;

  /* ——— Status bar ——— */
  WV.StatusBar = function ({ dark, time = "9:41" }) {
    return h("div", { className: "wv-status" + (dark ? " on-dark" : "") },
      h("span", null, time),
      h("span", { className: "si" },
        h("svg", { width: 18, height: 12, viewBox: "0 0 18 12", fill: "currentColor" },
          [3, 6, 9, 12].map((x, i) => h("rect", { key: i, x: i * 4.5, y: 11 - (i + 1) * 2.4, width: 3, height: (i + 1) * 2.4, rx: .6 }))),
        h("svg", { width: 17, height: 12, viewBox: "0 0 17 12", fill: "currentColor" },
          h("path", { d: "M8.5 2.2c2 0 3.9.7 5.3 2L8.5 10 3.2 4.2A7.7 7.7 0 0 1 8.5 2.2z", opacity: .95 })),
        h("svg", { width: 26, height: 13, viewBox: "0 0 26 13", fill: "none" },
          h("rect", { x: .6, y: .6, width: 21, height: 11.8, rx: 3, stroke: "currentColor", strokeWidth: 1, opacity: .4 }),
          h("rect", { x: 2.2, y: 2.2, width: 16, height: 8.6, rx: 1.6, fill: "currentColor" }),
          h("rect", { x: 23, y: 4, width: 2, height: 5, rx: 1, fill: "currentColor", opacity: .5 }))));
  };

  /* ——— Phone frame ——— */
  WV.Phone = function ({ children, dark, wide, time, bg }) {
    return h("div", { className: "wv-phone" + (wide ? " wide" : ""), style: bg ? { background: bg } : undefined },
      h(WV.StatusBar, { dark, time }),
      h("div", { className: "wv-screen" }, children));
  };

  /* ——— Sync status (ambient) ——— */
  WV.Sync = function ({ state }) {
    const s = state.sync;
    const map = { synced: ["Gesynct", ""], syncing: ["Synct\u2026", "syncing"], offline: ["Offline \u2014 lokaal bewaard", "offline"] };
    const [label, cls] = map[s] || map.synced;
    return h("span", { className: "wv-sync " + cls },
      h("span", { className: "pip" }), label);
  };

  /* ——— Deelnemer photo / fallback ——— */
  WV.Photo = function ({ d, size = 54, radius = 12 }) {
    const initial = (d.keyword || d.projectgroep || "?").trim()[0].toUpperCase();
    return h("div", { className: "wv-deel-photo", style: { width: size, height: size, borderRadius: radius,
        background: d.photo ? "var(--bg-2)" : `linear-gradient(140deg, ${d.color}, ${d.color} 60%, rgba(0,0,0,.18))`,
        fontSize: size * 0.4 } },
      d.photo ? h("img", { src: d.photo, alt: "" })
        : h("span", { style: { color: "#fff", opacity: .95 } }, initial));
  };

  /* ——— Deelnemer card ——— */
  WV.DeelCard = function ({ d, rank, rankLabel = "rang", onClick, trailing, drift }) {
    return h("div", { className: "wv-deel" + (onClick ? " tappable" : ""), onClick },
      h(WV.Photo, { d }),
      h("div", { className: "wv-deel-body" },
        h("div", { className: "wv-deel-kw" }, d.keyword),
        h("div", { className: "wv-deel-meta" },
          h("span", null, d.projectgroep),
          h("span", { className: "dot" }),
          h("span", { style: { fontVariantNumeric: "tabular-nums" } }, WV.fmtStand(d.standNr)),
          drift && h(React.Fragment, null, h("span", { className: "dot" }),
            h("span", { style: { color: "var(--amber-ink)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 } },
              h(Icon, { name: "flag", size: 12, stroke: 2.2 }), "drift")))),
      trailing !== undefined ? trailing
        : (rank != null && h("div", { className: "wv-deel-rank" },
            h("span", { className: "lbl" }, rankLabel), "#" + rank)));
  };

  /* ——— Score input: segmented 1–5 pills ——— */
  WV.ScoreInput = function ({ crit, value, onChange, compact }) {
    return h("div", { className: "wv-score" },
      h("div", { className: "wv-score-head" },
        h("div", { className: "wv-score-name" },
          h("span", { className: "swatch", style: { background: crit.color } }),
          crit.label),
        h("div", { className: "wv-score-read" + (value ? " set" : "") },
          value ? `${value} \u00b7 ${WV.SCALE[value - 1]}` : "\u2014")),
      h("div", { className: "wv-seg" },
        [1, 2, 3, 4, 5].map((n) =>
          h("button", { key: n, type: "button",
            className: "wv-seg-pill" + (value === n ? " on" : ""),
            style: { "--accent": crit.color },
            onClick: () => onChange(n) },
            h("span", { className: "num" }, n),
            h("span", { className: "tip" }, WV.SCALE[n - 1])))));
  };

  /* ——— Drift flag row ——— */
  WV.DriftFlag = function ({ d, crit, severity, onClick }) {
    const c = WV.CRITERIA.find((x) => x.key === crit);
    return h("div", { className: "wv-drift", onClick },
      h("div", { className: "wv-drift-ic" }, h(Icon, { name: "flag", size: 16, stroke: 2.2 })),
      h("div", { className: "wv-drift-body" },
        h("div", { className: "wv-drift-t" }, d.keyword + " \u00b7 " + c.label),
        h("div", { className: "wv-drift-d" },
          severity >= 2 ? "Cijfer en plaatsing wijken sterk af" : "Cijfer en plaatsing spreken elkaar tegen")),
      h(Icon, { name: "chevRight", size: 18, style: { color: "var(--amber-ink)", flex: "none" } }));
  };

  /* ——— Banner ——— */
  WV.Banner = function ({ children, tone = "amber", icon = "leaf" }) {
    return h("div", { className: "wv-banner wv-banner-" + tone },
      h(Icon, { name: icon, size: 18, className: "ic" }),
      h("div", null, children));
  };

  /* ——— Button helper ——— */
  WV.Btn = function ({ kind = "primary", icon, iconRight, children, sm, ...rest }) {
    return h("button", { className: `wv-btn wv-btn-${kind}` + (sm ? " wv-btn-sm" : ""), ...rest },
      icon && h(Icon, { name: icon, size: sm ? 17 : 19 }),
      children,
      iconRight && h(Icon, { name: iconRight, size: sm ? 17 : 19 }));
  };

  /* ——— Empty state ——— */
  WV.Empty = function ({ icon = "inbox", title, children, clean }) {
    return h("div", { className: "wv-empty" + (clean ? " clean" : "") },
      h("div", { className: "ic" }, h(Icon, { name: clean ? "check" : icon, size: 28 })),
      h("h3", null, title),
      h("p", null, children));
  };

  /* ——— App bar ——— */
  WV.AppBar = function ({ title, sub, left, right, bordered }) {
    return h("div", { className: "wv-appbar" + (bordered ? " bordered" : "") },
      left, h("h2", null, title, sub && h("div", { className: "sub" }, sub)), right);
  };
})(window.WV);
