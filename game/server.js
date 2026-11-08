// LOW NOON - game server. Serves the client and runs rounds, bomb and bots.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { boxes, SPAWNS, NODES, PLANT_SPOTS, HOLDS, siteAt } from './shared/map.js';
import { moveBody, losClear, walkClear, segWorld, STAND_H, CROUCH_H } from './shared/physics.js';
import {
  WEAPONS, MAX_HP, ROUND_TIME, BOMB_TIME, FREEZE_TIME, PLANT_TIME, DEFUSE_TIME, ROUNDS_TO_WIN, HALF_ROUNDS,
} from './shared/weapons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const BOTS_PER_TEAM = 2;

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
    res.end(JSON.stringify({ G: { ...G }, ps: [...players.values()].map((p) => ({ id: p.id, n: p.name, tm: p.team, a: p.alive, pos: p.pos.map((v) => +v.toFixed(1)), use: p.use, path: p.brain && p.brain.path.map((q) => q.map((v) => +v.toFixed(1))), goal: p.brain && p.brain.goalKey })) }));
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
let nextId = 1;
const G = {
  phase: 'idle', timer: 0, round: 0, score: { red: 0, blue: 0 }, swapped: false,
  bomb: null, action: null, matchOver: false, pendingSwap: false, botPlan: 'A',
};
const sideOf = (team) => ((team === 'red') !== G.swapped ? 'atk' : 'def');
const teamOfSide = (side) => ((side === 'atk') !== G.swapped ? 'red' : 'blue');

const BOT_NAMES = ['Kebab', 'Falafel', 'Gyro', 'Hummus', 'Baklava', 'Shawarma', 'Tahini', 'Couscous'];
let botNameIdx = 0;

function makePlayer({ name, team, bot, ws }) {
  return {
    id: nextId++, name, team, bot, ws,
    pos: [0, 0, 0], vel: [0, 0, 0], onGround: true, h: STAND_H,
    yaw: 0, pitch: 0, cr: false, mv: false, w: 0,
    hp: MAX_HP, alive: false, k: 0, d: 0, use: false, lastFire: 0,
    brain: bot ? newBrain() : null,
  };
}
function newBrain() {
  return { path: [], goalKey: null, target: null, react: 0, fireT: 0, burst: 0, strafe: 0, strafeT: 0,
    stuckT: 0, lastProg: [0, 0, 0], hold: 0, alert: null, alertT: 0, lookT: 0, lookOff: 0 };
}

const send = (p, msg) => { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); };
function broadcast(msg, except) {
  const s = JSON.stringify(msg);
  for (const p of players.values()) if (p !== except && p.ws && p.ws.readyState === 1) p.ws.send(s);
}
const humans = () => [...players.values()].filter((p) => !p.bot);
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function fillBots() {
  const humanCount = humans().length;
  for (const team of ['red', 'blue']) {
    const members = [...players.values()].filter((p) => p.team === team);
    const h = members.filter((p) => !p.bot).length;
    const bots = members.filter((p) => p.bot);
    const want = humanCount ? Math.max(0, BOTS_PER_TEAM - h) : 0;
    while (bots.length > want) {
      const b = bots.pop();
      players.delete(b.id);
      if (G.action && G.action.id === b.id) G.action = null;
    }
    while (bots.length < want) {
      const b = makePlayer({ name: 'BOT ' + BOT_NAMES[botNameIdx++ % BOT_NAMES.length], team, bot: true });
      players.set(b.id, b);
      bots.push(b);
      if (G.phase === 'freeze') spawnPlayer(b, members.length + bots.length);
    }
  }
}

function spawnPlayer(p, idx) {
  const side = sideOf(p.team);
  const sp = SPAWNS[side];
  const pt = sp.pts[idx % sp.pts.length];
  p.pos = [pt[0], 0, pt[1]]; p.vel = [0, 0, 0]; p.onGround = true; p.h = STAND_H;
  p.yaw = sp.yaw; p.pitch = 0; p.hp = MAX_HP; p.alive = true; p.use = false; p.cr = false; p.w = 0;
  if (p.bot) {
    const keep = p.brain.hold;
    p.brain = newBrain();
    p.brain.hold = keep;
  }
  send(p, { t: 'spawn', p: p.pos, yaw: p.yaw });
}

function resetMatch() {
  G.score = { red: 0, blue: 0 }; G.round = 0; G.swapped = false; G.matchOver = false; G.pendingSwap = false;
  for (const p of players.values()) { p.k = 0; p.d = 0; }
}

function startRound() {
  let half = false;
  if (G.pendingSwap) { G.swapped = true; G.pendingSwap = false; half = true; }
  G.round++;
  G.phase = 'freeze'; G.timer = FREEZE_TIME; G.bomb = null; G.action = null;
  G.botPlan = Math.random() < 0.5 ? 'A' : 'B';
  const idx = { atk: 0, def: 0 };
  const order = [...players.values()].sort(() => Math.random() - 0.5);
  let defBot = Math.floor(Math.random() * 2);
  for (const p of order) {
    const s = sideOf(p.team);
    if (p.bot && s === 'def') { p.brain.hold = defBot % 2; defBot++; if (Math.random() < 0.2) p.brain.hold = 2; }
    spawnPlayer(p, idx[s]++);
  }
  broadcast({ t: 'round', rd: G.round, sw: G.swapped, half });
}

