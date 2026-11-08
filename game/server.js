// LOW NOON - game server. Serves the client and runs rounds, economy, bomb, grenades and bots.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { boxes, SPAWNS, NODES, PLANT_SPOTS, HOLDS, siteAt } from './shared/map.js';
import { moveBody, losClear, walkClear, segWorld, STAND_H, CROUCH_H } from './shared/physics.js';
import { stepNade } from './shared/nade.js';
import {
  WEAPONS, GEAR, NADE_IDS, MAX_HP, ROUND_TIME, BOMB_TIME, FREEZE_TIME, PLANT_TIME, DEFUSE_TIME, KIT_DEFUSE_TIME,
  ROUNDS_TO_WIN, HALF_ROUNDS, START_MONEY, MAX_MONEY, BUY_TIME, BUY_RADIUS, WIN_ELIM, WIN_OBJ, LOSS_BASE, LOSS_STEP, PLANT_BONUS,
} from './shared/weapons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const BOTS_PER_TEAM = Number(process.env.BOTS_PER_TEAM ?? 2);
const START_CASH = Number(process.env.START_MONEY) || START_MONEY;

// ------------------------------------------------------------------ static files
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };
const ROUTES = [
  ['/lib/', path.join(__dirname, 'node_modules/three/build') + path.sep],
  ['/shared/', path.join(__dirname, 'shared') + path.sep],
  ['/', path.join(__dirname, 'public') + path.sep],
];
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { url = '/'; }
  if (url === '/') url = '/index.html';
  if (url === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (url === '/debug' && process.env.DEBUG) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      G: { phase: G.phase, timer: G.timer, round: G.round, score: G.score, c4: G.c4, botPlan: G.botPlan, streak: G.streak },
      ps: [...players.values()].map((p) => ({ id: p.id, n: p.name, tm: p.team, a: p.alive, hp: p.hp, money: p.money, inv: p.inv, w: p.w,
        pos: p.pos.map((v) => +v.toFixed(1)), use: p.use, goal: p.brain && p.brain.goalKey })),
    }));
    return;
  }
  for (const [prefix, dir] of ROUTES) {
    if (!url.startsWith(prefix)) continue;
    const file = path.normalize(path.join(dir, url.slice(prefix.length)));
    if (!file.startsWith(dir)) break;
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

// ------------------------------------------------------------------ state
const players = new Map();
let nextId = 1, nadeId = 1;
const G = {
  phase: 'idle', timer: 0, round: 0, score: { red: 0, blue: 0 }, swapped: false, streak: { red: 0, blue: 0 },
  c4: null, action: null, matchOver: false, pendingSwap: false, botPlan: 'A', planted: false,
  nades: [], smokes: [],
};
const now = () => performance.now() / 1000;
const sideOf = (team) => ((team === 'red') !== G.swapped ? 'atk' : 'def');
const teamOfSide = (side) => ((side === 'atk') !== G.swapped ? 'red' : 'blue');
const otherTeam = (t) => (t === 'red' ? 'blue' : 'red');
const isPlanted = () => G.c4 && G.c4.st === 'planted';
const SPAWN_CENTER = { atk: [0, 0, -46], def: [0, 0, 46] };

const BOT_NAMES = ['Kebab', 'Falafel', 'Gyro', 'Hummus', 'Baklava', 'Shawarma', 'Tahini', 'Couscous'];
let botNameIdx = 0;

const freshInv = () => ({ pri: null, sec: 1, he: 0, fl: 0, sm: 0, ar: 0, helm: false, kit: false });

function makePlayer({ name, team, bot, ws }) {
  return {
    id: nextId++, name, team, bot, ws,
    pos: [0, 0, 0], vel: [0, 0, 0], onGround: true, h: STAND_H,
    yaw: 0, pitch: 0, cr: false, mv: false, w: 1, zm: 0,
    hp: MAX_HP, alive: false, k: 0, d: 0, use: false, lastFire: 0, lastThrow: 0,
    money: START_CASH, inv: freshInv(),
    brain: bot ? newBrain() : null,
  };
}
function newBrain() {
  return { path: [], goalKey: null, target: null, react: 0, fireT: 0, burst: 0, strafe: 0, strafeT: 0,
    stuckT: 0, lastProg: [0, 0, 0], hold: 0, alert: null, alertT: 0, lookT: 0, lookOff: 0,
    ammo: 0, reloadT: 0, blindUntil: 0 };
}

const send = (p, msg) => { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); };
function broadcast(msg, except) {
  const s = JSON.stringify(msg);
  for (const p of players.values()) if (p !== except && p.ws && p.ws.readyState === 1) p.ws.send(s);
}
const humans = () => [...players.values()].filter((p) => !p.bot);
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const addMoney = (p, v) => { p.money = Math.max(0, Math.min(MAX_MONEY, p.money + v)); };
const owns = (p, id) => id === 0 || p.inv.pri === id || p.inv.sec === id;
const bestGun = (p) => (p.inv.pri != null ? p.inv.pri : p.inv.sec);

