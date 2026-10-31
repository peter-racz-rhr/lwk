/* Home: the big clock, screen time by app, limits, net minutes; plus the two detail pages. */
(function () {
  "use strict";
  const App = window.App;
  const { esc, fmt, fmtH, signed } = App;

  /* ---------- data ---------- */
  const todayTotals = () => {
    const S = App.S;
    const won = S.wonTodaySec != null ? S.wonTodaySec : S.ledger.filter(b => b.deltaSec > 0).reduce((a, b) => a + b.deltaSec, 0);
    const lost = S.lostTodaySec != null ? S.lostTodaySec : S.ledger.filter(b => b.deltaSec < 0).reduce((a, b) => a - b.deltaSec, 0);
    return { used: S.usedTodaySec || 0, parts: S.usedTodayByApp || {}, won, lost };
  };
  /** Last n days, oldest first. Days without a record count as zero. */
  function lastDays(n) {
    const map = new Map((App.S.history || []).map(h => [h.day, h])), t = todayTotals(), out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const h = i === 0 ? { usedSec: t.used, byApp: t.parts, wonSec: t.won, lostSec: t.lost } : map.get(App.localKey(d)) || {};
      out.push({ date: d, used: h.usedSec || 0, parts: h.byApp || {}, won: h.wonSec || 0, lost: h.lostSec || 0, today: i === 0 });
    }
    return out;
  }
  function lastMonths(n) {
    const days = lastDays(186), out = [];
    for (let i = n - 1; i >= 0; i--) {
      const ref = new Date(); ref.setDate(1); ref.setMonth(ref.getMonth() - i);
      const inMonth = days.filter(d => d.date.getMonth() === ref.getMonth() && d.date.getFullYear() === ref.getFullYear());
      const parts = {};
      inMonth.forEach(d => Object.entries(d.parts).forEach(([k, v]) => { parts[k] = (parts[k] || 0) + v; }));
      out.push({ date: ref, used: inMonth.reduce((a, d) => a + d.used, 0), parts, today: i === 0 });
    }
    return out;
  }
  /* Old history days have only a total; show that as one neutral segment so nothing disappears. */
  /* Time recorded before per-app tracking (or any gap) shows as one neutral segment, so bars match totals. */
  const withParts = items => items.map(i => {
    const sum = Object.values(i.parts).reduce((a, v) => a + v, 0), gap = i.used - sum;
    return gap > 0 ? Object.assign({}, i, { parts: Object.assign({}, i.parts, { untracked: gap }) }) : i;
  });
  /** Name for an app that may no longer have a limit: its label if known, else the last part of its id. */
  const nameOf = pkg => { const l = App.labelOf(pkg); if (l !== pkg) return l; const last = pkg.split(".").pop() || pkg; return last.charAt(0).toUpperCase() + last.slice(1); };
  App.nameOf = nameOf;
  const dayLabel = i => i.date.toLocaleDateString(undefined, { weekday: "short" }).replace(".", "").slice(0, 2);
  const monthLabel = i => i.date.toLocaleDateString(undefined, { month: "short" }).replace(".", "").slice(0, 3);
  const isLight = () => App.P.isLight();
  App.data = { todayTotals, lastDays, lastMonths };

  function resetsIn() {
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    return fmtH((mid - now) / 1000);
  }

  /** Today's running net at the tables, oldest bet first, for the small stock-style graph. */
  function todaysBets() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return App.S.ledger.filter(b => b.atMs >= start.getTime()).slice().reverse().map(b => b.deltaSec);
  }

  /* ---------- pieces ---------- */
  App.healthBlock = () => {
    const S = App.S;
    if (!S.accessibility) return `
      <section class="panel perm" aria-labelledby="perm-h">
        <span class="pill warn"><i></i>Blocking is off</span>
        <h2 class="h2" id="perm-h">Let Ante see which app you open</h2>
        <p class="muted">Blocking needs Ante's accessibility switch. Ante only checks which app is in front and never reads your screen.</p>
        <button class="btn primary" data-a="openAcc">Open Accessibility settings</button>
        <details class="help"><summary>The switch is greyed out</summary>
          <p class="muted">Android blocks this switch for apps installed from an APK. Open Ante's App info, tap the ⋮ menu, choose <b>Allow restricted settings</b>, then try the switch again.</p>
          <button class="btn quiet" data-a="openInfo">Open App info</button>
        </details>
      </section>`;
    if (!S.watching) return `
      <section class="panel perm"><span class="pill bad"><i></i>Not running</span><h2 class="h2">Blocking isn't running</h2>
        <p class="muted">The switch is on, but Android stopped Ante's watcher. Switch <b>Ante app limits</b> off and on again.</p>
        <button class="btn primary" data-a="settingsGo" data-go="acc">Open Accessibility settings</button></section>`;
    return "";
  };

  function limitRows() {
    return App.S.limits.map(l => {
      const used = Math.max(0, l.limitSec - l.leftSec), bonus = l.leftSec - l.limitSec, out = l.leftSec <= 0;
      const pct = Math.min(100, (used / l.limitSec) * 100);
      const sub = bonus > 0 ? `<span class="win">${signed(bonus)}</span> won on top of ${fmt(l.limitSec)}`
        : out ? "Locked until midnight" : `${Math.round(pct)}% of ${fmt(l.limitSec)} used`;
      return `<button class="limit" data-a="edit" data-pkg="${esc(l.pkg)}" aria-label="${esc(l.label)}, ${fmt(l.leftSec)} left. Edit limit">
        ${App.appIcon(l.pkg)}
        <span class="meta"><span class="name">${esc(l.label)}</span>
          <span class="meter ${out ? "out" : bonus > 0 ? "bonus" : ""}"><i style="width:${out || bonus > 0 ? 100 : pct}%"></i></span>
          <span class="sub">${sub}</span></span>
        <span class="left num ${out ? "loss" : ""}">${fmt(l.leftSec)}</span></button>`;
    }).join("");
  }

  /* ---------- views ---------- */
  App.views.home = function () {
    const S = App.S, t = todayTotals();
    const total = S.limits.reduce((a, l) => a + l.leftSec, 0);
    const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    const week = withParts(lastDays(7)), series = App.CH.seriesFor(S.limits, week, isLight(), nameOf);
    const allowed = S.limits.reduce((a, l) => a + l.limitSec, 0);
    const avg = week.reduce((a, d) => a + d.used, 0) / 7;
    const net = t.won - t.lost, bets = todaysBets();
    const tr = App.CH.trend(bets, { w: 160, h: 72, minSpan: 120, label: `Today's net at the tables, ${signed(net)}` });
    const pill = !bets.length ? `<span class="pill warn"><i></i>No bets yet</span>` : net > 0 ? `<span class="pill good"><i></i>Up today</span>` : net < 0 ? `<span class="pill bad"><i></i>Down today</span>` : `<span class="pill"><i></i>Even</span>`;
    const status = S.accessibility && S.watching ? `<span class="pill good"><i></i>Blocking on${S.strict ? " · Strict" : ""}</span>` : "";
    const name = App.displayName();
    return `<div class="screen" id="screen">
      <header class="masthead"><span class="mark">${App.ICON.logo}Ante</span><button class="avatar" data-a="tab" data-t="profile" aria-label="Profile">${esc(App.initials(name))}</button></header>
      <section class="hero" aria-label="${fmt(total)} left today">
        <p class="muted">${esc(date)}</p>
        <div class="dotclock-box"><p class="dotclock" data-fit="150" aria-hidden="true">${fmt(total)}</p></div>
        <div class="hero-row"><span class="muted">${S.limits.length ? `left across ${S.limits.length} ${S.limits.length === 1 ? "app" : "apps"} · resets in ${resetsIn()}` : "Add an app to give it a daily budget."}</span>${status}</div>
      </section>
      ${App.healthBlock()}
      <section class="panel card-chart tap" role="button" tabindex="0" data-a="tab" data-t="screentime" aria-label="Screen time this week. Open the breakdown by app">
        <div class="panel-head"><div><h2 class="h3">Screen time</h2><p class="muted">Last 7 days, by app</p></div><span class="chev">${App.ICON.chev}</span></div>
        ${App.CH.stacked(week, series, dayLabel, fmtH)}
        <div class="tiles">
          <div class="tile-box"><p class="eyebrow">Today</p><p class="tile-v num">${fmtH(t.used)}</p><p class="muted">of ${fmtH(allowed)} allowed</p></div>
          <div class="tile-box"><p class="eyebrow">Daily average</p><p class="tile-v num">${fmtH(avg)}</p><p class="muted">this week</p></div>
        </div>
      </section>
      <section class="panel" aria-labelledby="lim-h">
        <div class="panel-head"><div><h2 class="h3" id="lim-h">Limits</h2><p class="muted">Daily budgets for today</p></div><button class="btn-sm" data-a="add">${App.ICON.plus}Add app</button></div>
        ${S.limits.length ? `<div class="limits">${limitRows()}</div>` : `<div class="empty"><p class="muted">No limits yet. Pick an app you open too often and give it a daily budget.</p><button class="btn primary" data-a="add">Add an app</button></div>`}
      </section>
      <section class="panel card-balance tap" role="button" tabindex="0" data-a="tab" data-t="results" aria-label="Net minutes today ${signed(net)}. Open table results">
        <div class="panel-head"><p class="muted">Net minutes today</p><span class="chev">${App.ICON.chev}</span></div>
        <div class="bal-row">
          <div class="bal-l"><p class="balance num ${net > 0 ? "win" : net < 0 ? "loss" : ""}">${signed(net)}</p>${pill}</div>
          <div class="bal-graph">${tr.svg}</div>
        </div>
        <div class="ledger-box">
          <div class="lrow"><span>Won at the tables</span><span class="num">${signed(t.won)}</span></div>
          <div class="lrow"><span>Lost at the tables</span><span class="num">${t.lost ? signed(-t.lost) : signed(0)}</span></div>
          <div class="lrow total"><span>Net today</span><span class="num">${signed(net)}</span></div>
        </div>
        <p class="card-note">Wins go back to the app you staked from. Every table keeps a small edge, so over time the house wins and you scroll less.</p>
      </section>
    </div>`;
  };

  App.views.screentime = function () {
    const range = App.ui.range || "week";
    const items = withParts(range === "week" ? lastDays(7) : lastMonths(6));
    const series = App.CH.seriesFor(App.S.limits, items, isLight(), nameOf);
    const total = items.reduce((a, i) => a + i.used, 0);
    const span = lastDays(183), first = span.findIndex(d => d.used > 0);
    const days = range === "week" ? 7 : Math.max(1, first < 0 ? 1 : span.length - first);
    return `<div class="screen" id="screen">
      <header class="topbar">${App.backBtn("tab", "Back to Home").replace('data-a="tab"', 'data-a="tab" data-t="home"')}<div class="grow"><h1 class="h2">Screen time</h1><p class="muted">Time spent in apps with a limit</p></div></header>
      <section class="panel">
        <div class="panel-head"><span class="muted">${range === "week" ? "Last 7 days" : "Last 6 months"}</span>
          <div class="seg-sm" role="group" aria-label="Range"><button data-a="range" data-r="week" aria-pressed="${range === "week"}">7D</button><button data-a="range" data-r="months" aria-pressed="${range !== "week"}">6M</button></div></div>
        ${App.CH.stacked(items, series, range === "week" ? dayLabel : monthLabel, fmtH).replace('class="sbars"', 'class="sbars tall"')}
        ${App.CH.legend(items, series, pkg => pkg === "other" ? '<span class="appicon mono sm" aria-hidden="true">··</span>' : App.appIcon(pkg, "sm"))}
        <div class="tiles">
          <div class="tile-box"><p class="eyebrow">Total</p><p class="tile-v num">${fmtH(total)}</p><p class="muted">${range === "week" ? "this week" : "6 months"}</p></div>
          <div class="tile-box"><p class="eyebrow">Per day</p><p class="tile-v num">${fmtH(total / days)}</p><p class="muted">on average</p></div>
        </div>
      </section>
      <p class="fine">Bars show how the time splits between apps. Only apps with a limit are counted, and only time spent after opening them from Ante's block screen.</p>
    </div>`;
  };

  App.views.results = function () {
    const days30 = lastDays(30);
    const tr = App.CH.trend(days30.map(d => d.won - d.lost), { label: "Net minutes over the last 30 days" });
    const won30 = days30.reduce((a, d) => a + d.won, 0), lost30 = days30.reduce((a, d) => a + d.lost, 0);
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const recent = App.S.ledger.filter(b => b.atMs >= startOfDay.getTime()).slice(0, 12).map(b => {
      const t = new Date(b.atMs), g = App.G.GAMES.find(x => x.name === b.game);
      return `<div class="txn"><span class="txn-ic" aria-hidden="true">${g ? App.FX.GAME_ICON(g.id) : App.ICON.play}</span>
        <span class="txn-m"><b>${esc(b.game)}</b><span class="muted">${esc(App.labelOf(b.pkg))}</span></span>
        <span class="muted num txn-t">${App.pad(t.getHours())}:${App.pad(t.getMinutes())}</span>
        <span class="num txn-v ${b.deltaSec > 0 ? "win" : b.deltaSec < 0 ? "loss" : ""}">${signed(b.deltaSec)}</span></div>`;
    }).join("");
    return `<div class="screen" id="screen">
      <header class="topbar">${App.backBtn("tab", "Back to Home").replace('data-a="tab"', 'data-a="tab" data-t="home"')}<div class="grow"><h1 class="h2">Table results</h1><p class="muted">Minutes won and lost</p></div></header>
      <section class="panel" aria-labelledby="h-net">
        <div><h2 class="h3" id="h-net">Last 30 days</h2><p class="muted">Running total at the tables</p></div>
        <p class="balance sm num ${tr.last > 0 ? "win" : tr.last < 0 ? "loss" : ""}">${signed(tr.last)}</p>
        ${tr.svg}
        <div class="ledger-box"><div class="lrow"><span>Won</span><span class="num">${signed(won30)}</span></div><div class="lrow"><span>Lost</span><span class="num">${lost30 ? signed(-lost30) : signed(0)}</span></div></div>
      </section>
      <section class="panel" aria-labelledby="h-bets">
        <div class="panel-head"><div><h2 class="h3" id="h-bets">Recent bets</h2><p class="muted">Today's rounds</p></div><button class="btn-sm" data-a="tab" data-t="tables">Play</button></div>
        ${recent ? `<div class="txns">${recent}</div>` : `<p class="muted">No bets today. Results show up here as you play.</p>`}
      </section>
    </div>`;
  };

  Object.assign(App.act, {
    range(d) { App.ui.range = d.r; App.chipFx(); App.render(); },
  });
})();
