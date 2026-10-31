/* window.Ante: one API for the UI. On the phone it calls the Kotlin bridge (window.AnteNative).
   In a desktop browser it runs a mock with the same rules, so the whole UI can be tested there.
   Mock options in the URL: ?mode=block&pkg=com.instagram.android&acc=1&note=Session%20over. */
(function () {
  "use strict";
  const N = window.AnteNative;

  function parse(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }

  if (N) {
    window.Ante = {
      native: true,
      state: () => parse(N.state(), { limits: [], ledger: [] }),
      context: () => parse(N.context(), { mode: "main" }),
      apps: () => parse(N.apps(), []),
      icon: pkg => N.icon(pkg),
      setLimit: (pkg, label, sec) => N.setLimit(pkg, label, sec | 0),
      removeLimit: pkg => N.removeLimit(pkg),
      bet: (pkg, sec) => N.bet(pkg, sec | 0),
      settle: (pkg, game, stake, ret) => N.settle(pkg, game, stake | 0, Math.round(ret)),
      open: (pkg, sec) => N.open(pkg, sec | 0),
      closeBlock: () => N.closeBlock(),
      openAnte: () => N.openAnte(),
      openAccessibilitySettings: () => N.openAccessibilitySettings(),
      openAppInfo: () => N.openAppInfo(),
      haptic: kind => { try { N.haptic(kind); } catch (e) { /* older bridge */ } },
      startWait: () => N.startWait(),
      waitLeftMs: () => Number(N.waitLeftMs()),
      setStrict: on => N.setStrict(!!on),
      openGuarded: pkg => N.openGuarded(pkg),
      openBatterySettings: () => N.openBatterySettings(),
      openDateSettings: () => N.openDateSettings(),
    };
    return;
  }

  /* ---------------- browser mock ---------------- */
  const KEY = "ante-mock-v2";
  const q = new URLSearchParams(location.search);
  const HUES = ["#C13584", "#0E9F99", "#D93636", "#5B6472", "#F0601F", "#C9A400", "#2E9E5B", "#2F7FD8", "#7A5AF8", "#B4654A"];
  const SAMPLE_APPS = [
    ["com.instagram.android", "Instagram"], ["com.zhiliaoapp.musically", "TikTok"], ["com.google.android.youtube", "YouTube"],
    ["com.twitter.android", "X"], ["com.reddit.frontpage", "Reddit"], ["com.snapchat.android", "Snapchat"],
    ["com.whatsapp", "WhatsApp"], ["com.google.android.apps.maps", "Maps"], ["com.netflix.mediaclient", "Netflix"],
    ["com.spotify.music", "Spotify"],
  ];
  function monogram(label, hue) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="${hue}"/><text x="48" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="40" fill="#fff">${label.slice(0, 2)}</text></svg>`;
    return "data:image/svg+xml;base64," + btoa(svg);
  }
  const apps = SAMPLE_APPS.map(([pkg, label], i) => ({ pkg, label, icon: monogram(label, HUES[i % HUES.length]) }));
  const today = () => new Date().toISOString().slice(0, 10);

  function fresh() {
    const now = Date.now();
    return {
      day: today(),
      accessibility: q.get("acc") === "1",
      limits: [
        { pkg: "com.instagram.android", label: "Instagram", limitSec: 1200, leftSec: 840 },
        { pkg: "com.zhiliaoapp.musically", label: "TikTok", limitSec: 1800, leftSec: 1800 },
        { pkg: "com.google.android.youtube", label: "YouTube", limitSec: 2700, leftSec: 1520 },
      ],
      ledger: [
        { game: "Coin flip", pkg: "com.instagram.android", deltaSec: 270, atMs: now - 3600e3 },
        { game: "Roulette", pkg: "com.google.android.youtube", deltaSec: -300, atMs: now - 7200e3 },
      ],
      session: null,
      parked: {},
      strict: false,
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !Array.isArray(S.limits) || q.get("reset") === "1") S = fresh();
  if (q.get("acc") === "1") S.accessibility = true;
  if (S.day !== today()) { S.day = today(); S.limits.forEach(l => { l.leftSec = l.limitSec; }); S.ledger = []; S.parked = {}; }
  const open = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
  const lim = pkg => S.limits.find(l => l.pkg === pkg);
  const ctx = { mode: q.get("mode") === "block" ? "block" : "main", pkg: q.get("pkg") || null, note: q.get("note") || null };
  const WAIT = q.get("wait") === "1" ? 1000 : 30000;
  let waitStart = 0;
  const say = msg => window.dispatchEvent(new CustomEvent("ante-mock", { detail: msg }));

  window.Ante = {
    native: false,
    resetMock: () => { S = fresh(); save(); },
    state: () => JSON.parse(JSON.stringify(Object.assign({ watching: true, autoTime: true, batteryOk: q.get("battery") !== "0" }, S, { now: Date.now() }))),
    context: () => {
      if (ctx.mode !== "block" || !ctx.pkg) return { mode: ctx.mode, platform: "browser" };
      const a = apps.find(x => x.pkg === ctx.pkg);
      return { mode: "block", platform: "browser", pkg: ctx.pkg, label: a ? a.label : ctx.pkg, icon: a ? a.icon : "", note: ctx.note };
    },
    apps: () => apps.slice(),
    icon: pkg => (apps.find(a => a.pkg === pkg) || {}).icon || "",
    // Same rules as TimeBank.setLimit: cuts apply now, raises from tomorrow, removed limits remember their time.
    setLimit(pkg, label, sec) {
      sec = Math.max(60, Math.min(86400, sec | 0));
      S.parked = S.parked || {};
      const l = lim(pkg);
      if (l) { l.leftSec = Math.max(0, l.leftSec - Math.max(0, l.limitSec - sec)); l.limitSec = sec; l.label = label; }
      else S.limits.push({ pkg, label, limitSec: sec, leftSec: pkg in S.parked ? Math.min(sec, S.parked[pkg]) : sec });
      delete S.parked[pkg];
      save(); return true;
    },
    removeLimit(pkg) {
      const l = lim(pkg); if (!l) return true;
      S.parked = S.parked || {}; S.parked[pkg] = Math.min(l.leftSec, l.limitSec);
      S.limits = S.limits.filter(x => x.pkg !== pkg); save(); return true;
    },
    bet(pkg, sec) {
      const l = lim(pkg); sec |= 0;
      if (!l || sec <= 0 || sec > l.leftSec) return false;
      l.leftSec -= sec; open[pkg] = (open[pkg] || 0) + sec; save(); return true;
    },
    settle(pkg, game, stake, ret) {
      const l = lim(pkg); stake |= 0;
      if (!l || stake <= 0 || stake > (open[pkg] || 0)) return -2147483648;
      open[pkg] -= stake;
      ret = Math.max(0, Math.min(Math.round(ret), stake * 100));
      l.leftSec += ret;
      S.ledger.unshift({ game, pkg, deltaSec: ret - stake, atMs: Date.now() });
      S.ledger = S.ledger.slice(0, 50); save();
      return ret - stake;
    },
    open(pkg, sec) {
      const l = lim(pkg); sec |= 0;
      if (!l || sec <= 0 || sec > l.leftSec) return false;
      l.leftSec -= sec; save();
      say(`Opens ${l.label} for ${Math.round(sec / 60)} min`);
      return true;
    },
    closeBlock: () => say("Goes to the home screen"),
    openAnte: () => say("Opens Ante"),
    openAccessibilitySettings: () => {
      if (S.strict && !(waitStart && Date.now() - waitStart >= WAIT)) return false;
      waitStart = 0; S.accessibility = true; save(); say("Opens Accessibility settings (mock: switched on)"); return true;
    },
    openAppInfo: () => { say("Opens Ante's App info page"); return true; },
    haptic: () => {},
    // Strict mode. ?wait=1 shortens the 30 s wait to 1 s for tests.
    startWait: () => { waitStart = Date.now(); },
    waitLeftMs: () => Math.max(0, waitStart + WAIT - Date.now()),
    setStrict(on) {
      if (!on && S.strict && !(waitStart && Date.now() - waitStart >= WAIT)) return false;
      S.strict = !!on; waitStart = 0; save(); return true;
    },
    openGuarded(pkg) { if (!(waitStart && Date.now() - waitStart >= WAIT)) return false; waitStart = 0; say("Opens Settings for 2 minutes"); return true; },
    openBatterySettings: () => { say("Opens battery optimization"); S.batteryOk = true; save(); return true; },
    openDateSettings: () => { say("Opens Date & time"); return true; },
  };
})();