function fillBots() {
  const humanCount = humans().length;
  for (const team of ['red', 'blue']) {
    const members = [...players.values()].filter((p) => p.team === team);
    const h = members.filter((p) => !p.bot).length;
    const bots = members.filter((p) => p.bot);
    const want = humanCount ? Math.max(0, BOTS_PER_TEAM - h) : 0;
    while (bots.length > want) removePlayer(bots.pop());
    while (bots.length < want) {
      const b = makePlayer({ name: 'BOT ' + BOT_NAMES[botNameIdx++ % BOT_NAMES.length], team, bot: true });
      players.set(b.id, b);
      bots.push(b);
      if (G.phase === 'freeze') { spawnPlayer(b, members.length + bots.length); botBuy(b); }
    }
  }
}

function removePlayer(p) {
  if (G.c4 && G.c4.st === 'carried' && G.c4.c === p.id) dropBomb(p, false);
  players.delete(p.id);
  if (G.action && G.action.id === p.id) G.action = null;
}

function spawnPlayer(p, idx) {
  const side = sideOf(p.team);
  const sp = SPAWNS[side];
  const pt = sp.pts[idx % sp.pts.length];
  p.pos = [pt[0], 0, pt[1]]; p.vel = [0, 0, 0]; p.onGround = true; p.h = STAND_H;
  p.yaw = sp.yaw; p.pitch = 0; p.hp = MAX_HP; p.alive = true; p.use = false; p.cr = false; p.zm = 0;
  p.w = bestGun(p);
  if (p.bot) {
    const keep = p.brain.hold;
    p.brain = newBrain();
    p.brain.hold = keep;
    p.brain.ammo = WEAPONS[p.w].mag;
  }
  send(p, { t: 'spawn', p: p.pos, yaw: p.yaw });
}

function resetMatch() {
  G.score = { red: 0, blue: 0 }; G.round = 0; G.swapped = false; G.matchOver = false; G.pendingSwap = false;
  G.streak = { red: 0, blue: 0 };
  for (const p of players.values()) { p.k = 0; p.d = 0; p.money = START_CASH; p.inv = freshInv(); p.alive = false; }
}

// ------------------------------------------------------------------ economy
function tryBuy(p, item) {
  const side = sideOf(p.team);
  if (typeof item === 'number') {
    const W = WEAPONS[item];
    if (!W || !W.price || W.slot === 'knife') return false;
    if (W.side && W.side !== side) return false;
    if (p.money < W.price) return false;
    if (W.slot === 'pri') { if (p.inv.pri === item) return false; p.inv.pri = item; p.w = item; }
    else if (W.slot === 'sec') { if (p.inv.sec === item) return false; p.inv.sec = item; if (p.inv.pri == null) p.w = item; }
    else if (W.slot === 'nade') {
      if (p.inv[W.nade] >= W.max) return false;
      if (p.inv.he + p.inv.fl + p.inv.sm >= 4) return false;
      p.inv[W.nade]++;
    }
    p.money -= W.price;
    return true;
  }
  if (item === 'vest') {
    if (p.inv.ar >= 100 || p.money < GEAR.vest.price) return false;
    p.money -= GEAR.vest.price; p.inv.ar = 100; return true;
  }
  if (item === 'vesthelm') {
    if (p.inv.ar >= 100 && p.inv.helm) return false;
    const price = p.inv.ar >= 100 ? 350 : GEAR.vesthelm.price;
    if (p.money < price) return false;
    p.money -= price; p.inv.ar = 100; p.inv.helm = true; return true;
  }
  if (item === 'kit') {
    if (side !== 'def' || p.inv.kit || p.money < GEAR.kit.price) return false;
    p.money -= GEAR.kit.price; p.inv.kit = true; return true;
  }
  return false;
}
function canBuyNow(p) {
  if (!p.alive) return false;
  const inTime = G.phase === 'freeze' || (G.phase === 'live' && ROUND_TIME - G.timer < BUY_TIME);
  return inTime && dist2d(p.pos, SPAWN_CENTER[sideOf(p.team)]) < BUY_RADIUS;
}

function botBuy(b) {
  const side = sideOf(b.team);
  const rifle = side === 'atk' ? 5 : 6;
  const r = Math.random();
  if (b.inv.pri == null) {
    if (b.money >= 6200 && r < 0.15) tryBuy(b, 7);
    else if (b.money >= WEAPONS[rifle].price + 1000) tryBuy(b, rifle);
    else if (b.money >= WEAPONS[rifle].price && r < 0.6) tryBuy(b, rifle);
    else if (b.money >= 2000 && r < 0.6) tryBuy(b, 3);
    else if (b.money >= 1800 && r < 0.3) tryBuy(b, 4);
  }
  if (b.inv.ar < 100 || !b.inv.helm) {
    if (b.money >= 1000 && (b.inv.pri != null || b.money > 2500)) tryBuy(b, 'vesthelm');
    else if (b.money >= 650 && (b.inv.pri != null || G.round === 1 || G.round === HALF_ROUNDS + 1 || Math.random() < 0.5)) tryBuy(b, 'vest');
  }
  if (b.inv.pri == null && b.inv.sec === 1 && b.money >= 700 && Math.random() < 0.5) tryBuy(b, 2);
  if (side === 'def' && b.money >= 400 && Math.random() < 0.6) tryBuy(b, 'kit');
  if (b.money >= 300 && Math.random() < 0.4) tryBuy(b, 8);
  b.w = bestGun(b);
  b.brain.ammo = WEAPONS[b.w].mag;
}

