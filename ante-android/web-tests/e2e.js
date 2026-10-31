// End-to-end check of the bundled UI in Chromium, using the browser mock bridge.
// Usage: node ante-android/web-tests/e2e.js [screenshot-dir]
// Exits non-zero on any console error, failed check or horizontal overflow.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const INDEX = "file://" + path.resolve(__dirname, "../app/src/main/assets/web/index.html");
const OUT = process.argv[2] || path.resolve(__dirname, "../build/e2e");
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); };

async function page(browser, query, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", e => p.errors.push(e.message));
  p.on("console", m => { if (m.type() === "error") p.errors.push(m.text()); });
  await p.goto(INDEX + query);
  await p.waitForSelector(".screen");
  await p.waitForTimeout(300);
  return p;
}
const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + ".png") });
const leftOf = (p, pkg) => p.evaluate(k => window.Ante.state().limits.find(l => l.pkg === k).leftSec, pkg);
async function noOverflow(p, label) {
  const w = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  check(w[0] <= w[1], `${label}: no horizontal overflow (${w[0]} <= ${w[1]})`);
}

(async () => {
  const browser = await chromium.launch();

  /* Today + permission + add limit */
  let p = await page(browser, "?reset=1");
  await shot(p, "01-today-permission");
  check(await p.isVisible("text=Let Ante see which app you open"), "permission card shows when the switch is off");
  await p.click("text=Open Accessibility settings");
  await p.waitForSelector('[data-a="agreeAcc"]');
  check(await p.isVisible("text=does not read what is on your screen"), "disclosure shows before Settings");
  await shot(p, "01b-consent");
  await p.click('[data-a="agreeAcc"]');
  await p.waitForTimeout(400);
  check(!(await p.isVisible("text=Let Ante see which app you open")), "permission card hides after switching on");
  await shot(p, "02-today");
  await noOverflow(p, "today");
  await p.click('[data-a="add"]');
  await p.waitForSelector(".pick-list .limit");
  await p.fill("#app-search", "red");
  await p.waitForTimeout(100);
  check((await p.$$(".pick-list .limit")).length === 1, "app search filters the list");
  await shot(p, "03-picker");
  await p.click('.pick-list [data-pkg="com.reddit.frontpage"]');
  await p.click('[data-a="limSet"][data-v="900"]');
  await shot(p, "04-edit-sheet");
  await p.click('[data-a="saveLimit"]');
  await p.waitForTimeout(200);
  check(await p.isVisible('.limit[data-pkg="com.reddit.frontpage"]'), "new limit appears on Today");
  check((await leftOf(p, "com.reddit.frontpage")) === 900, "new limit starts full");

  /* Removing and re-adding a limit must not refill it */
  await p.evaluate(() => { window.Ante.bet("com.reddit.frontpage", 900); });
  await p.click('.limit[data-pkg="com.reddit.frontpage"]');
  await p.click('[data-a="removeLimit"]');
  await p.click('[data-a="add"]');
  await p.waitForSelector('.pick-list [data-pkg="com.reddit.frontpage"]');
  await p.click('.pick-list [data-pkg="com.reddit.frontpage"]');
  await p.click('[data-a="saveLimit"]');
  await p.waitForTimeout(200);
  check((await leftOf(p, "com.reddit.frontpage")) === 0, "removing and re-adding a used-up limit keeps it at 0:00");

  /* Tables list */
  await p.click('[data-t="tables"]');
  await p.waitForTimeout(200);
  await shot(p, "05-tables");
  await noOverflow(p, "tables");

  /* Coin */
  const ig = "com.instagram.android";
  await p.click('[data-a="stakeApp"][data-pkg="' + ig + '"]');
  await p.click('[data-a="game"][data-id="coin"]');
  let before = await leftOf(p, ig);
  await p.click('[data-a="coinFlip"]');
  await p.waitForTimeout(600);
  await shot(p, "06-coin-midair");
  await p.waitForSelector('[data-a="coinFlip"]:not([disabled])', { timeout: 5000 });
  let after = await leftOf(p, ig);
  check(after === before - 300 || after === before - 300 + 570, `coin settles to -5:00 or +4:30 (${before} → ${after})`);
  await shot(p, "07-coin-done");
  await p.click('[data-a="leave"]');

  /* Roulette */
  await p.click('[data-a="game"][data-id="roulette"]');
  await p.waitForTimeout(200);
  await shot(p, "08-roulette");
  await p.click('[data-a="rBet"][data-v="black"]');
  before = await leftOf(p, ig);
  await p.click('[data-a="rSpin"]');
  await p.waitForTimeout(2500);
  await shot(p, "09-roulette-spinning");
  await p.waitForSelector('[data-a="rSpin"]:not([disabled])', { timeout: 9000 });
  after = await leftOf(p, ig);
  check(after === before - 300 || after === before + 300, `roulette even-money settles (${before} → ${after})`);
  check(await p.isVisible(".wheel-result.show"), "winning number shows in the wheel");
  await shot(p, "10-roulette-done");
  await noOverflow(p, "roulette");
  await p.click('[data-a="leave"]');

  /* Slots */
  await p.click('[data-a="game"][data-id="slots"]');
  await p.waitForTimeout(200);
  await p.click('[data-a="stakeSet"][data-v="60"]');
  await p.click('[data-a="sSpin"]');
  await p.waitForTimeout(700);
  await shot(p, "11-slots-spinning");
  await p.waitForSelector('[data-a="sSpin"]:not([disabled])', { timeout: 6000 });
  check((await p.$$(".reel .strip .cell")).length === 9, "reels settle to three visible symbols each");
  await shot(p, "12-slots-done");
  await p.click('[data-a="leave"]');

  /* Blackjack */
  await p.click('[data-a="game"][data-id="blackjack"]');
  await p.waitForTimeout(200);
  await p.click('[data-a="stakeSet"][data-v="300"]');
  await p.click('[data-a="bjDeal"]');
  await p.waitForFunction(() => document.querySelector('[data-a="bjStand"]') || document.querySelector('[data-a="bjDeal"]:not([disabled])'), null, { timeout: 6000 });
  await shot(p, "13-blackjack-dealt");
  check(!(await p.$('[data-a="leave"]:not([disabled])')) || !(await p.$('[data-a="bjStand"]')), "back button locked while a hand is open");
  if (await p.$('[data-a="bjStand"]')) await p.click('[data-a="bjStand"]');
  await p.waitForSelector('[data-a="bjDeal"]:not([disabled])', { timeout: 8000 });
  await p.waitForTimeout(300);
  await shot(p, "14-blackjack-done");
  check((await p.textContent("#result")).length > 3, "blackjack shows a result line");
  await p.click('[data-a="leave"]');

  /* Poker */
  await p.click('[data-a="game"][data-id="poker"]');
  await p.waitForTimeout(200);
  await p.click('[data-a="pDeal"]');
  await p.waitForSelector('[data-a="pDraw"]', { timeout: 6000 });
  await p.click('.vp-slot[data-i="0"]');
  await p.click('.vp-slot[data-i="2"]');
  check((await p.$$(".vp-slot.held")).length === 2, "tapping cards holds them");
  await shot(p, "15-poker-held");
  await p.click('[data-a="pDraw"]');
  await p.waitForSelector('[data-a="pDeal"]:not([disabled])', { timeout: 8000 });
  await shot(p, "16-poker-done");
  await noOverflow(p, "poker");

  /* Ledger */
  await p.click('[data-a="leave"]');
  await p.click('[data-t="today"]');
  await p.waitForTimeout(200);
  check((await p.$$(".slip-row")).length >= 5, "bets appear in today's slip");
  await shot(p, "17-today-after-bets");
  check(p.errors.length === 0, "no console errors in main flow: " + p.errors.join(" | "));

  /* Back hook */
  check(await p.evaluate(() => window.anteBack()) === false, "back on Today lets the activity close");

  /* Block screen */
  const b = await page(browser, "?mode=block&pkg=" + ig + "&acc=1");
  await shot(b, "18-block");
  check(await b.isVisible("text=Play for more time"), "block screen offers play");
  await b.click('[data-a="pickOpen"][data-v="600"]');
  check((await b.textContent('[data-a="openApp"]')).includes("10:00"), "open button follows the chosen time");
  await b.click('[data-a="toTables"]');
  await b.waitForTimeout(200);
  check(!(await b.$(".from")), "block tables are locked to the blocked app");
  await shot(b, "19-block-tables");
  check(await b.evaluate(() => window.anteBack()) === true, "back from block tables returns to the block screen");
  await b.click('[data-a="openApp"]');
  await b.waitForTimeout(200);
  check(b.errors.length === 0, "no console errors on block screen: " + b.errors.join(" | "));

  /* Session over, nothing left */
  const z = await page(browser, "?mode=block&pkg=com.zhiliaoapp.musically&acc=1&note=Session%20over.");
  await z.evaluate(() => { const s = window.Ante; s.bet("com.zhiliaoapp.musically", 1800); window.anteRefresh(); });
  await z.waitForTimeout(200);
  check(await z.isVisible("text=is done for today"), "empty budget shows the done-for-today state");
  await shot(z, "20-block-empty");

  /* Small phone + reduced motion */
  const s = await page(browser, "?acc=1", { width: 340, reduced: true });
  await noOverflow(s, "today at 340px");
  await s.click('[data-t="tables"]');
  await noOverflow(s, "tables at 340px");
  await shot(s, "21-small-tables");
  await s.click('[data-a="game"][data-id="poker"]');
  await s.click('[data-a="pDeal"]');
  await s.waitForSelector('[data-a="pDraw"]', { timeout: 4000 });
  await noOverflow(s, "poker at 340px");
  await shot(s, "22-small-poker");
  check(s.errors.length === 0, "no console errors at 340px: " + s.errors.join(" | "));

  await browser.close();
  console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nAll checks passed");
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