function endRound(side, reason) {
  if (G.phase === 'end') return;
  const team = teamOfSide(side);
  G.score[team]++;
  G.phase = 'end'; G.timer = 5; G.action = null;
  broadcast({ t: 'roundend', side, team, reason });
  if (G.score[team] >= ROUNDS_TO_WIN) {
    G.matchOver = true; G.timer = 9;
    broadcast({ t: 'matchend', team });
  } else if (G.round === HALF_ROUNDS) {
    G.pendingSwap = true;
  }
}

function applyDamage(victim, attacker, w, head) {
  if (!victim.alive || G.phase === 'freeze') return;
  const W = WEAPONS[w];
  const dmg = Math.round(W.dmg * (head ? W.headMul : 1));
  victim.hp -= dmg;
  if (victim.bot && attacker) { victim.brain.alert = attacker.id; victim.brain.alertT = 2.5; }
  if (attacker) send(victim, { t: 'hurt', dmg, from: [attacker.pos[0], attacker.pos[2]] });
  if (victim.hp <= 0) {
    victim.hp = 0; victim.alive = false; victim.use = false; victim.d++;
    if (attacker && attacker !== victim) attacker.k++;
    if (G.action && G.action.id === victim.id) G.action = null;
    broadcast({ t: 'kill', killer: attacker ? attacker.id : null, victim: victim.id, w, head: !!head });
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
  const sp = 4.8;
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
  const eye = [b.pos[0], b.pos[1] + 1.6, b.pos[2]];
  let chance = 0.62 - d * 0.012;
  if (t.mv) chance *= 0.8;
  if (t.cr) chance *= 0.9;
  chance = Math.max(0.12, Math.min(0.58, chance)) * 0.85;
  const hit = Math.random() < chance;
  const head = hit && Math.random() < 0.12;
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
  broadcast({ t: 'fire', i: b.id, w: 0, e: end.map((v) => +v.toFixed(2)), hit: hit ? t.id : 0 });
  if (hit) applyDamage(t, b, 0, head);
}

function updateBot(b, dt) {
  b.use = false; b.mv = false;
  if (!b.alive || G.phase === 'freeze' || G.phase === 'idle') return;
  const br = b.brain;
  const side = sideOf(b.team);
  const eye = [b.pos[0], b.pos[1] + 1.6, b.pos[2]];

  if (br.alertT > 0) br.alertT -= dt; else br.alert = null;

  let target = null, td = Infinity;
  for (const e of players.values()) {
    if (!e.alive || e.team === b.team) continue;
    const d = dist2d(b.pos, e.pos);
    if (d > 50) continue;
    const ang = Math.abs(angDiff(yawTo(b.pos, e.pos), b.yaw));
    if (ang > 1.35 && br.alert !== e.id && d > 4) continue;
    const chest = [e.pos[0], e.pos[1] + (e.cr ? 0.85 : 1.2), e.pos[2]];
    if (!losClear(eye, chest, boxes)) continue;
    if (d < td) { td = d; target = e; }
  }

  if (target) {
    if (br.target !== target.id) { br.target = target.id; br.react = 0.32 + Math.random() * 0.4; }
    const desired = yawTo(b.pos, target.pos);
    const chestY = target.pos[1] + (target.cr ? 0.85 : 1.2);
    b.yaw = turnToward(b.yaw, desired, 7 * dt);
    b.pitch += (Math.atan2(chestY - eye[1], td) - b.pitch) * Math.min(1, dt * 8);
    br.strafeT -= dt;
    if (br.strafeT <= 0) { br.strafeT = 0.4 + Math.random() * 0.8; br.strafe = [-1, 0, 0, 1][Math.floor(Math.random() * 4)]; }
    const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
    botWalk(b, rx * br.strafe * 2.4, rz * br.strafe * 2.4, dt);
    if (br.strafe) b.mv = true;
    br.react -= dt;
    if (br.react <= 0 && Math.abs(angDiff(desired, b.yaw)) < 0.12) {
      br.fireT -= dt;
      if (br.fireT <= 0) {
        botShoot(b, target, td);
        br.burst++;
        if (br.burst >= 4) { br.burst = 0; br.fireT = 0.45 + Math.random() * 0.35; } else br.fireT = 0.11;
      }
    }
    return;
  }
  br.target = null;

  // turn toward whoever shot us
  if (br.alert) {
    const a = players.get(br.alert);
    if (a) { b.yaw = turnToward(b.yaw, yawTo(b.pos, a.pos), 5 * dt); }
  }

  let goal, useAtGoal = false, lookAt = null;
  if (side === 'atk') {
    if (!G.bomb) { goal = PLANT_SPOTS[G.botPlan]; useAtGoal = true; }
    else if (dist2d(b.pos, G.bomb.pos) < 8) { goal = b.pos.slice(); lookAt = [0, 0, 46]; }
    else goal = G.bomb.pos;
  } else if (G.bomb) { goal = G.bomb.pos; useAtGoal = true; }
  else { const h = HOLDS[br.hold] || HOLDS[0]; goal = h.p; lookAt = h.look; }

  const arrived = navigate(b, goal, dt);
  if (arrived) {
    if (useAtGoal) {
      if (side === 'atk' && siteAt(b.pos)) b.use = true;
      if (side === 'def' && G.bomb && dist3(b.pos, G.bomb.pos) < 2.4) b.use = true;
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
    if (G.phase === 'live' && side === 'atk' && siteAt(p.pos) && p.onGround !== false) { actor = p; kind = 'plant'; }
    else if (G.phase === 'planted' && side === 'def' && G.bomb && dist3(p.pos, G.bomb.pos) < 2.4) { actor = p; kind = 'defuse'; }
    if (actor && G.action && G.action.id === actor.id) break;
  }
  if (!actor) { G.action = null; return; }
  if (!G.action || G.action.id !== actor.id || G.action.kind !== kind) {
    G.action = { id: actor.id, kind, prog: 0, total: kind === 'plant' ? PLANT_TIME : DEFUSE_TIME, start: actor.pos.slice() };
  }
  if (dist2d(actor.pos, G.action.start) > 0.6) { G.action.prog = 0; G.action.start = actor.pos.slice(); }
  G.action.prog += dt;
  if (G.action.prog >= G.action.total) {
    if (kind === 'plant') {
      G.bomb = { pos: actor.pos.slice(), site: siteAt(actor.pos) };
      G.phase = 'planted'; G.timer = BOMB_TIME; G.action = null;
      for (const p of players.values()) p.use = false;
      broadcast({ t: 'sound', s: 'plant', site: G.bomb.site, by: actor.id });
    } else {
      G.action = null;
      broadcast({ t: 'sound', s: 'defuse', by: actor.id });
      endRound('def', 'defuse');
    }
  }
}

function explode() {
  const bp = G.bomb.pos;
  broadcast({ t: 'sound', s: 'boom', p: bp });
  for (const p of players.values()) {
    if (p.alive && dist3(p.pos, bp) < 15) { p.hp = 0; p.alive = false; p.d++; broadcast({ t: 'kill', killer: null, victim: p.id, w: -1, head: false }); }
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
    hp: p.hp, a: p.alive ? 1 : 0, cr: p.cr ? 1 : 0, mv: p.mv ? 1 : 0, w: p.w, k: p.k, d: p.d,
  }));
  const g = {
    ph: G.phase, tm: r2(Math.max(0, G.timer)), sc: G.score, sw: G.swapped, rd: G.round,
    bomb: G.bomb ? { p: G.bomb.pos.map(r2), s: G.bomb.site } : null,
    act: G.action ? { i: G.action.id, k: G.action.kind, p: r2(G.action.prog / G.action.total) } : null,
  };
  broadcast({ t: 'snap', ps, g });
}

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(dt);
}, 1000 / 30);
setInterval(snapshot, 50);

