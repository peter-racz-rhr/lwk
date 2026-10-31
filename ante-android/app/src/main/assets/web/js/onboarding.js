/* Onboarding: three animated story slides, then sign-in (the pill that grows into a card),
   then the one permission. Swipe or tap Continue; Skip jumps to sign-in. */
(function () {
  "use strict";
  const App = window.App;
  const { A, esc } = App;
  const ui = App.ui;
  const SLIDES = 3; // story slides before sign-in (step 3) and permission (step 4)

  const feedArt = () => `<div class="ob-phone" aria-hidden="true"><div class="ob-feed">${Array.from({ length: 8 }, (_, i) =>
    `<div class="ob-post"><i class="ob-av"></i><i class="ob-line" style="width:${40 + (i * 17) % 40}%"></i><i class="ob-img"></i></div>`).join("")}</div>
    <div class="ob-counter"><span class="eyebrow">Scrolled today</span><span class="dotnum" id="ob-count">0:00:00</span></div></div>`;
  const budgetArt = () => `<div class="ob-budget" aria-hidden="true">
    ${[["In", "#c13584", 72], ["Tk", "#0e9f99", 46], ["Yt", "#d93636", 88]].map(([m, c, w], i) => `<div class="ob-app" style="--d:${i * 0.25}s;--w:${w}%"><span class="appicon mono" style="background:${c};color:#fff">${m}</span><span class="ob-track"><i></i></span></div>`).join("")}
    <div class="ob-cover"><span class="ob-lock">${App.ICON.lock}</span><span class="dotnum">0:00</span><span class="muted">Instagram is done for today</span></div></div>`;
  const betArt = () => `<div class="ob-bet" aria-hidden="true"><div class="ob-wheel">${App.FX.GAME_ART.roulette()}</div>
    <span class="ob-chip c1">+5:00</span><span class="ob-chip c2">−1:00</span><span class="ob-chip c3">+10:00</span></div>`;

  const STORY = [
    { art: feedArt, kicker: "Ante", title: "Your feed never ends.<br>Your day does.", body: "Apps are built to keep you scrolling. Ante gives each one a daily budget of minutes." },
    { art: budgetArt, kicker: "Daily budgets", title: "When the time is up, the app is covered.", body: "Open an app that's over its limit and Ante steps in front of it. Take a breath, then choose: open it for a few minutes, or put it down." },
    { art: betArt, kicker: "The tables", title: "Want more?<br>Bet the minutes.", body: "Stake time at roulette, blackjack, slots, poker or a coin flip. The house keeps a small edge, so the more you play, the less you scroll." },
  ];

  App.views.welcome = function () {
    const step = ui.welcomeStep;
    const dots = `<div class="ob-dots" role="tablist" aria-label="Onboarding steps">${Array.from({ length: SLIDES + 2 }, (_, i) => `<i class="${i === step ? "on" : i < step ? "done" : ""}"></i>`).join("")}</div>`;
    if (step < SLIDES) {
      return `<div class="screen welcome story" id="screen">
        <div class="ob-top">${dots}<button class="link" data-a="obSkip">Skip</button></div>
        <div class="ob-stage" id="ob-stage">${STORY.map((s, i) => `
          <section class="ob-slide ${i === step ? "active" : ""}" data-k="${i}" aria-hidden="${i !== step}">
            <div class="ob-art">${s.art()}</div>
            <p class="eyebrow">${s.kicker}</p><h1 class="ob-title">${s.title}</h1><p class="muted ob-body">${s.body}</p>
          </section>`).join("")}</div>
        <button class="btn primary big ob-next" data-a="obNext"><span>${step === SLIDES - 1 ? "Get started" : "Continue"}</span></button>
      </div>`;
    }
    if (step === SLIDES) {
      return `<div class="screen welcome" id="screen">
        <div class="ob-top">${dots}</div>
        <div class="w-hero"><span class="w-logo" aria-hidden="true">${App.ICON.logo}</span><h1 class="w-title">Ante</h1>
          <p class="muted">Sign in to put your name on it, or keep going without an account. Your limits stay on this phone either way.</p></div>
        <div class="grow"></div>
        <div class="signin" id="signin" data-open="false">
          <button class="signin-pill" data-a="signinOpen" aria-expanded="false" aria-controls="signin-card">Sign in</button>
          <div class="signin-card" id="signin-card" role="dialog" aria-label="Sign in">
            <div class="sheet-head"><h2 class="h2">Sign in</h2><button class="iconbtn" data-a="signinClose" aria-label="Close">${App.ICON.close}</button></div>
            <button class="btn google" data-a="google">${App.ICON.google}Continue with Google</button>
            <div class="or"><span>or</span></div>
            <button class="btn quiet" data-a="skipSignin">Continue without an account</button>
            <p class="auth-msg" id="auth-msg" role="status"></p>
            <p class="fine">Signing in only saves your name and email on this phone.</p>
          </div>
        </div>
        <button class="btn ghost" data-a="skipSignin">Skip for now</button>
        <p class="fine center">By continuing you agree to the <button class="inline-link" data-a="doc" data-v="terms">Terms</button> and the <button class="inline-link" data-a="doc" data-v="privacy">Privacy Policy</button>.</p>
      </div>`;
    }
    return `<div class="screen welcome" id="screen">
      <div class="ob-top">${dots}</div>
      <div class="w-hero"><span class="w-logo" aria-hidden="true">${App.ICON.lock}</span><h1 class="h1">One switch to turn on</h1><p class="muted">Ante covers an app when its time is up. To do that it needs to know which app is in front.</p></div>
      <ul class="facts"><li>It only sees the name of the app you open.</li><li>It never reads your screen, what you type or your notifications.</li><li>You can switch it off any time in Settings → Accessibility.</li></ul>
      <div class="grow"></div>
      <button class="btn primary big" data-a="welcomeAcc">Turn on blocking</button>
      <button class="btn ghost" data-a="finishWelcome">Do it later</button>
    </div>`;
  };

  /* Slide 1's counter: a scroll timer that runs away from you. */
  let countTimer = null;
  App.afterWelcome = function () {
    clearInterval(countTimer);
    const el = document.getElementById("ob-count"); if (!el) return;
    let s = 0;
    countTimer = setInterval(() => {
      if (!document.body.contains(el)) { clearInterval(countTimer); return; }
      s += 37; el.textContent = `${Math.floor(s / 3600)}:${App.pad(Math.floor((s % 3600) / 60))}:${App.pad(s % 60)}`;
    }, 60);
    attachSwipe();
  };

  function goStep(n) {
    const from = ui.welcomeStep;
    ui.welcomeStep = Math.max(0, Math.min(SLIDES + 1, n));
    App.SFX.play("tap"); App.haptic("tap");
    if (from < SLIDES && ui.welcomeStep < SLIDES && stageCtl) {
      // Stay on the same DOM and glide the stage, so the change animates.
      stageCtl.go(ui.welcomeStep);
      document.querySelectorAll(".ob-dots i").forEach((d, i) => { d.className = i === ui.welcomeStep ? "on" : i < ui.welcomeStep ? "done" : ""; });
      const b = document.querySelector('[data-a="obNext"]');
      if (b) {
        const label = ui.welcomeStep === SLIDES - 1 ? "Get started" : "Continue";
        if (b.textContent !== label) { b.innerHTML = `<span class="swap">${label}</span>`; }
      }
      return;
    }
    App.render();
    const scr = document.getElementById("screen");
    if (scr && ui.welcomeStep >= SLIDES) { scr.classList.remove("enter"); void scr.offsetWidth; scr.classList.add("ob-enter"); }
  }
  App.welcomeBack = () => { if (ui.welcomeStep === 0) return false; if (ui.welcomeStep === SLIDES + 1 && App.ACC.signedIn) return true; goStep(ui.welcomeStep - 1); return true; };

  /**
   * The story stage. `pos` is a fractional slide index: the strip follows the finger, each slide's
   * art drifts slower than its text (parallax) and shrinks as it leaves, and a release springs to
   * the nearest slide (or the next one on a flick).
   */
  let stageCtl = null;
  const SWIPE_FLICK = 0.35; // px per ms
  function attachSwipe() {
    const stage = document.getElementById("ob-stage"); if (!stage) { stageCtl = null; return; }
    const slides = [...stage.querySelectorAll(".ob-slide")];
    const still = App.FX.reduced();
    let pos = ui.welcomeStep, raf = 0, drag = null;
    function paint() {
      stage.style.transform = `translate3d(${(-pos * 100).toFixed(3)}%, 0, 0)`;
      slides.forEach(sl => {
        const d = Number(sl.dataset.k) - pos, a = Math.min(1, Math.abs(d));
        sl.style.setProperty("--d", d.toFixed(3));
        sl.style.setProperty("--a", a.toFixed(3));
      });
    }
    function settle(target) {
      cancelAnimationFrame(raf);
      slides.forEach((sl, i) => { sl.classList.toggle("active", i === target); sl.setAttribute("aria-hidden", String(i !== target)); });
      if (still) { pos = target; paint(); return; }
      // Critically damped spring (stiffness 170, damping 26), stepped with the real frame time.
      const K = 170, C = 26;
      let v = 0, last = performance.now();
      const step = now => {
        const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
        v += (K * (target - pos) - C * v) * dt;
        pos += v * dt;
        if (Math.abs(target - pos) < 0.001 && Math.abs(v) < 0.01) { pos = target; paint(); return; }
        paint(); raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    stage.addEventListener("pointerdown", e => {
      if (drag) return;
      cancelAnimationFrame(raf);
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: pos, t0: performance.now(), lastX: e.clientX, lastT: performance.now(), v: 0, live: false };
    });
    stage.addEventListener("pointermove", e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.live) { if (Math.abs(dx) < 8 || Math.abs(dy) > Math.abs(dx)) return; drag.live = true; stage.setPointerCapture && stage.setPointerCapture(e.pointerId); }
      const now = performance.now();
      drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT); drag.lastX = e.clientX; drag.lastT = now;
      let p = drag.p0 - dx / stage.clientWidth;
      if (p < 0) p = p * 0.3; // rubber band at the ends
      if (p > SLIDES - 1) p = SLIDES - 1 + (p - (SLIDES - 1)) * 0.3;
      pos = p; paint();
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.live) return;
      let target = Math.round(pos);
      if (Math.abs(d.v) > SWIPE_FLICK) target = d.v < 0 ? Math.ceil(d.p0 + 0.01) : Math.floor(d.p0 - 0.01);
      target = Math.max(0, Math.min(SLIDES - 1, target));
      if (target !== ui.welcomeStep) goStep(target); else settle(target);
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    paint();
    stageCtl = { go: settle };
  }

  /* Sign-in pill that grows into the sign-in card (after Skiper UI's sign-in), and back. */
  App.morphSignin = function (open) {
    const box = document.getElementById("signin"); if (!box) return;
    const card = box.querySelector(".signin-card"), pill = box.querySelector(".signin-pill");
    const from = box.getBoundingClientRect();
    box.dataset.open = String(open);
    pill.setAttribute("aria-expanded", String(open));
    card.style.width = (box.parentElement.clientWidth - 32) + "px"; // measure at the final width
    const toH = open ? card.scrollHeight : 48;
    box.style.height = from.height + "px";
    void box.offsetWidth;
    box.style.height = toH + "px";
    if (open) { App.SFX.play("tap"); setTimeout(() => { const g = card.querySelector(".google"); if (g) g.focus(); }, 380); }
    else setTimeout(() => pill.focus(), 380);
  };

  Object.assign(App.act, {
    obNext() { goStep(ui.welcomeStep + 1); },
    obSkip() { goStep(SLIDES); },
    signinOpen() { App.morphSignin(true); },
    signinClose() { App.morphSignin(false); },
    skipSignin() { goStep(SLIDES + 1); },
    welcomeAcc() { ui.sheet = { type: "consent", fromWelcome: true }; App.paintOverlay(); },
    finishWelcome() { A.finishOnboarding(); App.refresh(); ui.view = "home"; App.render(); },
  });
  App.SLIDES = SLIDES;
})();
