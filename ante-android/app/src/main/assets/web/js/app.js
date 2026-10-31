/* Ante UI: Today, the block screen, the tables. State lives in the native bank (window.Ante). */
(function () {
  "use strict";
  const A = window.Ante, G = window.AnteGames, FX = window.AnteFX;
  const $app = document.getElementById("app"), $overlay = document.getElementById("overlay");
  const CTX = A.context();
  const BLOCK = CTX.mode === "block";

  let S = A.state();
  const ui = {
    view: BLOCK ? "block" : "today",   // today | tables | game | block
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
  const refresh = () => { S = A.state(); };

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
  function vToday() {
    const total = S.limits.reduce((a, l) => a + l.leftSec, 0);
    const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    const perm = S.accessibility ? "" : `
      <section class="panel perm" aria-labelledby="perm-h">
        <h2 class="h3" id="perm-h">Let Ante see which app you open</h2>
        <p class="muted">Blocking needs Ante's accessibility switch. Ante only checks which app is in front and never reads your screen.</p>
        <button class="btn primary" data-a="openAcc">Open Accessibility settings</button>
        <details class="help"><summary>The switch is greyed out</summary>
          <p class="muted">Android blocks this switch for apps installed from an APK. Open Ante's App info, tap the ⋮ menu, choose <b>Allow restricted settings</b>, then try the switch again.</p>
          <button class="btn quiet" data-a="openInfo">Open App info</button>
        </details>
      </section>`;
    const rows = S.limits.map(l => {
      const used = Math.max(0, l.limitSec - l.leftSec), bonus = l.leftSec - l.limitSec, out = l.leftSec <= 0;
      const pct = Math.min(100, (used / l.limitSec) * 100);
      const sub = bonus > 0 ? `<span class="win">${signed(bonus)}</span> won on top of ${fmt(l.limitSec)}`
        : out ? "Locked until midnight" : `${fmt(used)} of ${fmt(l.limitSec)} used`;
      return `<button class="limit" data-a="edit" data-pkg="${esc(l.pkg)}" aria-label="${esc(l.label)}, ${fmt(l.leftSec)} left. Edit limit">
        ${appIcon(l.pkg)}
        <span class="meta"><span class="name">${esc(l.label)}</span><span class="sub">${sub}</span>
          <span class="meter ${out ? "out" : bonus > 0 ? "bonus" : ""}"><i style="width:${out || bonus > 0 ? 100 : pct}%"></i></span></span>
        <span class="left num ${out ? "loss" : ""}">${fmt(l.leftSec)}</span></button>`;
    }).join("");
    const net = S.ledger.reduce((a, b) => a + b.deltaSec, 0);
    const ledger = S.ledger.slice(0, 8).map(b => {
      const t = new Date(b.atMs);
      return `<div class="slip-row"><span><b>${esc(b.game)}</b> · ${esc(labelOf(b.pkg))}</span><span class="when num">${pad(t.getHours())}:${pad(t.getMinutes())}</span><span class="delta num ${b.deltaSec > 0 ? "win" : b.deltaSec < 0 ? "loss" : ""}">${signed(b.deltaSec)}</span></div>`;
    }).join("");
    return `<div class="screen" id="screen">
      <header class="masthead"><span class="mark">Ante</span><span class="muted">${esc(date)}</span></header>
      <section class="hero">
        <p class="eyebrow">Time left today</p>
        <p class="bignum num" aria-label="${fmt(total)} left today">${fmt(total)}</p>
        <p class="muted">${S.limits.length ? `Across ${S.limits.length} ${S.limits.length === 1 ? "app" : "apps"}. Resets at midnight.` : "Add an app to give it a daily budget."}</p>
      </section>
      ${perm}
      <section class="panel" aria-labelledby="lim-h">
        <div class="panel-head"><h2 class="h3" id="lim-h">Limits</h2><button class="link" data-a="add">${ICON.plus}Add app</button></div>
        ${rows ? `<div class="limits">${rows}</div>` : `<div class="empty"><p class="muted">No limits yet. Pick an app you open too often and give it a daily budget.</p><button class="btn primary" data-a="add">Add an app</button></div>`}
      </section>
      <section class="panel slip" aria-labelledby="slip-h">
        <div class="panel-head"><h2 class="h3" id="slip-h">Bets today</h2>${S.ledger.length ? `<span class="num ${net > 0 ? "win" : net < 0 ? "loss" : "muted"}">${signed(net)}</span>` : ""}</div>
        ${ledger || `<p class="muted">No bets yet. Stake minutes at the tables.</p>`}
      </section>
    </div>`;
  }

  function vTables() {
    ensureStakeApp();
    const playable = S.limits.filter(l => l.leftSec >= 60);
    const head = BLOCK
      ? `<header class="topbar"><button class="iconbtn" data-a="toBlock" aria-label="Back to ${esc(CTX.label)}">${ICON.back}</button><div><p class="eyebrow">Playing with ${esc(CTX.label)} time</p><h1 class="h2">Tables</h1></div></header>`
      : `<header class="masthead"><span class="mark">Ante</span></header><header><h1 class="h1">Tables</h1><p class="muted">Stake minutes from an app. Wins go back to that app. Losses are gone for today.</p></header>`;
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
        <div><h1 class="h2">${g.name}</h1><p class="muted">Returns ${g.rtp} on average</p></div></header>
      <section class="felt" id="table" aria-label="${g.name} table"></section>
      <p class="result" id="result" aria-live="polite"></p>
      <section class="panel controls" id="controls"></section>
    </div>`;
  }

  function vBlock() {
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
        <button class="btn primary" data-a="openApp">Open ${label} · ${fmt(ui.openPick)}</button>
        <button class="btn quiet" data-a="toTables" ${l.leftSec < 60 ? "disabled" : ""}>Play for more time</button>
      </section>
      <button class="btn ghost" data-a="closeBlock">Not now</button>
    </div>`;
  }

  function tabbar() {
    if (BLOCK) return "";
    const on = v => (ui.view === v || (v === "tables" && ui.view === "game")) ? "page" : "false";
    return `<nav class="tabbar" aria-label="Sections">
      <button data-a="tab" data-t="today" aria-current="${on("today")}" ${ui.busy || ui.round ? "disabled" : ""}>${ICON.today}<span>Today</span></button>
      <button data-a="tab" data-t="tables" aria-current="${on("tables")}" ${ui.busy || ui.round ? "disabled" : ""}>${ICON.tables}<span>Tables</span></button></nav>`;
  }

  /* ---------- sheets ---------- */
  function vSheet() {
    const sh = ui.sheet; if (!sh) return "";
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
    const body = ui.view === "block" ? vBlock() : ui.view === "tables" ? vTables() : ui.view === "game" ? vGame() : vToday();
    $app.innerHTML = body + tabbar();
    $app.dataset.view = ui.view;
    const s2 = document.getElementById("screen"); if (s2 && keep) s2.scrollTop = keep;
    if (table && table.destroy) table.destroy();
    table = null;
    mountedKey = ui.view === "game" ? "game:" + ui.game : ui.view;
    if (ui.view === "game") { mountGame(); renderControls(); }
    paintOverlay();
  }
  function renderNav() {
    const nav = $app.querySelector(".tabbar"); if (!nav) return;
    const tmp = document.createElement("div"); tmp.innerHTML = tabbar();
    nav.replaceWith(tmp.firstElementChild);
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
    if (net > 0) { FX.burst(document.getElementById("table"), { power: multiple >= 10 ? 1.4 : 1 }); haptic("win"); }
    else if (net < 0) haptic("loss");
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
    tab(d) { ui.view = d.t; ui.game = null; render(); },
    openAcc() { ui.sheet = { type: "consent" }; paintOverlay(); },
    agreeAcc() { ui.sheet = null; paintOverlay(); A.openAccessibilitySettings(); setTimeout(() => { refresh(); render(); }, 300); },
    openInfo() { A.openAppInfo(); },
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
    closeSheet() { ui.sheet = null; paintOverlay(); },
    limStep(d) { ui.sheet.limit = Math.max(300, Math.min(14400, ui.sheet.limit + Number(d.d))); paintOverlay(); },
    limSet(d) { ui.sheet.limit = Number(d.v); paintOverlay(); },
    saveLimit() {
      const sh = ui.sheet; const existed = !!lim(sh.pkg);
      if (!A.setLimit(sh.pkg, sh.label, sh.limit)) { toast("Ante can't limit that app."); return; }
      refresh(); ui.sheet = null; render();
      toast(existed ? `${sh.label} limit set to ${fmt(sh.limit)}.` : `${sh.label} added with ${fmt(sh.limit)} a day.`);
    },
    removeLimit() { const sh = ui.sheet; A.removeLimit(sh.pkg); refresh(); ui.sheet = null; render(); toast(`${sh.label} no longer has a limit.`); },
    stakeApp(d) { ui.stakePkg = d.pkg; clampStake(); haptic("tap"); render(); },
    stake(d) { ui.stake += Number(d.d); clampStake(); haptic("tap"); ui.view === "game" ? renderControls() : render(); },
    stakeSet(d) { ui.stake = Number(d.v); clampStake(); haptic("tap"); ui.view === "game" ? renderControls() : render(); },
    game(d) { ui.game = d.id; ui.view = "game"; render(); },
    leave() { if (ui.busy || ui.round) return; ui.view = "tables"; ui.game = null; render(); },
    coinPick(d) { ui.pick = d.v; renderControls(); },
    rBet(d) { ui.bet = d.v; haptic("tap"); renderControls(); },
    rNum(d) { ui.num = (ui.num + Number(d.d) + 37) % 37; ui.bet = "num"; renderControls(); },
    coinFlip: guarded(coinFlip), rSpin: guarded(rSpin), sSpin: guarded(sSpin),
    bjDeal: guarded(bjDeal), bjHit: guarded(bjHit), bjStand: guarded(async () => { if (!ui.busy) await bjSettle(); }),
    bjDouble: guarded(bjDouble), pDeal: guarded(pDeal), pDraw: guarded(pDraw),
    pickOpen(d) { ui.openPick = Number(d.v); haptic("tap"); render(); },
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
    if (!BLOCK && ui.view === "tables") { ui.view = "today"; render(); return true; }
    return false;
  };
  window.anteRefresh = function () {
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
