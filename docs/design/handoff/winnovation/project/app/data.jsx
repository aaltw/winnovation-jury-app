/* ============================================================
   Winnovation — data model, sample content (Dutch), store
   Exposed on window.WV
   ============================================================ */
window.WV = window.WV || {};

(function (WV) {
  const { createContext, useContext, useReducer, useMemo } = React;

  /* — Criteria & scale — */
  WV.CRITERIA = [
    { key: "innov",  label: "Innovativiteit", short: "Innov.",  color: "var(--c-innov)",  hex: "#4B3BF5" },
    { key: "relev",  label: "Relevantie",     short: "Relev.",  color: "var(--c-relev)",  hex: "#FF5A3C" },
    { key: "haalb",  label: "Haalbaarheid",   short: "Haalb.",  color: "var(--c-haalb)",  hex: "#00A7C4" },
    { key: "impact", label: "Impact",         short: "Impact",  color: "var(--c-impact)", hex: "#06BE7E" },
  ];
  WV.SCALE = ["slecht", "matig", "goed", "zeer goed", "uitstekend"]; // score 1..5

  const PHOTO = ["#4B3BF5", "#FF5A3C", "#00A7C4", "#06BE7E", "#F5A300", "#8A5BE0", "#1E88A8", "#E0457B"];

  /* — Seed deelnemers (plausible Dutch student innovation projects) —
     scoresA / scoresB keyed by criterion. null = not scored. */
  const SEED = [
    { id: "d1", standNr: 3,  projectgroep: "AquaSense",        keyword: "Slimme watermeter",  vervolg: false,
      scoresA: { innov: 5, relev: 4, haalb: 3, impact: 4 }, scoresB: { innov: 4, relev: 4, haalb: 3, impact: 4 },
      note: "Sterke sensor-aanpak, team weet waar het over gaat.", review: "Mooi werkend prototype. Denk na over kalibratie bij hard water." },
    { id: "d2", standNr: 5,  projectgroep: "Zorg Nu",          keyword: "Pillen-reminder",    vervolg: false,
      scoresA: { innov: 3, relev: 5, haalb: 4, impact: 5 }, scoresB: { innov: 3, relev: 5, haalb: 4, impact: 4 },
      note: "Niet super nieuw, maar raakt een echt probleem.", review: "Heldere doelgroep. Privacy van medicatiedata uitwerken." },
    { id: "d3", standNr: 7,  projectgroep: "De Daktuiniers",   keyword: "Levend dak",         vervolg: true,
      scoresA: { innov: 4, relev: 4, haalb: 2, impact: 4 }, scoresB: { innov: 4, relev: 3, haalb: 2, impact: 4 },
      note: "Vervolg op vorig jaar — beoordeel alleen de uitbreiding.", review: "Mooie groei. Onderhoud op grote schaal blijft de vraag." },
    { id: "d4", standNr: 9,  projectgroep: "Team Zon",         keyword: "Draagbare zonlader", vervolg: false,
      scoresA: { innov: 3, relev: 3, haalb: 4, impact: 3 }, scoresB: { innov: 3, relev: 3, haalb: 5, impact: 3 },
      note: "Degelijk, maar markt zit al vol.", review: "Werkt goed. Onderscheid t.o.v. bestaande powerbanks scherper maken." },
    { id: "d5", standNr: 12, projectgroep: "Kringloop Kicks",  keyword: "Schoenen uit afval", vervolg: false,
      scoresA: { innov: 5, relev: 4, haalb: 3, impact: 5 }, scoresB: { innov: 5, relev: 4, haalb: 2, impact: 5 },
      note: "Wauw-factor. Materiaal-innovatie is echt nieuw.", review: "Indrukwekkend. Schaalbaarheid van de productie testen." },
    { id: "d6", standNr: 14, projectgroep: "Klas 5B",          keyword: "Notuleren met AI",   vervolg: false,
      scoresA: { innov: 4, relev: 3, haalb: 5, impact: 3 }, scoresB: { innov: 3, relev: 3, haalb: 5, impact: 3 },
      note: "Goed uitgevoerd, beperkte reikwijdte.", review: "Strak gebouwd. Denk aan meertaligheid en jargon." },
    /* scored by A only — stays 'incompleet' in Reconcile/Result */
    { id: "d7", standNr: 18, projectgroep: "Buurtbattery",     keyword: "Deel-accu wijk",     vervolg: false,
      scoresA: { innov: 4, relev: 5, haalb: 3, impact: 5 }, scoresB: null,
      note: "Collega B was hier nog niet — sterk maatschappelijk idee.", review: "Groot potentieel. Regelgeving rond energiedelen uitzoeken." },
    /* not yet placed by A — drives the Compare demo */
    { id: "d8", standNr: 21, projectgroep: "FietsFlow",        keyword: "Slim kruispunt",     vervolg: false,
      scoresA: { innov: 4, relev: 4, haalb: 4, impact: 4 }, scoresB: { innov: 4, relev: 4, haalb: 3, impact: 4 },
      note: "Net gescoord — moet nog geplaatst worden.", review: "Veelbelovend. Veiligheidsdata van een echte kruising zou helpen." },
  ];

  SEED.forEach((d, i) => { d.color = PHOTO[i % PHOTO.length]; d.photo = null; });

  /* sum of a score object */
  WV.sum = (s) => s ? WV.CRITERIA.reduce((a, c) => a + (s[c.key] || 0), 0) : 0;

  /* Build initial per-criterion placement order for judge A.
     Order = by score desc, then we inject ONE drift to make Review meaningful. */
  function buildOrders(deels) {
    const orders = {};
    const placed = deels.filter((d) => d.placedA);
    WV.CRITERIA.forEach((c) => {
      orders[c.key] = placed
        .slice()
        .sort((a, b) => (b.scoresA[c.key] - a.scoresA[c.key]) || (a.standNr - b.standNr))
        .map((d) => d.id);
    });
    return orders;
  }

  function makeInitial() {
    const deels = SEED.map((d) => ({ ...d, placedA: d.id !== "d8" })); // d8 unplaced
    const orders = buildOrders(deels);
    /* Inject a deliberate drift on Impact: move d6 (impact 3) above d2 (impact 5). */
    const imp = orders.impact;
    const i6 = imp.indexOf("d6"), i2 = imp.indexOf("d2");
    if (i6 > -1 && i2 > -1 && i6 > i2) { imp.splice(i6, 1); imp.splice(i2, 0, "d6"); }
    /* And a small drift on Haalbaarheid: lift d3 (haalb 2) above d1 (haalb 3). */
    const ha = orders.haalb;
    const a3 = ha.indexOf("d3"), a1 = ha.indexOf("d1");
    if (a3 > -1 && a1 > -1 && a3 > a1) { ha.splice(a3, 1); ha.splice(a1, 0, "d3"); }

    return {
      eventCode: "WIN-26",
      judge: "A",                 // active jurylid
      deelnemers: deels,
      orders,                     // { crit: [id...] } judge A placement order
      ordersB: buildOrdersB(deels),
      sync: "synced",             // synced | syncing | offline
      finalLocked: false,
      draftFocus: null,           // id currently in Compare focus
    };
  }

  /* Judge B order purely from B scores (no drift) */
  function buildOrdersB(deels) {
    const orders = {};
    const scored = deels.filter((d) => d.scoresB);
    WV.CRITERIA.forEach((c) => {
      orders[c.key] = scored.slice()
        .sort((a, b) => (b.scoresB[c.key] - a.scoresB[c.key]) || (a.standNr - b.standNr))
        .map((d) => d.id);
    });
    return orders;
  }

  /* ——— Drift detection ———
     For deelnemer d on criterion c: count inversions — placed ABOVE a project
     with a strictly higher score, or BELOW one with strictly lower score.
     Returns { [id]: { [crit]: severity } }  severity 1=mild, 2=strong. */
  WV.computeDrift = function (state) {
    const byId = Object.fromEntries(state.deelnemers.map((d) => [d.id, d]));
    const out = {};
    WV.CRITERIA.forEach((c) => {
      const ord = state.orders[c.key] || [];
      ord.forEach((id, i) => {
        const s = byId[id].scoresA[c.key];
        let inv = 0;
        ord.forEach((id2, j) => {
          if (i === j) return;
          const s2 = byId[id2].scoresA[c.key];
          if (i < j && s < s2) inv++;       // I'm above someone I scored lower
          if (i > j && s > s2) inv++;       // I'm below someone I scored higher
        });
        if (inv > 0) {
          out[id] = out[id] || {};
          out[id][c.key] = inv >= 3 ? 2 : 1;
        }
      });
    });
    return out;
  };

  /* list of {id, crit, severity} flattened, strongest first */
  WV.driftList = function (state) {
    const d = WV.computeDrift(state);
    const rows = [];
    Object.keys(d).forEach((id) => Object.keys(d[id]).forEach((crit) =>
      rows.push({ id, crit, severity: d[id][crit] })));
    return rows.sort((a, b) => b.severity - a.severity);
  };

  /* placed = present in all 4 orders */
  WV.isPlaced = (state, id) => WV.CRITERIA.every((c) => (state.orders[c.key] || []).includes(id));
  WV.placedCount = (state) => state.deelnemers.filter((d) => WV.isPlaced(state, d.id)).length;
  WV.unplaced = (state) => state.deelnemers.filter((d) => !WV.isPlaced(state, d.id));

  /* combined ranking (judge A placement points + judge B placement points).
     points = sum of (rank index) over criteria; lower = better. */
  WV.combinedRanking = function (state) {
    const rows = state.deelnemers.map((d) => {
      const placedA = WV.isPlaced(state, d.id);
      const scoredB = !!d.scoresB;
      let ptsA = 0, ptsB = 0;
      WV.CRITERIA.forEach((c) => {
        const ia = (state.orders[c.key] || []).indexOf(d.id);
        const ib = (state.ordersB[c.key] || []).indexOf(d.id);
        ptsA += ia > -1 ? ia : 99;
        ptsB += ib > -1 ? ib : 99;
      });
      const total = WV.sum(d.scoresA) + (scoredB ? WV.sum(d.scoresB) : 0);
      return { d, placedA, scoredB, complete: placedA && scoredB, ptsA, ptsB, total,
               combined: ptsA + ptsB, disagree: Math.abs(ptsA - ptsB) };
    });
    const complete = rows.filter((r) => r.complete).sort((a, b) => a.combined - b.combined || b.total - a.total);
    const incomplete = rows.filter((r) => !r.complete);
    return { complete, incomplete, all: rows };
  };

  /* ——— Store ——— */
  const StoreCtx = createContext(null);

  function reducer(state, action) {
    switch (action.type) {
      case "SET_JUDGE":   return { ...state, judge: action.judge };
      case "SET_SYNC":    return { ...state, sync: action.sync };
      case "ADD_DEELNEMER": {
        const d = { ...action.deelnemer, id: "d" + (state.deelnemers.length + 1) + "_" + Date.now(),
                    placedA: false, color: PHOTO[state.deelnemers.length % PHOTO.length] };
        return { ...state, deelnemers: [...state.deelnemers, d], draftFocus: d.id };
      }
      case "SET_SCORE": {  // adjust a stored deelnemer's A score (drift resolve)
        const deelnemers = state.deelnemers.map((d) =>
          d.id === action.id ? { ...d, scoresA: { ...d.scoresA, [action.crit]: action.value } } : d);
        return { ...state, deelnemers };
      }
      case "PLACE": {       // insert id into criterion order at index
        const { id, crit, index } = action;
        const arr = (state.orders[crit] || []).filter((x) => x !== id);
        arr.splice(index, 0, id);
        const orders = { ...state.orders, [crit]: arr };
        const deelnemers = state.deelnemers.map((d) => d.id === id ? { ...d, placedA: WV.CRITERIA.every((c) => (orders[c.key] || []).includes(id)) } : d);
        return { ...state, orders, deelnemers };
      }
      case "REPLACE_ORDER": return { ...state, orders: { ...state.orders, [action.crit]: action.order } };
      case "SET_FOCUS":     return { ...state, draftFocus: action.id };
      case "LOCK_FINAL":    return { ...state, finalLocked: true };
      case "RESET":         return makeInitial();
      default: return state;
    }
  }

  WV.StoreProvider = function ({ children }) {
    const [state, dispatch] = useReducer(reducer, null, makeInitial);
    const value = useMemo(() => ({ state, dispatch }), [state]);
    return React.createElement(StoreCtx.Provider, { value }, children);
  };
  WV.useStore = () => useContext(StoreCtx);

  /* small helpers shared by screens */
  WV.byId = (state, id) => state.deelnemers.find((d) => d.id === id);
  WV.fmtStand = (n) => "Stand " + String(n).padStart(2, "0");
})(window.WV);
