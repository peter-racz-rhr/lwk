/* Blind Spritz: guess the fragrance from its notes. */
(function () {
  "use strict";

  const ALL = window.FRAGRANCES || [];
  const $ = (sel, root = document) => root.querySelector(sel);
  const IMG_BASE = window.BLIND_SPRITZ_IMG_BASE || "https://fimgs.net/mdimg/perfume/375x500.";
  const imgSrc = (f) => (window.BLIND_SPRITZ_IMAGES && window.BLIND_SPRITZ_IMAGES[f.img]) || (f.img ? IMG_BASE + f.img + ".jpg" : "");

  // ---------- modes ----------
  const MODES = {
    easy: { label: "Easy", guesses: 10, hints: 4, minPop: 5, blur: 16, showAccords: true, showMeta: true, startNotes: Infinity,
      blurb: "Best sellers. Full pyramid, accords, house type and gender." },
    medium: { label: "Medium", guesses: 8, hints: 3, minPop: 4, blur: 24, showAccords: false, showMeta: false, startNotes: Infinity,
      blurb: "Popular bottles. Full note pyramid only." },
    hard: { label: "Hard", guesses: 6, hints: 2, minPop: 1, blur: 34, showAccords: false, showMeta: false, startNotes: 2,
      blurb: "Every bottle. Two notes to start, one more after each miss." },
  };
  const GENDERS = { all: "All", Masculine: "Men", Feminine: "Women", Unisex: "Unisex" };

  // ---------- scales ----------
  const CONC = { EDC: 1, EDT: 2, EDP: 3, Parfum: 4, Extrait: 5 };
  const CONC_LABEL = { EDC: "Cologne", EDT: "Eau de Toilette", EDP: "Eau de Parfum", Parfum: "Parfum", Extrait: "Extrait" };
  const LONGEVITY = ["", "Very weak", "Weak", "Moderate", "Long", "Eternal"];
  const SILLAGE = ["", "Intimate", "Moderate", "Strong", "Huge"];
  const POPULARITY = ["", "Rare", "Known", "Popular", "Very popular", "Iconic"];

  // ---------- note matching ----------
  const NOTE_ALIAS = {
    "orris root": "iris", "orris": "iris", "ambrox": "ambroxan", "jasmine sambac": "jasmine", "water jasmine": "jasmine",
    "white musk": "musk", "white rose": "rose", "damask rose": "rose", "sea water": "sea notes", "water notes": "sea notes",
    "tobacco leaf": "tobacco", "cocoa": "cacao", "olibanum": "incense", "cassis": "black currant", "green apple": "apple",
    "black pepper": "pepper", "litchi": "lychee", "pelargonium": "geranium", "orange flower": "orange blossom",
    "vanilla orchid": "vanilla", "blood mandarin": "mandarin", "juniper berries": "juniper", "cashmere wood": "cashmeran",
  };
  const canon = (n) => { const k = n.toLowerCase().trim(); return NOTE_ALIAS[k] || k; };
  const allNotes = (f) => [...f.top, ...f.heart, ...f.base];
  const noteSet = (f) => new Set(allNotes(f).map(canon));
  const byId = (id) => ALL.find((f) => f.id === id);

  // ---------- storage ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem("blindspritz:" + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, val) { try { localStorage.setItem("blindspritz:" + key, JSON.stringify(val)); } catch (e) { /* storage blocked */ } },
  };

  // ---------- seeded randomness ----------
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = seed || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  // ---------- state ----------
  const prefs = Object.assign({ mode: "medium", play: "daily", gender: "all" }, store.get("prefs", {}));
  if (!MODES[prefs.mode]) prefs.mode = "medium";
  if (!GENDERS[prefs.gender]) prefs.gender = "all";
  let game = null;

  function pool() {
    const m = MODES[prefs.mode];
    const g = (f) => prefs.gender === "all" || f.gender === prefs.gender;
    const p = ALL.filter((f) => g(f) && f.popularity >= m.minPop);
    return p.length >= 8 ? p : ALL.filter(g);
  }
  const slot = () => prefs.mode + ":" + prefs.gender;

  function pickTarget() {
    const p = pool();
    if (prefs.play === "daily") return p[hash(todayKey() + ":" + slot()) % p.length];
    const recent = store.get("recent:" + slot(), []);
    const fresh = p.filter((f) => !recent.includes(f.id));
    const from = fresh.length ? fresh : p;
    const choice = from[Math.floor(Math.random() * from.length)];
    store.set("recent:" + slot(), [choice.id, ...recent].slice(0, Math.max(0, Math.min(25, p.length - 1))));
    return choice;
  }

  function revealOrder(target, seed) {
    const r = rng(seed);
    const shuffle = (a) => a.map((x) => [r(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    return [...shuffle(target.base), ...shuffle(target.heart), ...shuffle(target.top)].map(canon);
  }

  function newGame(restore) {
    const daily = prefs.play === "daily";
    const key = "daily:" + slot() + ":" + todayKey();
    if (restore && daily) {
      const saved = store.get(key, null);
      const t = saved && byId(saved.target);
      if (t) { game = { ...saved, target: t, key }; render(); return; }
    }
    const target = pickTarget();
    game = { key, daily, mode: prefs.mode, gender: prefs.gender, target, guesses: [], hints: [], over: false, won: false,
      order: revealOrder(target, hash(target.id + key)), date: todayKey() };
    save();
    render();
  }
  function save() { if (game && game.daily) store.set(game.key, { ...game, target: game.target.id }); }

  // ---------- comparison ----------
  function compare(guess, target) {
    const tn = noteSet(target);
    const shared = [...noteSet(guess)].filter((n) => tn.has(n));
    const num = (a, b, near) => ({ state: a === b ? "hit" : Math.abs(a - b) <= near ? "near" : "miss", dir: a === b ? 0 : b > a ? 1 : -1 });
    const sameRegion = guess.country === target.country && guess.house === target.house;
    return [
      { label: "Brand", value: guess.brand, state: guess.brand === target.brand ? "hit" : sameRegion ? "near" : "miss" },
      { label: "House", value: guess.house, state: guess.house === target.house ? "hit" : "miss" },
      { label: "Gender", value: GENDERS[guess.gender], state: guess.gender === target.gender ? "hit" : guess.gender === "Unisex" || target.gender === "Unisex" ? "near" : "miss" },
      { label: "Family", value: guess.family, state: guess.family === target.family ? "hit" : target.accords.some((a) => a.toLowerCase() === guess.family.toLowerCase()) ? "near" : "miss" },
      { label: "Year", value: String(guess.year), ...num(guess.year, target.year, 4) },
      { label: "Strength", value: guess.conc, ...num(CONC[guess.conc], CONC[target.conc], 1) },
      { label: "Lasting", value: LONGEVITY[guess.longevity], ...num(guess.longevity, target.longevity, 1) },
      { label: "Sillage", value: SILLAGE[guess.sillage], ...num(guess.sillage, target.sillage, 1) },
      { label: "Hype", value: POPULARITY[guess.popularity], ...num(guess.popularity, target.popularity, 1) },
      { label: "Notes", value: guess.id === target.id ? "all" : shared.length + " shared", state: guess.id === target.id ? "hit" : shared.length ? "near" : "miss" },
    ];
  }

  // ---------- what the player can see ----------
  function visibleNotes() {
    const m = MODES[game.mode];
    const all = noteSet(game.target);
    if (m.startNotes === Infinity || game.over) return all;
    const misses = game.guesses.filter((id) => id !== game.target.id).length;
    const extra = game.hints.filter((h) => h === "note").length;
    const vis = new Set(game.order.slice(0, m.startNotes + misses + extra));
    game.guesses.forEach((id) => { const g = byId(id); if (g) noteSet(g).forEach((n) => all.has(n) && vis.add(n)); });
    return vis;
  }
  function sharedNotes() {
    const s = new Set();
    game.guesses.forEach((id) => { const g = byId(id); if (g && g.id !== game.target.id) noteSet(g).forEach((n) => s.add(n)); });
    return s;
  }

  // ---------- hints ----------
  const HINTS = [
    { id: "house", label: "House type", value: (t) => t.house, hide: (m) => m.showMeta },
    { id: "gender", label: "Gender", value: (t) => GENDERS[t.gender], hide: (m) => m.showMeta || game.gender !== "all" },
    { id: "decade", label: "Decade", value: (t) => Math.floor(t.year / 10) * 10 + "s" },
    { id: "family", label: "Family", value: (t) => t.family },
    { id: "country", label: "Country", value: (t) => t.country },
    { id: "initial", label: "Brand initial", value: (t) => t.brand[0] + " (" + t.brand.replace(/[^A-Za-z]/g, "").length + " letters)" },
    { id: "note", label: "Extra note", value: () => "", hide: (m) => m.startNotes === Infinity, repeat: true },
  ];
  function useHint(id) {
    const m = MODES[game.mode];
    const h = HINTS.find((x) => x.id === id);
    if (game.over || !h || game.hints.length >= m.hints || (!h.repeat && game.hints.includes(id))) return;
    if (id === "note" && visibleNotes().size >= noteSet(game.target).size) return;
    game.hints.push(id); save(); render();
  }

  // ---------- turns ----------
  function submitGuess(id) {
    if (game.over || game.guesses.includes(id) || !byId(id)) return;
    game.guesses.push(id);
    if (id === game.target.id) { game.over = true; game.won = true; }
    else if (game.guesses.length >= MODES[game.mode].guesses) game.over = true;
    if (game.over) recordResult();
    save(); render(true);
  }
  function giveUp() {
    if (game.over) return;
    game.over = true; game.gaveUp = true; recordResult(); save(); render(true);
  }
  function recordResult() {
    const k = "stats:" + game.mode;
    const s = store.get(k, { played: 0, won: 0, streak: 0, best: 0, dist: {} });
    s.played++;
    if (game.won) { s.won++; s.streak++; s.best = Math.max(s.best, s.streak); s.dist[game.guesses.length] = (s.dist[game.guesses.length] || 0) + 1; }
    else s.streak = 0;
    store.set(k, s);
  }

  // ---------- rendering ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function renderControls() {
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === prefs.mode)));
    document.querySelectorAll("[data-play]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.play === prefs.play)));
    document.querySelectorAll("[data-gender]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.gender === prefs.gender)));
    const m = MODES[prefs.mode];
    $("#mode-blurb").textContent = m.blurb + " " + m.guesses + " guesses.";
  }

  function renderBottle(justEnded) {
    const t = game.target, m = MODES[game.mode];
    const fig = $("#bottle");
    const img = $("#bottle-img");
    const src = imgSrc(t);
    if (img.dataset.src !== src) {
      fig.classList.remove("bottle--loaded", "bottle--missing");
      img.dataset.src = src;
      img.src = src;
    }
    fig.style.setProperty("--blur", m.blur + "px");
    fig.classList.toggle("bottle--revealed", game.over);
    img.alt = game.over ? t.brand + " " + t.name + " bottle" : "Blurred bottle of the hidden fragrance";
    $("#reveal-name").textContent = game.over ? t.name : "";
    $("#reveal-brand").textContent = game.over ? t.brand + " · " + t.year : "";
    if (justEnded && game.over) fig.classList.add("bottle--pop");
  }

  function renderNotes() {
    const t = game.target, m = MODES[game.mode];
    const vis = visibleNotes(), shared = sharedNotes();
    const row = (name, notes) => !notes.length ? "" :
      '<div class="tier"><dt>' + name + '</dt><dd><ul class="notes">' + notes.map((n) => {
        const c = canon(n);
        if (!vis.has(c)) return '<li class="note note--hidden"><span class="sr">hidden note</span></li>';
        return '<li class="note' + (shared.has(c) && !game.over ? " note--shared" : "") + '">' + esc(n) + "</li>";
      }).join("") + "</ul></dd></div>";
    const flat = !t.top.length && !t.base.length;
    let html = '<dl class="pyramid">' + (flat ? row("Notes", t.heart) : row("Top", t.top) + row("Heart", t.heart) + row("Base", t.base)) + "</dl>";
    const facts = [];
    if (m.showMeta || game.over) facts.push(t.house, t.gender);
    if (m.showAccords || game.over) facts.push(t.accords.slice(0, 4).join(", ").toLowerCase());
    $("#facts").textContent = facts.join(" · ");
    $("#facts").hidden = !facts.length;
    const hidden = noteSet(t).size - vis.size;
    $("#notes-count").textContent = hidden > 0 ? hidden + " of " + noteSet(t).size + " notes still hidden" : "";
    $("#notes").innerHTML = html;
  }

  function renderHints() {
    const m = MODES[game.mode];
    const left = m.hints - game.hints.length;
    const box = $("#hints");
    box.hidden = game.over;
    if (game.over) return;
    $("#hints-left").textContent = left + " left";
    $("#hints-used").innerHTML = game.hints.filter((h) => h !== "note").map((id) => {
      const h = HINTS.find((x) => x.id === id);
      return "<li><span>" + h.label + "</span> " + esc(h.value(game.target)) + "</li>";
    }).join("");
    $("#hint-buttons").innerHTML = HINTS.filter((h) => !(h.hide && h.hide(m))).map((h) => {
      const used = !h.repeat && game.hints.includes(h.id);
      const done = h.id === "note" && visibleNotes().size >= noteSet(game.target).size;
      return '<button type="button" class="chip" data-hint="' + h.id + '"' + (used || done || left <= 0 ? " disabled" : "") + ">" + h.label + "</button>";
    }).join("");
  }

  const ARROW = { 1: "↑", "-1": "↓" };
  function renderGuesses(animate) {
    const m = MODES[game.mode];
    $("#guess-count").textContent = game.guesses.length + " / " + m.guesses;
    const rows = game.guesses.slice().reverse().map((id, idx) => {
      const g = byId(id);
      const cells = compare(g, game.target);
      return '<li class="guess' + (animate && idx === 0 ? " guess--new" : "") + '">' +
        '<p class="guess__name"><strong>' + esc(g.name) + "</strong> " + esc(g.brand) + "</p>" +
        '<div class="tiles">' + cells.map((c, i) =>
          '<div class="tile tile--' + c.state + '" style="--i:' + i + '"><span class="tile__k">' + c.label + '</span><span class="tile__v">' + esc(c.value) +
          (c.dir ? ' <b aria-label="' + (c.dir > 0 ? "answer is higher" : "answer is lower") + '">' + ARROW[c.dir] + "</b>" : "") + "</span></div>").join("") +
        "</div></li>";
    }).join("");
    $("#guesses").innerHTML = rows;
    $("#guess-empty").hidden = !!rows;
  }

  function renderEnd() {
    const box = $("#result");
    $("#guess-form").hidden = game.over;
    box.hidden = !game.over;
    if (!game.over) return;
    const t = game.target, m = MODES[game.mode];
    const s = store.get("stats:" + game.mode, { played: 0, won: 0, streak: 0, best: 0, dist: {} });
    const verdict = game.won ? (game.guesses.length === 1 ? "First try." : "Solved in " + game.guesses.length + ".") : game.gaveUp ? "You gave up." : "Out of guesses.";
    box.innerHTML =
      '<p class="result__verdict">' + verdict + "</p>" +
      '<dl class="result__facts">' +
      "<div><dt>Strength</dt><dd>" + CONC_LABEL[t.conc] + "</dd></div>" +
      "<div><dt>Family</dt><dd>" + esc(t.family) + "</dd></div>" +
      "<div><dt>Lasting</dt><dd>" + LONGEVITY[t.longevity] + "</dd></div>" +
      "<div><dt>Sillage</dt><dd>" + SILLAGE[t.sillage] + "</dd></div></dl>" +
      '<p class="result__stats">' + m.label + ": " + s.played + " played · " + (s.played ? Math.round((s.won / s.played) * 100) : 0) + "% won · streak " + s.streak + " · best " + s.best + "</p>" +
      '<div class="result__actions">' +
      (game.daily ? '<button type="button" class="btn btn--solid" id="next-btn">Play unlimited</button>' : '<button type="button" class="btn btn--solid" id="next-btn">Next bottle</button>') +
      '<button type="button" class="btn" id="share-btn">Copy result</button>' +
      '<a class="btn btn--plain" href="https://www.fragrantica.com/search/?query=' + encodeURIComponent(t.brand + " " + t.name) + '" target="_blank" rel="noopener">Fragrantica ↗</a></div>' +
      '<p class="result__copied" id="copied" role="status"></p><textarea class="share-text" id="share-text" readonly hidden></textarea>';
    $("#share-btn").addEventListener("click", share);
    $("#next-btn").addEventListener("click", () => {
      if (game.daily) { prefs.play = "unlimited"; store.set("prefs", prefs); }
      newGame(false); window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function share() {
    const m = MODES[game.mode];
    const emoji = { hit: "🟩", near: "🟨", miss: "⬜" };
    const lines = game.guesses.map((id) => compare(byId(id), game.target).map((c) => emoji[c.state]).join(""));
    const text = "Blind Spritz · " + m.label + (game.gender !== "all" ? " · " + GENDERS[game.gender] : "") + (game.daily ? " · " + game.date : "") +
      " · " + (game.won ? game.guesses.length : "X") + "/" + m.guesses + "\n" + lines.join("\n");
    const out = $("#copied");
    const fallback = () => { const ta = $("#share-text"); ta.hidden = false; ta.value = text; ta.select(); out.textContent = "Copy the text above."; };
    try { navigator.clipboard.writeText(text).then(() => { out.textContent = "Copied."; }, fallback); } catch (e) { fallback(); }
  }

  function render(animate) {
    renderControls();
    renderBottle(animate);
    renderNotes();
    renderHints();
    renderGuesses(animate);
    renderEnd();
    $("#round").textContent = game.daily ? "Daily · " + game.date : "Unlimited";
    if (animate && game.over) $("#stage").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- autocomplete ----------
  function setupCombobox() {
    const input = $("#guess-input"), list = $("#guess-list");
    let items = [], active = -1;
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
    function update() {
      const q = norm(input.value.trim());
      if (!q) { close(); return; }
      const words = q.split(/\s+/);
      items = ALL.filter((f) => words.every((w) => norm(f.name + " " + f.brand).includes(w)))
        .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name)).slice(0, 8);
      list.hidden = false; input.setAttribute("aria-expanded", "true");
      if (!items.length) { list.innerHTML = '<li class="opt opt--none">No match in the list</li>'; return; }
      active = 0;
      list.innerHTML = items.map((f, i) => {
        const used = game.guesses.includes(f.id);
        return '<li class="opt' + (i === 0 ? " opt--active" : "") + (used ? " opt--used" : "") + '" role="option" id="opt-' + i + '" data-i="' + i + '" aria-selected="' + (i === 0) + '">' +
          "<span>" + esc(f.name) + "</span><span>" + esc(f.brand) + (used ? " · guessed" : "") + "</span></li>";
      }).join("");
      input.setAttribute("aria-activedescendant", "opt-0");
    }
    function move(d) {
      if (!items.length) return;
      active = (active + d + items.length) % items.length;
      list.querySelectorAll(".opt").forEach((el, i) => { el.classList.toggle("opt--active", i === active); el.setAttribute("aria-selected", String(i === active)); });
      input.setAttribute("aria-activedescendant", "opt-" + active);
      const el = $("#opt-" + active); if (el) el.scrollIntoView({ block: "nearest" });
    }
    function choose(i) {
      const f = items[i];
      if (!f || game.guesses.includes(f.id)) return;
      input.value = ""; close(); submitGuess(f.id);
      if (!game.over) input.focus();
    }
    input.addEventListener("input", update);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); list.hidden ? update() : move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", (e) => { const li = e.target.closest(".opt[data-i]"); if (li) { e.preventDefault(); choose(Number(li.dataset.i)); } });
    $("#guess-form").addEventListener("submit", (e) => { e.preventDefault(); if (active >= 0) choose(active); });
    input.addEventListener("blur", () => setTimeout(close, 120));
  }

  // ---------- wiring ----------
  function init() {
    const bind = (attr, key) => document.querySelectorAll("[data-" + attr + "]").forEach((b) => b.addEventListener("click", () => {
      prefs[key] = b.dataset[attr]; store.set("prefs", prefs); newGame(true);
    }));
    bind("mode", "mode"); bind("play", "play"); bind("gender", "gender");
    $("#hint-buttons").addEventListener("click", (e) => { const b = e.target.closest("[data-hint]"); if (b) useHint(b.dataset.hint); });
    $("#give-up").addEventListener("click", giveUp);
    const img = $("#bottle-img"), fig = $("#bottle");
    img.addEventListener("load", () => fig.classList.add("bottle--loaded"));
    img.addEventListener("error", () => fig.classList.add("bottle--missing"));
    fig.addEventListener("animationend", () => fig.classList.remove("bottle--pop"));
    $("#count").textContent = ALL.length;
    setupCombobox();
    newGame(true);
  }

  window.BlindSpritz = { compare, canon, MODES };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