// ------------------------------------------------------------------ rounds
function startRound() {
  let resetAll = false, half = false;
  if (G.pendingSwap) { G.swapped = true; G.pendingSwap = false; half = true; resetAll = true; G.streak = { red: 0, blue: 0 }; }
  if (G.round === 0) resetAll = true;
  G.round++;
  G.phase = 'freeze'; G.timer = FREEZE_TIME; G.action = null; G.planted = false;
  G.nades = []; G.smokes = [];
  G.botPlan = Math.random() < 0.5 ? 'A' : 'B';
  const idx = { atk: 0, def: 0 };
  const order = [...players.values()].sort(() => Math.random() - 0.5);
  let defBot = Math.floor(Math.random() * 2);
  for (const p of order) {
    if (resetAll) { p.money = START_CASH; p.inv = freshInv(); }
    else if (!p.alive) p.inv = freshInv();          // died last round: lose your gear
    const s = sideOf(p.team);
    if (p.bot && s === 'def') { p.brain.hold = defBot % 2; defBot++; if (Math.random() < 0.2) p.brain.hold = 2; }
    spawnPlayer(p, idx[s]++);
  }
  // give the bomb to a random attacker
  const atk = order.filter((p) => sideOf(p.team) === 'atk');
  G.c4 = atk.length ? { st: 'carried', c: atk[Math.floor(Math.random() * atk.length)].id } : null;
  for (const p of order) if (p.bot) botBuy(p);
  broadcast({ t: 'round', rd: G.round, sw: G.swapped, half });
}

function endRound(side, reason) {
  if (G.phase === 'end') return;
  const team = teamOfSide(side), lose = otherTeam(team);
  G.score[team]++;
  G.phase = 'end'; G.timer = 5; G.action = null;
  const win = reason === 'elim' || reason === 'time' ? WIN_ELIM : WIN_OBJ;
  const loss = LOSS_BASE + LOSS_STEP * Math.min(4, G.streak[lose]);
  G.streak[team] = 0; G.streak[lose]++;
  for (const p of players.values()) {
    if (p.team === team) addMoney(p, win);
    else addMoney(p, loss + (side === 'def' && G.planted ? PLANT_BONUS : 0));
  }
  broadcast({ t: 'roundend', side, team, reason, win, loss });
  if (G.score[team] >= ROUNDS_TO_WIN) {
    G.matchOver = true; G.timer = 9;
    broadcast({ t: 'matchend', team });
  } else if (G.round === HALF_ROUNDS) {
    G.pendingSwap = true;
  }
}

function applyDamage(victim, attacker, w, head, override) {
  if (!victim.alive || G.phase === 'freeze') return;
  const W = WEAPONS[w];
  let dmg = override != null ? override : W.dmg * (head ? W.headMul : 1);
  if (victim.inv.ar > 0 && (!head || victim.inv.helm)) {
    const absorbed = dmg * (1 - W.pen);
    victim.inv.ar = Math.max(0, Math.round(victim.inv.ar - absorbed));
    dmg *= W.pen;
  }
  dmg = Math.max(1, Math.round(dmg));
  victim.hp -= dmg;
  if (victim.bot && attacker) { victim.brain.alert = attacker.id; victim.brain.alertT = 2.5; }
  if (attacker) send(victim, { t: 'hurt', dmg, from: [attacker.pos[0], attacker.pos[2]] });
  if (victim.hp <= 0) {
    victim.hp = 0; victim.alive = false; victim.use = false; victim.d++;
    if (attacker && attacker !== victim && attacker.team !== victim.team) {
      attacker.k++;
      addMoney(attacker, W.reward);
      send(attacker, { t: 'cash', v: W.reward, why: 'kill' });
    }
    if (G.action && G.action.id === victim.id) G.action = null;
    if (G.c4 && G.c4.st === 'carried' && G.c4.c === victim.id) dropBomb(victim, false);
    broadcast({ t: 'kill', killer: attacker ? attacker.id : null, victim: victim.id, w, head: !!head });
  }
}

// ------------------------------------------------------------------ bomb carry
function dropBomb(p, thrown) {
  const pos = p.pos.slice();
  if (thrown) {
    const f = [-Math.sin(p.yaw), 0, -Math.cos(p.yaw)];
    const tgt = [pos[0] + f[0] * 1.6, pos[1], pos[2] + f[2] * 1.6];
    if (walkClear(pos, tgt, boxes)) { pos[0] = tgt[0]; pos[2] = tgt[2]; }
  }
  G.c4 = { st: 'dropped', p: pos, noPick: p.id, noPickUntil: now() + 1.5 };
  broadcast({ t: 'bomb', ev: 'drop', by: p.id });
}
function updateBombPickup() {
  if (!G.c4 || G.c4.st !== 'dropped') return;
  for (const p of players.values()) {
    if (!p.alive || sideOf(p.team) !== 'atk') continue;
    if (p.id === G.c4.noPick && now() < G.c4.noPickUntil) continue;
    if (dist2d(p.pos, G.c4.p) < 1.3 && Math.abs(p.pos[1] - G.c4.p[1]) < 1.6) {
      G.c4 = { st: 'carried', c: p.id };
      broadcast({ t: 'bomb', ev: 'pick', by: p.id });
      return;
    }
  }
}

