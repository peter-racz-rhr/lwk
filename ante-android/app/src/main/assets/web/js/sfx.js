/* Ante sound effects, synthesized with Web Audio: no audio files, works offline.
   The audio context starts on the first tap (browsers and WebView require a gesture).
   window.AnteSFX.play(name), .muted, .toggle(). The mute choice is remembered on the device. */
(function () {
  "use strict";
  const KEY = "ante-sound-muted";
  let ctx = null, master = null, noise = null, reelLoop = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch (e) { /* storage blocked */ }

  function ensure() {
    if (muted) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  // Unlock on the first touch anywhere.
  ["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, () => { ensure(); }, { once: true, capture: true }));

  /* ---------- building blocks ---------- */
  function tone({ f = 440, f2 = null, type = "sine", t = 0, dur = 0.15, vol = 0.3, attack = 0.004 }) {
    const c = ensure(); if (!c) return;
    const at = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + dur + 0.02);
  }
  function hiss({ t = 0, dur = 0.08, vol = 0.25, type = "bandpass", f = 3000, q = 1, f2 = null }) {
    const c = ensure(); if (!c) return;
    const at = c.currentTime + t;
    const src = c.createBufferSource(); src.buffer = noise;
    const flt = c.createBiquadFilter(); flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f, at);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(at, Math.random() * 0.5); src.stop(at + dur + 0.02);
  }

  /* ---------- the sounds ---------- */
  const SOUNDS = {
    tap: () => tone({ f: 1400, type: "triangle", dur: 0.035, vol: 0.12 }),
    chip: () => { // clay chips clacking
      hiss({ f: 2600, q: 6, dur: 0.05, vol: 0.35 });
      hiss({ t: 0.045, f: 3200, q: 7, dur: 0.04, vol: 0.22 });
      tone({ f: 2200, type: "sine", dur: 0.05, vol: 0.06 });
    },
    deal: () => hiss({ type: "highpass", f: 1800, f2: 5000, q: 0.7, dur: 0.11, vol: 0.32 }),
    flip: () => { hiss({ f: 4200, q: 3, dur: 0.035, vol: 0.28 }); tone({ f: 700, f2: 500, type: "triangle", dur: 0.04, vol: 0.08 }); },
    coinToss: () => { // thumb flick and metallic ring
      hiss({ f: 5000, q: 4, dur: 0.03, vol: 0.3 });
      [2200, 3420, 5150].forEach((f, i) => tone({ f, type: "sine", dur: 0.9 - i * 0.2, vol: 0.09 - i * 0.02 }));
    },
    coinLand: () => {
      tone({ f: 180, f2: 90, type: "sine", dur: 0.12, vol: 0.35 });
      [1900, 2950, 4300].forEach((f, i) => tone({ f, t: 0.01, type: "sine", dur: 0.35 - i * 0.07, vol: 0.07 }));
      [0.14, 0.24].forEach((t, i) => tone({ f: 2100, t, type: "sine", dur: 0.08, vol: 0.05 / (i + 1) }));
    },
    wheelSpin: () => hiss({ type: "bandpass", f: 400, f2: 160, q: 0.8, dur: 1.6, vol: 0.12 }),
    ballTick: () => { hiss({ f: 5200, q: 9, dur: 0.018, vol: 0.2 }); tone({ f: 3100 + Math.random() * 600, type: "sine", dur: 0.02, vol: 0.05 }); },
    ballDrop: () => { hiss({ f: 2400, q: 5, dur: 0.06, vol: 0.4 }); tone({ f: 900, f2: 600, type: "triangle", dur: 0.06, vol: 0.12 }); },
    leverClick: () => { hiss({ f: 3800, q: 6, dur: 0.02, vol: 0.18 }); tone({ f: 1600, type: "square", dur: 0.012, vol: 0.03 }); },
    leverPull: () => { tone({ f: 120, f2: 55, type: "sine", dur: 0.18, vol: 0.5 }); hiss({ f: 1400, q: 1.5, dur: 0.09, vol: 0.3 }); tone({ f: 700, f2: 420, t: 0.02, type: "triangle", dur: 0.08, vol: 0.08 }); },
    leverJam: () => tone({ f: 160, type: "square", dur: 0.06, vol: 0.06 }),
    reelStop: () => { tone({ f: 140, f2: 70, type: "sine", dur: 0.14, vol: 0.45 }); hiss({ f: 900, q: 2, dur: 0.06, vol: 0.25 }); },
    win: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone({ f, t: i * 0.085, type: "triangle", dur: 0.32, vol: 0.18 });
      tone({ f: f * 2, t: i * 0.085, type: "sine", dur: 0.2, vol: 0.04 });
    }),
    bigWin: () => {
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone({ f, t: i * 0.07, type: "triangle", dur: 0.5, vol: 0.18 }));
      for (let i = 0; i < 14; i++) tone({ f: 2400 + Math.random() * 2400, t: 0.4 + i * 0.05, type: "sine", dur: 0.12, vol: 0.05 });
    },
    lose: () => { tone({ f: 330, f2: 247, type: "triangle", dur: 0.28, vol: 0.14 }); tone({ f: 247, f2: 185, t: 0.16, type: "triangle", dur: 0.36, vol: 0.12 }); },
    push: () => tone({ f: 440, type: "triangle", dur: 0.22, vol: 0.12 }),
    block: () => { tone({ f: 196, type: "sine", dur: 0.4, vol: 0.18 }); tone({ f: 147, t: 0.12, type: "sine", dur: 0.5, vol: 0.14 }); },
  };

  /* A clicking reel motor while slots spin. */
  function reelStart() {
    reelStop();
    if (!ensure()) return;
    let n = 0;
    reelLoop = setInterval(() => { hiss({ f: 1800 + (n++ % 3) * 300, q: 8, dur: 0.02, vol: 0.12 }); }, 55);
  }
  function reelStop() { if (reelLoop) { clearInterval(reelLoop); reelLoop = null; } }

  window.AnteSFX = {
    play(name) { if (muted) return; const s = SOUNDS[name]; if (s) { try { s(); } catch (e) { /* audio unavailable */ } } },
    reelStart, reelStop,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) { /* storage blocked */ }
      if (muted) reelStop(); else { ensure(); SOUNDS.chip(); }
      return muted;
    },
    names: Object.keys(SOUNDS),
  };
})();
