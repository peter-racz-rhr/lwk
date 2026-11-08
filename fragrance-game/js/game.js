/* Blind Spritz: guess the fragrance from its notes. */
(function () {
  "use strict";

  const ALL = window.FRAGRANCES || [];
  ALL.forEach((f, i) => { f.rank = i + 1; });
  const $ = (sel, root = document) => root.querySelector(sel);
  const IMG_BASE = "https://fimgs.net/mdimg/perfume/375x500.";
  const imgSrc = (f) => (window.BLIND_SPRITZ_IMAGES && window.BLIND_SPRITZ_IMAGES[f.id]) || IMG_BASE + f.id + ".jpg";

  // ---------- modes ----------
  // pixels: how many columns the bottle photo is shrunk to before it is blown back up.
  const MODES = {
    easy: { label: "Easy", guesses: 10, hints: 4, top: 100, pixels: 12, startNotes: Infinity, accordLabels: true, showGender: true,
      blurb: "The 100 most-voted bottles. All notes and accords are shown." },
    medium: { label: "Medium", guesses: 8, hints: 3, top: 175, pixels: 8, startNotes: 0.5, accordLabels: true, showGender: false,
      blurb: "The top 175. Half the notes start blurred; each miss uncovers one." },
    hard: { label: "Hard", guesses: 6, hints: 3, top: 250, pixels: 5, startNotes: 2, accordLabels: false, showGender: false,
      blurb: "All 250. Two notes to start, accord names hidden." },
  };
  const GENDERS = { all: "All", Masculine: "Men", Feminine: "Women", Unisex: "Unisex" };

  // Accord bar colours, close to the ones Fragrantica uses.
  const ACCORD = {
    "white floral": "#ede3e8", floral: "#f26b8f", "yellow floral": "#f2d04e", rose: "#f0447d", tuberose: "#f4dce6", violet: "#7a2bc2",
    iris: "#b7a2e0", powdery: "#e3cdbf", sweet: "#e8475a", vanilla: "#fff2c4", caramel: "#c8822c", honey: "#f0a926", chocolate: "#5e3a24",
    cacao: "#6e4228", coffee: "#5b3a29", almond: "#f0dcb6", nutty: "#b98a52", coconut: "#f6efe2", lactonic: "#f5f0e4", cherry: "#c4123a",
    rum: "#8f3e1e", whiskey: "#a8601e", fruity: "#fb5b33", tropical: "#ff9b3d", citrus: "#f3e22c", fresh: "#9ae8f4", aquatic: "#45c3e6",
    marine: "#3aa2cf", ozonic: "#b2e3f2", salty: "#d7eef2", mineral: "#a8b6bb", metallic: "#b2bcc2", green: "#3fae3b", herbal: "#78a85d",
    aromatic: "#3b8f7c", lavender: "#9a85d6", "fresh spicy": "#9bc94d", "soft spicy": "#d98a52", "warm spicy": "#d0451b", cinnamon: "#c45a26",
    anis: "#c3c7a0", amber: "#c86a1a", balsamic: "#a46b3e", woody: "#7b5a3c", earthy: "#6f5a3f", mossy: "#6b7b3a", patchouli: "#5e5a2d",
    conifer: "#2f6b4d", camphor: "#9fd1c4", oud: "#4b2f22", leather: "#6b3f2e", tobacco: "#9e6b33", smoky: "#7b7b84", animalic: "#7a4d2a",
    musky: "#c9bfd6", aldehydic: "#dfe7f2", beeswax: "#e6b34b", savory: "#a68a5b", cannabis: "#5e8a3a",
  };
  const ink = (hex) => {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1a1a1a" : "#ffffff";
  };

  // ---------- note matching ----------
  const ALIAS = {
    "orris root": "iris", "orris": "iris", "ambrox": "ambroxan", "jasmine sambac": "jasmine", "white musk": "musk",
    "sea notes": "water notes", "sea water": "water notes", "tobacco leaf": "tobacco", "cocoa": "cacao", "olibanum": "incense",
    "cassis": "black currant", "green apple": "apple", "red apple": "apple", "black pepper": "pepper", "litchi": "lychee",
    "pelargonium": "geranium", "orange flower": "orange blossom", "african orange flower": "orange blossom", "tonka": "tonka bean",
    "mandarin orange": "mandarin", "calabrian bergamot": "bergamot", "madagascar vanilla": "vanilla", "bourbon vanilla": "vanilla",
    "virginia cedar": "cedar", "atlas cedar": "cedar", "bulgarian rose": "rose", "turkish rose": "rose", "damask rose": "rose", "may rose": "rose",
  };
  const canon = (n) => { const k = n.toLowerCase().trim(); return ALIAS[k] || k; };
  const allNotes = (f) => [...f.top, ...f.heart, ...f.base];
  const noteSet = (f) => new Set(allNotes(f).map(canon));
  const byId = (id) => ALL.find((f) => f.id === id);

  // ---------- storage ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem("blindspritz2:" + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, val) { try { localStorage.setItem("blindspritz2:" + key, JSON.stringify(val)); } catch (e) { /* storage blocked */ } },
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
    const p = ALL.filter((f) => g(f) && f.rank <= m.top);
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
    store.set("recent:" + slot(), [choice.id, ...recent].slice(0, Math.max(0, Math.min(40, p.length - 1))));
    return choice;
  }

  function revealOrder(target, seed) {
    const r = rng(seed);
    const shuffle = (a) => a.map((x) => [r(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    return [...new Set([...shuffle(target.base), ...shuffle(target.heart), ...shuffle(target.top)].map(canon))];
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
  const fmtVotes = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n));
  const surname = (p) => p.split(" ").slice(-1)[0];
  function compare(guess, target) {
    const tn = noteSet(target);
    const shared = [...noteSet(guess)].filter((n) => tn.has(n));
    const num = (a, b, near) => ({ state: a === b ? "hit" : Math.abs(a - b) <= near ? "near" : "miss", dir: a === b ? 0 : b > a ? 1 : -1 });
    const top5 = (f) => f.accords.slice(0, 5);
    const sharedAcc = top5(guess).filter((a) => top5(target).includes(a)).length;
    const sharedPerf = guess.perfumers.filter((p) => target.perfumers.includes(p));
    const same = guess.id === target.id;
    const votes = num(guess.votes, target.votes, Math.round(target.votes * 0.2));
    if (votes.state === "hit" && !same) votes.state = "near";
    return [
      { label: "Brand", value: guess.brand, state: guess.brand === target.brand ? "hit" : "miss" },
      { label: "Gender", value: GENDERS[guess.gender], state: guess.gender === target.gender ? "hit" : guess.gender === "Unisex" || target.gender === "Unisex" ? "near" : "miss" },
      { label: "Country", value: guess.country, state: guess.country === target.country ? "hit" : "miss" },
      { label: "Year", value: guess.year ? String(guess.year) : "?", ...num(guess.year || 0, target.year || 0, 4) },
      { label: "Rating", value: guess.rating.toFixed(2), ...num(Math.round(guess.rating * 100), Math.round(target.rating * 100), 10) },
      { label: "Votes", value: fmtVotes(guess.votes), ...votes },
      { label: "Main accord", value: guess.accords[0] || "?", state: guess.accords[0] === target.accords[0] ? "hit" : top5(target).includes(guess.accords[0]) ? "near" : "miss" },
      { label: "Accords", value: sharedAcc + " / 5", state: same || sharedAcc === 5 ? "hit" : sharedAcc >= 2 ? "near" : "miss" },
      { label: "Perfumer", value: guess.perfumers.length ? guess.perfumers.map(surname).join(", ") : "Unknown", state: same || (sharedPerf.length && sharedPerf.length === target.perfumers.length) ? "hit" : sharedPerf.length ? "near" : "miss" },
      { label: "Notes", value: same ? "all" : shared.length + " shared", state: same ? "hit" : shared.length ? "near" : "miss" },
    ];
  }

  // ---------- what the player can see ----------
  function startCount() {
    const m = MODES[game.mode], total = game.order.length;
    if (m.startNotes === Infinity) return Infinity;
    return m.startNotes < 1 ? Math.max(3, Math.ceil(total * m.startNotes)) : m.startNotes;
  }
  function visibleNotes() {
    const all = noteSet(game.target);
    const start = startCount();
    if (start === Infinity || game.over) return all;
    const misses = game.guesses.filter((id) => id !== game.target.id).length;
    const extra = game.hints.filter((h) => h === "note").length;
    const vis = new Set(game.order.slice(0, start + misses + extra));
    game.guesses.forEach((id) => { const g = byId(id); if (g) noteSet(g).forEach((n) => all.has(n) && vis.add(n)); });
    return vis;
  }
  function sharedNotes() {
    const s = new Set();
    game.guesses.forEach((id) => { const g = byId(id); if (g && g.id !== game.target.id) noteSet(g).forEach((n) => s.add(n)); });
    return s;
  }
  const accordsShown = () => game.over || MODES[game.mode].accordLabels || game.hints.includes("accords");

  // Stand-in text for anything blurred, so the real word is never in the page.
  function fake(seed, min, max) {
    const r = rng(hash(String(seed)));
    const len = min + Math.floor(r() * (max - min + 1));
    const letters = "aeioursntlcmdpbgh";
    let s = "";
    for (let i = 0; i < len; i++) s += letters[Math.floor(r() * letters.length)];
    return s;
  }

  // ---------- hints ----------
  const HINTS = [
    { id: "accords", label: "Accord names", value: () => "", hide: (m) => m.accordLabels },
    { id: "gender", label: "Gender", value: (t) => GENDERS[t.gender], hide: (m) => m.showGender || game.gender !== "all" },
    { id: "decade", label: "Decade", value: (t) => (t.year ? Math.floor(t.year / 10) * 10 + "s" : "unknown") },
    { id: "country", label: "Country", value: (t) => t.country },
    { id: "perfumer", label: "Perfumer", value: (t) => t.perfumers.join(", ") || "not listed" },
    { id: "initial", label: "Brand initial", value: (t) => t.brand[0] + " (" + t.brand.replace(/[^A-Za-zÀ-ÿ]/g, "").length + " letters)" },
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
  function giveUp() { if (game.over) return; game.over = true; game.gaveUp = true; recordResult(); save(); render(true); }
  function recordResult() {
    const k = "stats:" + game.mode;
    const s = store.get(k, { played: 0, won: 0, streak: 0, best: 0 });
    s.played++;
    if (game.won) { s.won++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
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

  // The hidden bottle is drawn into a canvas from a tiny copy of the photo, so the
  // page never holds a sharp image that could be dragged out or saved.
  let drawToken = 0;
  function renderBottle(justEnded) {
    const t = game.target, m = MODES[game.mode];
    const fig = $("#bottle"), canvas = $("#bottle-blur"), frame = $("#bottle-frame");
    const key = t.id + ":" + game.mode;
    fig.classList.toggle("bottle--revealed", game.over);
    if (game.over) {
      let img = $("#bottle-img");
      if (!img || img.dataset.id !== String(t.id)) {
        if (img) img.remove();
        img = new Image();
        img.id = "bottle-img"; img.dataset.id = String(t.id); img.width = 375; img.height = 500; img.draggable = false;
        img.alt = t.brand + " " + t.name + " bottle";
        img.referrerPolicy = "no-referrer";
        img.onload = () => fig.classList.add("bottle--sharp");
        img.onerror = () => fig.classList.add("bottle--missing");
        img.src = imgSrc(t);
        frame.appendChild(img);
      }
    } else {
      const old = $("#bottle-img"); if (old) old.remove();
      fig.classList.remove("bottle--sharp", "bottle--missing");
    }
    if (canvas.dataset.key !== key) {
      canvas.dataset.key = key;
      fig.classList.remove("bottle--drawn");
      const token = ++drawToken;
      const src = new Image();
      src.referrerPolicy = "no-referrer";
      src.onload = () => {
        if (token !== drawToken) return;
        const w = m.pixels, h = Math.round(m.pixels * 4 / 3);
        const tiny = document.createElement("canvas"); tiny.width = w; tiny.height = h;
        const tctx = tiny.getContext("2d");
        tctx.fillStyle = "#fff"; tctx.fillRect(0, 0, w, h);
        tctx.drawImage(src, 0, 0, w, h);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tiny, 0, 0, canvas.width, canvas.height);
        fig.classList.add("bottle--drawn");
      };
      src.onerror = () => { if (token === drawToken) fig.classList.add("bottle--missing"); };
      src.src = imgSrc(t);
    }
    $("#reveal-name").textContent = game.over ? t.name : "";
    $("#reveal-brand").textContent = game.over ? t.brand + (t.year ? " · " + t.year : "") : "";
    if (justEnded && game.over) { fig.classList.remove("bottle--pop"); void fig.offsetWidth; fig.classList.add("bottle--pop"); }
  }

  function renderAccords() {
    const t = game.target;
    const show = accordsShown();
    const n = t.accords.length;
    $("#accords").innerHTML = t.accords.map((a, i) => {
      const col = ACCORD[a] || "#b8b2a7";
      const w = 100 - (i * 52) / Math.max(1, n - 1);
      const label = show ? esc(a) : '<span class="blurtext" aria-hidden="true">' + fake(t.id + "a" + i, 4, 9) + "</span>";
      return '<div class="accord" style="--w:' + w.toFixed(1) + "%;--c:" + col + ";--t:" + ink(col) + '">' + label + "</div>";
    }).join("");
    $("#accords").setAttribute("aria-label", show ? "Main accords" : "Main accords, names hidden");
  }

  function renderNotes() {
    const t = game.target;
    const vis = visibleNotes(), shared = sharedNotes();
    const row = (name, notes, tier) => !notes.length ? "" :
      '<div class="tier"><dt>' + name + '</dt><dd><ul class="notes">' + notes.map((n, i) => {
        const c = canon(n);
        if (!vis.has(c)) return '<li class="note note--blur"><span class="blurtext" aria-hidden="true">' + fake(t.id + tier + i, 4, 11) + '</span><span class="sr">hidden note</span></li>';
        return '<li class="note' + (shared.has(c) && !game.over ? " note--shared" : "") + '">' + esc(n) + "</li>";
      }).join("") + "</ul></dd></div>";
    const flat = !t.top.length && !t.base.length;
    $("#notes").innerHTML = '<dl class="pyramid">' + (flat ? row("Notes", t.heart, "h") : row("Top", t.top, "t") + row("Heart", t.heart, "h") + row("Base", t.base, "b")) + "</dl>";
    const hidden = noteSet(t).size - vis.size;
    $("#notes-count").textContent = hidden > 0 ? hidden + " of " + noteSet(t).size + " notes hidden" : "";
    const facts = [];
    if (MODES[game.mode].showGender || game.over) facts.push(t.gender);
    if (game.over) facts.push(t.country, "rated " + t.rating.toFixed(2) + " by " + t.votes.toLocaleString("en-US"));
    $("#facts").textContent = facts.join(" · ");
    $("#facts").hidden = !facts.length;
  }

  function renderHints() {
    const m = MODES[game.mode];
    const left = m.hints - game.hints.length;
    $("#hints").hidden = game.over;
    if (game.over) return;
    $("#hints-left").textContent = left + " left";
    $("#hints-used").innerHTML = game.hints.filter((h) => h !== "note" && h !== "accords").map((id) => {
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
      return '<li class="guess' + (animate && idx === 0 ? " guess--new" : "") + '">' +
        '<p class="guess__name"><strong>' + esc(g.name) + "</strong> " + esc(g.brand) + "</p>" +
        '<div class="tiles">' + compare(g, game.target).map((c, i) =>
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
    const s = store.get("stats:" + game.mode, { played: 0, won: 0, streak: 0, best: 0 });
    const verdict = game.won ? (game.guesses.length === 1 ? "First try." : "Solved in " + game.guesses.length + ".") : game.gaveUp ? "You gave up." : "Out of guesses.";
    box.innerHTML =
      '<p class="result__verdict">' + verdict + "</p>" +
      '<p class="result__stats">' + m.label + ": " + s.played + " played · " + (s.played ? Math.round((s.won / s.played) * 100) : 0) + "% won · streak " + s.streak + " · best " + s.best + "</p>" +
      (t.perfumers.length ? '<p class="result__stats">Perfumer: ' + esc(t.perfumers.join(", ")) + "</p>" : "") +
      '<div class="result__actions">' +
      '<button type="button" class="btn btn--solid" id="next-btn">' + (game.daily ? "Play unlimited" : "Next bottle") + "</button>" +
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
    renderAccords();
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
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "");
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
    function update() {
      const q = norm(input.value.trim());
      if (!q) { close(); return; }
      const words = q.split(/\s+/);
      items = ALL.filter((f) => words.every((w) => norm(f.name + " " + f.brand).includes(w))).sort((a, b) => a.rank - b.rank).slice(0, 8);
      list.hidden = false; input.setAttribute("aria-expanded", "true");
      if (!items.length) { list.innerHTML = '<li class="opt opt--none">Not in the top 250</li>'; return; }
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
    $("#bottle").addEventListener("animationend", () => $("#bottle").classList.remove("bottle--pop"));
    $("#bottle").addEventListener("contextmenu", (e) => { if (!game.over) e.preventDefault(); });
    $("#count").textContent = ALL.length;
    setupCombobox();
    newGame(true);
  }

  window.BlindSpritz = { compare, canon, MODES };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