// ------------------------------------------------------------------ grenades
function segPointDist(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const L = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
  const t = Math.max(0, Math.min(1, (ac[0] * ab[0] + ac[1] * ab[1] + ac[2] * ab[2]) / L));
  return Math.hypot(a[0] + ab[0] * t - c[0], a[1] + ab[1] * t - c[1], a[2] + ab[2] * t - c[2]);
}
function smokeBlocks(a, b) {
  const t = now();
  for (const s of G.smokes) if (t > s.from && t < s.until && segPointDist(a, b, s.p) < 3.6) return true;
  return false;
}
const canSee = (a, b) => losClear(a, b, boxes) && !smokeBlocks(a, b);

function throwNade(p, kind, o, v) {
  G.nades.push({ id: nadeId++, k: kind, p: o, v, fuse: kind === 'sm' ? 2.0 : kind === 'fl' ? 1.5 : 1.7, owner: p.id });
}
function updateNades(dt) {
  for (let i = G.nades.length - 1; i >= 0; i--) {
    const n = G.nades[i];
    stepNade(n, dt, boxes);
    n.fuse -= dt;
    if (n.fuse <= 0) { G.nades.splice(i, 1); detonate(n); }
  }
  const t = now();
  G.smokes = G.smokes.filter((s) => s.until > t);
}
function detonate(n) {
  const p = n.p.map((v) => +v.toFixed(2));
  const owner = players.get(n.owner) || null;
  if (n.k === 'he') {
    broadcast({ t: 'nade', k: 'he', p });
    for (const v of players.values()) {
      if (!v.alive) continue;
      if (owner && v.team === owner.team && v !== owner) continue;
      const c = [v.pos[0], v.pos[1] + 1.0, v.pos[2]];
      const d = dist3(p, c);
      if (d > 7) continue;
      if (!losClear([p[0], p[1] + 0.2, p[2]], c, boxes)) continue;
      applyDamage(v, owner, NADE_IDS.he, false, 100 * Math.pow(1 - d / 7, 1.3));
    }
  } else if (n.k === 'fl') {
    broadcast({ t: 'nade', k: 'fl', p });
    for (const b of players.values()) {
      if (!b.bot || !b.alive) continue;
      const eye = [b.pos[0], b.pos[1] + 1.6, b.pos[2]];
      const d = dist3(eye, p);
      if (d > 28 || !losClear(eye, p, boxes)) continue;
      const ang = Math.abs(angDiff(yawTo(b.pos, p), b.yaw));
      const k = (ang < 1.2 ? 1 : 0.35) * (1 - d / 30);
      b.brain.blindUntil = Math.max(b.brain.blindUntil, now() + 3.2 * k);
    }
  } else if (n.k === 'sm') {
    G.smokes.push({ p, from: now() + 0.8, until: now() + 16.5 });
    broadcast({ t: 'nade', k: 'sm', p, dur: 16.5 });
  }
}

// ------------------------------------------------------------------ bots
const GRAPH = NODES.map(() => []);
for (let i = 0; i < NODES.length; i++) {
  for (let j = i + 1; j < NODES.length; j++) {
    const a = NODES[i], b = NODES[j];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d <= 26 && walkClear([a[0], 0, a[1]], [b[0], 0, b[1]], boxes)) {
      GRAPH[i].push([j, d]); GRAPH[j].push([i, d]);
    }
  }
}
function nearestNode(p) {
  const order = NODES.map((n, i) => [i, Math.hypot(n[0] - p[0], n[1] - p[2])]).sort((a, b) => a[1] - b[1]);
  for (const [i] of order.slice(0, 8)) if (walkClear(p, [NODES[i][0], 0, NODES[i][1]], boxes)) return i;
  return order[0][0];
}
function findPath(from, goal) {
  if (walkClear(from, goal, boxes)) return [goal.slice()];
  const s = nearestNode(from), e = nearestNode(goal);
  const dist = NODES.map(() => Infinity), prev = NODES.map(() => -1), done = NODES.map(() => false);
  dist[s] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < NODES.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity || u === e) break;
    done[u] = true;
    for (const [v, w] of GRAPH[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
  }
  const nodes = [];
  for (let n = e; n >= 0; n = prev[n]) nodes.unshift(n);
  const pts = nodes.map((i) => [NODES[i][0], 0, NODES[i][1]]);
  if (pts.length > 1 && walkClear(from, pts[1], boxes)) pts.shift();
  pts.push(goal.slice());
  return pts;
}
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const turnToward = (cur, target, maxStep) => { const d = angDiff(target, cur); return cur + Math.max(-maxStep, Math.min(maxStep, d)); };
const yawTo = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));

