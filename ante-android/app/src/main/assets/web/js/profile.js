/* Profile: account, appearance (themes), settings, blocking health, Strict mode, support, legal. */
(function () {
  "use strict";
  const App = window.App;
  const { A, esc } = App;
  const ui = App.ui;
  const KOFI = "https://ko-fi.com/peteracz";

  function themeCards() {
    const P = App.P, cur = P.get();
    return `<div class="themes" role="radiogroup" aria-label="Theme">${Object.entries(P.FLAVORS).map(([id, f]) => `
      <button class="theme" role="radio" aria-checked="${cur.theme === id}" data-a="theme" data-v="${id}" style="--t-bg:${f.c.mantle};--t-s:${f.c.base};--t-l:${f.c.s1};--t-x:${f.c.text}">
        <span class="t-prev" aria-hidden="true"><i></i><i></i><i></i></span><span class="t-name">${esc(f.name)}</span></button>`).join("")}</div>
      <div class="accents" role="radiogroup" aria-label="Accent colour">${Object.entries(P.ACCENTS[cur.theme]).map(([id, hex]) => `
        <button class="accent" role="radio" aria-checked="${cur.accent === id}" aria-label="${esc(id)}" data-a="accent" data-v="${id}" style="--a:${hex}"></button>`).join("")}</div>`;
  }

  App.views.profile = function () {
    const S = App.S, ACC = App.ACC, prefs = App.P.get(), name = App.displayName();
    const row = (label, value, tone, go, cta) => `<div class="srow"><span class="srow-l">${label}</span><span class="pill ${tone}"><i></i>${value}</span>${go ? `<button class="btn-sm" data-a="settingsGo" data-go="${go}">${cta}</button>` : ""}</div>`;
    const doc = (id, title) => `<button class="lrow-btn" data-a="doc" data-v="${id}">${App.ICON.doc}<span>${title}</span>${App.ICON.chev}</button>`;
    return `<div class="screen" id="screen">
      <header><h1 class="h1">Profile</h1></header>
      <section class="panel profile-card" aria-labelledby="acc-h">
        <div class="acct"><span class="avatar lg" aria-hidden="true">${esc(App.initials(name))}</span>
          <div class="acct-m"><h2 class="h3" id="acc-h">${esc(name || "Your name")}</h2><p class="muted">${ACC.signedIn ? esc(ACC.email) : "Not signed in. Your limits work without an account."}</p></div></div>
        <label class="field"><span class="eyebrow">Display name</span><input id="name-input" class="search" type="text" maxlength="40" autocomplete="nickname" placeholder="${esc(ACC.name || "Add a name")}" value="${esc(prefs.name)}"></label>
        ${ACC.signedIn ? `<button class="btn quiet" data-a="signOut">Sign out of Google</button>` : `<button class="btn google" data-a="google">${App.ICON.google}Sign in with Google</button><p class="auth-msg" id="auth-msg" role="status"></p>`}
      </section>

      <section class="panel" aria-labelledby="ap-h">
        <div><h2 class="h3" id="ap-h">Appearance</h2><p class="muted">Neutral, or one of the four Catppuccin flavours.</p></div>
        ${themeCards()}
      </section>

      <section class="panel" aria-labelledby="set-h">
        <h2 class="h3" id="set-h">Settings</h2>
        <div class="srows">
          <div class="srow"><span class="srow-l">Sound effects</span>${App.toggle("sound", !App.SFX.muted, "Sound effects")}</div>
          <div class="srow"><span class="srow-l">Vibration</span>${App.toggle("haptics", prefs.haptics, "Vibration")}</div>
        </div>
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
        <div class="panel-head"><h2 class="h3" id="strict-h">${App.ICON.lock} Strict mode</h2>${App.toggle(S.strict ? "strictOff" : "strictOn", S.strict, "Strict mode")}</div>
        <p class="muted">${S.strict ? "Settings and uninstalling are covered. Getting in, or turning this off, takes a 30-second wait." : "Covers Settings and the uninstall screen too, so blocking can't be switched off on impulse."}</p>
      </section>`}

      <section class="panel support" aria-labelledby="kofi-h">
        <div class="support-row"><span class="support-ic" aria-hidden="true">${App.ICON.coffee}</span>
          <div><h2 class="h3" id="kofi-h">Support Ante</h2><p class="muted">Ante is free and has no ads. If it helps you, you can buy me a coffee.</p></div></div>
        <button class="btn quiet" data-a="kofi">Tip on Ko-fi</button>
      </section>

      <section class="panel" aria-labelledby="lg-h">
        <h2 class="h3" id="lg-h">Legal</h2>
        <div class="lrows">${doc("terms", "Terms of Service")}${doc("privacy", "Privacy Policy")}${doc("imprint", "Imprint")}</div>
      </section>

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
      <p class="fine center">${versionLine()} · No real money · Your limits and history stay on this phone.</p>
    </div>`;
  };

  /** "Ante 0.1.0 · UI update 2026-10-31 14:52", so it's easy to see an update has landed. */
  function versionLine() {
    const v = (A.versions && A.versions()) || {};
    const app = v.app ? `Ante ${esc(v.app)}` : "Ante";
    if (!v.web) return `${app} · built-in UI`;
    const d = new Date(Number(v.web) * 1000);
    const stamp = isNaN(d) ? String(v.web) : `${d.getFullYear()}-${App.pad(d.getMonth() + 1)}-${App.pad(d.getDate())} ${App.pad(d.getHours())}:${App.pad(d.getMinutes())}`;
    return `${app} · UI update ${esc(stamp)}`;
  }

  App.views.legal = function () {
    const d = App.L.DOCS[ui.doc] || App.L.DOCS.terms;
    return `<div class="screen legal" id="screen">
      <header class="topbar">${App.backBtn("legalBack", "Back")}<div class="grow"><h1 class="h2">${esc(d.title)}</h1></div></header>
      <p class="muted">${esc(d.intro)}</p>
      ${d.sections.map(([h, body]) => `<section class="doc-sec"><h2 class="h3">${esc(h)}</h2><p>${body}</p></section>`).join("")}
      <p class="fine">Contact: ${esc(App.L.EMAIL)} · ${esc(App.L.PHONE)}</p>
      <button class="btn quiet" data-a="mail">Email ${esc(App.L.OWNER)}</button>
    </div>`;
  };

  /* Opens Settings shortcuts; in Strict mode they need the 30-second wait first. */
  const SETTINGS = { acc: () => A.openAccessibilitySettings(), battery: () => A.openBatterySettings(), date: () => A.openDateSettings(), info: () => A.openAppInfo() };

  Object.assign(App.act, {
    theme(d) { App.P.set({ theme: d.v }); App.SFX.play("tap"); App.render(); },
    accent(d) { App.P.set({ accent: d.v }); App.SFX.play("tap"); App.render(); },
    haptics() { App.P.set({ haptics: !App.P.get().haptics }); App.haptic("tap"); App.render(); },
    sound() {
      App.SFX.toggle();
      if (ui.view === "profile") { App.render(); return; }
      document.querySelectorAll('[data-a="sound"].iconbtn').forEach(b => { const t = document.createElement("div"); t.innerHTML = App.soundBtn(); b.replaceWith(t.firstElementChild); });
    },
    doc(d) { ui.back = ui.view; ui.doc = d.v; ui.view = "legal"; App.render(); },
    legalBack() { ui.view = ui.back || "profile"; ui.back = null; App.render(); },
    kofi() { if (A.openLink(KOFI) === false) App.toast("Ko-fi: " + KOFI); },
    mail() { A.openLink("mailto:" + App.L.EMAIL); },
    signOut() { A.signOut(); App.refresh(); App.render(); App.toast("Signed out. Your limits are still here."); },
    google() {
      const msg = document.getElementById("auth-msg"); if (msg) msg.textContent = "Opening Google…";
      A.signInWithGoogle();
    },
    openAcc() { ui.sheet = { type: "consent" }; App.paintOverlay(); },
    agreeAcc() {
      const fromWelcome = ui.sheet && ui.sheet.fromWelcome;
      ui.sheet = null; App.paintOverlay();
      if (fromWelcome) { A.finishOnboarding(); ui.view = "home"; }
      if (A.openAccessibilitySettings() === false) { App.act.settingsGo({ go: "acc" }); return; }
      setTimeout(() => { App.refresh(); App.render(); }, 300);
    },
    openInfo() { App.act.settingsGo({ go: "info" }); },
    strictOn() { ui.sheet = { type: "strict" }; App.paintOverlay(); },
    agreeStrict() { A.setStrict(true); App.refresh(); ui.sheet = null; App.render(); App.toast("Strict mode is on."); },
    strictOff() { App.openWait({ title: "Turn off Strict mode", body: "Wait 30 seconds. If you still want to turn it off after that, you can.", cta: "Turn off Strict mode", then: "strictOffNow" }); },
    strictOffNow() { if (!A.setStrict(false)) { App.toast("The wait isn't over yet."); return; } App.refresh(); ui.sheet = null; App.render(); App.toast("Strict mode is off."); },
    settingsGo(d) {
      const go = SETTINGS[d.go]; if (!go) return;
      if (App.S.strict) { App.openWait({ title: "Settings is behind Strict mode", body: "Wait 30 seconds to open it.", cta: "Open Settings", then: "settingsNow", go: d.go }); return; }
      go(); setTimeout(() => { App.refresh(); App.render(); }, 300);
    },
    settingsNow() {
      const fn = SETTINGS[ui.sheet && ui.sheet.go];
      if (fn && fn() === false) { App.toast("The wait isn't over yet."); return; }
      ui.sheet = null; App.paintOverlay();
    },
    guardWait() { App.openWait({ title: "Open Settings", body: "Settings opens for 2 minutes after the wait.", cta: "Open Settings", then: "guardOpen" }); },
    guardOpen() { if (A.openGuarded(App.CTX.pkg) === false) { App.toast("The wait isn't over yet."); return; } ui.sheet = null; App.paintOverlay(); },
  });

  /* Display name saves as you type (no network; local only). */
  document.addEventListener("input", e => {
    if (e.target.id !== "name-input") return;
    App.P.set({ name: e.target.value });
    const h = document.getElementById("acc-h"), av = document.querySelector(".profile-card .avatar");
    if (h) h.textContent = App.displayName() || "Your name";
    if (av) av.textContent = App.initials(App.displayName());
  });
})();
