/* Ante UI shell: sheets, the three-tab navigation, rendering, events, native hooks and boot.
   Screens register themselves in App.views and App.act (home.js, tables.js, profile.js, onboarding.js). */
(function () {
  "use strict";
  const App = window.App;
  const { A, esc, fmt } = App;
  const ui = App.ui;

  /* ---------- sheets ---------- */
  let waitTimer = null;
  /** A wait the native side times (30 s). Shows a countdown ring, then unlocks the action. */
  App.openWait = function (opts) {
    A.startWait();
    ui.sheet = Object.assign({ type: "wait", left: 30000 }, opts);
    clearInterval(waitTimer);
    const tick = () => {
      if (!ui.sheet || ui.sheet.type !== "wait") { clearInterval(waitTimer); return; }
      let left = Number(A.waitLeftMs());
      if (left < 0) { A.startWait(); left = 30000; } // used or expired: start a fresh wait
      ui.sheet.left = left;
      const n = document.getElementById("wait-n"), b = document.getElementById("wait-go"), ring = document.getElementById("wait-ring");
      if (n) n.textContent = Math.ceil(left / 1000);
      if (ring) ring.style.setProperty("--p", String(1 - left / 30000));
      if (b) b.disabled = left > 0;
      if (left <= 0) clearInterval(waitTimer);
    };
    App.paintOverlay(); tick();
    waitTimer = setInterval(tick, 250);
  };

  const sheet = (label, body, labelledby) => `<div class="scrim" data-a="closeSheet"><div class="sheet" role="dialog" aria-modal="true" ${labelledby ? `aria-labelledby="${labelledby}"` : `aria-label="${esc(label)}"`} data-stop><span class="grabber" aria-hidden="true"></span>${body}</div></div>`;
  const head = (title, id) => `<div class="sheet-head"><h2 class="h2" id="${id || ""}">${esc(title)}</h2><button class="iconbtn" data-a="closeSheet" aria-label="Close">${App.ICON.close}</button></div>`;

  function vSheet() {
    const sh = ui.sheet; if (!sh) return "";
    if (sh.type === "wait") return sheet("", `${head(sh.title, "wait-h")}
        <div class="wait"><div class="wait-ring" id="wait-ring" style="--p:${1 - sh.left / 30000}"><span class="dotnum" id="wait-n">${Math.ceil(sh.left / 1000)}</span></div><p class="muted">${esc(sh.body)}</p></div>
        <button class="btn primary" id="wait-go" data-a="waitCta" ${sh.left > 0 ? "disabled" : ""}>${esc(sh.cta)}</button>`, "wait-h");
    if (sh.type === "strict") return sheet("", `${head("Turn on Strict mode", "strict-s")}
        <ul class="facts"><li>Opening Settings shows a block screen. After a 30-second wait you get 2 minutes, then it is covered again.</li>
          <li>The Play Store opens the same way. The install and uninstall screen stays covered until Strict mode is off.</li>
          <li>Turning Strict mode off takes the same 30-second wait.</li>
          <li>Quick settings in the notification shade keep working, so Wi-Fi, flashlight and emergency calls are never locked.</li></ul>
        <div class="btn-row"><button class="btn quiet" data-a="closeSheet">Not now</button><button class="btn primary" data-a="agreeStrict">Turn on</button></div>`, "strict-s");
    if (sh.type === "consent") return sheet("", `${head("Before you switch it on", "consent-h")}
        <p>Ante uses Android's Accessibility service to see <b>which app is in front</b>, so it can cover apps that are over their limit.</p>
        <ul class="facts"><li>It only sees the name of the app you open.</li><li>It does not read what is on your screen, what you type or your notifications.</li><li>Nothing leaves your phone. Ante has no internet permission.</li></ul>
        <p class="muted">You can switch it off any time in Settings → Accessibility.</p>
        <div class="btn-row"><button class="btn quiet" data-a="closeSheet">Not now</button><button class="btn primary" data-a="agreeAcc">I agree, open Settings</button></div>`, "consent-h");
    if (sh.type === "pick") {
      const q = (sh.q || "").toLowerCase();
      const list = (sh.apps || []).filter(a => !App.lim(a.pkg) && (!q || a.label.toLowerCase().includes(q)));
      const body = sh.apps == null ? `<p class="muted">Loading your apps…</p>`
        : list.length ? list.map(a => `<button class="limit pick" data-a="pickApp" data-pkg="${esc(a.pkg)}">${a.icon ? `<img class="appicon" src="${esc(a.icon)}" alt="" width="44" height="44">` : `<span class="appicon mono">${esc(a.label.slice(0, 2))}</span>`}<span class="meta"><span class="name">${esc(a.label)}</span></span>${App.ICON.chev}</button>`).join("")
          : `<p class="muted">${q ? "No app matches that name." : "Every app already has a limit."}</p>`;
      return sheet("Add an app", `${head("Add an app")}
        <input class="search" id="app-search" type="search" placeholder="Search apps" autocomplete="off" value="${esc(sh.q || "")}">
        <div class="pick-list" id="pick-list">${body}</div>`);
    }
    const l = App.lim(sh.pkg);
    return sheet(`${sh.label} limit`, `<div class="sheet-head">${App.appIcon(sh.pkg)}<div class="grow"><h2 class="h2">${esc(sh.label)}</h2><p class="muted">${l ? `<span class="num">${fmt(l.leftSec)}</span> left today` : "New limit"}</p></div>
        <button class="iconbtn" data-a="closeSheet" aria-label="Close">${App.ICON.close}</button></div>
      <p class="eyebrow">Daily limit</p>
      <div class="stake-row">
        <button class="step" data-a="limStep" data-d="-300" aria-label="Five minutes less" ${sh.limit <= 300 ? "disabled" : ""}>−</button>
        <output class="stake-val"><span class="dotnum">${fmt(sh.limit)}</span></output>
        <button class="step" data-a="limStep" data-d="300" aria-label="Five minutes more" ${sh.limit >= 14400 ? "disabled" : ""}>+</button>
      </div>
      <div class="chips">${[[900, "15 min"], [1200, "20 min"], [1800, "30 min"], [3600, "1 hour"]].map(([v, t]) => `<button class="chip" data-a="limSet" data-v="${v}" aria-pressed="${sh.limit === v}">${t}</button>`).join("")}</div>
      ${l && sh.limit > l.limitSec ? `<p class="muted">The extra ${fmt(sh.limit - l.limitSec)} starts tomorrow. Cuts apply straight away.</p>` : ""}
      <div class="btn-row">${l ? `<button class="btn danger" data-a="removeLimit">Remove limit</button>` : ""}<button class="btn primary" data-a="saveLimit">${l ? "Save" : "Add limit"}</button></div>`);
  }

  /** Fetches picker icons a few at a time so the list appears at once. */
  function loadIcons(list) {
    let i = 0;
    const step = () => {
      if (!ui.sheet || ui.sheet.type !== "pick") return;
      for (const end = Math.min(i + 6, list.length); i < end; i++) {
        const a = list[i];
        if (a.icon) continue;
        try { a.icon = A.icon(a.pkg) || ""; } catch (e) { a.icon = ""; }
        App.iconCache[a.pkg] = a.icon;
        const el = a.icon && document.querySelector(`.pick-list [data-pkg="${CSS.escape(a.pkg)}"] .appicon.mono`);
        if (el) { const img = new Image(44, 44); img.className = "appicon"; img.alt = ""; img.src = a.icon; el.replaceWith(img); }
      }
      if (i < list.length) setTimeout(step, 16);
    };
    step();
  }
  let sheetShown = false;
  App.paintOverlay = function () {
    const focusSearch = document.activeElement && document.activeElement.id === "app-search";
    const caret = focusSearch ? document.activeElement.selectionStart : null;
    const wasShown = sheetShown;
    App.$overlay.innerHTML = vSheet() + (ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : "");
    sheetShown = !!ui.sheet;
    if (sheetShown && wasShown) App.$overlay.querySelector(".scrim").classList.add("still"); // no re-entry animation on updates
    if (focusSearch) { const s = document.getElementById("app-search"); if (s) { s.focus(); try { s.setSelectionRange(caret, caret); } catch (e) { /* type=search */ } } }
  };

  /* ---------- navigation: three tabs, with an indicator that glides to the active one ---------- */
  const TABS = [["home", "Home", "home"], ["tables", "Play", "play"], ["profile", "Profile", "user"]];
  const TAB_OF = { home: "home", screentime: "home", results: "home", tables: "tables", game: "tables", profile: "profile", legal: "profile" };
  let indX = null, tipUntil = 0;
  function navbar() {
    if (App.BLOCK || ui.view === "welcome" || (ui.view === "legal" && ui.back === "welcome")) return "";
    const S = App.S, cur = TAB_OF[ui.view] || "home";
    const care = !S.accessibility || !S.watching || S.batteryOk === false;
    const lock = ui.busy || ui.round ? "disabled" : "";
    return `<nav class="navpill" aria-label="Sections"><span class="nav-ind" aria-hidden="true"></span><span class="navtip" aria-hidden="true"></span>${TABS.map(([t, l, ic]) =>
      `<button data-a="tab" data-t="${t}" aria-label="${l}" aria-current="${cur === t ? "page" : "false"}" ${lock}>${App.ICON[ic]}${t === "profile" && care ? '<i class="ndot"></i>' : ""}</button>`).join("")}</nav>`;
  }
  function placeNav(hover) {
    const nav = App.$app.querySelector(".navpill"); if (!nav) return;
    const active = nav.querySelector('[aria-current="page"]'), ind = nav.querySelector(".nav-ind"), tip = nav.querySelector(".navtip");
    if (active && ind) {
      const x = active.offsetLeft;
      if (indX != null && indX !== x) { ind.style.transition = "none"; ind.style.transform = `translateX(${indX}px)`; void ind.offsetWidth; ind.style.transition = ""; }
      ind.style.transform = `translateX(${x}px)`; ind.style.width = active.offsetWidth + "px"; indX = x;
    }
    const t = hover || active;
    if (t && tip) {
      tip.textContent = t.getAttribute("aria-label");
      tip.style.left = (t.offsetLeft + t.offsetWidth / 2) + "px";
      tip.classList.toggle("show", !!hover || Date.now() < tipUntil);
    }
  }
  App.renderNav = function () {
    const nav = App.$app.querySelector(".navpill"); if (!nav) return;
    const tmp = document.createElement("div"); tmp.innerHTML = navbar();
    if (tmp.firstElementChild) nav.replaceWith(tmp.firstElementChild);
    placeNav();
    const back = App.$app.querySelector('[data-a="leave"]'); if (back) back.disabled = !!(ui.busy || ui.round);
  };

  /* ---------- render ---------- */
  let mountedKey = null;
  App.render = function () {
    if (ui.view === "game" && mountedKey === "game:" + ui.game) { App.renderControls(); App.paintOverlay(); return; }
    const scroller = document.getElementById("screen");
    const same = mountedKey === ui.view, keep = scroller && same ? scroller.scrollTop : 0;
    const view = App.views[ui.view] || App.views.home;
    App.unmountGame();
    App.$app.innerHTML = view() + navbar();
    App.$app.dataset.view = ui.view;
    App.$app.classList.remove("focusing");
    const s2 = document.getElementById("screen");
    if (s2) { if (keep) s2.scrollTop = keep; if (!same) s2.classList.add("enter"); }
    mountedKey = ui.view === "game" ? "game:" + ui.game : ui.view;
    placeNav();
    App.fitText();
    if (ui.view === "game") { App.mountGame(); App.renderControls(); }
    if (ui.view === "tables") App.afterTables();
    if (ui.view === "welcome") App.afterWelcome();
    App.paintOverlay();
  };

  /* ---------- shared actions ---------- */
  Object.assign(App.act, {
    tab(d) {
      if (ui.busy || ui.round) return;
      tipUntil = Date.now() + 1100;
      ui.view = d.t; ui.game = null; App.haptic("tap");
      App.render();
      setTimeout(() => placeNav(), 1150);
    },
    add() {
      ui.sheet = { type: "pick", apps: null, q: "" }; App.paintOverlay();
      setTimeout(() => { if (ui.sheet && ui.sheet.type === "pick") { ui.sheet.apps = A.apps(); App.paintOverlay(); loadIcons(ui.sheet.apps); } }, 30);
    },
    pickApp(d) {
      const a = (ui.sheet.apps || []).find(x => x.pkg === d.pkg); if (!a) return;
      App.iconCache[a.pkg] = a.icon;
      ui.sheet = { type: "edit", pkg: a.pkg, label: a.label, limit: 1800 }; App.paintOverlay();
    },
    edit(d) { const l = App.lim(d.pkg); ui.sheet = { type: "edit", pkg: l.pkg, label: l.label, limit: l.limitSec }; App.paintOverlay(); },
    closeSheet() { ui.sheet = null; clearInterval(waitTimer); App.paintOverlay(); },
    limStep(d) { ui.sheet.limit = Math.max(300, Math.min(14400, ui.sheet.limit + Number(d.d))); App.chipFx(); App.paintOverlay(); },
    limSet(d) { ui.sheet.limit = Number(d.v); App.chipFx(); App.paintOverlay(); },
    saveLimit() {
      const sh = ui.sheet, existed = !!App.lim(sh.pkg);
      if (!A.setLimit(sh.pkg, sh.label, sh.limit)) { App.toast("Ante can't limit that app."); return; }
      App.refresh(); ui.sheet = null; App.render();
      App.toast(existed ? `${sh.label} limit set to ${fmt(sh.limit)}.` : `${sh.label} added with ${fmt(sh.limit)} a day.`);
    },
    removeLimit() { const sh = ui.sheet; A.removeLimit(sh.pkg); App.refresh(); ui.sheet = null; App.render(); App.toast(`${sh.label} no longer has a limit.`); },
    waitCta() { const t = ui.sheet && ui.sheet.then; if (t && App.act[t] && ui.sheet.left <= 0) App.act[t](); },
  });

  /* ---------- events ---------- */
  function onClick(e) {
    const el = e.target.closest("[data-a]");
    if (!el || el.disabled) return;
    if (el.classList.contains("scrim") && e.target.closest("[data-stop]")) return;
    const fn = App.act[el.dataset.a];
    if (fn) fn(el.dataset, el);
  }
  App.$app.addEventListener("click", onClick);
  App.$overlay.addEventListener("click", onClick);
  App.$app.addEventListener("keydown", e => { // role="button" cards
    if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"][data-a]')) { e.preventDefault(); onClick(e); }
  });
  App.$app.addEventListener("pointerover", e => { const b = e.target.closest(".navpill button"); if (b && e.pointerType === "mouse") placeNav(b); });
  App.$app.addEventListener("pointerout", e => { const b = e.target.closest(".navpill button"); if (b && e.pointerType === "mouse") placeNav(); });
  App.$app.addEventListener("input", e => { if (e.target.id === "stake-slider") App.onStakeSlider(e.target); });
  App.$overlay.addEventListener("input", e => { if (e.target.id === "app-search" && ui.sheet) { ui.sheet.q = e.target.value; App.paintOverlay(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape") window.anteBack(); });
  window.addEventListener("resize", () => { App.fitText(); placeNav(); });

  /* ---------- hooks for the native shell ---------- */
  window.anteBack = function () {
    if (ui.sheet) { ui.sheet = null; App.paintOverlay(); return true; }
    if (ui.view === "game") { if (!ui.busy && !ui.round) { ui.view = "tables"; ui.game = null; App.render(); } return true; }
    if (ui.view === "legal") { App.act.legalBack(); return true; }
    if (ui.view === "screentime" || ui.view === "results") { ui.view = "home"; App.render(); return true; }
    if (App.BLOCK && ui.view === "tables") { ui.view = "block"; App.render(); return true; }
    if (!App.BLOCK && (ui.view === "tables" || ui.view === "profile")) { ui.view = "home"; App.render(); return true; }
    if (ui.view === "welcome") {
      if (document.querySelector('#signin[data-open="true"]')) { App.morphSignin(false); return true; }
      return App.welcomeBack();
    }
    return false;
  };
  /** Result of Google sign-in from the native side (a JSON string). */
  window.anteAuth = function (raw) {
    let r; try { r = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { r = { ok: false, message: "Sign-in failed." }; }
    App.refresh();
    if (r && r.ok) {
      App.toast(`Signed in as ${r.name || r.email}.`);
      if (ui.view === "welcome") ui.welcomeStep = App.SLIDES + 1;
      App.render();
    } else {
      const msg = document.getElementById("auth-msg"), text = (r && r.message) || "Sign-in failed.";
      if (msg) msg.textContent = r && r.error === "cancelled" ? "" : text; else App.toast(text);
    }
  };
  window.anteRefresh = function () {
    if (App.BLOCK && ui.view === "block") App.startBreath();
    if (ui.busy || ui.round) return;
    App.refresh();
    if (ui.view === "game") App.renderControls(); else App.render();
  };

  /* ---------- boot ---------- */
  const start = () => { App.ensureStakeApp(); App.startBreath(); App.render(); };
  if (document.fonts && document.fonts.ready) {
    let done = false; const go = () => { if (!done) { done = true; start(); } };
    document.fonts.ready.then(go); setTimeout(go, 400);
  } else start();
})();