function botWalk(b, vx, vz, dt) {
  b.vel[0] = vx; b.vel[2] = vz;
  moveBody(b, dt, boxes);
}

function navigate(b, goal, dt) {
  const br = b.brain;
  const key = goal[0].toFixed(1) + ',' + goal[2].toFixed(1);
  if (br.goalKey !== key) {
    br.goalKey = key; br.path = findPath(b.pos, goal); br.stuckT = 0; br.lastProg = b.pos.slice();
  }
  if (!br.path.length) { botWalk(b, 0, 0, dt); return dist2d(b.pos, goal) < 1.6; }
  const next = br.path[0];
  const dx = next[0] - b.pos[0], dz = next[2] - b.pos[2];
  const d = Math.hypot(dx, dz);
  if (d < 0.8) { br.path.shift(); botWalk(b, 0, 0, dt); return !br.path.length; }
  const sp = 4.8 * WEAPONS[b.w].speed;
  botWalk(b, (dx / d) * sp, (dz / d) * sp, dt);
  b.mv = true;
  b.yaw = turnToward(b.yaw, Math.atan2(-dx, -dz), 6 * dt);
  b.pitch *= 0.9;
  br.stuckT += dt;
  if (br.stuckT > 1.5) {
    if (dist2d(b.pos, br.lastProg) < 0.6) br.goalKey = null;
    br.stuckT = 0; br.lastProg = b.pos.slice();
  }
  return false;
}

function botShoot(b, t, d) {
  const W = WEAPONS[b.w];
  const eye = [b.pos[0], b.pos[1] + 1.6, b.pos[2]];
  let mul = 1;
  if (W.slot === 'sec') mul = 0.85;
  else if (W.id === 3) mul = 0.9;
  else if (W.pellets) mul = d < 10 ? 1.3 : d < 20 ? 0.6 : 0.12;
  else if (W.scope) mul = 1.5;
  let chance = 0.62 - d * 0.012;
  if (t.mv) chance *= 0.8;
  if (t.cr) chance *= 0.9;
  chance = Math.min(0.85, Math.max(0.12, Math.min(0.58, chance)) * 0.85 * mul);
  const hit = Math.random() < chance;
  const head = hit && !W.pellets && Math.random() < 0.12;
  const th = t.cr ? CROUCH_H : STAND_H;
  let aim = [t.pos[0], t.pos[1] + (head ? th - 0.15 : th * 0.65), t.pos[2]];
  if (!hit) aim = [aim[0] + (Math.random() - 0.5) * 1.6, aim[1] + (Math.random() - 0.4) * 1.2, aim[2] + (Math.random() - 0.5) * 1.6];
  const dir = [aim[0] - eye[0], aim[1] - eye[1], aim[2] - eye[2]];
  const L = Math.hypot(...dir) || 1;
  const far = [eye[0] + (dir[0] / L) * (L + 25), eye[1] + (dir[1] / L) * (L + 25), eye[2] + (dir[2] / L) * (L + 25)];
  let end = hit ? aim : far;
  if (!hit) {
    const f = segWorld(eye, far, boxes);
    end = [eye[0] + (far[0] - eye[0]) * f, Math.max(0, eye[1] + (far[1] - eye[1]) * f), eye[2] + (far[2] - eye[2]) * f];
  }
  broadcast({ t: 'fire', i: b.id, w: W.id, e: end.map((v) => +v.toFixed(2)), hit: hit ? 1 : 0 });
  if (hit) {
    const override = W.pellets ? W.dmg * W.pellets * Math.max(0.15, 0.75 - d / W.range) : undefined;
    applyDamage(t, b, W.id, head, override);
  }
  b.brain.ammo--;
  if (b.brain.ammo <= 0) b.brain.reloadT = W.reload;
}

function botCombat(b, br, target, td, dt) {
  const W = WEAPONS[b.w];
  const eye = [b.pos[0], b.pos[1] + 1.6, b.pos[2]];
  if (br.target !== target.id) { br.target = target.id; br.react = 0.32 + Math.random() * 0.4 + (W.scope ? 0.25 : 0); }
  const desired = yawTo(b.pos, target.pos);
  const chestY = target.pos[1] + (target.cr ? 0.85 : 1.2);
  b.yaw = turnToward(b.yaw, desired, 7 * dt);
  b.pitch += (Math.atan2(chestY - eye[1], td) - b.pitch) * Math.min(1, dt * 8);
  br.strafeT -= dt;
  if (br.strafeT <= 0) { br.strafeT = 0.4 + Math.random() * 0.8; br.strafe = W.scope ? 0 : [-1, 0, 0, 1][Math.floor(Math.random() * 4)]; }
  if (W.pellets && td > 7) {
    botWalk(b, -Math.sin(b.yaw) * 4, -Math.cos(b.yaw) * 4, dt); b.mv = true;   // shotguns push in
  } else {
    botWalk(b, Math.cos(b.yaw) * br.strafe * 2.4, -Math.sin(b.yaw) * br.strafe * 2.4, dt);
    if (br.strafe) b.mv = true;
  }
  br.react -= dt;
  if (br.reloadT > 0) return;
  if (br.react <= 0 && Math.abs(angDiff(desired, b.yaw)) < 0.12) {
    br.fireT -= dt;
    if (br.fireT <= 0) {
      botShoot(b, target, td);
      if (W.auto) {
        br.burst++;
        if (br.burst >= 4) { br.burst = 0; br.fireT = 0.45 + Math.random() * 0.35; } else br.fireT = W.rate * 1.1;
      } else br.fireT = W.rate * 1.6 + Math.random() * 0.25;
    }
  }
}

