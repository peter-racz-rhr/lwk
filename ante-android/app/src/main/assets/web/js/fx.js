/* Visual layer for Ante's tables: card, coin, wheel, reel and particle animations.
   Every animation returns a Promise so the game flow can await it. Respects reduced motion. */
(function () {
  "use strict";
  const G = window.AnteGames;
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = ms => new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 30) : ms));
  const dur = ms => (reduced() ? 1 : ms);
  const finished = a => (a && a.finished ? a.finished.catch(() => {}) : Promise.resolve());

  /* ---------- artwork ---------- */
  const SUIT_PATH = {
    spades: "M32 6C24 18 10 26 10 38c0 7 5 12 11 12 4 0 7-2 9-5-1 6-3 10-7 13h18c-4-3-6-7-7-13 2 3 5 5 9 5 6 0 11-5 11-12C54 26 40 18 32 6z",
    hearts: "M32 56C20 46 8 37 8 24 8 16 14 10 21 10c5 0 9 3 11 7 2-4 6-7 11-7 7 0 13 6 13 14 0 13-12 22-24 32z",
    diamonds: "M32 6 52 32 32 58 12 32z",
    clubs: "M32 8c-7 0-12 5-12 12 0 3 1 6 3 8-2-1-4-1-6-1-7 0-11 5-11 11s5 12 11 12c5 0 8-2 10-5-1 6-3 9-6 12h22c-3-3-5-6-6-12 2 3 5 5 10 5 6 0 11-5 11-12s-4-11-11-11c-2 0-4 0-6 1 2-2 3-5 3-8 0-7-5-12-12-12z",
  };
  const suitSvg = (suit, cls) => `<svg class="${cls || ""}" viewBox="0 0 64 64" aria-hidden="true"><path d="${SUIT_PATH[suit]}" fill="currentColor"/></svg>`;

  function cardHtml(card, faceUp) {
    const back = `<div class="face back"><i></i></div>`;
    if (!card) return `<div class="card"><div class="card-in">${back}</div></div>`;
    const suit = G.SUITS[card.s], rank = G.rankLabel(card.r), red = G.isRed(card);
    const court = card.r >= 11;
    const centre = court
      ? `<span class="court"><b>${rank}</b>${suitSvg(suit, "court-suit")}</span>`
      : `<span class="pip">${suitSvg(suit)}</span>`;
    const name = `${rank === "A" ? "Ace" : rank === "J" ? "Jack" : rank === "Q" ? "Queen" : rank === "K" ? "King" : rank} of ${suit}`;
    return `<div class="card ${faceUp ? "up" : ""}" data-name="${name}" role="img" aria-label="${faceUp ? name : "Face-down card"}">
      <div class="card-in">
        <div class="face front ${red ? "red" : ""}">
          <span class="ix"><b>${rank}</b>${suitSvg(suit)}</span>${centre}<span class="ix ix-b"><b>${rank}</b>${suitSvg(suit)}</span>
        </div>${back}
      </div></div>`;
  }

  const SLOT_ART = {
    seven: `<svg viewBox="0 0 64 64" aria-label="Seven"><text x="32" y="53" text-anchor="middle" font-family="'Big Shoulders Display', Impact, sans-serif" font-weight="800" font-size="58" fill="var(--red)" stroke="var(--brass)" stroke-width="2" paint-order="stroke">7</text></svg>`,
    bar: `<svg viewBox="0 0 64 64" aria-label="Bar"><rect x="5" y="20" width="54" height="24" rx="6" fill="#141716" stroke="var(--brass)" stroke-width="2.5"/><text x="32" y="39" text-anchor="middle" font-family="'Big Shoulders Display', Impact, sans-serif" font-weight="800" font-size="19" letter-spacing="2" fill="var(--ivory)">BAR</text></svg>`,
    bell: `<svg viewBox="0 0 64 64" aria-label="Bell"><path d="M32 8c-2 0-3 1-3 3v2c-9 2-14 10-14 19v9l-5 6v3h44v-3l-5-6v-9c0-9-5-17-14-19v-2c0-2-1-3-3-3z" fill="var(--brass)"/><path d="M24 22c-3 3-4 7-4 11v7" stroke="#F6E2AE" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="32" cy="54" r="5" fill="var(--brass-deep)"/></svg>`,
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
        const fill = c === "green" ? "var(--zero)" : c === "red" ? "var(--red)" : "#141716";
        const p = (r, a) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
        wedges += `<path d="M${p(44, a0)}A44 44 0 0 1 ${p(44, a1)}L${p(30, a1)}A30 30 0 0 0 ${p(30, a0)}z" fill="${fill}"/>`;
      }
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="49" fill="#2A1A10" stroke="var(--brass)" stroke-width="1.5"/>${wedges}<circle cx="50" cy="50" r="30" fill="var(--felt-deep)"/><circle cx="50" cy="50" r="7" fill="var(--brass)"/><path d="M50 32v36M32 50h36" stroke="var(--brass)" stroke-width="2.5" stroke-linecap="round"/><circle cx="72" cy="22" r="3.4" fill="var(--ivory)"/></svg>`;
    },
    blackjack: () => `<div class="mini-cards">${cardHtml({ r: 1, s: 0 }, true)}${cardHtml({ r: 13, s: 1 }, true)}</div>`,
    slots: () => `<div class="mini-reels">${["seven", "seven", "seven"].map(s => `<span>${slotSvg(s)}</span>`).join("")}</div>`,
    poker: () => `<div class="mini-fan">${[{ r: 10, s: 2 }, { r: 11, s: 2 }, { r: 12, s: 2 }, { r: 13, s: 2 }, { r: 1, s: 2 }].map(c => cardHtml(c, true)).join("")}</div>`,
    coin: () => `<div class="mini-coin">${coinFace("H")}</div>`,
  };

  function coinFace(side) {
    return side === "H"
      ? `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="var(--brass)"/><circle cx="50" cy="50" r="41" fill="none" stroke="var(--brass-deep)" stroke-width="2" stroke-dasharray="3 4"/><circle cx="50" cy="50" r="34" fill="#E6C784"/><text x="50" y="64" text-anchor="middle" font-family="'Big Shoulders Display', Impact, sans-serif" font-weight="800" font-size="40" fill="var(--brass-ink)">H</text></svg>`
      : `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#C9A35C"/><circle cx="50" cy="50" r="41" fill="none" stroke="var(--brass-deep)" stroke-width="2" stroke-dasharray="3 4"/><circle cx="50" cy="50" r="34" fill="#D9B56E"/><path d="M38 30h24v4l-9 16 9 16v4H38v-4l9-16-9-16z" fill="var(--brass-ink)"/><text x="50" y="92" text-anchor="middle" font-family="'Big Shoulders Display', Impact, sans-serif" font-weight="800" font-size="9" letter-spacing="2" fill="var(--brass-ink)">T</text></svg>`;
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
    const colors = ["#D9B56E", "#F2EAD8", "#E6C784", "#9C7B3C"];
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
    if (haptic) haptic("tap");
    await flyIn(el, from);
    if (faceUp) await flip(el, card);
    return el;
  }

  /* ---------- coin ---------- */
  function Coin(host) {
    host.innerHTML = `<div class="coin-stage"><div class="coin-shadow"></div><div class="coin-toss"><div class="coin3d">
      <div class="coin-face heads">${coinFace("H")}</div><div class="coin-face tails">${coinFace("T")}</div></div></div></div>`;
    const toss = host.querySelector(".coin-toss"), coin = host.querySelector(".coin3d"), shadow = host.querySelector(".coin-shadow");
    let angle = 0;
    return {
      async flip(result) {
        const turns = 6 + ((Math.random() * 3) | 0);
        const base = Math.ceil(angle / 360) * 360;
        const end = base + turns * 360 + (result === "T" ? 180 : 0);
        const d = dur(1500);
        const a1 = toss.animate([{ transform: "translateY(0)" }, { transform: "translateY(-150px)", offset: 0.45 }, { transform: "translateY(0)", offset: 0.85 }, { transform: "translateY(-14px)", offset: 0.93 }, { transform: "translateY(0)" }], { duration: d, easing: "ease-in-out" });
        const a2 = coin.animate([{ transform: `rotateX(${angle}deg)` }, { transform: `rotateX(${end}deg)` }], { duration: d * 0.88, easing: "cubic-bezier(.25,.6,.3,1)", fill: "forwards" });
        const a3 = shadow.animate([{ transform: "scale(1)", opacity: 0.55 }, { transform: "scale(.45)", opacity: 0.2, offset: 0.45 }, { transform: "scale(1)", opacity: 0.55, offset: 0.85 }, { transform: "scale(1)", opacity: 0.55 }], { duration: d });
        await Promise.all([finished(a1), finished(a2), finished(a3)]);
        coin.style.transform = `rotateX(${end}deg)`;
        a2.cancel();
        angle = end;
      },
    };
  }

  /* ---------- roulette wheel ---------- */
  function Roulette(host) {
    host.innerHTML = `<div class="wheel-wrap"><canvas class="wheel" aria-label="Roulette wheel" role="img"></canvas>
      <div class="wheel-result" aria-live="polite"></div></div>`;
    const cv = host.querySelector("canvas"), out = host.querySelector(".wheel-result");
    const N = G.WHEEL.length, STEP = (Math.PI * 2) / N;
    let size = 0, R = 0, dpr = 1, stator = null, rotor = null;
    let wheelA = 0, ballA = -Math.PI / 2, ballR = 0, highlight = -1, showBall = false;

    function setup() {
      const w = Math.min(host.clientWidth || 300, 320);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      size = w; R = w / 2;
      cv.style.width = cv.style.height = w + "px";
      cv.width = cv.height = Math.round(w * dpr);
      stator = drawStator(); rotor = drawRotor();
      ballR = R * 0.85;
      draw();
    }
    function off() { const c = document.createElement("canvas"); c.width = c.height = Math.round(size * dpr); const x = c.getContext("2d"); x.scale(dpr, dpr); x.translate(R, R); return [c, x]; }
    function ring(x, r0, r1, fill) { x.beginPath(); x.arc(0, 0, r1, 0, Math.PI * 2); x.arc(0, 0, r0, 0, Math.PI * 2, true); x.fillStyle = fill; x.fill(); }
    function drawStator() {
      const [c, x] = off();
      const wood = x.createRadialGradient(0, 0, R * 0.8, 0, 0, R);
      wood.addColorStop(0, "#1E120A"); wood.addColorStop(0.5, "#3B2416"); wood.addColorStop(1, "#24150C");
      ring(x, R * 0.9, R * 0.995, wood);
      ring(x, R * 0.895, R * 0.91, "#D9B56E");
      const track = x.createRadialGradient(0, 0, R * 0.78, 0, 0, R * 0.9);
      track.addColorStop(0, "#0B0F0E"); track.addColorStop(0.6, "#1B2422"); track.addColorStop(1, "#0D1312");
      ring(x, R * 0.79, R * 0.895, track);
      // ball deflectors
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        x.save(); x.rotate(a); x.fillStyle = "#B8954F";
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
        x.fillStyle = col === "green" ? "#1F7A4F" : col === "red" ? "#B83A2E" : "#141716";
        x.fill();
        // number
        x.save(); x.rotate(i * STEP);
        x.fillStyle = "#F2EAD8";
        x.font = `700 ${Math.round(R * 0.085)}px 'Big Shoulders Display', Impact, sans-serif`;
        x.textAlign = "center"; x.textBaseline = "middle";
        x.fillText(String(n), 0, -R * 0.735);
        x.restore();
      }
      // pocket frets
      x.strokeStyle = "#C9A35C"; x.lineWidth = 1.2;
      for (let i = 0; i < N; i++) {
        const a = i * STEP - STEP / 2 - Math.PI / 2;
        x.beginPath(); x.moveTo(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6); x.lineTo(Math.cos(a) * R * 0.79, Math.sin(a) * R * 0.79); x.stroke();
      }
      x.beginPath(); x.arc(0, 0, R * 0.69, 0, Math.PI * 2); x.strokeStyle = "rgba(201,163,92,.55)"; x.lineWidth = 1; x.stroke();
      // cone
      const cone = x.createRadialGradient(-R * 0.1, -R * 0.12, R * 0.05, 0, 0, R * 0.6);
      cone.addColorStop(0, "#3A6B5A"); cone.addColorStop(0.55, "#1C4136"); cone.addColorStop(1, "#0F2620");
      x.beginPath(); x.arc(0, 0, R * 0.6, 0, Math.PI * 2); x.fillStyle = cone; x.fill();
      x.beginPath(); x.arc(0, 0, R * 0.6, 0, Math.PI * 2); x.strokeStyle = "#C9A35C"; x.lineWidth = 2; x.stroke();
      // turret
      x.strokeStyle = "#D9B56E"; x.lineCap = "round"; x.lineWidth = R * 0.035;
      for (let k = 0; k < 4; k++) {
        x.save(); x.rotate((k * Math.PI) / 2);
        x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -R * 0.3); x.stroke();
        x.beginPath(); x.arc(0, -R * 0.3, R * 0.04, 0, Math.PI * 2); x.fillStyle = "#E6C784"; x.fill();
        x.restore();
      }
      const knob = x.createRadialGradient(-R * 0.03, -R * 0.03, 1, 0, 0, R * 0.09);
      knob.addColorStop(0, "#F6E2AE"); knob.addColorStop(1, "#9C7B3C");
      x.beginPath(); x.arc(0, 0, R * 0.09, 0, Math.PI * 2); x.fillStyle = knob; x.fill();
      return c;
    }
    function draw() {
      const x = cv.getContext("2d");
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, cv.width, cv.height);
      x.drawImage(stator, 0, 0);
      x.save(); x.translate(cv.width / 2, cv.height / 2); x.rotate(wheelA); x.drawImage(rotor, -cv.width / 2, -cv.height / 2);
      if (highlight >= 0) {
        x.scale(dpr, dpr);
        const a0 = highlight * STEP - STEP / 2 - Math.PI / 2;
        x.beginPath(); x.arc(0, 0, R * 0.795, a0, a0 + STEP); x.arc(0, 0, R * 0.595, a0 + STEP, a0, true); x.closePath();
        x.strokeStyle = "#F6E2AE"; x.lineWidth = 2.5; x.stroke();
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
    let lastW = host.clientWidth;
    const ro = window.ResizeObserver ? new ResizeObserver(() => { if (host.clientWidth !== lastW) { lastW = host.clientWidth; setup(); } }) : null;
    if (ro) ro.observe(host);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rotor = drawRotor(); draw(); });

    return {
      spin(n, onTick) {
        const index = G.WHEEL.indexOf(n);
        highlight = -1; showBall = true; out.classList.remove("show");
        const T = dur(6200);
        const w0 = wheelA, W = Math.PI * 2 * (2.2 + Math.random() * 0.6);
        const wf = w0 + W;
        const pocketScreen = wf + index * STEP - Math.PI / 2; // absolute angle of the pocket at the end
        const b0 = ballA;
        let B = b0 - pocketScreen;
        while (B < Math.PI * 2 * 8) B += Math.PI * 2; // ball travels 8+ turns the other way
        const rim = R * 0.85, pocket = R * 0.655;
        let lastPocket = -1;
        return new Promise(resolve => {
          const t0 = performance.now();
          function frame(now) {
            const t = Math.min(1, (now - t0) / T);
            wheelA = w0 + W * easeOut(t, 3);
            const free = b0 - B * easeOut(t, 2.4);
            // Ball drops off the track between 55% and 80%, rattles, then rides its pocket.
            if (t < 0.55) ballR = rim;
            else if (t < 0.8) {
              const k = (t - 0.55) / 0.25;
              ballR = rim - (rim - pocket) * smooth(k) + Math.sin(k * Math.PI * 5) * R * 0.03 * (1 - k);
            } else ballR = pocket;
            const locked = wheelA + index * STEP - Math.PI / 2;
            const s = t < 0.8 ? 0 : smooth((t - 0.8) / 0.2);
            ballA = free + (locked - free) * s;
            if (onTick && t > 0.55) {
              const rel = Math.round(((((ballA - wheelA + Math.PI / 2) / STEP) % N) + N) % N);
              if (rel !== lastPocket) { lastPocket = rel; if (t < 0.85) onTick(); }
            }
            draw();
            if (t < 1) requestAnimationFrame(frame);
            else {
              wheelA %= Math.PI * 2; ballA = wheelA + index * STEP - Math.PI / 2;
              highlight = index; draw();
              out.textContent = String(n);
              out.className = "wheel-result show " + G.pocketColor(n);
              resolve();
            }
          }
          requestAnimationFrame(frame);
        });
      },
      destroy() { if (ro) ro.disconnect(); },
    };
  }

  /* ---------- slot machine ---------- */
  function Slots(host, initial) {
    const rows = r => [G.slotSymbol(), r, G.slotSymbol()];
    host.innerHTML = `<div class="cabinet"><div class="reels">${initial.map(s => `<div class="reel"><div class="strip">${rows(s).map(x => `<div class="cell">${slotSvg(x)}</div>`).join("")}</div></div>`).join("")}</div><div class="payline" aria-hidden="true"></div></div>`;
    const reels = [...host.querySelectorAll(".reel")];
    return {
      async spin(final, onStop) {
        host.querySelector(".cabinet").classList.remove("hit");
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
          if (onStop) onStop(i);
        });
        await Promise.all(jobs);
      },
      win() { host.querySelector(".cabinet").classList.add("hit"); },
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
          await flyIn(el, deck);
          await flip(el, hand[i]);
        }
      },
      highlight(rank) { host.querySelectorAll(".pt-row").forEach(r => r.classList.toggle("on", r.dataset.rank === rank)); },
    };
  }

  window.AnteFX = { cardHtml, slotSvg, coinFace, GAME_ART, suitSvg, burst, countUp, wait, Coin, Roulette, Slots, Blackjack, Poker, reduced };
})();
