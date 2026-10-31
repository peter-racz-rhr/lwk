/* Tables: the table list, the stake control, each game's flow, focus mode, and the block screen. */
(function () {
  "use strict";
  const App = window.App;
  const { A, G, FX, esc, fmt, signed } = App;
  const ui = App.ui;
  let table = null; // mounted game controller

  /* ---------- stake ---------- */
  const stakeLimit = () => App.lim(ui.stakePkg);
  App.ensureStakeApp = function () {
    if (App.BLOCK) { ui.stakePkg = App.CTX.pkg; return; }
    const cur = stakeLimit();
    if (cur && cur.leftSec >= 60) return;
    const best = App.S.limits.filter(l => l.leftSec >= 60).sort((a, b) => b.leftSec - a.leftSec)[0];
    ui.stakePkg = best ? best.pkg : (App.S.limits[0] || {}).pkg || null;
  };
  function clampStake() {
    const l = stakeLimit(); if (!l) return;
    ui.stake = Math.max(60, Math.min(ui.stake, Math.max(60, Math.floor(l.leftSec / 60) * 60)));
  }
  const canStake = extra => { const l = stakeLimit(); return !!l && l.leftSec >= (extra || ui.stake) && ui.stake >= 60; };

  /** Stake readout with −/+, a slider and quick picks. */
  function stakeBox(locked) {
    const l = stakeLimit(); if (!l) return "";
    clampStake();
    const maxMin = Math.max(1, Math.floor(l.leftSec / 60)), allIn = maxMin * 60;
    const presets = [[60, "1 min"], [300, "5 min"], [600, "10 min"], [allIn, "All in"]];
    const dis = locked ? "disabled" : "";
    const pct = maxMin > 1 ? ((ui.stake / 60 - 1) / (maxMin - 1)) * 100 : 100;
    return `<div class="stakebox">
      <div class="stake-head"><span class="eyebrow">Stake</span><span class="muted">from ${esc(l.label)} · <span class="num">${fmt(l.leftSec)}</span> left</span></div>
      <div class="stake-row">
        <button class="step" data-a="stake" data-d="-60" aria-label="One minute less" ${dis || (ui.stake <= 60 ? "disabled" : "")}>−</button>
        <output class="stake-val" id="stake-val" aria-live="polite"><span class="dotnum">${fmt(ui.stake)}</span></output>
        <button class="step" data-a="stake" data-d="60" aria-label="One minute more" ${dis || (ui.stake + 60 > l.leftSec ? "disabled" : "")}>+</button>
      </div>
      <input class="slider" id="stake-slider" type="range" min="1" max="${maxMin}" step="1" value="${ui.stake / 60}" style="--p:${pct.toFixed(1)}%" aria-label="Stake in minutes" ${dis}>
      <div class="chips">${presets.map(([v, t]) => `<button class="chip" data-a="stakeSet" data-v="${v}" aria-pressed="${ui.stake === v && v > 0}" ${dis || (v < 60 || v > l.leftSec ? "disabled" : "")}>${t}</button>`).join("")}</div>
    </div>`;
  }
  App.onStakeSlider = function (el) {
    ui.stake = Number(el.value) * 60; clampStake();
    const v = document.getElementById("stake-val"); if (v) v.innerHTML = `<span class="dotnum">${fmt(ui.stake)}</span>`;
    const max = Number(el.max), pct = max > 1 ? ((Number(el.value) - 1) / (max - 1)) * 100 : 100;
    el.style.setProperty("--p", pct.toFixed(1) + "%");
    document.querySelectorAll('[data-a="stakeSet"]').forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.v) === ui.stake)));
    const go = document.querySelector("#controls .btn.primary[data-go]"); if (go) go.textContent = go.dataset.go.replace("{s}", fmt(ui.stake));
    App.haptic("tick");
  };

  /* ---------- list ---------- */
  App.views.tables = function () {
    App.ensureStakeApp();
    const S = App.S, l = stakeLimit();
    const head = App.BLOCK
      ? `<header class="topbar">${App.backBtn("toBlock", `Back to ${App.CTX.label}`)}<div class="grow"><p class="eyebrow">Playing with ${esc(App.CTX.label)} time</p><h1 class="h2">Tables</h1></div>${App.soundBtn()}</header>`
      : `<header class="topbar"><div class="grow"><h1 class="h1">Play</h1><p class="muted">Stake minutes. Wins go back to that app; losses are gone for today.</p></div>${App.soundBtn()}</header>`;
    if (!l || l.leftSec < 60) {
      return `<div class="screen" id="screen">${head}<section class="panel"><h2 class="h3">Nothing to stake</h2><p class="muted">${S.limits.length ? "Every limited app is under a minute for today. Budgets reset at midnight." : "Add a limit on Home first. Its minutes are your chips."}</p></section></div>`;
    }
    const from = App.BLOCK ? "" : `<div class="from" role="group" aria-label="Stake from">${S.limits.map(x => `<button class="from-chip" data-a="stakeApp" data-pkg="${esc(x.pkg)}" aria-pressed="${ui.stakePkg === x.pkg}" ${x.leftSec < 60 ? "disabled" : ""}>${App.appIcon(x.pkg, "sm")}<span>${esc(x.label)}</span><span class="num">${fmt(x.leftSec)}</span></button>`).join("")}</div>`;
    const games = G.GAMES.map((g, i) => `<button class="game ${i === 0 ? "feature" : ""} g-${g.id}" data-a="game" data-id="${g.id}">
        <span class="art" aria-hidden="true">${FX.GAME_ART[g.id]()}</span>
        <span class="gtext"><span class="gname">${g.name}</span><span class="grule">${g.rule}</span></span>
        <span class="rtp"><span class="num">${g.rtp}</span> back</span></button>`).join("");
    return `<div class="screen" id="screen">${head}
      <section class="panel">${from}${stakeBox(false)}</section>
      <section class="games" aria-label="Tables">${games}</section>
      <p class="fine">No real money. "Back" is the average share of a stake each table returns, so the house keeps a little every round.</p>
    </div>`;
  };
  App.afterTables = () => { const art = document.querySelector(".g-roulette .art"); if (art) FX.miniWheel(art); };

  /* ---------- game screen ---------- */
  App.views.game = function () {
    const g = G.GAMES.find(x => x.id === ui.game);
    return `<div class="screen game-screen" id="screen" data-game="${g.id}">
      <header class="topbar">${App.backBtn("leave", "Back to tables")}<div class="grow"><h1 class="h2">${g.name}</h1><p class="muted">Returns ${g.rtp} on average</p></div>${App.soundBtn()}</header>
      <section class="felt" id="table" aria-label="${g.name} table"></section>
      <p class="result" id="result" aria-live="polite"></p>
      <section class="panel controls" id="controls"></section>
    </div>`;
  };

  App.mountGame = function () {
    if (table && table.destroy) table.destroy();
    const el = document.getElementById("table");
    ui.res = null; ui.round = null;
    if (ui.game === "coin") { ui.pick = ui.pick || "H"; table = FX.Coin(el); }
    if (ui.game === "roulette") { ui.rbets = (ui.rbets || ["red"]).filter(G.isRouletteBet); ui.hist = ui.hist || []; ui.rTab = ui.rTab || "outside";
      table = FX.Roulette(el, { fitHeight: true, onFlick: (dir, power) => {
        // A flick is another way to press Spin, with the same checks.
        const b = document.querySelector('#controls [data-a="rSpin"]');
        if (!b || b.disabled) { if (!ui.busy) App.toast((ui.rbets || []).length ? `Not enough ${App.labelOf(ui.stakePkg)} time for those bets.` : "Put a bet on the table first."); return false; }
        ui.flick = { dir, power }; b.click(); return true;
      } }); }
    if (ui.game === "slots") { table = FX.Slots(el, ["seven", "bell", "cherry"]); paytableSlots(el); }
    if (ui.game === "blackjack") { ui.shoe = ui.shoe && ui.shoe.length > 30 ? ui.shoe : G.newShoe(); table = FX.Blackjack(el); }
    if (ui.game === "poker") {
      table = FX.Poker(el, i => {
        if (ui.round && ui.round.phase === "dealt" && !ui.busy) { ui.round.held[i] = !ui.round.held[i]; table.setHold(i, ui.round.held[i]); App.haptic("tap"); App.SFX.play("chip"); }
      });
    }
  };
  App.unmountGame = () => { if (table && table.destroy) table.destroy(); table = null; };
  function paytableSlots(el) {
    const rows = [["seven", "100×"], ["bar", "40×"], ["bell", "20×"], ["diamond", "10×"], ["cherry", "5×"]];
    const div = document.createElement("div");
    div.className = "slot-pays";
    div.innerHTML = rows.map(([s, m]) => `<div class="sp" data-key="three-${s}"><span class="sp-art">${FX.slotSvg(s).repeat(3)}</span><span class="num">${m}</span></div>`).join("")
      + `<div class="sp" data-key="two-sevens"><span class="sp-txt">Any two 7s</span><span class="num">5×</span></div><div class="sp" data-key="pair"><span class="sp-txt">Any other pair</span><span class="num">0.4×</span></div>`;
    el.appendChild(div);
  }

  App.renderControls = function () {
    const c = document.getElementById("controls"); if (!c) return;
    const r = document.getElementById("result");
    if (r) { r.className = "result " + (ui.res ? ui.res.tone : ""); if (!ui.res) r.textContent = ""; }
    const locked = ui.busy || !!ui.round;
    const go = (label, action) => canStake() || locked
      ? `<button class="btn primary big" data-a="${action}" data-go="${esc(label)}" ${ui.busy ? "disabled" : ""}>${esc(label.replace("{s}", fmt(ui.stake)))}</button>`
      : `<p class="muted center">Not enough ${esc(App.labelOf(ui.stakePkg))} time for this stake.</p>`;
    let html = "";
    if (ui.game === "coin") {
      html = `<div class="seg2" role="group" aria-label="Your call">
          <button class="chip" data-a="coinPick" data-v="H" aria-pressed="${ui.pick === "H"}" ${locked ? "disabled" : ""}>Heads</button>
          <button class="chip" data-a="coinPick" data-v="T" aria-pressed="${ui.pick === "T"}" ${locked ? "disabled" : ""}>Tails</button></div>
        ${stakeBox(locked)}${go("Flip for {s}", "coinFlip")}`;
    } else if (ui.game === "roulette") {
      const bets = ui.rbets || [], n = bets.length, total = ui.stake * n, dis = locked ? "disabled" : "";
      const on = id => bets.includes(id);
      const nums = bets.filter(b => b.startsWith("n:")).length, outs = n - nums;
      const l = stakeLimit();
      const cell = k => `<button class="rnum ${G.pocketColor(k)}" data-a="rToggle" data-v="n:${k}" aria-pressed="${on("n:" + k)}" aria-label="Number ${k}" ${dis}>${k}</button>`;
      const tab = (id, label, count) => `<button role="tab" class="rtab" data-a="rTab" data-v="${id}" aria-selected="${ui.rTab === id}" ${dis}>${label}${count ? ` <span class="rcount">${count}</span>` : ""}</button>`;
      const board = ui.rTab === "numbers"
        ? `<div class="rboard rgrid" role="group" aria-label="Single numbers, ${G.STRAIGHT_MULTIPLE}× each">${cell(0)}${Array.from({ length: 36 }, (_, i) => cell(i + 1)).join("")}</div>`
        : `<div class="rboard bets" role="group" aria-label="Outside bets">${Object.entries(G.ROULETTE_BETS).map(([id, b]) => `<button class="chip bet-${id}" data-a="rToggle" data-v="${id}" aria-pressed="${on(id)}" ${dis}><span>${b.label}</span><span class="pays">${b.multiple}×</span></button>`).join("")}</div>`;
      const spin = n === 0 ? `<button class="btn primary big rgo" disabled>Pick a bet</button>`
        : canStake(total) || locked ? `<button class="btn primary big rgo" data-a="rSpin" ${ui.busy ? "disabled" : ""}><span>Spin ${esc(fmt(total))}</span><small>${n} ${n === 1 ? "bet" : "bets"}</small></button>`
        : `<button class="btn primary big rgo" disabled><span>Too much</span><small>${esc(fmt(total))} of ${esc(fmt(l ? l.leftSec : 0))}</small></button>`;
      html = `<div class="rtop"><div class="history" aria-label="Last numbers">${(ui.hist || []).slice(0, 6).map(k => `<span class="${G.pocketColor(k)}">${k}</span>`).join("") || `<span class="none">Flick the wheel or press Spin</span>`}</div>
          ${l ? `<span class="rfrom">${App.appIcon(l.pkg, "sm")}<span class="num">${esc(fmt(l.leftSec))}</span></span>` : ""}</div>
        <div class="rtabs" role="tablist" aria-label="Bets">${tab("outside", "Outside", outs)}${tab("numbers", `Numbers <span class="pays">${G.STRAIGHT_MULTIPLE}×</span>`, nums)}
          <button class="rclear" data-a="rClear" aria-label="Clear all bets" ${n && !locked ? "" : "disabled"}>Clear</button></div>
        ${board}
        <div class="rstake-row">
          <div class="rstake" role="group" aria-label="Stake per bet">
            <button class="step" data-a="stake" data-d="-60" aria-label="One minute less per bet" ${dis || (ui.stake <= 60 ? "disabled" : "")}>−</button>
            <output class="rstake-val" id="stake-val" aria-live="polite"><span class="dotnum">${fmt(ui.stake)}</span><small>per bet</small></output>
            <button class="step" data-a="stake" data-d="60" aria-label="One minute more per bet" ${dis || (!l || (ui.stake + 60) * Math.max(1, n) > l.leftSec ? "disabled" : "")}>+</button>
          </div>${spin}</div>`;
    } else if (ui.game === "slots") {
      html = `${stakeBox(locked)}${go("Spin for {s}", "sSpin")}`;
    } else if (ui.game === "blackjack") {
      const R = ui.round;
      if (R && R.phase === "play") {
        const canDouble = R.p.length === 2 && stakeLimit() && stakeLimit().leftSec >= R.stake;
        html = `<div class="btn-row three"><button class="btn quiet" data-a="bjHit" ${ui.busy ? "disabled" : ""}>Hit</button>
          <button class="btn primary" data-a="bjStand" ${ui.busy ? "disabled" : ""}>Stand</button>
          <button class="btn quiet" data-a="bjDouble" ${ui.busy || !canDouble ? "disabled" : ""}>Double</button></div>
          <p class="stake-from center">Stake <span class="num">${fmt(R.stake)}</span> on the table</p>`;
      } else html = `${stakeBox(locked)}${go("Deal for {s}", "bjDeal")}`;
    } else if (ui.game === "poker") {
      const R = ui.round;
      if (R && R.phase === "dealt") {
        html = `<p class="muted center">Tap the cards you want to keep, then draw.</p><button class="btn primary big" data-a="pDraw" ${ui.busy ? "disabled" : ""}>Draw</button>
          <p class="stake-from center">Stake <span class="num">${fmt(R.stake)}</span> in play</p>`;
      } else html = `${stakeBox(locked)}${go("Deal for {s}", "pDeal")}`;
    }
    c.innerHTML = html;
    App.renderNav();
  };

  /* ---------- focus mode: the table takes the whole screen while a round runs ---------- */
  let focusTimer = null;
  function enterFocus() {
    clearTimeout(focusTimer);
    const scr = document.getElementById("screen"), felt = document.getElementById("table");
    if (!scr || !felt || scr.classList.contains("focus")) return Promise.resolve();
    const first = felt.getBoundingClientRect();
    scr.classList.add("focus");
    App.$app.classList.add("focusing");
    const last = felt.getBoundingClientRect();
    if (!FX.reduced()) {
      felt.style.transformOrigin = "0 0"; // FLIP deltas are measured from the top-left corner
      felt.animate([
        { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})`, borderRadius: "24px" },
        { transform: "none", borderRadius: "0px" },
      ], { duration: 420, easing: "cubic-bezier(.2,.9,.25,1)" });
    }
    if (table && table.resize) table.resize();
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  function exitFocus(delay) {
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      const scr = document.getElementById("screen"), felt = document.getElementById("table");
      if (!scr || !scr.classList.contains("focus") || ui.busy || ui.round) return;
      const first = felt.getBoundingClientRect();
      scr.classList.remove("focus");
      App.$app.classList.remove("focusing");
      const last = felt.getBoundingClientRect();
      if (!FX.reduced()) {
        felt.style.transformOrigin = "0 0";
        felt.animate([
          { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})`, borderRadius: "0px" },
          { transform: "none", borderRadius: "24px" },
        ], { duration: 380, easing: "cubic-bezier(.2,.9,.25,1)" });
      }
      if (table && table.resize) table.resize();
    }, delay);
  }
  App.exitFocusNow = () => exitFocus(0);

  /* ---------- rounds ---------- */
  const INVALID_SETTLE = -2147483648;
  function takeStake(sec, game) {
    if (!A.bet(ui.stakePkg, sec)) { App.toast(`Not enough ${App.labelOf(ui.stakePkg)} time for that stake.`); return false; }
    ui.pending = { game, stake: (ui.pending ? ui.pending.stake : 0) + sec };
    App.refresh(); return true;
  }
  /** Runs a round. If anything throws after the stake was taken, the stake goes back. */
  function guarded(fn) {
    return async function () {
      try { await fn.apply(this, arguments); }
      catch (err) {
        console.warn("round failed", err);
        if (ui.pending) { A.settle(ui.stakePkg, ui.pending.game, ui.pending.stake, ui.pending.stake); ui.pending = null; }
        ui.busy = false; ui.round = null; ui.res = { tone: "loss", text: "That round broke. Your stake is back." };
        App.refresh(); App.renderControls(); exitFocus(0);
      }
    };
  }
  function finish(gameName, stake, multiple, prefix) {
    const ret = Math.round(stake * multiple);
    const net = A.settle(ui.stakePkg, gameName, stake, ret);
    ui.pending = null;
    App.refresh();
    ui.busy = false; ui.round = null;
    if (net === INVALID_SETTLE) {
      ui.res = { tone: "loss", text: "This round couldn't be paid out because Ante restarted mid-round." };
    } else {
      const app = App.labelOf(ui.stakePkg);
      if (net > 0) ui.res = { tone: "win", text: `${prefix}You win ${fmt(net)} of ${app}.` };
      else if (net === 0) ui.res = { tone: "", text: `${prefix}Push. Your stake comes back.` };
      else if (ret > 0) ui.res = { tone: "loss", text: `${prefix}${fmt(ret)} comes back. Net ${signed(net)}.` };
      else ui.res = { tone: "loss", text: `${prefix}You lose ${fmt(stake)}.` };
      if (net > 0) { FX.burst(document.getElementById("table"), { power: multiple >= 10 ? 1.5 : 1 }); App.haptic("win"); App.SFX.play(multiple >= 10 ? "bigWin" : "win"); }
      else if (net < 0) { App.haptic("loss"); App.SFX.play("lose"); }
      else App.SFX.play("push");
    }
    const r = document.getElementById("result"); if (r) r.textContent = ui.res.text;
    App.renderControls();
    exitFocus(1700);
  }
  async function begin() { ui.busy = true; ui.res = null; App.renderControls(); await enterFocus(); }

  async function coinFlip() {
    const stake = ui.stake; if (!takeStake(stake, "Coin flip")) return;
    await begin();
    const r = G.coinFlip(ui.pick);
    await table.flip(r.result);
    finish("Coin flip", stake, r.multiple, r.result === "H" ? "Heads. " : "Tails. ");
  }
  async function rSpin() {
    const bets = (ui.rbets || []).filter(G.isRouletteBet), per = ui.stake;
    const flick = ui.flick; ui.flick = null; // set when the wheel was flicked by hand
    if (!bets.length) return;
    const stake = per * bets.length; if (!takeStake(stake, "Roulette")) return;
    await begin();
    const n = G.rouletteSpin();
    let ticks = 0;
    await table.spin(n, () => { if (++ticks % 2 === 0) App.haptic("tick"); }, flick);
    ui.hist = [n, ...(ui.hist || [])].slice(0, 10);
    const won = bets.filter(b => G.rouletteReturn([b], n) > 0).map(b => b.startsWith("n:") ? b.slice(2) : G.ROULETTE_BETS[b].label);
    const hits = bets.length > 1 && won.length ? `${won.join(", ")} ${won.length === 1 ? "hits" : "hit"}. ` : "";
    finish("Roulette", stake, G.rouletteReturn(bets, n) / bets.length, `${n} ${G.pocketColor(n)}. ${hits}`);
  }
  async function sSpin() {
    const stake = ui.stake; if (!takeStake(stake, "Slots")) return;
    await begin();
    const reels = G.slotSpin();
    await table.spin(reels, () => App.haptic("tick"));
    const pay = G.slotPay(reels);
    document.querySelectorAll(".slot-pays .sp").forEach(e => e.classList.toggle("on", e.dataset.key === pay.key));
    if (pay.multiple >= 1) table.win();
    finish("Slots", stake, pay.multiple, pay.multiple >= 10 ? "Jackpot row. " : "");
  }
  const draw = () => { if (ui.shoe.length < 20) ui.shoe = G.newShoe(); return ui.shoe.pop(); };
  async function bjDeal() {
    const stake = ui.stake; if (!takeStake(stake, "Blackjack")) return;
    const R = ui.round = { phase: "deal", stake, p: [draw(), draw()], d: [draw(), draw()] };
    await begin();
    table.chip(fmt(stake));
    await table.deal(R.p, R.d, App.haptic);
    table.values(G.handValue(R.p), G.handValue([R.d[0]]));
    if (G.isBlackjack(R.p) || G.isBlackjack(R.d)) return bjSettle();
    R.phase = "play"; ui.busy = false; App.renderControls();
  }
  async function bjHit() {
    const R = ui.round; if (!R || ui.busy) return;
    ui.busy = true; App.renderControls();
    const card = draw(); R.p.push(card);
    await table.hit(card, App.haptic);
    const v = G.handValue(R.p);
    table.values(v, G.handValue([R.d[0]]));
    if (v >= 21) return bjSettle();
    ui.busy = false; App.renderControls();
  }
  async function bjDouble() {
    const R = ui.round; if (!R || ui.busy) return;
    if (!takeStake(R.stake, "Blackjack")) return;
    R.stake *= 2; table.chip(fmt(R.stake));
    ui.busy = true; App.renderControls();
    const card = draw(); R.p.push(card);
    await table.hit(card, App.haptic);
    table.values(G.handValue(R.p), G.handValue([R.d[0]]));
    await bjSettle();
  }
  async function bjSettle() {
    const R = ui.round; ui.busy = true; App.renderControls();
    await table.reveal(R.d[1]);
    const pv = G.handValue(R.p);
    if (pv <= 21 && !G.isBlackjack(R.p) && !G.isBlackjack(R.d)) {
      while (G.handValue(R.d) < 17) { const c = draw(); R.d.push(c); table.values(pv, G.handValue(R.d)); await table.dealer(c, App.haptic); }
    }
    table.values(pv, G.handValue(R.d));
    const res = G.blackjackMultiple(R.p, R.d), dv = G.handValue(R.d);
    const words = { blackjack: "Blackjack!", "dealer-blackjack": "Dealer blackjack", bust: "Bust", "dealer-bust": "Dealer busts", win: "You win", push: "Push", lose: "Dealer wins" };
    table.banner(words[res.outcome], res.multiple > 1 ? "win" : res.multiple === 1 ? "" : "loss");
    const prefix = res.outcome === "win" ? `${pv} beats ${dv}. ` : res.outcome === "lose" ? `Dealer's ${dv} beats ${pv}. ` : res.outcome === "bust" ? `Bust at ${pv}. ` : res.outcome === "dealer-bust" ? `Dealer busts at ${dv}. ` : "";
    finish("Blackjack", R.stake, res.multiple, prefix);
    table.chip("");
  }
  async function pDeal() {
    const stake = ui.stake; if (!takeStake(stake, "Poker")) return;
    const deck = G.shuffledDeck();
    const R = ui.round = { phase: "deal", stake, deck, hand: deck.splice(0, 5), held: [false, false, false, false, false] };
    await begin();
    await table.deal(R.hand, App.haptic);
    table.highlight(G.pokerRank(R.hand));
    R.phase = "dealt"; ui.busy = false; table.enable(true); App.renderControls();
  }
  async function pDraw() {
    const R = ui.round; if (!R || ui.busy) return;
    ui.busy = true; table.enable(false); App.renderControls();
    R.hand = R.hand.map((c, i) => (R.held[i] ? c : R.deck.shift()));
    await table.draw(R.hand, R.held, App.haptic);
    const res = G.pokerMultiple(R.hand);
    table.highlight(res.rank);
    finish("Poker", R.stake, res.multiple, res.rank ? `${res.rank}. ` : "No pair of jacks or better. ");
  }

  /* ---------- block screen ---------- */
  const BREATH_S = Number(new URLSearchParams(location.search).get("breath") || 5);
  let breathEnds = 0, breathTimer = null;
  const breathLeft = () => Math.max(0, Math.ceil((breathEnds - Date.now()) / 1000));
  /** A short pause before a blocked app can be opened. Restarts each time the block screen returns. */
  App.startBreath = function () {
    if (!App.BLOCK || BREATH_S <= 0) return;
    breathEnds = Date.now() + BREATH_S * 1000;
    clearInterval(breathTimer);
    breathTimer = setInterval(() => {
      const b = document.getElementById("open-app"), left = breathLeft();
      if (b) {
        const l = App.lim(App.CTX.pkg);
        b.disabled = left > 0;
        b.textContent = left > 0 ? `Take a breath · ${left}` : `Open ${App.CTX.label || (l && l.label) || "app"} · ${fmt(ui.openPick)}`;
      }
      if (left <= 0) clearInterval(breathTimer);
    }, 250);
  };

  function vGuard() {
    const CTX = App.CTX, installer = /packageinstaller/.test(CTX.pkg || "");
    return `<div class="screen block" id="screen">
      <div class="block-top"><span class="appicon xl lockicon" aria-hidden="true">${App.ICON.lock}</span><p class="eyebrow">Strict mode</p>
        <h1 class="h1">${installer ? "Installing and removing apps is locked" : `${esc(CTX.label || "Settings")} is locked`}</h1></div>
      <p class="muted">${installer ? "Strict mode keeps Ante installed. To install or remove apps, turn off Strict mode in Ante first. That takes a 30-second wait." : "Strict mode covers this so blocking can't be switched off on impulse. Wait 30 seconds to use it for 2 minutes."}</p>
      <div class="grow"></div>
      ${installer ? `<button class="btn primary" data-a="openAnte">Open Ante</button>` : `<button class="btn primary" data-a="guardWait">Start the 30-second wait</button>`}
      <button class="btn ghost" data-a="closeBlock">Back to home screen</button>
    </div>`;
  }
  App.views.block = function () {
    const CTX = App.CTX;
    if (CTX.note === "strict") return vGuard();
    const l = App.lim(CTX.pkg), label = esc(CTX.label || (l && l.label) || "This app");
    if (!l) return `<div class="screen block" id="screen"><div class="block-top">${App.appIcon(CTX.pkg, "xl")}<h1 class="h1">${label} has no limit</h1></div>
        <div class="grow"></div><button class="btn primary" data-a="closeBlock">Back to home screen</button></div>`;
    if (l.leftSec <= 0) return `<div class="screen block" id="screen">
        <div class="block-top">${App.appIcon(CTX.pkg, "xl")}<p class="eyebrow">${CTX.note ? esc(CTX.note) : "Daily limit reached"}</p><h1 class="h1">${label} is done for today</h1></div>
        <div class="dotclock-box"><p class="dotclock loss" data-fit="140">0:00</p></div><p class="muted">Your ${fmt(l.limitSec)} resets at midnight.</p>
        <div class="grow"></div>
        <button class="btn primary" data-a="closeBlock">Back to home screen</button>
        <button class="btn ghost" data-a="openAnte">Open Ante</button></div>`;
    const opts = [[300, "5 min"], [600, "10 min"], [900, "15 min"], [l.leftSec, "All"]];
    if (ui.openPick > l.leftSec) ui.openPick = l.leftSec;
    return `<div class="screen block" id="screen">
      <div class="block-top">${App.appIcon(CTX.pkg, "xl")}<p class="eyebrow">${CTX.note ? esc(CTX.note) : "Daily limit"}</p><h1 class="h1">${label}</h1></div>
      <div><div class="dotclock-box"><p class="dotclock" data-fit="140">${fmt(l.leftSec)}</p></div><p class="muted">left today of ${fmt(l.limitSec)}</p></div>
      <div class="grow"></div>
      <section class="panel">
        <p class="eyebrow">Open for</p>
        <div class="chips">${opts.map(([v, t]) => `<button class="chip" data-a="pickOpen" data-v="${v}" aria-pressed="${ui.openPick === v}" ${v > l.leftSec ? "disabled" : ""}>${t}</button>`).join("")}</div>
        <button class="btn primary" id="open-app" data-a="openApp" ${breathLeft() > 0 ? "disabled" : ""}>${breathLeft() > 0 ? `Take a breath · ${breathLeft()}` : `Open ${label} · ${fmt(ui.openPick)}`}</button>
        <button class="btn quiet" data-a="toTables" ${l.leftSec < 60 ? "disabled" : ""}>Play for more time</button>
      </section>
      <button class="btn ghost" data-a="closeBlock">Not now</button>
    </div>`;
  };

  Object.assign(App.act, {
    stakeApp(d) { ui.stakePkg = d.pkg; clampStake(); App.chipFx(); App.render(); },
    stake(d) { ui.stake += Number(d.d); clampStake(); App.chipFx(); ui.view === "game" ? App.renderControls() : App.render(); },
    stakeSet(d) { ui.stake = Number(d.v); clampStake(); App.chipFx(); ui.view === "game" ? App.renderControls() : App.render(); },
    game(d) { ui.game = d.id; ui.view = "game"; App.render(); },
    leave() { if (ui.busy || ui.round) return; ui.view = "tables"; ui.game = null; App.render(); },
    coinPick(d) { ui.pick = d.v; App.chipFx(); App.renderControls(); },
    rToggle(d) {
      if (!G.isRouletteBet(d.v)) return;
      const cur = ui.rbets || [];
      ui.rbets = cur.includes(d.v) ? cur.filter(b => b !== d.v) : [...cur, d.v];
      App.chipFx(); App.renderControls();
    },
    rClear() { ui.rbets = []; App.chipFx(); App.renderControls(); },
    rTab(d) { ui.rTab = d.v === "numbers" ? "numbers" : "outside"; App.chipFx(); App.renderControls(); },
    coinFlip: guarded(coinFlip), rSpin: guarded(rSpin), sSpin: guarded(sSpin),
    bjDeal: guarded(bjDeal), bjHit: guarded(bjHit), bjStand: guarded(async () => { if (!ui.busy) await bjSettle(); }),
    bjDouble: guarded(bjDouble), pDeal: guarded(pDeal), pDraw: guarded(pDraw),
    pickOpen(d) { ui.openPick = Number(d.v); App.chipFx(); App.render(); },
    openApp() {
      if (!A.open(App.CTX.pkg, ui.openPick)) { App.toast("Couldn't open that app. It may have been uninstalled."); return; }
      App.refresh(); App.render();
    },
    toTables() { ui.view = "tables"; App.render(); },
    toBlock() { ui.view = "block"; ui.game = null; App.render(); },
    closeBlock() { A.closeBlock(); },
    openAnte() { A.openAnte(); },
  });
})();