function updateBot(b, dt) {
  b.use = false; b.mv = false;
  if (!b.alive || G.phase === 'freeze' || G.phase === 'idle') return;
  const br = b.brain;
  const side = sideOf(b.team);
  const eye = [b.pos[0], b.pos[1] + 1.6, b.pos[2]];
  const t = now();

  if (br.alertT > 0) br.alertT -= dt; else br.alert = null;
  if (br.reloadT > 0) { br.reloadT -= dt; if (br.reloadT <= 0) br.ammo = WEAPONS[b.w].mag; }

  let target = null, td = Infinity;
  if (t > br.blindUntil) {
    for (const e of players.values()) {
      if (!e.alive || e.team === b.team) continue;
      const d = dist2d(b.pos, e.pos);
      if (d > (WEAPONS[b.w].scope ? 70 : 50)) continue;
      const ang = Math.abs(angDiff(yawTo(b.pos, e.pos), b.yaw));
      if (ang > 1.35 && br.alert !== e.id && d > 4) continue;
      const chest = [e.pos[0], e.pos[1] + (e.cr ? 0.85 : 1.2), e.pos[2]];
      if (!canSee(eye, chest)) continue;
      if (d < td) { td = d; target = e; }
    }
  }
  if (target) { botCombat(b, br, target, td, dt); return; }
  br.target = null;

  if (t < br.blindUntil) { b.yaw += dt * 2; botWalk(b, 0, 0, dt); return; }

  if (br.alert) {
    const a = players.get(br.alert);
    if (a) b.yaw = turnToward(b.yaw, yawTo(b.pos, a.pos), 5 * dt);
  }

  let goal, useAtGoal = false, lookAt = null;
  const c4 = G.c4;
  if (side === 'atk') {
    const spot = PLANT_SPOTS[G.botPlan];
    if (!c4) goal = spot;
    else if (c4.st === 'planted') {
      if (dist2d(b.pos, c4.p) < 8) { goal = b.pos.slice(); lookAt = [0, 0, 46]; } else goal = c4.p;
    } else if (c4.st === 'dropped') {
      let best = null, bd = Infinity;
      for (const p of players.values()) if (p.bot && p.alive && sideOf(p.team) === 'atk') { const d = dist2d(p.pos, c4.p); if (d < bd) { bd = d; best = p; } }
      goal = best === b ? c4.p : spot;
    } else if (c4.c === b.id) { goal = spot; useAtGoal = true; }
    else {
      const carrier = players.get(c4.c);
      goal = carrier && !carrier.bot && dist2d(b.pos, carrier.pos) > 6 ? carrier.pos : spot;
      if (dist2d(b.pos, spot) < 6) lookAt = [0, 0, 46];
    }
  } else if (isPlanted()) { goal = c4.p; useAtGoal = true; }
  else { const h = HOLDS[br.hold] || HOLDS[0]; goal = h.p; lookAt = h.look; }

  const arrived = navigate(b, goal, dt);
  if (arrived) {
    if (useAtGoal) {
      if (side === 'atk' && siteAt(b.pos)) b.use = true;
      if (side === 'def' && isPlanted() && dist3(b.pos, c4.p) < 2.4) b.use = true;
    }
    if (lookAt && !br.alert) {
      br.lookT -= dt;
      if (br.lookT <= 0) { br.lookT = 1.5 + Math.random() * 2; br.lookOff = (Math.random() - 0.5) * 1.2; }
      b.yaw = turnToward(b.yaw, yawTo(b.pos, lookAt) + br.lookOff, 2.5 * dt);
    }
  }
}

