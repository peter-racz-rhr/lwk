/* Charts for Ante, as plain HTML/SVG strings. Pure functions: data in, markup out.
   Follows the dataviz rules: one axis, thin marks, 2px gaps between stacked segments, a legend
   for 2+ series, identity never by colour alone (legend shows icon + name). */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /** Validated categorical palette (dark and light steps), fixed order; extra apps fold into Other. */
  const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
  const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
  const OTHER = "other";

  /** Builds the series list: apps in limit order first, then any app seen in the data, capped at 5 + Other. */
  function seriesFor(limits, items, light) {
    const order = limits.map(l => ({ key: l.pkg, name: l.label }));
    const seen = new Set(order.map(s => s.key));
    items.forEach(i => Object.keys(i.parts || {}).forEach(k => { if (!seen.has(k)) { seen.add(k); order.push({ key: k, name: k === "untracked" ? "Before per-app tracking" : k }); } }));
    const pal = light ? SERIES_LIGHT : SERIES_DARK;
    const main = order.slice(0, pal.length).map((s, i) => Object.assign({}, s, { color: pal[i] }));
    const rest = order.slice(pal.length).map(s => s.key);
    if (rest.length) main.push({ key: OTHER, name: "Other apps", color: "var(--bar)", members: rest });
    return main;
  }
  const partOf = (item, s) => s.members ? s.members.reduce((a, k) => a + (item.parts[k] || 0), 0) : (item.parts[s.key] || 0);

  /**
   * Stacked columns: each column is one day (or month), split into one segment per app.
   * No numbers on the marks; heights show the proportions. Screen readers get the values.
   */
  function stacked(items, series, label, fmt) {
    const totals = items.map(i => series.reduce((a, s) => a + partOf(i, s), 0));
    const max = Math.max(1, ...totals);
    const desc = items.map((i, n) => `${label(i)}: ${series.map(s => `${s.name} ${fmt(partOf(i, s))}`).join(", ")}`).join("; ");
    return `<div class="sbars" role="img" aria-label="${esc(desc)}">${items.map((i, n) => {
      const h = totals[n] ? Math.max(6, (totals[n] / max) * 100) : 2;
      const segs = series.map(s => ({ s, v: partOf(i, s) })).filter(x => x.v > 0);
      return `<div class="sbar-col${i.today ? " now" : ""}" title="${esc(label(i))}">
        <div class="sbar" style="height:${h.toFixed(1)}%">${segs.map(x => `<i style="flex-grow:${x.v};background:${x.s.color}"></i>`).join("") || '<i class="empty"></i>'}</div>
        <span class="bar-x">${esc(label(i))}</span></div>`;
    }).join("")}</div>`;
  }

  /** Legend with each app's share of the period as a bar (no numbers), icon and name. */
  function legend(items, series, iconFor) {
    const sums = series.map(s => items.reduce((a, i) => a + partOf(i, s), 0));
    const total = Math.max(1, sums.reduce((a, b) => a + b, 0));
    return `<ul class="slegend">${series.map((s, n) => sums[n] <= 0 ? "" : `<li>
      <span class="sw" style="background:${s.color}" aria-hidden="true"></span>
      ${s.key === OTHER ? '<span class="appicon mono sm" aria-hidden="true">··</span>' : iconFor(s.key)}
      <span class="sl-name">${esc(s.name)}</span>
      <span class="share" role="img" aria-label="${Math.round((sums[n] / total) * 100)}% of the time"><i style="width:${((sums[n] / total) * 100).toFixed(1)}%;background:${s.color}"></i></span>
    </li>`).join("")}</ul>`;
  }

  /** Running total over time as a line with an area fill; returns {last, svg}. */
  function trend(values, opts) {
    const o = Object.assign({ w: 320, h: 120, minSpan: 60, cls: "" }, opts);
    let run = 0; const pts = [0].concat(values.map(v => (run += v)));
    const min = Math.min(0, ...pts), max = Math.max(0, ...pts), span = Math.max(o.minSpan, max - min);
    const x = i => (i / Math.max(1, pts.length - 1)) * o.w, y = v => o.h - 6 - ((v - min) / span) * (o.h - 12);
    const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
    const last = pts[pts.length - 1];
    const tone = last > 0 ? "up" : last < 0 ? "down" : "flat";
    const id = "g" + Math.random().toString(36).slice(2, 8);
    return { last, tone, svg: `<svg class="trend ${tone} ${o.cls}" viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="none" role="img" aria-label="${esc(o.label || "")}">
      <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" x2="${o.w}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="trend-zero"/>
      <path d="${d}L${o.w} ${o.h}L0 ${o.h}Z" fill="url(#${id})"/><path d="${d}" class="trend-line"/>
      <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="4" class="trend-dot"/></svg>` };
  }

  window.AnteCharts = { seriesFor, stacked, legend, trend, SERIES_DARK, SERIES_LIGHT };
})();
