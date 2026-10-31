// Run with: node --test ante-android/web-tests
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../app/src/main/assets/web/js/games.js");

const c = (r, s) => ({ r, s });
// Deterministic RNG for repeatable tests.
function seeded(seed) {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}

test("wheel has 37 unique pockets in European order", () => {
  assert.equal(G.WHEEL.length, 37);
  assert.equal(new Set(G.WHEEL).size, 37);
  assert.deepEqual(G.WHEEL.slice(0, 5), [0, 32, 15, 19, 4]);
});

test("roulette colours alternate around the wheel", () => {
  for (let i = 1; i < 36; i++) {
    assert.notEqual(G.pocketColor(G.WHEEL[i]), G.pocketColor(G.WHEEL[i + 1]), `pockets ${i} and ${i + 1}`);
  }
  assert.equal(G.pocketColor(0), "green");
});

test("roulette zero loses every outside bet", () => {
  for (const bet of Object.keys(G.ROULETTE_BETS)) assert.equal(G.rouletteMultiple(bet, 0, 17), 0, bet);
  assert.equal(G.rouletteMultiple("num", 0, 0), 36);
});

test("roulette expected return is 36/37 for every bet", () => {
  for (const bet of [...Object.keys(G.ROULETTE_BETS), "num"]) {
    let sum = 0;
    for (let n = 0; n <= 36; n++) sum += G.rouletteMultiple(bet, n, 17);
    assert.ok(Math.abs(sum / 37 - 36 / 37) < 1e-9, bet);
  }
});

test("slots return is 93%", () => {
  assert.ok(Math.abs(G.slotReturn() - 0.9298) < 0.001, String(G.slotReturn()));
});

test("slots pay table", () => {
  assert.equal(G.slotPay(["seven", "seven", "seven"]).multiple, 100);
  assert.equal(G.slotPay(["seven", "bar", "seven"]).multiple, 5);
  assert.equal(G.slotPay(["bell", "cherry", "bell"]).multiple, 0.4);
  assert.equal(G.slotPay(["bell", "cherry", "bar"]).multiple, 0);
});

test("slot symbol frequencies follow the weights", () => {
  const rng = seeded(7), counts = {};
  for (let i = 0; i < 150000; i++) { const s = G.slotSymbol(rng); counts[s] = (counts[s] || 0) + 1; }
  G.SLOT_SYMBOLS.forEach((s, i) => {
    const expected = G.SLOT_WEIGHTS[i] / 15;
    assert.ok(Math.abs(counts[s] / 150000 - expected) < 0.01, `${s}: ${counts[s] / 150000}`);
  });
});

test("coin pays 1.9x on a correct call", () => {
  const always = () => 0.1; // heads
  assert.deepEqual(G.coinFlip("H", always), { result: "H", multiple: 1.9 });
  assert.deepEqual(G.coinFlip("T", always), { result: "H", multiple: 0 });
});

test("blackjack hand values count aces as 1 or 11", () => {
  assert.equal(G.handValue([c(1, 0), c(13, 1)]), 21);
  assert.equal(G.handValue([c(1, 0), c(1, 1), c(9, 2)]), 21);
  assert.equal(G.handValue([c(1, 0), c(5, 1), c(10, 2)]), 16);
  assert.equal(G.handValue([c(10, 0), c(10, 1), c(5, 2)]), 25);
});

test("blackjack settlement", () => {
  assert.equal(G.blackjackMultiple([c(1, 0), c(12, 0)], [c(10, 0), c(9, 0)]).multiple, 2.5);
  assert.equal(G.blackjackMultiple([c(1, 0), c(12, 0)], [c(1, 1), c(13, 1)]).multiple, 1);
  assert.equal(G.blackjackMultiple([c(10, 0), c(9, 0)], [c(1, 1), c(13, 1)]).multiple, 0);
  assert.equal(G.blackjackMultiple([c(10, 0), c(9, 0), c(5, 0)], [c(10, 1), c(7, 1)]).outcome, "bust");
  assert.equal(G.blackjackMultiple([c(10, 0), c(8, 0)], [c(10, 1), c(6, 1), c(9, 1)]).multiple, 2);
  assert.equal(G.blackjackMultiple([c(10, 0), c(8, 0)], [c(10, 1), c(8, 1)]).multiple, 1);
  assert.equal(G.blackjackMultiple([c(10, 0), c(7, 0)], [c(10, 1), c(8, 1)]).multiple, 0);
});