// ------------------------------------------------------------------ plant / defuse
function updateAction(dt) {
  let actor = null, kind = null;
  for (const p of players.values()) {
    if (!p.alive || !p.use) continue;
    const side = sideOf(p.team);
    if (G.phase === 'live' && side === 'atk' && G.c4 && G.c4.st === 'carried' && G.c4.c === p.id && siteAt(p.pos) && p.onGround !== false) { actor = p; kind = 'plant'; }
    else if (G.phase === 'planted' && side === 'def' && dist3(p.pos, G.c4.p) < 2.4) { actor = p; kind = 'defuse'; }
    if (actor && G.action && G.action.id === actor.id) break;
  }
  if (!actor) { G.action = null; return; }
  if (!G.action || G.action.id !== actor.id || G.action.kind !== kind) {
    const total = kind === 'plant' ? PLANT_TIME : actor.inv.kit ? KIT_DEFUSE_TIME : DEFUSE_TIME;
    G.action = { id: actor.id, kind, prog: 0, total, start: actor.pos.slice() };
  }
  if (dist2d(actor.pos, G.action.start) > 0.6) { G.action.prog = 0; G.action.start = actor.pos.slice(); }
  G.action.prog += dt;
  if (G.action.prog >= G.action.total) {
    if (kind === 'plant') {
      G.c4 = { st: 'planted', p: actor.pos.slice(), s: siteAt(actor.pos) };
      G.phase = 'planted'; G.timer = BOMB_TIME; G.action = null; G.planted = true;
      addMoney(actor, 300); send(actor, { t: 'cash', v: 300, why: 'plant' });
      for (const p of players.values()) p.use = false;
      broadcast({ t: 'sound', s: 'plant', site: G.c4.s, by: actor.id });
    } else {
      G.action = null;
      addMoney(actor, 300); send(actor, { t: 'cash', v: 300, why: 'defuse' });
      broadcast({ t: 'sound', s: 'defuse', by: actor.id });
      endRound('def', 'defuse');
    }
  }
}

function explode() {
  const bp = G.c4.p;
  broadcast({ t: 'sound', s: 'boom', p: bp });
  for (const p of players.values()) {
    if (!p.alive) continue;
    const d = dist3(p.pos, bp);
    if (d < 14) { p.hp = 0; p.alive = false; p.d++; broadcast({ t: 'kill', killer: null, victim: p.id, w: -1, head: false }); }
    else if (d < 22) { p.hp = Math.max(1, p.hp - Math.round(90 * (1 - (d - 14) / 8))); send(p, { t: 'hurt', dmg: 30, from: [bp[0], bp[2]] }); }
  }
  endRound('atk', 'bomb');
}

// ------------------------------------------------------------------ main loop
function tick(dt) {
  if (!humans().length) {
    if (G.phase !== 'idle') { G.phase = 'idle'; fillBots(); }
    return;
  }
  if (G.phase === 'idle') { resetMatch(); startRound(); }
  G.timer -= dt;
  for (const p of players.values()) if (p.bot) updateBot(p, dt);
  updateNades(dt);
  updateBombPickup();
  if (G.phase === 'live' || G.phase === 'planted') updateAction(dt);

  const alive = { atk: 0, def: 0 };
  for (const p of players.values()) if (p.alive) alive[sideOf(p.team)]++;

  if (G.phase === 'freeze') {
    if (G.timer <= 0) { G.phase = 'live'; G.timer = ROUND_TIME; broadcast({ t: 'go' }); }
  } else if (G.phase === 'live') {
    if (!alive.atk) endRound('def', 'elim');
    else if (!alive.def) endRound('atk', 'elim');
    else if (G.timer <= 0) endRound('def', 'time');
  } else if (G.phase === 'planted') {
    if (G.timer <= 0) explode();
    else if (!alive.def) endRound('atk', 'elim');
  } else if (G.phase === 'end') {
    if (G.timer <= 0) {
      if (G.matchOver) resetMatch();
      startRound();
    }
  }
}

const r2 = (v) => Math.round(v * 100) / 100;
function snapshot() {
  const ps = [...players.values()].map((p) => ({
    i: p.id, n: p.name, tm: p.team, b: p.bot ? 1 : 0,
    x: r2(p.pos[0]), y: r2(p.pos[1]), z: r2(p.pos[2]), yw: r2(p.yaw), pt: r2(p.pitch),
    hp: p.hp, a: p.alive ? 1 : 0, cr: p.cr ? 1 : 0, mv: p.mv ? 1 : 0, w: p.w, zm: p.zm, k: p.k, d: p.d,
    m: p.money, ar: p.inv.ar, hm: p.inv.helm ? 1 : 0, kit: p.inv.kit ? 1 : 0,
    pri: p.inv.pri, sec: p.inv.sec, he: p.inv.he, fl: p.inv.fl, sm: p.inv.sm,
  }));
  const c4 = G.c4 ? { st: G.c4.st, c: G.c4.c || 0, p: G.c4.p ? G.c4.p.map(r2) : null, s: G.c4.s || null } : null;
  const buyLeft = G.phase === 'freeze' ? G.timer + BUY_TIME : G.phase === 'live' ? Math.max(0, BUY_TIME - (ROUND_TIME - G.timer)) : 0;
  const g = {
    ph: G.phase, tm: r2(Math.max(0, G.timer)), sc: G.score, sw: G.swapped, rd: G.round, c4, bt: r2(buyLeft),
    act: G.action ? { i: G.action.id, k: G.action.kind, p: r2(G.action.prog / G.action.total) } : null,
    nd: G.nades.map((n) => [n.id, n.k, r2(n.p[0]), r2(n.p[1]), r2(n.p[2])]),
  };
  broadcast({ t: 'snap', ps, g });
}

let last = performance.now();
setInterval(() => {
  const t = performance.now();
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  tick(dt);
}, 1000 / 30);
setInterval(snapshot, 50);

// ------------------------------------------------------------------ websocket
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(finite);

