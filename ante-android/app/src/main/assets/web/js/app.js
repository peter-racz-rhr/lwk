/* Ante UI: Today, the block screen, the tables. State lives in the native bank (window.Ante). */
(function () {
  "use strict";
  const A = window.Ante, G = window.AnteGames, FX = window.AnteFX;
  const $app = document.getElementById("app"), $overlay = document.getElementById("overlay");
  const CTX = A.context();
  const BLOCK = CTX.mode === "block";

  let S = A.state();
  let ACC = A.account();
  const ui = {
    view: BLOCK ? "block" : ACC.onboarded ? "today" : "welcome", // today | tables | game | history | profile | welcome | block
    welcomeStep: "signin", range: "week",
    game: null, sheet: null, toast: null,
    stakePkg: BLOCK ? CTX.pkg : null, stake: 300,
    openPick: 300, busy: false, res: null, round: null,
  };
  let table = null; // mounted game controller

  /* ---------- helpers ---------- */
  const pad = n => String(n).padStart(2, "0");
  function fmt(s) {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }
  const signed = d => (d > 0 ? "+" : d < 0 ? "−" : "±") + fmt(Math.abs(d));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lim = pkg => S.limits.find(l => l.pkg === pkg);
  const labelOf = pkg => (lim(pkg) || {}).label || (pkg === CTX.pkg ? CTX.label : pkg);
  const icons = {};
  function iconOf(pkg) {
    if (!(pkg in icons)) { try { icons[pkg] = A.icon(pkg) || ""; } catch (e) { icons[pkg] = ""; } }
    return icons[pkg];
  }
  if (CTX.pkg && CTX.icon) icons[CTX.pkg] = CTX.icon;
  function appIcon(pkg, cls) {
    const src = iconOf(pkg);
    const l = labelOf(pkg);
    return src
      ? `<img class="appicon ${cls || ""}" src="${esc(src)}" alt="" width="44" height="44">`
      : `<span class="appicon mono ${cls || ""}" aria-hidden="true">${esc(l.slice(0, 2))}</span>`;
  }
  const haptic = kind => { try { A.haptic(kind); } catch (e) { /* no-op */ } };
  const SFX = window.AnteSFX || { play() {}, muted: true, toggle() { return true; } };
  const chipFx = () => { haptic("tap"); SFX.play("chip"); };
  const soundBtn = () => `<button class="iconbtn sound" data-a="sound" aria-pressed="${!SFX.muted}" aria-label="${SFX.muted ? "Turn sound on" : "Turn sound off"}">${SFX.muted ? ICON.soundOff : ICON.soundOn}</button>`;
  let waitTimer = null;
  const refresh = () => { S = A.state(); ACC = A.account(); };

  function toast(msg) {
    ui.toast = msg; paintOverlay();
    clearTimeout(toast.t); toast.t = setTimeout(() => { ui.toast = null; paintOverlay(); }, 2600);
  }
  window.addEventListener("ante-mock", e => toast(e.detail));

  const ICON = {
    back: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    today: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
    logo: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 7.5h7v1.2L13 12l2.5 3.3v1.2h-7v-1.2L11 12 8.5 8.7z" fill="currentColor"/></svg>',
    history: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    user: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    google: '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
    tables: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/></svg>',
  };

  /* ---------- stake ---------- */
  function stakeLimit() { return lim(ui.stakePkg); }
  function ensureStakeApp() {
    if (BLOCK) { ui.stakePkg = CTX.pkg; return; }
    const cur = stakeLimit();
    if (cur && cur.leftSec >= 60) return;
    const best = S.limits.filter(l => l.leftSec >= 60).sort((a, b) => b.leftSec - a.leftSec)[0];
    ui.stakePkg = best ? best.pkg : (S.limits[0] || {}).pkg || null;
  }
  function clampStake() {
    const l = stakeLimit(); if (!l) return;
    const max = Math.max(60, Math.floor(l.leftSec / 60) * 60);
    ui.stake = Math.max(60, Math.min(ui.stake, max));
  }
  const canStake = extra => { const l = stakeLimit(); return !!l && l.leftSec >= (extra || ui.stake) && ui.stake >= 60; };

  function stakeBox(locked) {
    const l = stakeLimit();
    if (!l) return "";
    clampStake();
    const allIn = Math.floor(l.leftSec / 60) * 60;
    const presets = [[60, "1:00"], [300, "5:00"], [600, "10:00"], [allIn, "All in"]];
    const dis = locked ? "disabled" : "";
    return `<div class="stakebox">
      <div class="stake-row">
        <button class="step" data-a="stake" data-d="-60" aria-label="One minute less" ${dis || (ui.stake <= 60 ? "disabled" : "")}>−</button>
        <div class="stake-chip" aria-live="polite"><span class="lbl">Stake</span><span class="num">${fmt(ui.stake)}</span></div>
        <button class="step" data-a="stake" data-d="60" aria-label="One minute more" ${dis || (ui.stake + 60 > l.leftSec ? "disabled" : "")}>+</button>
      </div>
      <div class="chips">${presets.map(([v, t]) => `<button class="chip" data-a="stakeSet" data-v="${v}" aria-pressed="${ui.stake === v && v > 0}" ${dis || (v < 60 || v > l.leftSec ? "disabled" : "")}>${t}</button>`).join("")}</div>
      <p class="stake-from">From ${esc(l.label)} · <span class="num">${fmt(l.leftSec)}</span> left</p>
    </div>`;
  }

  /* ---------- views ---------- */
  /* ---------- time + chart helpers ---------- */
  const localKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function fmtH(sec) { // 1h 12m / 34m / 0m, for charts and totals
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? `${h}h ${pad(m)}m` : `${m}m`;
  }
  function resetsIn() {
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    return fmtH((mid - now) / 1000);
  }
  const todayTotals = () => {
    // Native counts every bet; older saves only have the ledger (latest 50).
    const won = S.wonTodaySec != null ? S.wonTodaySec : S.ledger.filter(b => b.deltaSec > 0).reduce((a, b) => a + b.deltaSec, 0);
    const lost = S.lostTodaySec != null ? S.lostTodaySec : S.ledger.filter(b => b.deltaSec < 0).reduce((a, b) => a - b.deltaSec, 0);
    return { used: S.usedTodaySec || 0, won, lost };
  };
  /** Last n days, oldest first; days with no record count as zero. */
  function lastDays(n) {
    const map = new Map((S.history || []).map(h => [h.day, h]));
    const out = [], t = todayTotals();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const h = i === 0 ? { usedSec: t.used, wonSec: t.won, lostSec: t.lost } : map.get(localKey(d)) || { usedSec: 0, wonSec: 0, lostSec: 0 };
      out.push({ date: d, used: h.usedSec, won: h.wonSec, lost: h.lostSec, today: i === 0 });
    }
    return out;
  }
  function lastMonths(n) {
    const days = lastDays(186), out = [];
    for (let i = n - 1; i >= 0; i--) {
      const ref = new Date(); ref.setDate(1); ref.setMonth(ref.getMonth() - i);
      const inMonth = days.filter(d => d.date.getMonth() === ref.getMonth() && d.date.getFullYear() === ref.getFullYear());
      out.push({ date: ref, used: inMonth.reduce((a, d) => a + d.used, 0), days: inMonth.filter(d => d.used > 0).length, today: i === 0 });
    }
    return out;
  }
  function bars(items, label) {
    const max = Math.max(1, ...items.map(i => i.used));
    return `<div class="bars" role="img" aria-label="${esc(items.map(i => `${label(i)} ${fmtH(i.used)}`).join(", "))}">${items.map(i => {
      const h = i.used ? Math.max(8, (i.used / max) * 100) : 3;
      return `<div class="bar-col"><div class="bar ${i.today ? "now" : ""} ${i.used ? "" : "zero"}" style="height:${h.toFixed(1)}%"><span class="bar-tip num">${fmtH(i.used)}</span></div><span class="bar-x">${label(i)}</span></div>`;
    }).join("")}</div>`;
  }
  const dayLabel = i => i.date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
  const monthLabel = i => i.date.toLocaleDateString(undefined, { month: "short" }).slice(0, 3);
  function trendLine(days) {
    let run = 0; const pts = days.map(d => (run += d.won - d.lost));
    const w = 320, h = 120, min = Math.min(0, ...pts), max = Math.max(0, ...pts), span = Math.max(60, max - min);
    const x = i => (i / (pts.length - 1)) * w, y = v => h - 8 - ((v - min) / span) * (h - 16);
    const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
    const last = pts[pts.length - 1];
    return { last, svg: `<svg class="trend" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Net minutes over the last ${days.length} days, now ${signed(last)}">
      <defs><linearGradient id="tg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fafafa" stop-opacity=".18"/><stop offset="1" stop-color="#fafafa" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" x2="${w}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="trend-zero"/>
      <path d="${d}L${w} ${h}L0 ${h}Z" fill="url(#tg)"/><path d="${d}" class="trend-line"/>
      <circle cx="${x(pts.length - 1)}" cy="${y(last).toFixed(1)}" r="4" class="trend-dot"/></svg>` };
  }
  const initials = n => (n || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "A";

  /* ---------- views ---------- */
  function healthBlock() {
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
  }

  function vToday() {
    const total = S.limits.reduce((a, l) => a + l.leftSec, 0);
    const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    const rows = S.limits.map(l => {
      const used = Math.max(0, l.limitSec - l.leftSec), bonus = l.leftSec - l.limitSec, out = l.leftSec <= 0;
      const pct = Math.min(100, (used / l.limitSec) * 100);
      const sub = bonus > 0 ? `<span class="win">${signed(bonus)}</span> won on top of ${fmt(l.limitSec)}`
        : out ? "Locked until midnight" : `${Math.round(pct)}% used of ${fmt(l.limitSec)}`;
      return `<button class="limit" data-a="edit" data-pkg="${esc(l.pkg)}" aria-label="${esc(l.label)}, ${fmt(l.leftSec)} left. Edit limit">
        ${appIcon(l.pkg)}
        <span class="meta"><span class="name">${esc(l.label)}</span>
          <span class="meter ${out ? "out" : bonus > 0 ? "bonus" : ""}"><i style="width:${out || bonus > 0 ? 100 : pct}%"></i></span>
          <span class="sub">${sub}</span></span>
        <span class="left num ${out ? "loss" : ""}">${fmt(l.leftSec)}</span></button>`;
    }).join("");
    const week = lastDays(7), t = todayTotals();
    const allowed = S.limits.reduce((a, l) => a + l.limitSec, 0);
    const avg = week.reduce((a, d) => a + d.used, 0) / 7;
    const net = t.won - t.lost;
    const pill = !S.ledger.length ? `<span class="pill warn"><i></i>No bets yet</span>` : net > 0 ? `<span class="pill good"><i></i>Up today</span>` : net < 0 ? `<span class="pill bad"><i></i>Down today</span>` : `<span class="pill"><i></i>Even</span>`;
    const status = S.accessibility && S.watching ? `<span class="pill good"><i></i>Blocking is on${S.strict ? " · Strict" : ""}</span>` : "";
    return `<div class="screen" id="screen">
      <header class="masthead"><span class="mark">${ICON.logo}Ante</span><button class="avatar" data-a="tab" data-t="profile" aria-label="Profile">${esc(initials(ACC.name))}</button></header>
      <section class="hero">
        <p class="muted">${esc(date)}</p>
        <p class="bignum num" aria-label="${fmt(total)} left today">${fmt(total)}</p>
        <div class="hero-row"><span class="muted">${S.limits.length ? `Left across ${S.limits.length} ${S.limits.length === 1 ? "app" : "apps"} · resets in ${resetsIn()}` : "Add an app to give it a daily budget."}</span>${status}</div>
      </section>
      ${healthBlock()}
      <section class="panel card-chart" aria-labelledby="st-h">
        <div><h2 class="h3" id="st-h">Screen time</h2><p class="muted">Last 7 days in limited apps</p></div>
        ${bars(week, dayLabel)}
        <div class="tiles">
          <div class="tile-box"><p class="eyebrow">Today</p><p class="tile-v num">${fmtH(t.used)}</p><p class="muted">of ${fmtH(allowed)} allowed</p></div>
          <div class="tile-box"><p class="eyebrow">Daily average</p><p class="tile-v num">${fmtH(avg)}</p><p class="muted">this week</p></div>
        </div>
        <div class="card-foot"><button class="btn soft" data-a="tab" data-t="history">View full history</button></div>
      </section>
      <section class="panel" aria-labelledby="lim-h">
        <div class="panel-head"><div><h2 class="h3" id="lim-h">Limits</h2><p class="muted">Daily budgets for today</p></div><button class="btn-sm" data-a="add">${ICON.plus}Add app</button></div>
        ${rows ? `<div class="limits">${rows}</div>` : `<div class="empty"><p class="muted">No limits yet. Pick an app you open too often and give it a daily budget.</p><button class="btn primary" data-a="add">Add an app</button></div>`}
      </section>
      <section class="panel card-balance" aria-labelledby="wl-h">
        <p class="muted" id="wl-h">Net minutes today</p>
        <p class="balance num ${net > 0 ? "win" : net < 0 ? "loss" : ""}">${signed(net)}</p>
        ${pill}
        <div class="ledger-box">
          <div class="lrow"><span>Won at the tables</span><span class="num">${signed(t.won)}</span></div>
          <div class="lrow"><span>Lost at the tables</span><span class="num">${t.lost ? signed(-t.lost) : signed(0)}</span></div>
          <div class="lrow total"><span>Net today</span><span class="num">${signed(net)}</span></div>
        </div>
        <p class="card-note">Wins go back to the app you staked from. Every table keeps a small edge, so over time the house wins and you scroll less.</p>
      </section>
    </div>`;
  }

  function vHistory() {
    const range = ui.range || "week";
    const items = range === "week" ? lastDays(7) : lastMonths(6);
    const days30 = lastDays(30);
    const total = items.reduce((a, i) => a + i.used, 0);
    // 6M average: count from the first day with any use, so a new install isn't divided by 183.
    const span = lastDays(183), first = span.findIndex(d => d.used > 0);
    const activeDays = range === "week" ? 7 : Math.max(1, first < 0 ? 1 : span.length - first);
    const tr = trendLine(days30);
    const won30 = days30.reduce((a, d) => a + d.won, 0), lost30 = days30.reduce((a, d) => a + d.lost, 0);
    const recent = S.ledger.slice(0, 10).map(b => {
      const t = new Date(b.atMs), g = G.GAMES.find(x => x.name === b.game);
      return `<div class="txn"><span class="txn-ic" aria-hidden="true">${g ? FX.GAME_ICON(g.id) : ICON.tables}</span>
        <span class="txn-m"><b>${esc(b.game)}</b><span class="muted">${esc(labelOf(b.pkg))}</span></span>
        <span class="muted num txn-t">${pad(t.getHours())}:${pad(t.getMinutes())}</span>
        <span class="num txn-v ${b.deltaSec > 0 ? "win" : b.deltaSec < 0 ? "loss" : ""}">${signed(b.deltaSec)}</span></div>`;
    }).join("");
    return `<div class="screen" id="screen">
      <header><h1 class="h1">History</h1><p class="muted">Screen time and table results, kept on this phone.</p></header>
      <section class="panel card-chart" aria-labelledby="h-st">
        <div class="panel-head"><div><h2 class="h3" id="h-st">Screen time</h2><p class="muted">${range === "week" ? "Last 7 days" : "Last 6 months"}</p></div>
          <div class="seg-sm" role="group" aria-label="Range"><button data-a="range" data-r="week" aria-pressed="${range === "week"}">7D</button><button data-a="range" data-r="months" aria-pressed="${range !== "week"}">6M</button></div></div>
        ${bars(items, range === "week" ? dayLabel : monthLabel)}
        <div class="tiles">
          <div class="tile-box"><p class="eyebrow">Total</p><p class="tile-v num">${fmtH(total)}</p><p class="muted">${range === "week" ? "this week" : "6 months"}</p></div>
          <div class="tile-box"><p class="eyebrow">Per day</p><p class="tile-v num">${fmtH(total / activeDays)}</p><p class="muted">on average</p></div>
        </div>
      </section>
      <section class="panel" aria-labelledby="h-net">
        <div><h2 class="h3" id="h-net">Net minutes</h2><p class="muted">Running total at the tables, last 30 days</p></div>
        <p class="balance sm num ${tr.last > 0 ? "win" : tr.last < 0 ? "loss" : ""}">${signed(tr.last)}</p>
        ${tr.svg}
        <div class="ledger-box"><div class="lrow"><span>Won</span><span class="num">${signed(won30)}</span></div><div class="lrow"><span>Lost</span><span class="num">${lost30 ? signed(-lost30) : signed(0)}</span></div></div>
      </section>
      <section class="panel" aria-labelledby="h-bets">
        <div class="panel-head"><div><h2 class="h3" id="h-bets">Recent bets</h2><p class="muted">Today's rounds</p></div><button class="btn-sm" data-a="tab" data-t="tables">Play</button></div>
        ${recent ? `<div class="txns">${recent}</div>` : `<p class="muted">No bets today. Results show up here as you play.</p>`}
      </section>
    </div>`;
  }

  function vProfile() {
    const signedIn = ACC.signedIn;
    const row = (label, value, tone, go, cta) => `<div class="srow"><span class="srow-l">${label}</span><span class="pill ${tone}"><i></i>${value}</span>${go ? `<button class="btn-sm" data-a="settingsGo" data-go="${go}">${cta}</button>` : ""}</div>`;
    return `<div class="screen" id="screen">
      <header><h1 class="h1">Profile</h1><p class="muted">Account, blocking and Strict mode.</p></header>
      <section class="panel" aria-labelledby="acc-h">
        <div class="acct"><span class="avatar lg" aria-hidden="true">${esc(initials(ACC.name))}</span>
          <div class="acct-m"><h2 class="h3" id="acc-h">${signedIn ? esc(ACC.name || "Google account") : "Not signed in"}</h2><p class="muted">${signedIn ? esc(ACC.email) : "Your limits work without an account."}</p></div></div>
        ${signedIn ? `<button class="btn quiet" data-a="signOut">Sign out</button>` : `<button class="btn google" data-a="google">${ICON.google}Sign in with Google</button><p class="auth-msg" id="auth-msg" role="status"></p>`}
      </section>
      <section class="panel" aria-labelledby="hl-h">
        <div><h2 class="h3" id="hl-h">Blocking health</h2><p class="muted">What keeps blocking working on this phone.</p></div>
        <div class="srows">
          ${row("Accessibility switch", S.accessibility ? (S.watching ? "Running" : "Stopped") : "Off", S.accessibility && S.watching ? "good" : "bad", S.accessibility && S.watching ? "" : "acc", "Open")}
          ${row("Background use", S.batteryOk === false ? "Restricted" : "Allowed", S.batteryOk === false ? "warn" : "good", S.batteryOk === false ? "battery" : "", "Allow")}
          ${row("Date & time", S.autoTime === false ? "Manual" : "Automatic", S.autoTime === false ? "warn" : "good", S.autoTime === false ? "date" : "", "Open")}
        </div>
      </section>
      ${!S.accessibility ? "" : `
      <section class="panel strict" aria-labelledby="strict-h">
        <div class="panel-head"><h2 class="h3" id="strict-h">${ICON.lock} Strict mode</h2>
          <button class="switch" role="switch" aria-checked="${!!S.strict}" data-a="${S.strict ? "strictOff" : "strictOn"}" aria-labelledby="strict-h"><i></i></button></div>
        <p class="muted">${S.strict ? "Settings and uninstalling are covered. Getting in, or turning this off, takes a 30-second wait." : "Covers Settings and the uninstall screen too, so blocking can't be switched off on impulse."}</p>
      </section>`}
      ${A.native ? "" : `
      <section class="panel" aria-labelledby="demo-h">
        <div><h2 class="h3" id="demo-h">Web demo</h2><p class="muted">This is the browser version, with sample data. On a phone, Ante covers the real app.</p></div>
        <div class="demo-links">
          <a class="btn quiet" href="?mode=block&pkg=com.instagram.android&acc=1">See the block screen</a>
          <a class="btn quiet" href="?mode=block&pkg=com.android.settings&note=strict&acc=1">See Strict mode covering Settings</a>
          <a class="btn quiet" href="?onboard=1&reset=1">Start onboarding again</a>
          <a class="btn ghost" href="?reset=1&acc=1">Reset demo data</a>
        </div>
      </section>`}
      <p class="fine center">Ante 0.1 · No real money · Your limits and history stay on this phone.</p>
    </div>`;
  }

  function vWelcome() {
    if (ui.welcomeStep === "perm") {
      return `<div class="screen welcome" id="screen">
        <div class="w-steps" aria-label="Step 2 of 2"><i class="on"></i><i class="on"></i></div>
        <div class="w-hero"><h1 class="h1">One switch to turn on</h1><p class="muted">Ante covers an app when its time is up. To do that it needs to know which app is in front.</p></div>
        <ul class="facts"><li>It only sees the name of the app you open.</li><li>It never reads your screen, what you type or your notifications.</li><li>You can switch it off any time in Settings → Accessibility.</li></ul>
        <div class="grow"></div>
        <button class="btn primary" data-a="welcomeAcc">Turn on blocking</button>
        <button class="btn ghost" data-a="finishWelcome">Do it later</button>
      </div>`;
    }
    return `<div class="screen welcome" id="screen">
      <div class="w-steps" aria-label="Step 1 of 2"><i class="on"></i><i></i></div>
      <div class="w-hero"><span class="w-logo" aria-hidden="true">${ICON.logo}</span><h1 class="w-title">Ante</h1>
        <p class="muted">Give every app a daily budget. When it runs out, the app is covered. Want more? Bet the minutes.</p></div>
      <div class="grow"></div>
      <div class="signin" id="signin" data-open="false">
        <button class="signin-pill" data-a="signinOpen" aria-expanded="false" aria-controls="signin-card">Sign in</button>
        <div class="signin-card" id="signin-card" role="dialog" aria-label="Sign in">
          <div class="sheet-head"><h2 class="h2">Sign in</h2><button class="iconbtn" data-a="signinClose" aria-label="Close">${ICON.close}</button></div>
          <button class="btn google" data-a="google">${ICON.google}Continue with Google</button>
          <div class="or"><span>or</span></div>
          <button class="btn quiet" data-a="skipSignin">Continue without an account</button>
          <p class="auth-msg" id="auth-msg" role="status"></p>
          <p class="fine">Your limits stay on this phone. Signing in only saves your name and email here.</p>
        </div>
      </div>
      <button class="btn ghost" data-a="skipSignin">Skip for now</button>
    </div>`;
  }

  function vTables() {
    ensureStakeApp();
    const playable = S.limits.filter(l => l.leftSec >= 60);
    const head = BLOCK
      ? `<header class="topbar"><button class="iconbtn" data-a="toBlock" aria-label="Back to ${esc(CTX.label)}">${ICON.back}</button><div class="grow"><p class="eyebrow">Playing with ${esc(CTX.label)} time</p><h1 class="h2">Tables</h1></div>${soundBtn()}</header>`
      : `<header class="masthead"><span class="mark">Ante</span>${soundBtn()}</header><header><h1 class="h1">Tables</h1><p class="muted">Stake minutes from an app. Wins go back to that app. Losses are gone for today.</p></header>`;
    if (!playable.length || !stakeLimit() || stakeLimit().leftSec < 60) {
      return `<div class="screen" id="screen">${head}<section class="panel"><h2 class="h3">Nothing to stake</h2><p class="muted">${S.limits.length ? "Every limited app is under a minute for today. Budgets reset at midnight." : "Add a limit on the Today tab first. Its minutes are your chips."}</p></section></div>`;
    }
    const from = BLOCK ? "" : `<div class="from" role="group" aria-label="Stake from">${S.limits.map(l => `<button class="from-chip" data-a="stakeApp" data-pkg="${esc(l.pkg)}" aria-pressed="${ui.stakePkg === l.pkg}" ${l.leftSec < 60 ? "disabled" : ""}>${appIcon(l.pkg, "sm")}<span>${esc(l.label)}</span><span class="num">${fmt(l.leftSec)}</span></button>`).join("")}</div>`;
    const games = G.GAMES.map((g, i) => `<button class="game ${i === 0 ? "feature" : ""} g-${g.id}" data-a="game" data-id="${g.id}">
        <span class="art">${FX.GAME_ART[g.id]()}</span>
        <span class="gtext"><span class="gname">${g.name}</span><span class="grule">${g.rule}</span></span>
        <span class="rtp"><span class="num">${g.rtp}</span> back</span></button>`).join("");
    return `<div class="screen" id="screen">${head}
      <section class="panel">${from}${stakeBox(false)}</section>
      <section class="games" aria-label="Tables">${games}</section>
      <p class="fine">No real money. "Back" is the average share of a stake each table returns, so the house keeps a little every round.</p>
    </div>`;
  }

  function vGame() {
    const g = G.GAMES.find(x => x.id === ui.game);
    return `<div class="screen game-screen" id="screen">
      <header class="topbar"><button class="iconbtn" data-a="leave" aria-label="Back to tables" ${ui.busy || ui.round ? "disabled" : ""}>${ICON.back}</button>
        <div class="grow"><h1 class="h2">${g.name}</h1><p class="muted">Returns ${g.rtp} on average</p></div>${soundBtn()}</header>
      <section class="felt" id="table" aria-label="${g.name} table"></section>
      <p class="result" id="result" aria-live="polite"></p>
      <section class="panel controls" id="controls"></section>
    </div>`;
  }

  /* A short pause before a blocked app can be opened, the way delay apps break the habit loop. */
  const BREATH_S = Number(new URLSearchParams(location.search).get("breath") || 5);
  let breathEnds = 0, breathTimer = null;
  const breathLeft = () => Math.max(0, Math.ceil((breathEnds - Date.now()) / 1000));
  /* Restarted every time the block screen comes back, even when the page is reused. */
  function startBreath() {
    if (!BLOCK || BREATH_S <= 0) return;
    breathEnds = Date.now() + BREATH_S * 1000;
    clearInterval(breathTimer);
    breathTimer = setInterval(() => {
      const b = document.getElementById("open-app");
      const left = breathLeft();
      if (b) {
        const l = lim(CTX.pkg);
        b.disabled = left > 0;
        b.textContent = left > 0 ? `Take a breath · ${left}` : `Open ${CTX.label || (l && l.label) || "app"} · ${fmt(ui.openPick)}`;
      }
      if (left <= 0) clearInterval(breathTimer);
    }, 250);
  }
  startBreath();

  function vGuard() {
    const installer = /packageinstaller/.test(CTX.pkg || "");
    return `<div class="screen block" id="screen">
      <div class="block-top"><span class="appicon xl lockicon" aria-hidden="true">${ICON.lock}</span><p class="eyebrow">Strict mode</p>
        <h1 class="h1">${installer ? "Installing and removing apps is locked" : `${esc(CTX.label || "Settings")} is locked`}</h1></div>
      <p class="muted">${installer ? "Strict mode keeps Ante installed. To install or remove apps, turn off Strict mode in Ante first. That takes a 30-second wait." : "Strict mode covers this so blocking can't be switched off on impulse. Wait 30 seconds to use it for 2 minutes."}</p>
      <div class="grow"></div>
      ${installer ? `<button class="btn primary" data-a="openAnte">Open Ante</button>` : `<button class="btn primary" data-a="guardWait">Start the 30-second wait</button>`}
      <button class="btn ghost" data-a="closeBlock">Back to home screen</button>
    </div>`;
  }

  function vBlock() {
    if (CTX.note === "strict") return vGuard();
    const l = lim(CTX.pkg);
    const label = esc(CTX.label || (l && l.label) || "This app");
    if (!l) {
      return `<div class="screen block" id="screen"><div class="block-top">${appIcon(CTX.pkg, "xl")}<h1 class="h1">${label} has no limit</h1></div>
        <div class="grow"></div><button class="btn primary" data-a="closeBlock">Back to home screen</button></div>`;
    }
    if (l.leftSec <= 0) {
      return `<div class="screen block" id="screen">
        <div class="block-top">${appIcon(CTX.pkg, "xl")}<p class="eyebrow">${CTX.note ? esc(CTX.note) : "Daily limit reached"}</p><h1 class="h1">${label} is done for today</h1></div>
        <p class="bignum num loss">0:00</p><p class="muted">Your ${fmt(l.limitSec)} resets at midnight.</p>
        <div class="grow"></div>
        <button class="btn primary" data-a="closeBlock">Back to home screen</button>
        <button class="btn ghost" data-a="openAnte">Open Ante</button></div>`;
    }
    const opts = [[300, "5:00"], [600, "10:00"], [900, "15:00"], [l.leftSec, "All"]];
    if (ui.openPick > l.leftSec) ui.openPick = l.leftSec;
    return `<div class="screen block" id="screen">
      <div class="block-top">${appIcon(CTX.pkg, "xl")}<p class="eyebrow">${CTX.note ? esc(CTX.note) : "Daily limit"}</p><h1 class="h1">${label}</h1></div>
      <div><p class="bignum num">${fmt(l.leftSec)}</p><p class="muted">left today of ${fmt(l.limitSec)}</p></div>
      <div class="grow"></div>
      <section class="panel">
        <p class="eyebrow">Open for</p>
        <div class="chips">${opts.map(([v, t]) => `<button class="chip" data-a="pickOpen" data-v="${v}" aria-pressed="${ui.openPick === v}" ${v > l.leftSec ? "disabled" : ""}>${t}</button>`).join("")}</div>
        <button class="btn primary" id="open-app" data-a="openApp" ${breathLeft() > 0 ? "disabled" : ""}>${breathLeft() > 0 ? `Take a breath · ${breathLeft()}` : `Open ${label} · ${fmt(ui.openPick)}`}</button>
        <button class="btn quiet" data-a="toTables" ${l.leftSec < 60 ? "disabled" : ""}>Play for more time</button>
      </section>
      <button class="btn ghost" data-a="closeBlock">Not now</button>
    </div>`;
  }

  /* Floating pill navigation; a label slides above the active tab (after Skiper UI's Vercel tooltip). */
  let tipX = null, tipUntil = 0, tipFor = null;
  function tabbar() {
    if (BLOCK || ui.view === "welcome") return "";
    const tabs = [["today", "Today", ICON.today], ["tables", "Tables", ICON.tables], ["history", "History", ICON.history], ["profile", "Profile", ICON.user]];
    const cur = ui.view === "game" ? "tables" : ui.view;
    const needsCare = !S.accessibility || !S.watching || S.batteryOk === false;
    const lock = ui.busy || ui.round ? "disabled" : "";
    return `<nav class="navpill" aria-label="Sections"><span class="navtip" aria-hidden="true"></span>${tabs.map(([t, l, ic]) =>
      `<button data-a="tab" data-t="${t}" aria-label="${l}" aria-current="${cur === t ? "page" : "false"}" ${lock}>${ic}${t === "profile" && needsCare ? '<i class="ndot"></i>' : ""}</button>`).join("")}</nav>`;
  }
  function placeTip(target) {
    const nav = $app.querySelector(".navpill"); if (!nav) return;
    const btn = target || nav.querySelector('[aria-current="page"]'), tip = nav.querySelector(".navtip");
    if (!btn || !tip) return;
    const x = btn.offsetLeft + btn.offsetWidth / 2;
    tip.textContent = btn.getAttribute("aria-label");
    if (tipX != null) { tip.style.transition = "none"; tip.style.left = tipX + "px"; void tip.offsetWidth; tip.style.transition = ""; }
    tip.style.left = x + "px"; tipX = x;
    tip.classList.toggle("show", Date.now() < tipUntil || !!target);
  }


  /* ---------- sheets ---------- */
  /* A wait the native side times (30 s). Shows a countdown, then unlocks the action. */
  function openWait(opts) {
    A.startWait();
    ui.sheet = Object.assign({ type: "wait", left: 30000 }, opts);
    clearInterval(waitTimer);
    const tick = () => {
      if (!ui.sheet || ui.sheet.type !== "wait") { clearInterval(waitTimer); return; }
      let left = Number(A.waitLeftMs());
      if (left < 0) { A.startWait(); left = 30000; } // the wait was used or expired: start a fresh one
      ui.sheet.left = left;
      const n = document.getElementById("wait-n"), b = document.getElementById("wait-go"), ring = document.getElementById("wait-ring");
      if (n) n.textContent = Math.ceil(ui.sheet.left / 1000);
      if (ring) ring.style.setProperty("--p", String(1 - ui.sheet.left / 30000));
      if (b) b.disabled = ui.sheet.left > 0;
      if (ui.sheet.left <= 0) clearInterval(waitTimer);
    };
    paintOverlay(); tick();
    waitTimer = setInterval(tick, 250);
  }

  function vSheet() {
    const sh = ui.sheet; if (!sh) return "";
    if (sh.type === "wait") {
      return `<div class="scrim" data-a="closeSheet"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="wait-h" data-stop>
        <div class="sheet-head"><h2 class="h2" id="wait-h">${esc(sh.title)}</h2><button class="iconbtn" data-a="closeSheet" aria-label="Cancel">${ICON.close}</button></div>
        <div class="wait"><div class="wait-ring" id="wait-ring" style="--p:${1 - sh.left / 30000}"><span class="num" id="wait-n">${Math.ceil(sh.left / 1000)}</span></div>
          <p class="muted">${esc(sh.body)}</p></div>
        <button class="btn primary" id="wait-go" data-a="waitCta" ${sh.left > 0 ? "disabled" : ""}>${esc(sh.cta)}</button>
      </div></div>`;
    }
    if (sh.type === "strict") {
      return `<div class="scrim" data-a="closeSheet"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="strict-s" data-stop>
        <div class="sheet-head"><h2 class="h2" id="strict-s">Turn on Strict mode</h2><button class="iconbtn" data-a="closeSheet" aria-label="Close">${ICON.close}</button></div>
        <ul class="facts"><li>Opening Settings shows a block screen. After a 30-second wait you get 2 minutes, then it is covered again.</li>
          <li>The Play Store opens the same way. The install and uninstall screen stays covered until Strict mode is off.</li>
          <li>Turning Strict mode off takes the same 30-second wait.</li>
          <li>Quick settings in the notification shade keep working, so Wi-Fi, flashlight and emergency calls are never locked.</li></ul>
        <div class="btn-row"><button class="btn quiet" data-a="closeSheet">Not now</button><button class="btn primary" data-a="agreeStrict">Turn on</button></div>
      </div></div>`;
    }
    if (sh.type === "consent") {
      return `<div class="scrim" data-a="closeSheet"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="consent-h" data-stop>
        <div class="sheet-head"><h2 class="h2" id="consent-h">Before you switch it on</h2><button class="iconbtn" data-a="closeSheet" aria-label="Close">${ICON.close}</button></div>
        <p>Ante uses Android's Accessibility service to see <b>which app is in front</b>, so it can cover apps that are over their limit.</p>
        <ul class="facts">
          <li>It only sees the name of the app you open.</li>
          <li>It does not read what is on your screen, what you type or your notifications.</li>
          <li>Nothing leaves your phone. Ante has no internet permission.</li>
        </ul>
        <p class="muted">You can switch it off any time in Settings → Accessibility.</p>
        <div class="btn-row"><button class="btn quiet" data-a="closeSheet">Not now</button><button class="btn primary" data-a="agreeAcc">I agree, open Settings</button></div>
      </div></div>`;
    }
    if (sh.type === "pick") {
      const q = (sh.q || "").toLowerCase();
      const list = (sh.apps || []).filter(a => !lim(a.pkg) && (!q || a.label.toLowerCase().includes(q)));
      const body = sh.apps == null ? `<p class="muted">Loading your apps…</p>`
        : list.length ? list.map(a => `<button class="limit pick" data-a="pickApp" data-pkg="${esc(a.pkg)}">${a.icon ? `<img class="appicon" src="${esc(a.icon)}" alt="" width="44" height="44">` : `<span class="appicon mono">${esc(a.label.slice(0, 2))}</span>`}<span class="meta"><span class="name">${esc(a.label)}</span></span>${ICON.chev}</button>`).join("")
          : `<p class="muted">${q ? "No app matches that name." : "Every app already has a limit."}</p>`;
      return `<div class="scrim" data-a="closeSheet"><div class="sheet" role="dialog" aria-modal="true" aria-label="Add an app" data-stop>
        <div class="sheet-head"><h2 class="h2">Add an app</h2><button class="iconbtn" data-a="closeSheet" aria-label="Close">${ICON.close}</button></div>
        <input class="search" id="app-search" type="search" placeholder="Search apps" autocomplete="off" value="${esc(sh.q || "")}">
        <div class="pick-list" id="pick-list">${body}</div></div></div>`;
    }
    const l = lim(sh.pkg);
    const label = sh.label;
    return `<div class="scrim" data-a="closeSheet"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)} limit" data-stop>
      <div class="sheet-head">${appIcon(sh.pkg)}<div class="grow"><h2 class="h2">${esc(label)}</h2><p class="muted">${l ? `<span class="num">${fmt(l.leftSec)}</span> left today` : "New limit"}</p></div>
        <button class="iconbtn" data-a="closeSheet" aria-label="Close">${ICON.close}</button></div>
      <p class="eyebrow">Daily limit</p>
      <div class="stake-row">
        <button class="step" data-a="limStep" data-d="-300" aria-label="Five minutes less" ${sh.limit <= 300 ? "disabled" : ""}>−</button>
        <div class="stake-chip wide"><span class="num">${fmt(sh.limit)}</span></div>
        <button class="step" data-a="limStep" data-d="300" aria-label="Five minutes more" ${sh.limit >= 14400 ? "disabled" : ""}>+</button>
      </div>
      <div class="chips">${[[900, "15:00"], [1200, "20:00"], [1800, "30:00"], [3600, "1:00:00"]].map(([v, t]) => `<button class="chip" data-a="limSet" data-v="${v}" aria-pressed="${sh.limit === v}">${t}</button>`).join("")}</div>
      ${l && sh.limit > l.limitSec ? `<p class="muted">The extra ${fmt(sh.limit - l.limitSec)} starts tomorrow. Cuts apply straight away.</p>` : ""}
      <div class="btn-row">${l ? `<button class="btn danger" data-a="removeLimit">Remove limit</button>` : ""}<button class="btn primary" data-a="saveLimit">${l ? "Save" : "Add limit"}</button></div>
    </div></div>`;
  }
  /* Fetch picker icons a few at a time so the list appears instantly. */
  function loadIcons(list) {
    let i = 0;
    const step = () => {
      if (!ui.sheet || ui.sheet.type !== "pick") return;
      for (const end = Math.min(i + 6, list.length); i < end; i++) {
        const a = list[i];
        if (a.icon) continue;
        try { a.icon = A.icon(a.pkg) || ""; } catch (e) { a.icon = ""; }
        icons[a.pkg] = a.icon;
        const el = a.icon && document.querySelector(`.pick-list [data-pkg="${CSS.escape(a.pkg)}"] .appicon.mono`);
        if (el) { const img = new Image(44, 44); img.className = "appicon"; img.alt = ""; img.src = a.icon; el.replaceWith(img); }
      }
      if (i < list.length) setTimeout(step, 16);
    };
    step();
  }
  function paintOverlay() {
    const focusSearch = document.activeElement && document.activeElement.id === "app-search";
    const caret = focusSearch ? document.activeElement.selectionStart : null;
    $overlay.innerHTML = vSheet() + (ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : "");
    if (focusSearch) { const s = document.getElementById("app-search"); if (s) { s.focus(); try { s.setSelectionRange(caret, caret); } catch (e) { /* type=search */ } } }
  }

  /* ---------- render ---------- */
  let mountedKey = null;
  function render() {
    if (ui.view === "game" && mountedKey === "game:" + ui.game) { renderControls(); paintOverlay(); return; }
    const scroller = document.getElementById("screen");
    const keep = scroller && mountedKey === ui.view ? scroller.scrollTop : 0;
    const body = ({ block: vBlock, tables: vTables, game: vGame, history: vHistory, profile: vProfile, welcome: vWelcome })[ui.view] || vToday;
    $app.innerHTML = body() + tabbar();
    placeTip();
    $app.dataset.view = ui.view;
    const s2 = document.getElementById("screen"); if (s2 && keep) s2.scrollTop = keep;
    if (table && table.destroy) table.destroy();
    table = null;
    mountedKey = ui.view === "game" ? "game:" + ui.game : ui.view;
    if (ui.view === "game") { mountGame(); renderControls(); }
    paintOverlay();
  }
  function renderNav() {
    const nav = $app.querySelector(".navpill"); if (!nav) return;
    const tmp = document.createElement("div"); tmp.innerHTML = tabbar();
    nav.replaceWith(tmp.firstElementChild);
    placeTip();
    const back = $app.querySelector('[data-a="leave"]'); if (back) back.disabled = !!(ui.busy || ui.round);
  }

  /* ---------- tables ---------- */
  function mountGame() {
    const el = document.getElementById("table");
    ui.res = null; ui.round = null;
    if (ui.game === "coin") { ui.pick = ui.pick || "H"; table = FX.Coin(el); }
    if (ui.game === "roulette") { ui.bet = ui.bet || "red"; ui.num = ui.num == null ? 17 : ui.num; ui.hist = ui.hist || []; table = FX.Roulette(el); }
    if (ui.game === "slots") { table = FX.Slots(el, ["seven", "bell", "cherry"]); paytableSlots(el); }
    if (ui.game === "blackjack") { ui.shoe = ui.shoe && ui.shoe.length > 30 ? ui.shoe : G.newShoe(); table = FX.Blackjack(el); }
    if (ui.game === "poker") { table = FX.Poker(el, i => { if (ui.round && ui.round.phase === "dealt" && !ui.busy) { ui.round.held[i] = !ui.round.held[i]; table.setHold(i, ui.round.held[i]); haptic("tap"); } }); }
  }
  function paytableSlots(el) {
    const rows = [["seven", "100×"], ["bar", "40×"], ["bell", "20×"], ["diamond", "10×"], ["cherry", "5×"]];
    const div = document.createElement("div");
    div.className = "slot-pays";
    div.innerHTML = rows.map(([s, m]) => `<div class="sp" data-key="three-${s}"><span class="sp-art">${FX.slotSvg(s).repeat(3)}</span><span class="num">${m}</span></div>`).join("")
      + `<div class="sp" data-key="two-sevens"><span class="sp-txt">Any two 7s</span><span class="num">5×</span></div><div class="sp" data-key="pair"><span class="sp-txt">Any other pair</span><span class="num">0.4×</span></div>`;
    el.appendChild(div);
  }

  function renderControls() {
    const c = document.getElementById("controls"); if (!c) return;
    const r = document.getElementById("result");
    if (r) { r.className = "result " + (ui.res ? ui.res.tone : ""); if (!ui.res) r.textContent = ""; }
    const locked = ui.busy || !!ui.round;
    const go = (label, action) => canStake() || locked
      ? `<button class="btn primary" data-a="${action}" ${ui.busy ? "disabled" : ""}>${label}</button>`
      : `<p class="muted center">Not enough ${esc(labelOf(ui.stakePkg))} time for this stake.</p>`;
    let html = "";
    if (ui.game === "coin") {
      html = `<div class="seg2" role="group" aria-label="Your call">
          <button class="chip" data-a="coinPick" data-v="H" aria-pressed="${ui.pick === "H"}" ${locked ? "disabled" : ""}>Heads</button>
          <button class="chip" data-a="coinPick" data-v="T" aria-pressed="${ui.pick === "T"}" ${locked ? "disabled" : ""}>Tails</button></div>
        ${stakeBox(locked)}${go(`Flip for ${fmt(ui.stake)}`, "coinFlip")}`;
    } else if (ui.game === "roulette") {
      const mult = ui.bet === "num" ? G.STRAIGHT_MULTIPLE : G.ROULETTE_BETS[ui.bet].multiple;
      html = `<div class="history" aria-label="Last numbers">${(ui.hist || []).map(n => `<span class="${G.pocketColor(n)}">${n}</span>`).join("") || `<span class="none">No spins yet</span>`}</div>
        <div class="bets">${Object.entries(G.ROULETTE_BETS).map(([id, b]) => `<button class="chip bet-${id}" data-a="rBet" data-v="${id}" aria-pressed="${ui.bet === id}" ${locked ? "disabled" : ""}>${b.label}</button>`).join("")}</div>
        <div class="straight">
          <button class="step" data-a="rNum" data-d="-1" aria-label="Lower number" ${locked ? "disabled" : ""}>−</button>
          <button class="chip" data-a="rBet" data-v="num" aria-pressed="${ui.bet === "num"}" ${locked ? "disabled" : ""}>Number <span class="num">${ui.num}</span></button>
          <button class="step" data-a="rNum" data-d="1" aria-label="Higher number" ${locked ? "disabled" : ""}>+</button></div>
        ${stakeBox(locked)}${go(`Spin · pays ${mult}×`, "rSpin")}`;
    } else if (ui.game === "slots") {
      html = `${stakeBox(locked)}${go(`Spin for ${fmt(ui.stake)}`, "sSpin")}`;
    } else if (ui.game === "blackjack") {
      const R = ui.round;
      if (R && R.phase === "play") {
        const canDouble = R.p.length === 2 && stakeLimit() && stakeLimit().leftSec >= R.stake;
        html = `<div class="btn-row three"><button class="btn quiet" data-a="bjHit" ${ui.busy ? "disabled" : ""}>Hit</button>
          <button class="btn primary" data-a="bjStand" ${ui.busy ? "disabled" : ""}>Stand</button>
          <button class="btn quiet" data-a="bjDouble" ${ui.busy || !canDouble ? "disabled" : ""}>Double</button></div>
          <p class="stake-from center">Stake <span class="num">${fmt(R.stake)}</span> on the table</p>`;
      } else html = `${stakeBox(locked)}${go(`Deal for ${fmt(ui.stake)}`, "bjDeal")}`;
    } else if (ui.game === "poker") {
      const R = ui.round;
      if (R && R.phase === "dealt") {
        html = `<p class="muted center">Tap the cards you want to keep, then draw.</p><button class="btn primary" data-a="pDraw" ${ui.busy ? "disabled" : ""}>Draw</button>
          <p class="stake-from center">Stake <span class="num">${fmt(R.stake)}</span> in play</p>`;
      } else html = `${stakeBox(locked)}${go(`Deal for ${fmt(ui.stake)}`, "pDeal")}`;
    }
    c.innerHTML = html;
    renderNav();
  }

  const INVALID_SETTLE = -2147483648;
  function takeStake(sec, game) {
    if (!A.bet(ui.stakePkg, sec)) { toast(`Not enough ${labelOf(ui.stakePkg)} time for that stake.`); return false; }
    ui.pending = { game, stake: (ui.pending ? ui.pending.stake : 0) + sec };
    refresh(); return true;
  }
  /* Runs a round. If anything throws after the stake was taken, the stake goes back. */
  function guarded(fn) {
    return async function () {
      try { await fn.apply(this, arguments); }
      catch (err) {
        console.warn("round failed", err);
        if (ui.pending) { A.settle(ui.stakePkg, ui.pending.game, ui.pending.stake, ui.pending.stake); ui.pending = null; }
        ui.busy = false; ui.round = null; ui.res = { tone: "loss", text: "That round broke. Your stake is back." };
        refresh(); renderControls();
      }
    };
  }
  function finish(gameName, stake, multiple, prefix) {
    const ret = Math.round(stake * multiple);
    const net = A.settle(ui.stakePkg, gameName, stake, ret);
    ui.pending = null;
    refresh();
    if (net === INVALID_SETTLE) {
      ui.res = { tone: "loss", text: "This round couldn't be paid out because Ante restarted mid-round." };
      ui.busy = false; ui.round = null;
      const r0 = document.getElementById("result"); if (r0) r0.textContent = ui.res.text;
      renderControls(); return;
    }
    const app = labelOf(ui.stakePkg);
    let tone = "", text;
    if (net > 0) { tone = "win"; text = `${prefix}You win ${fmt(net)} of ${app}.`; }
    else if (net === 0) text = `${prefix}Push. Your stake comes back.`;
    else if (ret > 0) { tone = "loss"; text = `${prefix}${fmt(ret)} comes back. Net ${signed(net)}.`; }
    else { tone = "loss"; text = `${prefix}You lose ${fmt(stake)}.`; }
    ui.res = { tone, text };
    ui.busy = false; ui.round = null;
    const r = document.getElementById("result");
    if (r) { r.textContent = text; }
    if (net > 0) { FX.burst(document.getElementById("table"), { power: multiple >= 10 ? 1.4 : 1 }); haptic("win"); SFX.play(multiple >= 10 ? "bigWin" : "win"); }
    else if (net < 0) { haptic("loss"); SFX.play("lose"); }
    else SFX.play("push");
    renderControls();
  }
  const begin = () => { ui.busy = true; ui.res = null; renderControls(); };

  async function coinFlip() {
    const stake = ui.stake; if (!takeStake(stake, "Coin flip")) return;
    begin();
    const r = G.coinFlip(ui.pick);
    await table.flip(r.result);
    finish("Coin flip", stake, r.multiple, (r.result === "H" ? "Heads. " : "Tails. "));
  }
  async function rSpin() {
    const stake = ui.stake; if (!takeStake(stake, "Roulette")) return;
    begin();
    const n = G.rouletteSpin();
    let ticks = 0;
    await table.spin(n, () => { if (++ticks % 2 === 0) haptic("tick"); });
    ui.hist = [n, ...(ui.hist || [])].slice(0, 10);
    const color = G.pocketColor(n);
    finish("Roulette", stake, G.rouletteMultiple(ui.bet, n, ui.num), `${n} ${color}. `);
  }
  async function sSpin() {
    const stake = ui.stake; if (!takeStake(stake, "Slots")) return;
    begin();
    const reels = G.slotSpin();
    await table.spin(reels, () => haptic("tick"));
    const pay = G.slotPay(reels);
    document.querySelectorAll(".slot-pays .sp").forEach(e => e.classList.toggle("on", e.dataset.key === pay.key));
    if (pay.multiple >= 1) table.win();
    finish("Slots", stake, pay.multiple, pay.multiple >= 10 ? "Jackpot row. " : "");
  }

  const draw = () => { if (ui.shoe.length < 20) ui.shoe = G.newShoe(); return ui.shoe.pop(); };
  async function bjDeal() {
    const stake = ui.stake; if (!takeStake(stake, "Blackjack")) return;
    const R = ui.round = { phase: "deal", stake, p: [draw(), draw()], d: [draw(), draw()] };
    begin();
    table.chip(fmt(stake));
    await table.deal(R.p, R.d, haptic);
    table.values(G.handValue(R.p), G.handValue([R.d[0]]));
    if (G.isBlackjack(R.p) || G.isBlackjack(R.d)) return bjSettle();
    R.phase = "play"; ui.busy = false; renderControls();
  }
  async function bjHit() {
    const R = ui.round; if (!R || ui.busy) return;
    ui.busy = true; renderControls();
    const card = draw(); R.p.push(card);
    await table.hit(card, haptic);
    const v = G.handValue(R.p);
    table.values(v, G.handValue([R.d[0]]));
    if (v >= 21) return bjSettle();
    ui.busy = false; renderControls();
  }
  async function bjDouble() {
    const R = ui.round; if (!R || ui.busy) return;
    if (!takeStake(R.stake, "Blackjack")) return;
    R.stake *= 2; table.chip(fmt(R.stake));
    ui.busy = true; renderControls();
    const card = draw(); R.p.push(card);
    await table.hit(card, haptic);
    table.values(G.handValue(R.p), G.handValue([R.d[0]]));
    bjSettle();
  }
  async function bjSettle() {
    const R = ui.round; ui.busy = true; renderControls();
    await table.reveal(R.d[1]);
    const pv = G.handValue(R.p);
    if (pv <= 21 && !G.isBlackjack(R.p) && !G.isBlackjack(R.d)) {
      while (G.handValue(R.d) < 17) { const c = draw(); R.d.push(c); table.values(pv, G.handValue(R.d)); await table.dealer(c, haptic); }
    }
    table.values(pv, G.handValue(R.d));
    const res = G.blackjackMultiple(R.p, R.d);
    const words = { blackjack: "Blackjack!", "dealer-blackjack": "Dealer blackjack", bust: "Bust", "dealer-bust": "Dealer busts", win: "You win", push: "Push", lose: "Dealer wins" };
    table.banner(words[res.outcome], res.multiple > 1 ? "win" : res.multiple === 1 ? "" : "loss");
    const dv = G.handValue(R.d);
    const prefix = res.outcome === "win" ? `${pv} beats ${dv}. ` : res.outcome === "lose" ? `Dealer's ${dv} beats ${pv}. ` : res.outcome === "bust" ? `Bust at ${pv}. ` : res.outcome === "dealer-bust" ? `Dealer busts at ${dv}. ` : "";
    finish("Blackjack", R.stake, res.multiple, prefix);
    table.chip("");
  }

  async function pDeal() {
    const stake = ui.stake; if (!takeStake(stake, "Poker")) return;
    const deck = G.shuffledDeck();
    const R = ui.round = { phase: "deal", stake, deck, hand: deck.splice(0, 5), held: [false, false, false, false, false] };
    begin();
    await table.deal(R.hand, haptic);
    table.highlight(G.pokerRank(R.hand));
    R.phase = "dealt"; ui.busy = false; table.enable(true); renderControls();
  }
  async function pDraw() {
    const R = ui.round; if (!R || ui.busy) return;
    ui.busy = true; table.enable(false); renderControls();
    R.hand = R.hand.map((c, i) => (R.held[i] ? c : R.deck.shift()));
    await table.draw(R.hand, R.held, haptic);
    const res = G.pokerMultiple(R.hand);
    table.highlight(res.rank);
    finish("Poker", R.stake, res.multiple, res.rank ? `${res.rank}. ` : "No pair of jacks or better. ");
  }

  /* ---------- actions ---------- */
  const ACT = {
    tab(d) { tipUntil = Date.now() + 1200; ui.view = d.t; ui.game = null; render(); setTimeout(() => placeTip(), 1250); },
    range(d) { ui.range = d.r; chipFx(); render(); },
    signinOpen() { morphSignin(true); },
    signinClose() { morphSignin(false); },
    google() {
      const msg = document.getElementById("auth-msg"); if (msg) msg.textContent = "Opening Google…";
      A.signInWithGoogle();
    },
    skipSignin() { ui.welcomeStep = "perm"; render(); },
    welcomeAcc() { ui.sheet = { type: "consent", fromWelcome: true }; paintOverlay(); },
    finishWelcome() { A.finishOnboarding(); refresh(); ui.view = "today"; render(); },
    signOut() { A.signOut(); refresh(); render(); toast("Signed out. Your limits are still here."); },
    openAcc() { ui.sheet = { type: "consent" }; paintOverlay(); },
    agreeAcc() {
      const fromWelcome = ui.sheet && ui.sheet.fromWelcome;
      ui.sheet = null; paintOverlay();
      if (fromWelcome) { A.finishOnboarding(); ui.view = "today"; }
      if (A.openAccessibilitySettings() === false) { ACT.settingsGo({ go: "acc" }); return; }
      setTimeout(() => { refresh(); render(); }, 300);
    },
    openInfo() { ACT.settingsGo({ go: "info" }); },
    add() {
      ui.sheet = { type: "pick", apps: null, q: "" }; paintOverlay();
      setTimeout(() => { if (ui.sheet && ui.sheet.type === "pick") { ui.sheet.apps = A.apps(); paintOverlay(); loadIcons(ui.sheet.apps); } }, 30);
    },
    pickApp(d) {
      const a = (ui.sheet.apps || []).find(x => x.pkg === d.pkg); if (!a) return;
      icons[a.pkg] = a.icon;
      ui.sheet = { type: "edit", pkg: a.pkg, label: a.label, limit: 1800 }; paintOverlay();
    },
    edit(d) { const l = lim(d.pkg); ui.sheet = { type: "edit", pkg: l.pkg, label: l.label, limit: l.limitSec }; paintOverlay(); },
    closeSheet() { ui.sheet = null; clearInterval(waitTimer); paintOverlay(); },
    limStep(d) { ui.sheet.limit = Math.max(300, Math.min(14400, ui.sheet.limit + Number(d.d))); paintOverlay(); },
    limSet(d) { ui.sheet.limit = Number(d.v); paintOverlay(); },
    saveLimit() {
      const sh = ui.sheet; const existed = !!lim(sh.pkg);
      if (!A.setLimit(sh.pkg, sh.label, sh.limit)) { toast("Ante can't limit that app."); return; }
      refresh(); ui.sheet = null; render();
      toast(existed ? `${sh.label} limit set to ${fmt(sh.limit)}.` : `${sh.label} added with ${fmt(sh.limit)} a day.`);
    },
    removeLimit() { const sh = ui.sheet; A.removeLimit(sh.pkg); refresh(); ui.sheet = null; render(); toast(`${sh.label} no longer has a limit.`); },
    stakeApp(d) { ui.stakePkg = d.pkg; clampStake(); chipFx(); render(); },
    stake(d) { ui.stake += Number(d.d); clampStake(); chipFx(); ui.view === "game" ? renderControls() : render(); },
    stakeSet(d) { ui.stake = Number(d.v); clampStake(); chipFx(); ui.view === "game" ? renderControls() : render(); },
    sound() {
      SFX.toggle();
      document.querySelectorAll('[data-a="sound"]').forEach(b => { const t = document.createElement("div"); t.innerHTML = soundBtn(); b.replaceWith(t.firstElementChild); });
    },
    strictOn() { ui.sheet = { type: "strict" }; paintOverlay(); },
    agreeStrict() { A.setStrict(true); refresh(); ui.sheet = null; render(); toast("Strict mode is on."); },
    strictOff() { openWait({ title: "Turn off Strict mode", body: "Wait 30 seconds. If you still want to turn it off after that, you can.", cta: "Turn off Strict mode", then: "strictOffNow" }); },
    strictOffNow() { if (!A.setStrict(false)) { toast("The wait isn't over yet."); return; } refresh(); ui.sheet = null; render(); toast("Strict mode is off."); },
    settingsGo(d) {
      const go = { acc: () => A.openAccessibilitySettings(), battery: () => A.openBatterySettings(), date: () => A.openDateSettings(), info: () => A.openAppInfo() }[d.go];
      if (!go) return;
      if (S.strict) { openWait({ title: "Settings is behind Strict mode", body: "Wait 30 seconds to open it.", cta: "Open Settings", then: "settingsNow", go: d.go }); return; }
      go(); setTimeout(() => { refresh(); render(); }, 300);
    },
    settingsNow() {
      const go = ui.sheet && ui.sheet.go;
      const fn = { acc: () => A.openAccessibilitySettings(), battery: () => A.openBatterySettings(), date: () => A.openDateSettings(), info: () => A.openAppInfo() }[go];
      if (fn && fn() === false) { toast("The wait isn't over yet."); return; }
      ui.sheet = null; paintOverlay();
    },
    guardWait() { openWait({ title: "Open Settings", body: "Settings opens for 2 minutes after the wait.", cta: "Open Settings", then: "guardOpen" }); },
    guardOpen() { if (A.openGuarded(CTX.pkg) === false) { toast("The wait isn't over yet."); return; } ui.sheet = null; paintOverlay(); },
    waitCta() { const t = ui.sheet && ui.sheet.then; if (t && ACT[t] && ui.sheet.left <= 0) ACT[t](); },
    game(d) { ui.game = d.id; ui.view = "game"; render(); },
    leave() { if (ui.busy || ui.round) return; ui.view = "tables"; ui.game = null; render(); },
    coinPick(d) { ui.pick = d.v; renderControls(); },
    rBet(d) { ui.bet = d.v; chipFx(); renderControls(); },
    rNum(d) { ui.num = (ui.num + Number(d.d) + 37) % 37; ui.bet = "num"; renderControls(); },
    coinFlip: guarded(coinFlip), rSpin: guarded(rSpin), sSpin: guarded(sSpin),
    bjDeal: guarded(bjDeal), bjHit: guarded(bjHit), bjStand: guarded(async () => { if (!ui.busy) await bjSettle(); }),
    bjDouble: guarded(bjDouble), pDeal: guarded(pDeal), pDraw: guarded(pDraw),
    pickOpen(d) { ui.openPick = Number(d.v); chipFx(); render(); },
    openApp() {
      if (!A.open(CTX.pkg, ui.openPick)) { toast("Couldn't open that app. It may have been uninstalled."); return; }
      refresh(); render();
    },
    toTables() { ui.view = "tables"; render(); },
    toBlock() { ui.view = "block"; ui.game = null; render(); },
    closeBlock() { A.closeBlock(); },
    openAnte() { A.openAnte(); },
  };

  function onClick(e) {
    const el = e.target.closest("[data-a]");
    if (!el || el.disabled) return;
    if (el.classList.contains("scrim") && e.target.closest("[data-stop]")) return;
    const fn = ACT[el.dataset.a];
    if (fn) fn(el.dataset, el);
  }
  $app.addEventListener("click", onClick);
  $app.addEventListener("pointerover", e => { const b = e.target.closest(".navpill button"); if (b && e.pointerType === "mouse") placeTip(b); });
  $app.addEventListener("pointerout", e => { const b = e.target.closest(".navpill button"); if (b && e.pointerType === "mouse") placeTip(); });
  $overlay.addEventListener("click", onClick);
  $overlay.addEventListener("input", e => {
    if (e.target.id === "app-search" && ui.sheet) { ui.sheet.q = e.target.value; paintOverlay(); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") window.anteBack(); });

  /* Hooks for the native shell. */
  window.anteBack = function () {
    if (ui.sheet) { ui.sheet = null; paintOverlay(); return true; }
    if (ui.view === "game") { if (!ui.busy && !ui.round) { ui.view = "tables"; ui.game = null; render(); } return true; }
    if (BLOCK && ui.view === "tables") { ui.view = "block"; render(); return true; }
    if (!BLOCK && ["tables", "history", "profile"].includes(ui.view)) { ui.view = "today"; render(); return true; }
    if (ui.view === "welcome" && ui.welcomeStep === "perm") { if (!ACC.signedIn) { ui.welcomeStep = "signin"; render(); } return true; }
    if (ui.view === "welcome" && document.querySelector('#signin[data-open="true"]')) { morphSignin(false); return true; }
    return false;
  };
  /* Result of Google sign-in from the native side (a JSON string). */
  window.anteAuth = function (raw) {
    let r; try { r = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { r = { ok: false, message: "Sign-in failed." }; }
    refresh();
    if (r && r.ok) {
      toast(`Signed in as ${r.name || r.email}.`);
      if (ui.view === "welcome") ui.welcomeStep = "perm";
      render();
    } else {
      const msg = document.getElementById("auth-msg");
      const text = (r && r.message) || "Sign-in failed.";
      if (msg) msg.textContent = r && r.error === "cancelled" ? "" : text; else toast(text);
    }
  };

  /* Sign-in pill that grows into the sign-in card (after Skiper UI's sign-in), and back. */
  function morphSignin(open) {
    const box = document.getElementById("signin"); if (!box) return;
    const card = box.querySelector(".signin-card"), pill = box.querySelector(".signin-pill");
    const from = box.getBoundingClientRect();
    box.dataset.open = String(open);
    pill.setAttribute("aria-expanded", String(open));
    // Lay the card out at its final width first, so the measured height is the real one.
    card.style.width = (box.parentElement.clientWidth - 32) + "px";
    const toH = open ? card.scrollHeight : 48;
    box.style.height = from.height + "px";
    void box.offsetWidth;
    box.style.height = toH + "px";
    if (open) { SFX.play("tap"); setTimeout(() => { const g = card.querySelector(".google"); if (g) g.focus(); }, 380); }
    else setTimeout(() => pill.focus(), 380);
  }

  window.anteRefresh = function () {
    if (BLOCK && ui.view === "block") startBreath();
    if (ui.busy || ui.round) return;
    refresh();
    if (ui.view === "game") renderControls(); else render();
  };

  const start = () => { ensureStakeApp(); render(); };
  if (document.fonts && document.fonts.ready) {
    let done = false; const go = () => { if (!done) { done = true; start(); } };
    document.fonts.ready.then(go); setTimeout(go, 400);
  } else start();
})();
