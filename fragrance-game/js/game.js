/* Blind Spritz: guess the fragrance from its notes. */
(function () {
  "use strict";

  const ALL = window.FRAGRANCES || [];
  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------- modes ----------
  const MODES = {
    easy: {
      label: "Easy", guesses: 10, hints: 4, pool: (f) => f.popularity >= 5,
      blurb: "Iconic bottles only. Full pyramid, accords, gender and house type are shown.",
      showAccords: true, showMeta: true, startNotes: Infinity,
    },
    medium: {
      label: "Medium", guesses: 8, hints: 3, pool: (f) => f.popularity >= 4,
      blurb: "Popular bottles. Full note pyramid, nothing else.",
      showAccords: false, showMeta: false, startNotes: Infinity,
    },
    hard: {
      label: "Hard", guesses: 6, hints: 2, pool: () => true,
      blurb: "Every bottle. Two notes to start; each miss reveals one more.",
      showAccords: false, showMeta: false, startNotes: 2,
    },
  };

  // ---------- scales ----------
  const CONC = { EDC: 1, EDT: 2, EDP: 3, Parfum: 4, Extrait: 5 };
  const CONC_LABEL = { EDC: "Cologne", EDT: "Eau de Toilette", EDP: "Eau de Parfum", Parfum: "Parfum", Extrait: "Extrait" };
  const LONGEVITY = ["", "Very weak", "Weak", "Moderate", "Long", "Eternal"];
  const SILLAGE = ["", "Intimate", "Moderate", "Strong", "Huge"];
  const SHORT_GENDER = { Masculine: "Men", Feminine: "Women", Unisex: "Unisex" };
  const POPULARITY = ["", "Rare find", "Known", "Popular", "Very popular", "Iconic"];

  // Accord bar colours, loosely following Fragrantica's palette.
  const ACCORD_HUE = {
    citrus: "#e8d44d", fresh: "#9fd8e8", aquatic: "#5fb7d4", aromatic: "#6fa98a", green: "#7cb342", fougère: "#8aa874",
    woody: "#9b7653", earthy: "#8a7356", leather: "#7a4a35", smoky: "#7d7d86", oud: "#5e3d2c", tobacco: "#a0703f",
    amber: "#d3822e", ambery: "#d3822e", "warm spicy": "#c4502d", spicy: "#c4502d", "fresh spicy": "#9ab55a", cinnamon: "#b4552c",
    saffron: "#d4882b", vanilla: "#f0dcae", sweet: "#e89aa8", gourmand: "#c98b5a", caramel: "#c58a3c", honey: "#e3a636",
    coffee: "#6b4a32", cacao: "#6e4630", chocolate: "#5d3a28", almond: "#e4cfa8", cherry: "#b8283f", boozy: "#a2582c",
    floral: "#f08eb0", "white floral": "#f3eef0", rose: "#e8517a", iris: "#a99ad6", violet: "#8a6fc4", tuberose: "#f5e3ea",
    neroli: "#f6e7b5", powdery: "#e9cfe0", musk: "#d9cfe6", clean: "#d7e8ef", fruity: "#f2795f", fig: "#7a8f4e",
    tea: "#9bb27a", milky: "#f1ece0", coconut: "#f2eee3", patchouli: "#7b6a3e", mossy: "#6e7e4a", chypre: "#7f8a55",
    animalic: "#8d6a52", incense: "#a39fa0", balsamic: "#b77b4e", conifer: "#4d7a57", salty: "#cfe0e6", mineral: "#a9b4b8",
    metallic: "#a8b1b8", lavender: "#9c88c9", aldehydic: "#e7ecf3", velvety: "#c6a5b6", "sweet ": "#e89aa8",
  };

  // ---------- note canonicalisation ----------
  const NOTE_ALIAS = {
    "orris root": "iris", "orris": "iris", "ambrox": "ambroxan", "jasmine sambac": "jasmine", "water jasmine": "jasmine",
    "white musk": "musk", "white rose": "rose", "damask rose": "rose", "sea water": "sea notes", "water notes": "sea notes",
    "tobacco leaf": "tobacco", "cocoa": "cacao", "olibanum": "incense", "cassis": "black currant", "green apple": "apple",
    "black pepper": "pepper", "litchi": "lychee", "pelargonium": "geranium", "orange flower": "orange blossom",
    "vanilla orchid": "vanilla", "blood mandarin": "mandarin", "juniper berries": "juniper", "cashmere wood": "cashmeran",
  };
  const canon = (n) => {
    const k = n.toLowerCase().trim();
    return NOTE_ALIAS[k] || k;
  };
  const allNotes = (f) => [...f.top, ...f.heart, ...f.base];
  const noteSet = (f) => new Set(allNotes(f).map(canon));

  // ---------- storage ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("blindspritz:" + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, val) { try { localStorage.setItem("blindspritz:" + key, JSON.stringify(val)); } catch (e) { /* storage off */ } },
  };

  // ---------- seeded randomness ----------
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }
  const todayKey = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  // ---------- state ----------
  let prefs = store.get("prefs", { mode: "medium", play: "daily" });
  if (!MODES[prefs.mode]) prefs.mode = "medium";
  let game = null;

  function pool() { return ALL.filter(MODES[prefs.mode].pool); }

  function pickTarget() {
    const p = pool();
    if (prefs.play === "daily") return p[hash(todayKey() + ":" + prefs.mode) % p.length];
    const recent = store.get("recent:" + prefs.mode, []);
    const fresh = p.filter((f) => !recent.includes(f.id));
    const choice = (fresh.length ? fresh : p)[Math.floor(Math.random() * (fresh.length ? fresh.length : p.length))];
    store.set("recent:" + prefs.mode, [choice.id, ...recent].slice(0, Math.min(25, p.length - 1)));
    return choice;
  }

  function revealOrder(target, seed) {
    // Hard mode: base notes first, then heart, then top. Shuffled inside each tier.
    const r = rng(seed);
    const shuffle = (a) => a.map((x) => [r(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    return [...shuffle(target.base), ...shuffle(target.heart), ...shuffle(target.top)].map(canon);
  }

  function newGame(restore) {
    const daily = prefs.play === "daily";
    const key = "daily:" + prefs.mode + ":" + todayKey();
    if (restore && daily) {
      const saved = store.get(key, null);
      const t = saved && ALL.find((f) => f.id === saved.target);
      if (t) { game = { ...saved, target: t, key }; render(); return; }
    }
    const target = pickTarget();
    game = {
      key, daily, mode: prefs.mode, target, guesses: [], hints: [], over: false, won: false,
      order: revealOrder(target, hash(target.id + key)), date: todayKey(),
    };
    save();
    render();
  }

  function save() {
    if (!game || !game.daily) return;
    store.set(game.key, { ...game, target: game.target.id });
  }

  // ---------- comparison ----------
  function compare(guess, target) {
    const tn = noteSet(target), gn = noteSet(guess);
    const shared = [...gn].filter((n) => tn.has(n));
    const num = (a, b, near) => ({ state: a === b ? "hit" : Math.abs(a - b) <= near ? "near" : "miss", dir: a === b ? 0 : b > a ? 1 : -1 });
    const yr = num(guess.year, target.year, 4);
    const cc = num(CONC[guess.conc], CONC[target.conc], 1);
    const lo = num(guess.longevity, target.longevity, 1);
    const si = num(guess.sillage, target.sillage, 1);
    const po = num(guess.popularity, target.popularity, 1);
    const tAcc = target.accords.map((a) => a.toLowerCase());
    return [
      { key: "brand", label: "Brand", value: guess.brand, state: guess.brand === target.brand ? "hit" : guess.country === target.country && guess.house === target.house ? "near" : "miss", note: guess.brand !== target.brand && guess.country === target.country && guess.house === target.house ? "same country & type" : "" },
      { key: "house", label: "House", value: guess.house, state: guess.house === target.house ? "hit" : "miss" },
      { key: "gender", label: "Gender", value: SHORT_GENDER[guess.gender], state: guess.gender === target.gender ? "hit" : (guess.gender === "Unisex" || target.gender === "Unisex") ? "near" : "miss" },
      { key: "family", label: "Family", value: guess.family, state: guess.family === target.family ? "hit" : tAcc.includes(guess.family.toLowerCase()) ? "near" : "miss" },
      { key: "year", label: "Year", value: String(guess.year), ...yr },
      { key: "conc", label: "Strength", value: guess.conc, ...cc },
      { key: "longevity", label: "Lasting", value: LONGEVITY[guess.longevity], ...lo },
      { key: "sillage", label: "Sillage", value: SILLAGE[guess.sillage], ...si },
      { key: "popularity", label: "Hype", value: POPULARITY[guess.popularity], ...po },
      { key: "notes", label: "Notes", value: shared.length ? shared.length + " shared" : "none", state: guess.id === target.id ? "hit" : shared.length ? "near" : "miss", shared },
    ];
  }

  // ---------- what the player can see ----------
  function visibleNotes() {
    const m = MODES[game.mode];
    const all = noteSet(game.target);
    if (m.startNotes === Infinity || game.over) return all;
    const misses = game.guesses.filter((id) => id !== game.target.id).length;
    const fromHints = game.hints.filter((h) => h === "note").length;
    const vis = new Set(game.order.slice(0, m.startNotes + misses + fromHints));
    // Notes shared with your guesses are uncovered too.
    game.guesses.forEach((id) => {
      const g = ALL.find((f) => f.id === id);
      if (g) noteSet(g).forEach((n) => all.has(n) && vis.add(n));
    });
    return vis;
  }

  function foundNotes() {
    const s = new Set();
    game.guesses.forEach((id) => {
      const g = ALL.find((f) => f.id === id);
      if (g && g.id !== game.target.id) noteSet(g).forEach((n) => s.add(n));
    });
    return s;
  }

  // ---------- hints ----------
  const HINTS = [
    { id: "house", label: "House type", value: (t) => t.house, hideIf: (m) => m.showMeta },
    { id: "gender", label: "Gender", value: (t) => t.gender, hideIf: (m) => m.showMeta },
    { id: "decade", label: "Release decade", value: (t) => Math.floor(t.year / 10) * 10 + "s" },
    { id: "family", label: "Olfactive family", value: (t) => t.family },
    { id: "country", label: "Country of the house", value: (t) => t.country },
    { id: "initial", label: "Brand initial", value: (t) => t.brand[0] + " · " + t.brand.replace(/[^A-Za-z]/g, "").length + " letters" },
    { id: "note", label: "Reveal a note", value: () => "One more note uncovered", onlyIf: (m) => m.startNotes !== Infinity, repeat: true },
  ];

  function useHint(id) {
    const m = MODES[game.mode];
    if (game.over || game.hints.length >= m.hints) return;
    const h = HINTS.find((x) => x.id === id);
    if (!h || (!h.repeat && game.hints.includes(id))) return;
    if (id === "note" && visibleNotes().size >= noteSet(game.target).size) return;
    game.hints.push(id);
    save();
    render();
  }

  // ---------- guessing ----------
  function submitGuess(id) {
    if (game.over || game.guesses.includes(id)) return;
    const f = ALL.find((x) => x.id === id);
    if (!f) return;
    game.guesses.push(id);
    const m = MODES[game.mode];
    if (id === game.target.id) { game.over = true; game.won = true; }
    else if (game.guesses.length >= m.guesses) { game.over = true; game.won = false; }
    if (game.over) recordResult();
    save();
    render(true);
  }

  function giveUp() {
    if (game.over) return;
    game.over = true; game.won = false; game.gaveUp = true;
    recordResult();
    save();
    render();
  }

  function recordResult() {
    const k = "stats:" + game.mode;
    const s = store.get(k, { played: 0, won: 0, streak: 0, best: 0, dist: {} });
    s.played++;
    if (game.won) {
      s.won++; s.streak++; s.best = Math.max(s.best, s.streak);
      const n = game.guesses.length; s.dist[n] = (s.dist[n] || 0) + 1;
    } else s.streak = 0;
    store.set(k, s);
  }

  // ---------- rendering ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function renderControls() {
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === prefs.mode)));
    document.querySelectorAll("[data-play]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.play === prefs.play)));
    const m = MODES[prefs.mode];
    $("#mode-blurb").textContent = m.blurb + " " + m.guesses + " guesses, " + m.hints + " hints.";
  }

  function renderStrip() {
    const m = MODES[game.mode];
    const t = game.target;
    const vis = visibleNotes();
    const found = foundNotes();
    const tier = (name, when, notes) => {
      if (!notes.length) return "";
      const chips = notes.map((n) => {
        const c = canon(n);
        if (!vis.has(c)) return '<li class="note note--hidden" aria-label="hidden note"><span>?</span></li>';
        const cls = found.has(c) && !game.over ? " note--found" : "";
        return '<li class="note' + cls + '">' + esc(n) + "</li>";
      }).join("");
      return '<div class="tier"><div class="tier__head"><span class="tier__name">' + name + '</span><span class="tier__when">' + when +
        '</span></div><ul class="notes">' + chips + "</ul></div>";
    };
    const flat = !t.top.length && !t.base.length;
    let html = "";
    if (flat) html += tier("Notes", "single layer", t.heart);
    else html += tier("Top", "0 – 15 min", t.top) + tier("Heart", "15 min – 3 h", t.heart) + tier("Base", "3 h +", t.base);

    let meta = "";
    if (m.showMeta || game.over) {
      meta = '<div class="strip__meta"><span class="pill">' + esc(t.house) + '</span><span class="pill">' + esc(t.gender) + "</span></div>";
    }
    let accords = "";
    if (m.showAccords || game.over) {
      accords = '<div class="accords" aria-label="Main accords">' + t.accords.map((a, i) => {
        const col = ACCORD_HUE[a.toLowerCase()] || "#b9b3a9";
        return '<div class="accord" style="--w:' + (100 - i * 14) + '%;--c:' + col + '"><span>' + esc(a.toLowerCase()) + "</span></div>";
      }).join("") + "</div>";
    }
    const hidden = noteSet(t).size - vis.size;
    const count = '<p class="strip__count">' + noteSet(t).size + " notes" + (hidden > 0 ? " · " + hidden + " still covered" : "") + "</p>";
    $("#strip-body").innerHTML = meta + accords + html + count;
  }

  function renderHints() {
    const m = MODES[game.mode];
    const left = m.hints - game.hints.length;
    $("#hints-left").textContent = game.over ? "" : left + " of " + m.hints + " left";
    const used = game.hints.filter((h) => h !== "note").map((id) => {
      const h = HINTS.find((x) => x.id === id);
      return '<li><span class="hint__k">' + h.label + '</span><span class="hint__v">' + esc(h.value(game.target)) + "</span></li>";
    }).join("");
    $("#hints-used").innerHTML = used;
    const btns = HINTS.filter((h) => !(h.hideIf && h.hideIf(m)) && (!h.onlyIf || h.onlyIf(m))).map((h) => {
      const taken = !h.repeat && game.hints.includes(h.id);
      const exhausted = h.id === "note" && visibleNotes().size >= noteSet(game.target).size;
      const dis = game.over || taken || left <= 0 || exhausted;
      return '<button type="button" class="hint-btn" data-hint="' + h.id + '"' + (dis ? " disabled" : "") + ">" + h.label + "</button>";
    }).join("");
    $("#hint-buttons").innerHTML = btns;
  }

  const ARROW = { 1: "↑", "-1": "↓" };
  const DIR_LABEL = { 1: "target is higher", "-1": "target is lower" };

  function renderGuesses(animateLast) {
    const m = MODES[game.mode];
    $("#guess-count").textContent = game.guesses.length + " / " + m.guesses;
    const rows = game.guesses.slice().reverse().map((id, idx) => {
      const g = ALL.find((f) => f.id === id);
      const cells = compare(g, game.target);
      const anim = animateLast && idx === 0 ? " row--new" : "";
      return '<li class="row' + anim + (g.id === game.target.id ? " row--win" : "") + '">' +
        '<div class="row__name"><span class="row__n">' + (game.guesses.length - idx) + '</span><strong>' + esc(g.name) + "</strong><span>" + esc(g.brand) + "</span></div>" +
        '<div class="tiles">' + cells.map((c, i) => {
          const arrow = c.dir ? '<span class="tile__arrow" aria-label="' + DIR_LABEL[c.dir] + '">' + ARROW[c.dir] + "</span>" : "";
          return '<div class="tile tile--' + c.state + '" style="--i:' + i + '" title="' + esc(c.label + ": " + c.value + (c.note ? " (" + c.note + ")" : "")) + '">' +
            '<span class="tile__k">' + c.label + '</span><span class="tile__v">' + esc(c.value) + arrow + "</span></div>";
        }).join("") + "</div></li>";
    }).join("");
    $("#guesses").innerHTML = rows || '<li class="empty">Your guesses appear here. Each one is compared with the mystery bottle on ten traits: green is a match, gold is close, and arrows point toward the answer.</li>';
  }

  function renderEnd() {
    const box = $("#result");
    const form = $("#guess-form");
    if (!game.over) { box.hidden = true; form.hidden = false; return; }
    form.hidden = true; box.hidden = false;
    const t = game.target;
    const s = store.get("stats:" + game.mode, { played: 0, won: 0, streak: 0, best: 0, dist: {} });
    const m = MODES[game.mode];
    const max = Math.max(1, ...Object.values(s.dist));
    const dist = Array.from({ length: m.guesses }, (_, i) => {
      const n = s.dist[i + 1] || 0;
      const mine = game.won && game.guesses.length === i + 1;
      return '<div class="dist__row"><span>' + (i + 1) + '</span><div class="dist__bar' + (mine ? " dist__bar--mine" : "") + '" style="--w:' + Math.max(6, (n / max) * 100) + '%">' + n + "</div></div>";
    }).join("");
    const q = encodeURIComponent(t.brand + " " + t.name);
    box.innerHTML =
      '<p class="result__eyebrow">' + (game.won ? "Got it in " + game.guesses.length : game.gaveUp ? "You gave up" : "Out of guesses") + "</p>" +
      '<h2 class="result__name">' + esc(t.name) + "</h2>" +
      '<p class="result__brand">' + esc(t.brand) + " · " + t.year + " · " + CONC_LABEL[t.conc] + "</p>" +
      '<dl class="result__facts">' +
      "<div><dt>House</dt><dd>" + esc(t.house) + " · " + esc(t.country) + "</dd></div>" +
      "<div><dt>Family</dt><dd>" + esc(t.family) + "</dd></div>" +
      "<div><dt>Lasting</dt><dd>" + LONGEVITY[t.longevity] + "</dd></div>" +
      "<div><dt>Sillage</dt><dd>" + SILLAGE[t.sillage] + "</dd></div></dl>" +
      '<div class="stats"><div><b>' + s.played + "</b><span>Played</span></div><div><b>" + (s.played ? Math.round((s.won / s.played) * 100) : 0) +
      "%</b><span>Won</span></div><div><b>" + s.streak + "</b><span>Streak</span></div><div><b>" + s.best + "</b><span>Best</span></div></div>" +
      '<div class="dist" aria-label="Guess distribution">' + dist + "</div>" +
      '<div class="result__actions"><button type="button" class="btn btn--primary" id="share-btn">Copy result</button>' +
      (game.daily ? '<button type="button" class="btn" id="practice-btn">Play unlimited</button>' : '<button type="button" class="btn" id="next-btn">Next bottle</button>') +
      '<a class="btn btn--link" href="https://www.fragrantica.com/search/?query=' + q + '" target="_blank" rel="noopener">View on Fragrantica ↗</a></div>' +
      '<p class="result__copied" id="copied" role="status"></p>' +
      '<textarea class="share-fallback" id="share-text" readonly hidden></textarea>';
    $("#share-btn").addEventListener("click", share);
    const next = $("#next-btn"); if (next) next.addEventListener("click", () => newGame(false));
    const prac = $("#practice-btn"); if (prac) prac.addEventListener("click", () => { prefs.play = "unlimited"; store.set("prefs", prefs); renderControls(); newGame(false); });
  }

  function shareText() {
    const m = MODES[game.mode];
    const emoji = { hit: "🟩", near: "🟨", miss: "⬛" };
    const lines = game.guesses.map((id) => {
      const g = ALL.find((f) => f.id === id);
      return compare(g, game.target).map((c) => emoji[c.state]).join("");
    });
    const head = "Blind Spritz · " + m.label + (game.daily ? " · " + game.date : "") + " · " +
      (game.won ? game.guesses.length : "X") + "/" + m.guesses + (game.hints.length ? " · " + game.hints.length + " hint" + (game.hints.length > 1 ? "s" : "") : "");
    return head + "\n" + lines.join("\n");
  }

  function share() {
    const text = shareText();
    const done = (msg) => { $("#copied").textContent = msg; };
    const fallback = () => {
      const ta = $("#share-text"); ta.hidden = false; ta.value = text; ta.select();
      done("Select the text above and copy it.");
    };
    try {
      navigator.clipboard.writeText(text).then(() => done("Copied. Paste it anywhere."), fallback);
    } catch (e) { fallback(); }
  }

  function render(animateLast) {
    renderControls();
    renderStrip();
    renderHints();
    renderGuesses(animateLast);
    renderEnd();
    $("#round-label").textContent = (game.daily ? "Daily · " + game.date : "Unlimited") + " · " + MODES[game.mode].label;
  }

  // ---------- autocomplete ----------
  function setupCombobox() {
    const input = $("#guess-input");
    const list = $("#guess-list");
    let items = [], active = -1;
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; input.removeAttribute("aria-activedescendant"); }
    function update() {
      const q = norm(input.value.trim());
      if (!q) { close(); return; }
      const words = q.split(/\s+/);
      items = ALL.filter((f) => {
        const hay = norm(f.name + " " + f.brand);
        return words.every((w) => hay.includes(w));
      }).sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name)).slice(0, 8);
      if (!items.length) {
        list.innerHTML = '<li class="opt opt--none">No bottle by that name in the cellar</li>';
        list.hidden = false; input.setAttribute("aria-expanded", "true"); return;
      }
      active = 0;
      list.innerHTML = items.map((f, i) => {
        const used = game.guesses.includes(f.id);
        return '<li class="opt' + (i === active ? " opt--active" : "") + (used ? " opt--used" : "") + '" role="option" id="opt-' + i + '" data-i="' + i + '" aria-selected="' + (i === active) + '"' + (used ? ' aria-disabled="true"' : "") + ">" +
          "<strong>" + esc(f.name) + "</strong><span>" + esc(f.brand) + (used ? " · guessed" : "") + "</span></li>";
      }).join("");
      list.hidden = false; input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-activedescendant", "opt-0");
    }
    function move(d) {
      if (!items.length) return;
      active = (active + d + items.length) % items.length;
      list.querySelectorAll(".opt").forEach((el, i) => { el.classList.toggle("opt--active", i === active); el.setAttribute("aria-selected", String(i === active)); });
      input.setAttribute("aria-activedescendant", "opt-" + active);
      const el = list.querySelector("#opt-" + active); if (el) el.scrollIntoView({ block: "nearest" });
    }
    function choose(i) {
      const f = items[i];
      if (!f || game.guesses.includes(f.id)) return;
      input.value = ""; close(); submitGuess(f.id); input.focus();
    }
    input.addEventListener("input", update);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) update(); else move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest(".opt[data-i]"); if (!li) return;
      e.preventDefault(); choose(Number(li.dataset.i));
    });
    $("#guess-form").addEventListener("submit", (e) => { e.preventDefault(); if (active >= 0) choose(active); });
    input.addEventListener("blur", () => setTimeout(close, 120));
  }

  // ---------- wiring ----------
  function init() {
    document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
      prefs.mode = b.dataset.mode; store.set("prefs", prefs); newGame(true);
    }));
    document.querySelectorAll("[data-play]").forEach((b) => b.addEventListener("click", () => {
      prefs.play = b.dataset.play; store.set("prefs", prefs); newGame(true);
    }));
    $("#hint-buttons").addEventListener("click", (e) => {
      const b = e.target.closest("[data-hint]"); if (b) useHint(b.dataset.hint);
    });
    $("#give-up").addEventListener("click", giveUp);
    $("#cellar-size").textContent = ALL.length;
    setupCombobox();
    newGame(true);
  }

  window.BlindSpritz = { compare, canon, MODES };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