wss.on('connection', (ws) => {
  let me = null;
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'join' && !me) {
      const name = String(m.name || 'Player').replace(/[^\w \-.!?áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g, '').trim().slice(0, 16) || 'Player';
      const hs = humans();
      let team = m.team === 'red' || m.team === 'blue' ? m.team : null;
      if (!team) {
        const red = hs.filter((p) => p.team === 'red').length, blue = hs.filter((p) => p.team === 'blue').length;
        team = red <= blue ? 'red' : 'blue';
      }
      me = makePlayer({ name, team, bot: false, ws });
      players.set(me.id, me);
      fillBots();
      send(me, { t: 'welcome', id: me.id, team: me.team, rd: G.round, sw: G.swapped });
      if (G.phase === 'freeze') spawnPlayer(me, 4 + Math.floor(Math.random() * 4));
      broadcast({ t: 'chat', text: `${name} joined ${team.toUpperCase()}` });
      return;
    }
    if (!me) return;

    if (m.t === 'st') {
      if (!me.alive || !isVec(m.p)) return;
      if (finite(m.yaw)) me.yaw = m.yaw;
      if (finite(m.pitch)) me.pitch = m.pitch;
      if (finite(m.w) && (owns(me, m.w) || (WEAPONS[m.w] && WEAPONS[m.w].slot === 'nade' && me.inv[WEAPONS[m.w].nade] > 0))) me.w = m.w;
      me.zm = m.zm ? 1 : 0;
      if (G.phase === 'freeze') return;
      me.pos = [Math.max(-40, Math.min(40, m.p[0])), Math.max(0, Math.min(20, m.p[1])), Math.max(-52, Math.min(52, m.p[2]))];
      me.cr = !!m.cr; me.mv = !!m.mv; me.onGround = m.g !== 0;
    } else if (m.t === 'fire') {
      if (!me.alive || G.phase === 'freeze') return;
      const W = WEAPONS[m.w];
      if (!W || W.slot === 'nade' || !owns(me, W.id)) return;
      const t = now();
      if (t - me.lastFire < W.rate * 0.6) return;
      me.lastFire = t;
      const hits = Array.isArray(m.hits) ? m.hits.slice(0, W.pellets || 1) : [];
      broadcast({ t: 'fire', i: me.id, w: W.id, e: isVec(m.e) ? m.e.map(r2) : null, hit: hits.length ? 1 : 0 }, me);
      for (const h of hits) {
        if (!h || !finite(h.id)) continue;
        const v = players.get(h.id);
        if (!v || !v.alive || v.team === me.team) continue;
        const d = dist3(v.pos, me.pos);
        if (W.id === 0 && d > 3.2) continue;
        const head = !!h.head;
        let dmg = W.dmg * (head ? W.headMul : 1);
        if (W.pellets) dmg *= Math.max(0.15, 1 - d / W.range);
        else if (W.id !== 0) dmg *= Math.pow(0.985, d / 10);
        applyDamage(v, me, W.id, head, dmg);
      }
    } else if (m.t === 'throw') {
      if (!me.alive || G.phase === 'freeze') return;
      const W = WEAPONS[m.w];
      if (!W || W.slot !== 'nade' || me.inv[W.nade] <= 0 || !isVec(m.v)) return;
      if (now() - me.lastThrow < 0.6) return;
      me.lastThrow = now();
      me.inv[W.nade]--;
      const sp = Math.hypot(...m.v);
      const v = sp > 22 ? m.v.map((c) => (c / sp) * 22) : m.v;
      const f = [-Math.sin(me.yaw), 0, -Math.cos(me.yaw)];
      const o = [me.pos[0] + f[0] * 0.3, me.pos[1] + (me.cr ? 1.0 : 1.5), me.pos[2] + f[2] * 0.3];
      throwNade(me, W.nade, o, v);
      broadcast({ t: 'throw', i: me.id });
      me.w = bestGun(me);
    } else if (m.t === 'buy') {
      if (!canBuyNow(me)) { send(me, { t: 'buyfail', why: 'Not in buy zone or buy time is over' }); return; }
      if (tryBuy(me, m.item)) send(me, { t: 'bought', item: m.item });
      else send(me, { t: 'buyfail', why: 'Can\'t buy that' });
    } else if (m.t === 'dropbomb') {
      if (me.alive && G.c4 && G.c4.st === 'carried' && G.c4.c === me.id) dropBomb(me, true);
    } else if (m.t === 'use') {
      me.use = !!m.on;
    } else if (m.t === 'chat') {
      const text = String(m.text || '').slice(0, 80).trim();
      if (text) broadcast({ t: 'chat', text: `${me.name}: ${text}`, team: me.team });
    }
  });
  ws.on('close', () => {
    if (!me) return;
    removePlayer(me);
    broadcast({ t: 'chat', text: `${me.name} left` });
    fillBots();
  });
});

server.listen(PORT, () => {
  console.log(`\n  LOW NOON server running on port ${PORT}`);
  console.log(`  Open on this computer:  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) console.log(`  Friends on same WiFi:   http://${ni.address}:${PORT}`);
    }
  }
  console.log('');
});
