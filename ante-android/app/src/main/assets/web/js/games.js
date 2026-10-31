/* Pure game rules for Ante's tables. No DOM. Loaded as a classic script in the app
   (window.AnteGames) and as a CommonJS module by the Node tests. */
(function (root) {
  "use strict";

  const rand = (n, rng) => Math.floor((rng || Math.random)() * n);

  /* ---------- coin ---------- */
  const COIN_RETURN = 1.9; // 95% return

  function coinFlip(pick, rng) {
    const result = (rng || Math.random)() < 0.5 ? "H" : "T";
    return { result, multiple: result === pick ? COIN_RETURN : 0 };
  }

  /* ---------- roulette (single zero) ---------- */
  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const ROULETTE_BETS = {
    red: { label: "Red", multiple: 2, wins: n => REDS.has(n) },
    black: { label: "Black", multiple: 2, wins: n => n !== 0 && !REDS.has(n) },
    even: { label: "Even", multiple: 2, wins: n => n !== 0 && n % 2 === 0 },
    odd: { label: "Odd", multiple: 2, wins: n => n % 2 === 1 },
    low: { label: "1–18", multiple: 2, wins: n => n >= 1 && n <= 18 },
    high: { label: "19–36", multiple: 2, wins: n => n >= 19 },
    d1: { label: "1st 12", multiple: 3, wins: n => n >= 1 && n <= 12 },
    d2: { label: "2nd 12", multiple: 3, wins: n => n >= 13 && n <= 24 },
    d3: { label: "3rd 12", multiple: 3, wins: n => n >= 25 },
  };
  const STRAIGHT_MULTIPLE = 36;
  const pocketColor = n => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");

  function rouletteMultiple(bet, n, straightNumber) {
    if (bet === "num") return n === straightNumber ? STRAIGHT_MULTIPLE : 0;
    const b = ROULETTE_BETS[bet];
    if (!b) return 0;
    return b.wins(n) ? b.multiple : 0;
  }
  /** A bet id is an outside bet ("red", "d2", ...) or one number, "n:0" to "n:36". */
  const NUM_BET = /^n:(\d{1,2})$/;
  function isRouletteBet(id) {
    if (typeof id !== "string") return false;
    if (Object.prototype.hasOwnProperty.call(ROULETTE_BETS, id)) return true;
    const m = NUM_BET.exec(id);
    return !!m && Number(m[1]) <= 36;
  }
  /** Total multiple for several equal stakes on one spin: each winning bet adds its own multiple. */
  function rouletteReturn(bets, n) {
    return [...new Set(bets)].filter(isRouletteBet).reduce((sum, id) => {
      const m = NUM_BET.exec(id);
      return sum + (m ? rouletteMultiple("num", n, Number(m[1])) : rouletteMultiple(id, n));
    }, 0);
  }
  function rouletteSpin(rng) { return rand(37, rng); }

  /* ---------- slots ---------- */
  const SLOT_SYMBOLS = ["seven", "bar", "bell", "diamond", "cherry"];
  const SLOT_WEIGHTS = [1, 2, 3, 4, 5];
  const SLOT_THREE = { seven: 100, bar: 40, bell: 20, diamond: 10, cherry: 5 };
  const SLOT_TWO_SEVENS = 5;
  const SLOT_PAIR = 0.4;

  function slotSymbol(rng) {
    let r = (rng || Math.random)() * 15;
    for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
      r -= SLOT_WEIGHTS[i];
      if (r < 0) return SLOT_SYMBOLS[i];
    }
    return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1];
  }
  function slotSpin(rng) { return [slotSymbol(rng), slotSymbol(rng), slotSymbol(rng)]; }
  function slotPay(reels) {
    const [a, b, c] = reels;
    if (a === b && b === c) return { multiple: SLOT_THREE[a], key: "three-" + a };
    if (reels.filter(s => s === "seven").length === 2) return { multiple: SLOT_TWO_SEVENS, key: "two-sevens" };
    if (new Set(reels).size === 2) return { multiple: SLOT_PAIR, key: "pair" };
    return { multiple: 0, key: "" };
  }
  /** Exact long-run return of the slot machine, by enumerating every outcome. */
  function slotReturn() {
    let total = 0;
    for (const a of SLOT_SYMBOLS) for (const b of SLOT_SYMBOLS) for (const c of SLOT_SYMBOLS) {
      const w = SLOT_WEIGHTS[SLOT_SYMBOLS.indexOf(a)] * SLOT_WEIGHTS[SLOT_SYMBOLS.indexOf(b)] * SLOT_WEIGHTS[SLOT_SYMBOLS.indexOf(c)];
      total += (w / 3375) * slotPay([a, b, c]).multiple;
    }
    return total;
  }

  /* ---------- cards ---------- */
  // rank 1..13 (1 = ace), suit 0..3 = spades, hearts, diamonds, clubs
  const SUITS = ["spades", "hearts", "diamonds", "clubs"];
  const rankLabel = r => ({ 1: "A", 11: "J", 12: "Q", 13: "K" })[r] || String(r);
  const isRed = c => c.s === 1 || c.s === 2;

  function shuffledDeck(rng) {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) {
      const j = rand(i + 1, rng);
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  /* ---------- blackjack (6-deck shoe, dealer stands on all 17s, 3:2) ---------- */
  function handValue(cards) {
    let total = 0, aces = 0;
    for (const c of cards) {
      if (c.r === 1) { aces++; total += 11; } else total += Math.min(10, c.r);
    }
    while (total > 21 && aces) { total -= 10; aces--; }
    return total;
  }
  const isBlackjack = cards => cards.length === 2 && handValue(cards) === 21;

  function newShoe(rng, decks) {
    let shoe = [];
    for (let i = 0; i < (decks || 6); i++) shoe = shoe.concat(shuffledDeck(rng));
    return shoe;
  }

  /** Dealer draws to 17 or more. Mutates and returns `dealer`. */
  function dealerPlay(dealer, draw) {
    while (handValue(dealer) < 17) dealer.push(draw());
    return dealer;
  }

  /** Return multiple of the stake (including the stake itself). */
  function blackjackMultiple(player, dealer) {
    const pbj = isBlackjack(player), dbj = isBlackjack(dealer);
    if (pbj && dbj) return { multiple: 1, outcome: "push" };
    if (pbj) return { multiple: 2.5, outcome: "blackjack" };
    if (dbj) return { multiple: 0, outcome: "dealer-blackjack" };
    const pv = handValue(player), dv = handValue(dealer);
    if (pv > 21) return { multiple: 0, outcome: "bust" };
    if (dv > 21) return { multiple: 2, outcome: "dealer-bust" };
    if (pv > dv) return { multiple: 2, outcome: "win" };
    if (pv === dv) return { multiple: 1, outcome: "push" };
    return { multiple: 0, outcome: "lose" };
  }

  /* ---------- video poker: jacks or better ---------- */
  const POKER_PAYS = [
    ["Royal flush", 250], ["Straight flush", 50], ["Four of a kind", 25], ["Full house", 8],
    ["Flush", 5], ["Straight", 4], ["Three of a kind", 3], ["Two pair", 2], ["Jacks or better", 1],
  ];
  function pokerRank(hand) {
    const rs = hand.map(c => (c.r === 1 ? 14 : c.r)).sort((a, b) => a - b);
    const counts = {};
    rs.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    const cv = Object.values(counts).sort((a, b) => b - a);
    const flush = hand.every(c => c.s === hand[0].s);
    const unique = new Set(rs).size === 5;
    const straight = unique && (rs[4] - rs[0] === 4 || rs.join() === "2,3,4,5,14");
    if (straight && flush && rs[0] === 10) return "Royal flush";
    if (straight && flush) return "Straight flush";
    if (cv[0] === 4) return "Four of a kind";
    if (cv[0] === 3 && cv[1] === 2) return "Full house";
    if (flush) return "Flush";
    if (straight) return "Straight";
    if (cv[0] === 3) return "Three of a kind";
    if (cv[0] === 2 && cv[1] === 2) return "Two pair";
    if (cv[0] === 2) {
      const pair = Number(Object.keys(counts).find(k => counts[k] === 2));
      if (pair >= 11) return "Jacks or better";
    }
    return null;
  }
  function pokerMultiple(hand) {
    const rank = pokerRank(hand);
    const row = POKER_PAYS.find(p => p[0] === rank);
    return { rank, multiple: row ? row[1] : 0 };
  }

  /* ---------- catalogue ---------- */
  const GAMES = [
    { id: "roulette", name: "Roulette", rule: "Single zero. Straight up pays 36×.", rtp: "97.3%" },
    { id: "blackjack", name: "Blackjack", rule: "Beat the dealer. Blackjack pays 3 to 2.", rtp: "≈99%" },
    { id: "slots", name: "Slots", rule: "Three reels. Three 7s pay 100×.", rtp: "93%" },
    { id: "poker", name: "Poker", rule: "Five-card draw. Jacks or better.", rtp: "≈96%" },
    { id: "coin", name: "Coin flip", rule: "Call it. Pays 1.9×.", rtp: "95%" },
  ];

  const api = {
    GAMES, COIN_RETURN, coinFlip,
    WHEEL, REDS, ROULETTE_BETS, STRAIGHT_MULTIPLE, pocketColor, rouletteMultiple, isRouletteBet, rouletteReturn, rouletteSpin,
    SLOT_SYMBOLS, SLOT_WEIGHTS, SLOT_THREE, SLOT_TWO_SEVENS, SLOT_PAIR, slotSymbol, slotSpin, slotPay, slotReturn,
    SUITS, rankLabel, isRed, shuffledDeck,
    handValue, isBlackjack, newShoe, dealerPlay, blackjackMultiple,
    POKER_PAYS, pokerRank, pokerMultiple,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AnteGames = api;
})(typeof window !== "undefined" ? window : this);
