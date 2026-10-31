/* Visual layer for Ante's tables: card, coin, wheel, reel and particle animations.
   Every animation returns a Promise so the game flow can await it. Respects reduced motion. */
(function () {
  "use strict";
  const G = window.AnteGames;
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = ms => new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 30) : ms));
  const dur = ms => (reduced() ? 1 : ms);
  const finished = a => (a && a.finished ? a.finished.catch(() => {}) : Promise.resolve());
  const sfx = name => { if (window.AnteSFX) window.AnteSFX.play(name); };

  /* ---------- artwork ---------- */
  const SUIT_PATH = {
    spades: "M32 6C24 18 10 26 10 38c0 7 5 12 11 12 4 0 7-2 9-5-1 6-3 10-7 13h18c-4-3-6-7-7-13 2 3 5 5 9 5 6 0 11-5 11-12C54 26 40 18 32 6z",
    hearts: "M32 56C20 46 8 37 8 24 8 16 14 10 21 10c5 0 9 3 11 7 2-4 6-7 11-7 7 0 13 6 13 14 0 13-12 22-24 32z",
    diamonds: "M32 6 52 32 32 58 12 32z",
    clubs: "M32 8c-7 0-12 5-12 12 0 3 1 6 3 8-2-1-4-1-6-1-7 0-11 5-11 11s5 12 11 12c5 0 8-2 10-5-1 6-3 9-6 12h22c-3-3-5-6-6-12 2 3 5 5 10 5 6 0 11-5 11-12s-4-11-11-11c-2 0-4 0-6 1 2-2 3-5 3-8 0-7-5-12-12-12z",
  };
  const suitSvg = (suit, cls) => `<svg class="${cls || ""}" viewBox="0 0 64 64" aria-hidden="true"><path d="${SUIT_PATH[suit]}" fill="currentColor"/></svg>`;

  /* Standard pip positions (x%, y%, upside-down) for 2–10, as on a printed deck. */
  const L = 28, C = 50, R = 72;
  const PIPS = {
    2: [[C, 18], [C, 82, 1]], 3: [[C, 18], [C, 50], [C, 82, 1]],
    4: [[L, 18], [R, 18], [L, 82, 1], [R, 82, 1]],
    5: [[L, 18], [R, 18], [C, 50], [L, 82, 1], [R, 82, 1]],
    6: [[L, 18], [R, 18], [L, 50], [R, 50], [L, 82, 1], [R, 82, 1]],
    7: [[L, 18], [R, 18], [C, 34], [L, 50], [R, 50], [L, 82, 1], [R, 82, 1]],
    8: [[L, 18], [R, 18], [C, 34], [L, 50], [R, 50], [C, 66, 1], [L, 82, 1], [R, 82, 1]],
    9: [[L, 18], [R, 18], [L, 39], [R, 39], [C, 50], [L, 61, 1], [R, 61, 1], [L, 82, 1], [R, 82, 1]],
    10: [[L, 18], [R, 18], [C, 29], [L, 39], [R, 39], [L, 61, 1], [R, 61, 1], [C, 71, 1], [L, 82, 1], [R, 82, 1]],
  };
  function cardHtml(card, faceUp) {
    const back = `<div class="face back"><i></i></div>`;
    if (!card) return `<div class="card"><div class="card-in">${back}</div></div>`;
    const suit = G.SUITS[card.s], rank = G.rankLabel(card.r), red = G.isRed(card);
    const court = card.r >= 11;
    const centre = court
      ? `<span class="court"><span class="court-band"></span><b>${rank}</b>${suitSvg(suit, "court-suit")}<span class="court-band b"></span></span>`
      : card.r === 1 ? `<span class="pip ace">${suitSvg(suit)}</span>`
        : `<span class="pips">${PIPS[card.r].map(([x, y, f]) => `<span class="p${f ? " f" : ""}" style="left:${x}%;top:${y}%">${suitSvg(suit)}</span>`).join("")}</span>`;
    const name = `${rank === "A" ? "Ace" : rank === "J" ? "Jack" : rank === "Q" ? "Queen" : rank === "K" ? "King" : rank} of ${suit}`;
    return `<div class="card ${faceUp ? "up" : ""}" data-name="${name}" role="img" aria-label="${faceUp ? name : "Face-down card"}">
      <div class="card-in">
        <div class="face front ${red ? "red" : ""}">
          <span class="ix"><b>${rank}</b>${suitSvg(suit)}</span>${centre}<span class="ix ix-b"><b>${rank}</b>${suitSvg(suit)}</span>
        </div>${back}
      </div></div>`;
  }

  const SLOT_ART = {
    seven: `<svg viewBox="0 0 64 64" aria-label="Seven"><text x="32" y="53" text-anchor="middle" font-family="Geist, Arial, sans-serif" font-weight="700" font-size="54" fill="var(--red)" stroke="#ffffff" stroke-width="2" paint-order="stroke">7</text></svg>`,
    bar: `<svg viewBox="0 0 64 64" aria-label="Bar"><rect x="5" y="20" width="54" height="24" rx="6" fill="#111111" stroke="var(--brass)" stroke-width="2.5"/><text x="32" y="39" text-anchor="middle" font-family="Geist, Arial, sans-serif" font-weight="800" font-size="19" letter-spacing="2" fill="var(--ivory)">BAR</text></svg>`,
    bell: `<svg viewBox="0 0 64 64" aria-label="Bell"><path d="M32 8c-2 0-3 1-3 3v2c-9 2-14 10-14 19v9l-5 6v3h44v-3l-5-6v-9c0-9-5-17-14-19v-2c0-2-1-3-3-3z" fill="var(--brass)"/><path d="M24 22c-3 3-4 7-4 11v7" stroke="#fafafa" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="32" cy="54" r="5" fill="var(--brass-deep)"/></svg>`,
    diamond: `<svg viewBox="0 0 64 64" aria-label="Diamond"><path d="M14 22 24 10h16l10 12-18 32z" fill="#BFE6E0"/><path d="M14 22h36L32 54z" fill="#8CCFC6"/><path d="M24 10l-4 12h24l-4-12" fill="#E6FAF6"/><path d="M14 22 24 10h16l10 12-18 32z" fill="none" stroke="#2C6F66" stroke-width="1.5"/></svg>`,
    cherry: `<svg viewBox="0 0 64 64" aria-label="Cherries"><path d="M34 8c-6 8-12 18-14 30M34 8c4 10 8 18 12 32" stroke="#3F7D3A" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M34 8c6-2 12 0 16 5-6 2-12 1-16-5z" fill="#5FA052"/><circle cx="19" cy="44" r="11" fill="var(--red)"/><circle cx="46" cy="44" r="11" fill="var(--red)"/><circle cx="15" cy="40" r="3" fill="#F2B3A8"/><circle cx="42" cy="40" r="3" fill="#F2B3A8"/></svg>`,
  };
  const slotSvg = s => SLOT_ART[s];

  /* Small illustrations for the table list. */
  const GAME_ART = {
    roulette: () => {
      let wedges = "";
      for (let i = 0; i < 37; i++) {
        const a0 = (i / 37) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 37) * Math.PI * 2 - Math.PI / 2;
        const c = G.pocketColor(G.WHEEL[i]);
        const fill = c === "green" ? "var(--zero)" : c === "red" ? "var(--red)" : "#111111";
        const p = (r, a) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
        wedges += `<path d="M${p(44, a0)}A44 44 0 0 1 ${p(44, a1)}L${p(30, a1)}A30 30 0 0 0 ${p(30, a0)}z" fill="${fill}"/>`;
      }
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="49" fill="#1a1a1a" stroke="var(--line-2)" stroke-width="1.5"/>${wedges}<circle cx="50" cy="50" r="30" fill="var(--felt-deep)"/><circle cx="50" cy="50" r="7" fill="var(--brass)"/><path d="M50 32v36M32 50h36" stroke="var(--brass)" stroke-width="2.5" stroke-linecap="round"/><circle cx="72" cy="22" r="3.4" fill="var(--ivory)"/></svg>`;
    },
    blackjack: () => `<div class="mini-cards">${cardHtml({ r: 1, s: 0 }, true)}${cardHtml({ r: 13, s: 1 }, true)}<span class="mini-chip"></span></div>`,
    slots: () => `<div class="mini-cab"><span class="mini-light"></span><div class="mini-reels">${["seven", "seven", "seven"].map(s => `<span>${slotSvg(s)}</span>`).join("")}</div><span class="mini-lever"><i></i></span></div>`,
    poker: () => `<div class="mini-fan">${[{ r: 10, s: 1 }, { r: 11, s: 1 }, { r: 12, s: 1 }, { r: 13, s: 1 }, { r: 1, s: 1 }].map(c => cardHtml(c, true)).join("")}</div>`,
    coin: () => `<div class="mini-coin">${coinFace("H", "mini")}</div>`,
  };

  /** A minted coin: metallic rim with reeding, embossed face. Heads shows Ante's hourglass mark. */
  function coinFace(side, key) {
    const id = "cf" + side + (key || "");
    const rim = Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; return `<line x1="${(50 + 45 * Math.cos(a)).toFixed(2)}" y1="${(50 + 45 * Math.sin(a)).toFixed(2)}" x2="${(50 + 48.5 * Math.cos(a)).toFixed(2)}" y2="${(50 + 48.5 * Math.sin(a)).toFixed(2)}"/>`; }).join("");
    const mark = side === "H"
      ? `<path d="M40 31h20v4l-7.5 15 7.5 15v4H40v-4l7.5-15L40 35z" fill="url(#${id}e)" stroke="#6b6b6b" stroke-width=".8"/><text x="50" y="82" text-anchor="middle" font-family="Geist, Arial, sans-serif" font-weight="700" font-size="7.5" letter-spacing="3" fill="#5a5a5a">ANTE</text>`
      : `<text x="50" y="62" text-anchor="middle" font-family="Geist, Arial, sans-serif" font-weight="700" font-size="30" fill="url(#${id}e)" stroke="#6b6b6b" stroke-width=".8">1′</text><text x="50" y="82" text-anchor="middle" font-family="Geist, Arial, sans-serif" font-weight="700" font-size="7.5" letter-spacing="3" fill="#5a5a5a">MINUTE</text>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
      <radialGradient id="${id}r" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d4d4d4"/><stop offset="1" stop-color="#8a8a8a"/></radialGradient>
      <radialGradient id="${id}f" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#f5f5f5"/><stop offset=".6" stop-color="#c8c8c8"/><stop offset="1" stop-color="#a1a1a1"/></radialGradient>
      <linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9a9a9a"/></linearGradient></defs>
      <circle cx="50" cy="50" r="49" fill="url(#${id}r)"/><g stroke="#8f8f8f" stroke-width="1.2">${rim}</g>
      <circle cx="50" cy="50" r="41" fill="url(#${id}f)" stroke="#9a9a9a" stroke-width="1"/>
      <circle cx="50" cy="50" r="36" fill="none" stroke="#b5b5b5" stroke-width=".8" stroke-dasharray="1.5 2.5"/>${mark}</svg>`;
  }

  /* ---------- particles ---------- */
  function burst(host, opts) {
    if (reduced() || !host) return;
    const o = Object.assign({ count: 46, power: 1 }, opts);
    const rect = host.getBoundingClientRect();
    const cv = document.createElement("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.className = "fx-canvas";
    cv.width = rect.width * dpr; cv.height = rect.height * dpr;
    host.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    const colors = ["#d4d4d4", "#F2EAD8", "#e5e5e5", "#737373"];
    const ps = Array.from({ length: o.count }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = (5 + Math.random() * 7) * o.power;
      return { x: rect.width / 2, y: rect.height * 0.55, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 3 + Math.random() * 4, c: colors[(Math.random() * 4) | 0], spin: Math.random() * 6, life: 0 };
    });
    let t0 = null;
    function frame(t) {
      if (!t0) t0 = t;
      const el = (t - t0) / 1000;
      ctx.clearRect(0, 0, rect.width, rect.height);
      for (const p of ps) {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.spin += 0.2;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
        ctx.globalAlpha = Math.max(0, 1 - el / 1.4);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      if (el < 1.4) requestAnimationFrame(frame); else cv.remove();
    }
    requestAnimationFrame(frame);
  }

  function countUp(el, to, format, ms) {
    if (!el) return;
    if (reduced()) { el.textContent = format(to); return; }
    const t0 = performance.now(), d = ms || 800;
    function step(t) {
      const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3);
      el.textContent = format(Math.round(to * e));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- dealing helpers ---------- */
  function flyIn(el, from) {
    if (!from) return Promise.resolve();
    const a = from.getBoundingClientRect(), b = el.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    return finished(el.animate(
      [{ transform: `translate(${dx}px, ${dy}px) rotate(-14deg) scale(.9)`, opacity: 0.4 }, { transform: "none", opacity: 1 }],
      { duration: dur(360), easing: "cubic-bezier(.2,.8,.25,1)" }
    ));
  }
  async function flip(cardEl, card) {
    if (card) {
      const tmp = document.createElement("div");
      tmp.innerHTML = cardHtml(card, false);
      cardEl.querySelector(".card-in").replaceWith(tmp.firstElementChild.querySelector(".card-in"));
      cardEl.setAttribute("aria-label", tmp.firstElementChild.dataset.name);
    }
    void cardEl.offsetWidth;
    sfx("flip");
    cardEl.classList.add("up");
    await wait(420);
  }
  function addCard(row, card) {
    const tmp = document.createElement("div");
    tmp.innerHTML = cardHtml(card, false);
    const el = tmp.firstElementChild;
    row.appendChild(el);
    return el;
  }
  async function deal(row, card, faceUp, from, haptic) {
    const el = addCard(row, null);
    el.style.setProperty("--rot", ((Math.random() - 0.5) * 4).toFixed(2) + "deg");
    if (haptic) haptic("tap");
    sfx("deal");
    await flyIn(el, from);
    if (faceUp) await flip(el, card);
    return el;
  }

  /* ---------- coin ---------- */
  function Coin(host) {
    host.innerHTML = `<div class="coin-stage"><div class="coin-shadow"></div><div class="coin-toss"><div class="coin3d">
      <div class="coin-face heads">${coinFace("H", "big")}</div><div class="coin-face tails">${coinFace("T", "big")}</div></div></div></div>`;
    const toss = host.querySelector(".coin-toss"), coin = host.querySelector(".coin3d"), shadow = host.querySelector(".coin-shadow");
    let angle = 0;
    return {
      async flip(result) {
        const turns = 6 + ((Math.random() * 3) | 0);
        const base = Math.ceil(angle / 360) * 360;
        const end = base + turns * 360 + (result === "T" ? 180 : 0);
        const d = dur(1500);
        sfx("coinToss");
        setTimeout(() => sfx("coinLand"), d * 0.85);
        const a1 = toss.animate([{ transform: "translateY(0)" }, { transform: "translateY(-150px)", offset: 0.45 }, { transform: "translateY(0)", offset: 0.85 }, { transform: "translateY(-14px)", offset: 0.93 }, { transform: "translateY(0)" }], { duration: d, easing: "ease-in-out" });
        const a2 = coin.animate([{ transform: `rotateX(${angle}deg)` }, { transform: `rotateX(${end}deg)` }], { duration: d * 0.88, easing: "cubic-bezier(.25,.6,.3,1)", fill: "forwards" });
        const a3 = shadow.animate([{ transform: "scale(1)", opacity: 0.55 }, { transform: "scale(.45)", opacity: 0.2, offset: 0.45 }, { transform: "scale(1)", opacity: 0.55, offset: 0.85 }, { transform: "scale(1)", opacity: 0.55 }], { duration: d });
        await Promise.all([finished(a1), finished(a2), finished(a3)]);
        coin.style.transform = `rotateX(${end}deg)`;
        a2.cancel();
        angle = end;
        if (!reduced()) await finished(toss.animate([{ transform: "scale(1)" }, { transform: "scale(1.08, .92)", offset: 0.35 }, { transform: "scale(1)" }], { duration: 260, easing: "ease-out" }));
      },
    };
  }

  /* ---------- roulette wheel ---------- */
  function Roulette(host, opts) {
    const MAX = (opts && opts.max) || 440;
    host.innerHTML = `<div class="wheel-wrap"><canvas class="wheel" aria-label="Roulette wheel" role="img"></canvas>
      <div class="wheel-result" aria-live="polite"></div></div>`;
    const cv = host.querySelector("canvas"), out = host.querySelector(".wheel-result");
    const N = G.WHEEL.length, STEP = (Math.PI * 2) / N;
    let size = 0, R = 0, dpr = 1, stator = null, rotor = null;
    let wheelA = 0, ballA = -Math.PI / 2, ballR = 0, highlight = -1, showBall = false, spinning = false;

    function setup() {
      // Size from the box the wheel really gets, and let CSS keep it square (aspect-ratio 1),
      // so a narrow box shrinks both sides instead of squashing it into an oval.
      const wrap = cv.parentNode;
      const avail = Math.min(wrap.clientWidth || host.clientWidth || 300, host.clientWidth || 300);
      // In a flex layout the felt's height is what's left on screen; fit inside that too.
      const cs = getComputedStyle(host);
      const innerH = host.clientHeight - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0);
      const byH = opts && opts.fitHeight && innerH > 60 ? innerH : Infinity;
      const w = Math.max(80, Math.min(avail, byH, MAX, Math.round(window.innerHeight * 0.5)));
      dpr = Math.min(3, window.devicePixelRatio || 1);
      size = w; R = w / 2;
      cv.style.width = w + "px"; cv.style.height = "auto";
      cv.width = cv.height = Math.round(w * dpr);
      stator = drawStator(); rotor = drawRotor();
      ballR = highlight >= 0 ? R * 0.655 : R * 0.85; // keep a landed ball in its pocket across resizes
      draw();
    }
    function off() { const c = document.createElement("canvas"); c.width = c.height = Math.round(size * dpr); const x = c.getContext("2d"); x.scale(dpr, dpr); x.translate(R, R); return [c, x]; }
    function ring(x, r0, r1, fill) { x.beginPath(); x.arc(0, 0, r1, 0, Math.PI * 2); x.arc(0, 0, r0, 0, Math.PI * 2, true); x.fillStyle = fill; x.fill(); }
    function drawStator() {
      const [c, x] = off();
      const wood = x.createRadialGradient(0, 0, R * 0.8, 0, 0, R);
      wood.addColorStop(0, "#0d0d0d"); wood.addColorStop(0.5, "#262626"); wood.addColorStop(1, "#141414");
      ring(x, R * 0.9, R * 0.995, wood);
      ring(x, R * 0.895, R * 0.91, "#d4d4d4");
      const track = x.createRadialGradient(0, 0, R * 0.78, 0, 0, R * 0.9);
      track.addColorStop(0, "#0a0a0a"); track.addColorStop(0.6, "#1c1c1c"); track.addColorStop(1, "#0d0d0d");
      ring(x, R * 0.79, R * 0.895, track);
      // ball deflectors
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        x.save(); x.rotate(a); x.fillStyle = "#a3a3a3";
        x.beginPath(); x.moveTo(R * 0.815, -3); x.lineTo(R * 0.86, 0); x.lineTo(R * 0.815, 3); x.closePath(); x.fill();
        x.restore();
      }
      return c;
    }
    function drawRotor() {
      const [c, x] = off();
      for (let i = 0; i < N; i++) {
        const n = G.WHEEL[i], col = G.pocketColor(n);
        const a0 = i * STEP - STEP / 2 - Math.PI / 2, a1 = a0 + STEP;
        x.beginPath(); x.arc(0, 0, R * 0.79, a0, a1); x.arc(0, 0, R * 0.6, a1, a0, true); x.closePath();
        x.fillStyle = col === "green" ? "#1F7A4F" : col === "red" ? "#B83A2E" : "#111111";
        x.fill();
        // number
        x.save(); x.rotate(i * STEP);
        x.fillStyle = "#F2EAD8";
        x.font = `700 ${Math.round(R * 0.085)}px Geist, Arial, sans-serif`;
        x.textAlign = "center"; x.textBaseline = "middle";
        x.fillText(String(n), 0, -R * 0.735);
        x.restore();
      }
      // pocket frets
      x.strokeStyle = "#a3a3a3"; x.lineWidth = 1.2;
      for (let i = 0; i < N; i++) {
        const a = i * STEP - STEP / 2 - Math.PI / 2;
        x.beginPath(); x.moveTo(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6); x.lineTo(Math.cos(a) * R * 0.79, Math.sin(a) * R * 0.79); x.stroke();
      }
      x.beginPath(); x.arc(0, 0, R * 0.69, 0, Math.PI * 2); x.strokeStyle = "rgba(255,255,255,.3)"; x.lineWidth = 1; x.stroke();
      // cone
      const cone = x.createRadialGradient(-R * 0.1, -R * 0.12, R * 0.05, 0, 0, R * 0.6);
      cone.addColorStop(0, "#3a3a3a"); cone.addColorStop(0.55, "#1f1f1f"); cone.addColorStop(1, "#111111");
      x.beginPath(); x.arc(0, 0, R * 0.6, 0, Math.PI * 2); x.fillStyle = cone; x.fill();
      x.beginPath(); x.arc(0, 0, R * 0.6, 0, Math.PI * 2); x.strokeStyle = "#a3a3a3"; x.lineWidth = 2; x.stroke();
      // turret
      x.strokeStyle = "#d4d4d4"; x.lineCap = "round"; x.lineWidth = R * 0.035;
      for (let k = 0; k < 4; k++) {
        x.save(); x.rotate((k * Math.PI) / 2);
        x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -R * 0.3); x.stroke();
        x.beginPath(); x.arc(0, -R * 0.3, R * 0.04, 0, Math.PI * 2); x.fillStyle = "#e5e5e5"; x.fill();
        x.restore();
      }
      const knob = x.createRadialGradient(-R * 0.03, -R * 0.03, 1, 0, 0, R * 0.09);
      knob.addColorStop(0, "#fafafa"); knob.addColorStop(1, "#737373");
      x.beginPath(); x.arc(0, 0, R * 0.09, 0, Math.PI * 2); x.fillStyle = knob; x.fill();
      return c;
    }
    function draw() {
      // A landed ball rides its pocket when the wheel is turned by hand.
      if (!spinning && highlight >= 0) ballA = wheelA + highlight * STEP - Math.PI / 2;
      const x = cv.getContext("2d");
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, cv.width, cv.height);
      x.drawImage(stator, 0, 0);
      x.save(); x.translate(cv.width / 2, cv.height / 2); x.rotate(wheelA); x.drawImage(rotor, -cv.width / 2, -cv.height / 2);
      if (highlight >= 0) {
        x.scale(dpr, dpr);
        const a0 = highlight * STEP - STEP / 2 - Math.PI / 2;
        x.beginPath(); x.arc(0, 0, R * 0.795, a0, a0 + STEP); x.arc(0, 0, R * 0.595, a0 + STEP, a0, true); x.closePath();
        x.strokeStyle = "#fafafa"; x.lineWidth = 2.5; x.stroke();
      }
      x.restore();
      if (showBall) {
        x.save(); x.scale(dpr, dpr); x.translate(R, R);
        const bx = Math.cos(ballA) * ballR, by = Math.sin(ballA) * ballR, br = R * 0.034;
        x.beginPath(); x.arc(bx + 1.5, by + 2, br, 0, Math.PI * 2); x.fillStyle = "rgba(0,0,0,.35)"; x.fill();
        const g = x.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.1, bx, by, br);
        g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#C9C2B2");
        x.beginPath(); x.arc(bx, by, br, 0, Math.PI * 2); x.fillStyle = g; x.fill();
        x.restore();
      }
    }
    const easeOut = (t, p) => 1 - Math.pow(1 - t, p);
    const smooth = t => t * t * (3 - 2 * t);

    setup();
    let lastW = host.clientWidth, lastH = host.clientHeight;
    const ro = window.ResizeObserver ? new ResizeObserver(() => {
      if (host.clientWidth === lastW && host.clientHeight === lastH) return;
      lastW = host.clientWidth; lastH = host.clientHeight; setup();
    }) : null;
    if (ro) ro.observe(host);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rotor = drawRotor(); draw(); });

    /* Spin it by hand: the wheel follows the finger round its centre; a quick flick spins it,
       a slow push just lets it coast to a stop. */
    let coastRaf = 0;
    const FLICK = 0.006; // rad per ms needed to count as a spin
    if (opts && opts.onFlick) {
      cv.classList.add("grab");
      let g = null;
      const angleAt = e => { const r = cv.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
      const nearCentre = e => { const r = cv.getBoundingClientRect(); return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < r.width * 0.12; };
      cv.addEventListener("pointerdown", e => {
        if (spinning || g || nearCentre(e)) return;
        e.preventDefault(); cancelAnimationFrame(coastRaf);
        g = { id: e.pointerId, a: angleAt(e), samples: [{ t: performance.now(), w: wheelA }] };
        cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
        cv.classList.add("grabbing");
      });
      cv.addEventListener("pointermove", e => {
        if (!g || e.pointerId !== g.id || nearCentre(e)) return;
        const a = angleAt(e);
        let d = a - g.a; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
        g.a = a; wheelA += d;
        const now = performance.now();
        g.samples.push({ t: now, w: wheelA });
        while (g.samples.length > 2 && now - g.samples[0].t > 90) g.samples.shift();
        draw();
      });
      const release = e => {
        if (!g || e.pointerId !== g.id) return;
        const smp = g.samples; g = null; cv.classList.remove("grabbing");
        if (e.type === "pointercancel" || smp.length < 2) return;
        const a = smp[0], b = smp[smp.length - 1];
        const v = (b.w - a.w) / Math.max(8, b.t - a.t); // rad per ms
        if (Math.abs(v) >= FLICK && opts.onFlick(v < 0 ? -1 : 1, (Math.abs(v) - FLICK) / 0.03)) return;
        coast(v);
      };
      cv.addEventListener("pointerup", release);
      cv.addEventListener("pointercancel", release);
    }
    function coast(v) {
      let last = performance.now();
      const step = now => {
        const dt = now - last; last = now;
        v *= Math.pow(0.996, dt); wheelA += v * dt; draw();
        if (Math.abs(v) > 0.0002) coastRaf = requestAnimationFrame(step);
      };
      coastRaf = requestAnimationFrame(step);
    }

    return {
      spin(n, onTick, flick) {
        const index = G.WHEEL.indexOf(n);
        cancelAnimationFrame(coastRaf); spinning = true;
        highlight = -1; showBall = true; out.classList.remove("show");
        // A hand flick sets the direction, and a harder flick spins a little longer.
        const dir = flick && flick.dir < 0 ? -1 : 1, power = flick ? Math.max(0, Math.min(1, flick.power || 0)) : 0.5;
        const T = dur(5600 + power * 1400);
        const w0 = wheelA, W = dir * Math.PI * 2 * (1.9 + power * 0.9 + Math.random() * 0.4);
        const wf = w0 + W;
        const pocketScreen = wf + index * STEP - Math.PI / 2; // absolute angle of the pocket at the end
        const b0 = ballA;
        // The ball runs the other way round: it travels -dir * B and must end on the pocket.
        let B = dir * (b0 - pocketScreen);
        B = ((B % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        while (B < Math.PI * 2 * 8) B += Math.PI * 2; // 8+ turns
        // Free flight ends exactly TURNS full turns away from the pocket. Taking those turns out
        // of the blend makes the ball ease into its pocket instead of whipping round them again.
        const TURNS = Math.round((pocketScreen - (b0 - dir * B)) / (Math.PI * 2)) * Math.PI * 2;
        const rim = R * 0.85, pocket = R * 0.655;
        let lastPocket = -1, dropped = false;
        sfx("wheelSpin");
        return new Promise(resolve => {
          const t0 = performance.now();
          function frame(now) {
            const t = Math.min(1, (now - t0) / T);
            wheelA = w0 + W * easeOut(t, 3);
            const free = b0 - dir * B * easeOut(t, 2.4);
            // Ball drops off the track between 55% and 80%, rattles, then rides its pocket.
            if (t < 0.55) ballR = rim;
            else if (t < 0.8) {
              const k = (t - 0.55) / 0.25;
              ballR = rim - (rim - pocket) * smooth(k) + Math.sin(k * Math.PI * 5) * R * 0.03 * (1 - k);
            } else ballR = pocket;
            const locked = wheelA + index * STEP - Math.PI / 2;
            const s = t < 0.8 ? 0 : smooth((t - 0.8) / 0.2);
            ballA = free + (locked - TURNS - free) * s;
            if (onTick && t > 0.55) {
              const rel = Math.round(((((ballA - wheelA + Math.PI / 2) / STEP) % N) + N) % N);
              if (rel !== lastPocket) { lastPocket = rel; if (t < 0.85) { onTick(); sfx("ballTick"); } }
            }
            if (!dropped && t >= 0.8) { dropped = true; sfx("ballDrop");
            }
            draw();
            if (t < 1) requestAnimationFrame(frame);
            else {
              wheelA %= Math.PI * 2; ballA = wheelA + index * STEP - Math.PI / 2;
              highlight = index; draw(); spinning = false;
              out.textContent = String(n);
              out.className = "wheel-result show " + G.pocketColor(n);
              resolve();
            }
          }
          requestAnimationFrame(frame);
        });
      },
      resize() { lastW = host.clientWidth; lastH = host.clientHeight; setup(); },
      destroy() { if (ro) ro.disconnect(); cancelAnimationFrame(coastRaf); },
    };
  }

  /* ---------- slot machine ---------- */
  function Slots(host, initial) {
    const rows = r => [G.slotSymbol(), r, G.slotSymbol()];
    host.innerHTML = `<div class="slot-rig"><div class="cabinet"><div class="reels">${initial.map(s => `<div class="reel"><div class="strip">${rows(s).map(x => `<div class="cell">${slotSvg(x)}</div>`).join("")}</div></div>`).join("")}</div><div class="payline" aria-hidden="true"></div></div>
      <div class="lever" role="button" tabindex="0" aria-label="Pull the lever to spin">
        <span class="lever-slot" aria-hidden="true"></span>
        <span class="lever-arm" aria-hidden="true"><span class="lever-knob"></span></span>
        <span class="lever-hub" aria-hidden="true"></span></div></div>`;
    const reels = [...host.querySelectorAll(".reel")];
    const lever = Lever(host.querySelector(".lever"), () => {
      // The lever is another way to press Spin: same checks, same flow.
      const b = document.querySelector('[data-a="sSpin"]');
      if (b && !b.disabled) { b.click(); return true; }
      return false;
    });
    return {
      async spin(final, onStop) {
        host.querySelector(".cabinet").classList.remove("hit");
        lever.throwIfIdle();
        if (window.AnteSFX) window.AnteSFX.reelStart();
        const cellH = reels[0].querySelector(".cell").getBoundingClientRect().height || 72;
        const jobs = reels.map(async (reel, i) => {
          const strip = reel.querySelector(".strip");
          const current = [...strip.children].map(c => c.innerHTML);
          const L = 22 + i * 6;
          const cells = [current[0], current[1]];
          for (let k = 2; k < L - 2; k++) cells.push(slotSvg(G.slotSymbol()));
          cells.push(slotSvg(final[i]), slotSvg(G.slotSymbol()));
          strip.innerHTML = cells.map(c => `<div class="cell">${c}</div>`).join("");
          const endY = -(L - 3) * cellH;
          const a = strip.animate([
            { transform: "translateY(0)", filter: "blur(0)" },
            { transform: `translateY(${-cellH * 2}px)`, filter: "blur(1.5px)", offset: 0.12 },
            { transform: `translateY(${endY - cellH * 0.18}px)`, filter: "blur(.4px)", offset: 0.9 },
            { transform: `translateY(${endY}px)`, filter: "blur(0)" },
          ], { duration: dur(1500 + i * 450), easing: "cubic-bezier(.3,.1,.25,1)", fill: "forwards" });
          await finished(a);
          const keep = [...strip.children].slice(L - 3).map(c => c.innerHTML);
          strip.innerHTML = keep.map(c => `<div class="cell">${c}</div>`).join("");
          a.cancel();
          strip.style.transform = "translateY(0)";
          sfx("reelStop");
          if (i === reels.length - 1 && window.AnteSFX) window.AnteSFX.reelStop();
          if (onStop) onStop(i);
        });
        await Promise.all(jobs);
      },
      win() { host.querySelector(".cabinet").classList.add("hit"); },
      destroy() { lever.destroy(); },
    };
  }

  /**
   * A one-armed-bandit lever. Drag the knob down (or tap it) and let go past the catch to spin.
   * Seen from the front, the arm swings over its hub, so it shortens, flips, and ends below it.
   */
  function Lever(el, onPull) {
    const arm = el.querySelector(".lever-arm"), knob = el.querySelector(".lever-knob");
    const CATCH = 0.72, CLICKS = 5;
    let p = 0, drag = null, anim = null, lastClick = 0, pulledAt = 0;
    const travel = () => el.clientHeight * 0.5 - 14;
    function set(v) {
      p = Math.max(0, Math.min(1, v));
      const k = 1 - 2 * p, safe = Math.abs(k) < 0.03 ? (k < 0 ? -0.03 : 0.03) : k;
      arm.style.transform = `scaleY(${safe.toFixed(3)})`;
      knob.style.transform = `scaleY(${(1 / safe).toFixed(3)})`; // keeps the ball round while the arm squashes
      const click = Math.floor(p * CLICKS);
      if (click > lastClick) sfx("leverClick");
      lastClick = click;
    }
    function springBack() {
      const from = p, t0 = performance.now(), T = dur(520);
      cancelAnimationFrame(anim);
      const step = now => {
        const t = Math.min(1, (now - t0) / T);
        // Damped spring: overshoots the top a little, then settles.
        const e = 1 - Math.exp(-6 * t) * Math.cos(t * 9);
        set(from * (1 - e)); lastClick = 0;
        if (t < 1) anim = requestAnimationFrame(step); else { set(0); el.classList.remove("down"); }
      };
      anim = requestAnimationFrame(step);
    }
    function fire() {
      sfx("leverPull");
      if (window.App && window.App.haptic) window.App.haptic("tap");
      pulledAt = performance.now();
      const ok = onPull();
      if (!ok) sfx("leverJam");
      springBack();
    }
    /** Animates a full pull (tap, keyboard, or the Spin button), then fires once if asked. */
    function throwArm(andFire) {
      cancelAnimationFrame(anim); el.classList.add("down");
      const from = p, t0 = performance.now(), T = dur(220);
      const step = now => {
        const t = Math.min(1, (now - t0) / T);
        set(from + (1 - from) * (t * t));
        if (t < 1) anim = requestAnimationFrame(step);
        else if (andFire) fire(); else { sfx("leverPull"); springBack(); }
      };
      anim = requestAnimationFrame(step);
    }
    function down(e) {
      if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      cancelAnimationFrame(anim);
      drag = { id: e.pointerId, y0: e.clientY, p0: p, moved: false };
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      el.classList.add("down");
    }
    function move(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = e.clientY - drag.y0;
      if (Math.abs(dy) > 4) drag.moved = true;
      set(drag.p0 + dy / Math.max(40, travel() * 2));
    }
    function up(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.moved) { throwArm(true); return; }
      if (e.type !== "pointercancel" && p >= CATCH) { set(1); fire(); } else springBack();
    }
    const key = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); throwArm(true); } };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("keydown", key);
    set(0);
    return {
      /** The Spin button was used: swing the lever too, unless it was just pulled by hand. */
      throwIfIdle() { if (!drag && performance.now() - pulledAt > 400) throwArm(false); },
      destroy() { cancelAnimationFrame(anim); },
    };
  }

  /* ---------- blackjack ---------- */
  function Blackjack(host) {
    host.innerHTML = `<div class="bj">
      <svg class="arc" viewBox="0 0 320 70" aria-hidden="true"><defs><path id="bjarc" d="M20 66 Q160 -6 300 66"/></defs>
        <text><textPath href="#bjarc" startOffset="50%" text-anchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text></svg>
      <p class="rule">Dealer stands on all 17s</p>
      <div class="shoe" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="hand dealer"><span class="val" data-v="dealer"></span><div class="row"></div></div>
      <div class="hand player"><span class="val" data-v="player"></span><div class="row"></div></div>
      <div class="bet-spot"><span class="chip-stake"></span></div>
      <div class="banner" aria-live="polite"></div></div>`;
    const shoe = host.querySelector(".shoe"), dRow = host.querySelector(".dealer .row"), pRow = host.querySelector(".player .row");
    const banner = host.querySelector(".banner");
    let hole = null;
    return {
      clear() { dRow.innerHTML = ""; pRow.innerHTML = ""; banner.className = "banner"; this.values(null, null); hole = null; },
      async deal(p, d, haptic) {
        this.clear();
        await deal(pRow, p[0], true, shoe, haptic);
        await deal(dRow, d[0], true, shoe, haptic);
        await deal(pRow, p[1], true, shoe, haptic);
        hole = await deal(dRow, null, false, shoe, haptic);
      },
      async hit(card, haptic) { await deal(pRow, card, true, shoe, haptic); },
      async reveal(card) { if (hole) await flip(hole, card); },
      async dealer(card, haptic) { await deal(dRow, card, true, shoe, haptic); },
      values(pv, dv) {
        host.querySelector('[data-v="player"]').textContent = pv == null ? "" : pv;
        host.querySelector('[data-v="dealer"]').textContent = dv == null ? "" : dv;
      },
      chip(text) { const c = host.querySelector(".chip-stake"); c.textContent = text || ""; c.classList.toggle("on", !!text); },
      banner(text, tone) { banner.textContent = text; banner.className = "banner show " + (tone || ""); },
    };
  }

  /* ---------- video poker ---------- */
  function Poker(host, onHold) {
    host.innerHTML = `<div class="vp">
      <div class="paytable" role="table" aria-label="Pay table">${G.POKER_PAYS.map(([n, m]) => `<div class="pt-row" role="row" data-rank="${n}"><span role="cell">${n}</span><span role="cell" class="num">${m}×</span></div>`).join("")}</div>
      <div class="vp-cards">${Array.from({ length: 5 }, (_, i) => `<button class="vp-slot" data-i="${i}" disabled aria-pressed="false"><span class="held-tag">Held</span></button>`).join("")}</div>
      <div class="deck" aria-hidden="true"><span></span><span></span></div></div>`;
    const slots = [...host.querySelectorAll(".vp-slot")], deck = host.querySelector(".deck");
    slots.forEach(s => s.addEventListener("click", () => onHold && onHold(+s.dataset.i)));
    const place = (i, card, up) => {
      slots[i].querySelector(".card")?.remove();
      const tmp = document.createElement("div"); tmp.innerHTML = cardHtml(up ? card : null, false);
      const el = tmp.firstElementChild; slots[i].prepend(el); return el;
    };
    return {
      async deal(hand, haptic) {
        this.highlight(null);
        slots.forEach((s, i) => { s.classList.remove("held"); s.setAttribute("aria-pressed", "false"); place(i, null, false); });
        for (let i = 0; i < 5; i++) {
          const el = slots[i].querySelector(".card");
          if (haptic) haptic("tap");
          sfx("deal");
          await flyIn(el, deck);
        }
        await Promise.all(hand.map((c, i) => wait(i * 70).then(() => flip(slots[i].querySelector(".card"), c))));
      },
      setHold(i, held) { slots[i].classList.toggle("held", held); slots[i].setAttribute("aria-pressed", String(held)); },
      enable(on) { slots.forEach(s => { s.disabled = !on; }); },
      async draw(hand, held, haptic) {
        const swaps = [];
        for (let i = 0; i < 5; i++) {
          if (held[i]) continue;
          const el = slots[i].querySelector(".card");
          swaps.push(finished(el.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(40px)", opacity: 0 }], { duration: dur(200), easing: "ease-in", fill: "forwards" })));
        }
        await Promise.all(swaps);
        for (let i = 0; i < 5; i++) {
          if (held[i]) continue;
          const el = place(i, null, false);
          if (haptic) haptic("tap");
          sfx("deal");
          await flyIn(el, deck);
          await flip(el, hand[i]);
        }
      },
      highlight(rank) { host.querySelectorAll(".pt-row").forEach(r => r.classList.toggle("on", r.dataset.rank === rank)); },
    };
  }

  /* Small monochrome icons per game, for lists. */
  const GAME_ICON = id => ({
    roulette: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/></svg>',
    blackjack: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="11" height="15" rx="2.5" transform="rotate(-8 8.5 12.5)"/><rect x="10" y="4" width="11" height="15" rx="2.5" transform="rotate(8 15.5 11.5)"/></svg>',
    slots: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M9 5v14M15 5v14"/></svg>',
    poker: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 3C9 7 5 9 5 13a3.5 3.5 0 0 0 6 2.4c-.3 2-1 3.3-2.3 4.6h6.6c-1.3-1.3-2-2.6-2.3-4.6A3.5 3.5 0 0 0 19 13c0-4-4-6-7-10z"/></svg>',
    coin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/></svg>',
  })[id] || "";

  /** A static, real wheel for the Roulette tile. */
  function miniWheel(el) { el.innerHTML = ""; Roulette(el, { max: 136 }); }

  window.AnteFX = { GAME_ICON, miniWheel, cardHtml, slotSvg, coinFace, GAME_ART, suitSvg, burst, countUp, wait, Coin, Roulette, Slots, Blackjack, Poker, reduced };
})();