// ------------------------------------------------------------------ websocket
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

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
      if (!me.alive || !Array.isArray(m.p) || !m.p.every(finite)) return;
      if (G.phase === 'freeze') return;
      me.pos = [Math.max(-40, Math.min(40, m.p[0])), Math.max(0, Math.min(20, m.p[1])), Math.max(-52, Math.min(52, m.p[2]))];
      if (finite(m.yaw)) me.yaw = m.yaw;
      if (finite(m.pitch)) me.pitch = m.pitch;
      me.cr = !!m.cr; me.mv = !!m.mv; me.onGround = m.g !== 0;
      if (m.w === 0 || m.w === 1 || m.w === 2) me.w = m.w;
    } else if (m.t === 'fire') {
      if (!me.alive || G.phase === 'freeze') return;
      const W = WEAPONS[m.w];
      if (!W) return;
      const now = performance.now() / 1000;
      if (now - me.lastFire < W.rate * 0.6) return;
      me.lastFire = now;
      const e = Array.isArray(m.e) && m.e.length === 3 && m.e.every(finite) ? m.e.map(r2) : null;
      broadcast({ t: 'fire', i: me.id, w: W.id, e, hit: m.hit && m.hit.id ? m.hit.id : 0 }, me);
      if (m.hit && m.hit.id) {
        const v = players.get(m.hit.id);
        if (v && v.alive && v.team !== me.team) {
          if (W.id === 2 && dist3(v.pos, me.pos) > 3.2) return;
          applyDamage(v, me, W.id, !!m.hit.head);
        }
      }
    } else if (m.t === 'use') {
      me.use = !!m.on;
    } else if (m.t === 'chat') {
      const text = String(m.text || '').slice(0, 80).trim();
      if (text) broadcast({ t: 'chat', text: `${me.name}: ${text}`, team: me.team });
    }
  });
  ws.on('close', () => {
    if (!me) return;
    players.delete(me.id);
    if (G.action && G.action.id === me.id) G.action = null;
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