test("dealer stands on soft 17", () => {
  const dealer = [c(1, 0), c(6, 0)];
  G.dealerPlay(dealer, () => { throw new Error("should not draw"); });
  assert.equal(dealer.length, 2);
});

test("blackjack with basic-ish strategy returns close to 99%", () => {
  const rng = seeded(42);
  let shoe = G.newShoe(rng), staked = 0, returned = 0;
  const draw = () => { if (shoe.length < 20) shoe = G.newShoe(rng); return shoe.pop(); };
  for (let i = 0; i < 200000; i++) {
    const p = [draw(), draw()], d = [draw(), draw()];
    let stake = 1;
    if (!G.isBlackjack(p) && !G.isBlackjack(d)) {
      const up = Math.min(10, d[0].r === 1 ? 11 : d[0].r);
      const pv = G.handValue(p);
      if ((pv === 11 || (pv === 10 && up < 10)) ) { stake = 2; p.push(draw()); }
      else {
        while (true) {
          const v = G.handValue(p);
          const soft = p.some(x => x.r === 1) && v <= 21 && G.handValue(p.map(x => x.r === 1 ? c(2, x.s) : x)) !== v;
          if (v >= 17 && !(soft && v === 17)) break;
          if (!soft && v >= 13 && up <= 6) break;
          if (!soft && v === 12 && up >= 4 && up <= 6) break;
          if (soft && v >= 18) break;
          p.push(draw());
          if (G.handValue(p) > 21) break;
        }
      }
      if (G.handValue(p) <= 21) G.dealerPlay(d, draw);
    }
    staked += stake;
    returned += stake * G.blackjackMultiple(p, d).multiple;
  }
  const rtp = returned / staked;
  assert.ok(rtp > 0.97 && rtp < 1.0, String(rtp));
});

test("poker ranks", () => {
  assert.equal(G.pokerRank([c(10, 0), c(11, 0), c(12, 0), c(13, 0), c(1, 0)]), "Royal flush");
  assert.equal(G.pokerRank([c(9, 1), c(10, 1), c(11, 1), c(12, 1), c(13, 1)]), "Straight flush");
  assert.equal(G.pokerRank([c(1, 1), c(2, 2), c(3, 1), c(4, 1), c(5, 1)]), "Straight");
  assert.equal(G.pokerRank([c(7, 0), c(7, 1), c(7, 2), c(7, 3), c(2, 0)]), "Four of a kind");
  assert.equal(G.pokerRank([c(7, 0), c(7, 1), c(7, 2), c(2, 3), c(2, 0)]), "Full house");
  assert.equal(G.pokerRank([c(2, 0), c(5, 0), c(7, 0), c(9, 0), c(12, 0)]), "Flush");
  assert.equal(G.pokerRank([c(7, 0), c(7, 1), c(7, 2), c(3, 3), c(2, 0)]), "Three of a kind");
  assert.equal(G.pokerRank([c(7, 0), c(7, 1), c(3, 2), c(3, 3), c(2, 0)]), "Two pair");
  assert.equal(G.pokerRank([c(11, 0), c(11, 1), c(3, 2), c(4, 3), c(2, 0)]), "Jacks or better");
  assert.equal(G.pokerRank([c(1, 0), c(1, 1), c(3, 2), c(4, 3), c(9, 0)]), "Jacks or better");
  assert.equal(G.pokerRank([c(10, 0), c(10, 1), c(3, 2), c(4, 3), c(2, 0)]), null);
  assert.equal(G.pokerRank([c(1, 0), c(13, 1), c(12, 2), c(11, 3), c(9, 0)]), null);
});

test("shuffled deck has 52 unique cards", () => {
  const d = G.shuffledDeck(seeded(1));
  assert.equal(d.length, 52);
  assert.equal(new Set(d.map(x => x.r + "-" + x.s)).size, 52);
});
