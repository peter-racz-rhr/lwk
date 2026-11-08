// Tiny AABB physics shared by client + server.
export const PLAYER_R = 0.35;
export const STAND_H = 1.8;
export const CROUCH_H = 1.25;
export const STEP = 0.45;
export const GRAVITY = 20;

function overlaps(p, r, h, b) {
  return p[0] + r > b.min[0] && p[0] - r < b.max[0] &&
         p[2] + r > b.min[2] && p[2] - r < b.max[2] &&
         p[1] + h > b.min[1] && p[1] < b.max[1];
}

function blockedAt(p, h, boxes) {
  for (const b of boxes) if (overlaps(p, PLAYER_R, h, b)) return true;
  return false;
}

export function canStand(pos, boxes) {
  return !blockedAt(pos, STAND_H, boxes);
}

// body: { pos:[x,y,z], vel:[x,y,z], onGround:bool, h:number }
export function moveBody(body, dt, boxes) {
  const r = PLAYER_R, h = body.h;
  const p = body.pos, v = body.vel;
  v[1] -= GRAVITY * dt;

  for (const axis of [0, 2]) {
    const d = v[axis] * dt;
    if (!d) continue;
    p[axis] += d;
    for (const b of boxes) {
      if (!overlaps(p, r, h, b)) continue;
      const rise = b.max[1] - p[1];
      if (body.onGround && rise > 0 && rise <= STEP) {
        const up = [p[0], b.max[1] + 0.001, p[2]];
        if (!blockedAt(up, h, boxes)) { p[1] = up[1]; continue; }
      }
      if (d > 0) p[axis] = b.min[axis] - r - 1e-4;
      else p[axis] = b.max[axis] + r + 1e-4;
    }
  }

  p[1] += v[1] * dt;
  body.onGround = false;
  if (p[1] <= 0) { p[1] = 0; v[1] = 0; body.onGround = true; }
  for (const b of boxes) {
    if (!overlaps(p, r, h, b)) continue;
    if (v[1] <= 0) { p[1] = b.max[1]; body.onGround = true; }
    else { p[1] = b.min[1] - h - 1e-4; }
    v[1] = 0;
  }
}

// segment a->a+d (t in 0..1) vs box, returns entry t or Infinity
export function segBox(o, d, b) {
  let tmin = 0, tmax = 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < b.min[i] || o[i] > b.max[i]) return Infinity;
    } else {
      let t1 = (b.min[i] - o[i]) / d[i], t2 = (b.max[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

// fraction (0..1) of segment a->b that is free
export function segWorld(a, b, boxes, filter) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  let best = 1;
  for (const bx of boxes) {
    if (filter && !filter(bx)) continue;
    const t = segBox(a, d, bx);
    if (t < best) best = t;
  }
  return best;
}

export function losClear(a, b, boxes) {
  return segWorld(a, b, boxes) >= 1;
}

const walkFilter = (bx) => bx.max[1] > 0.45 && bx.min[1] < 1.7;
export function walkClear(a, b, boxes) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const L = Math.hypot(dx, dz) || 1;
  const px = (-dz / L) * 0.42, pz = (dx / L) * 0.42;
  for (const s of [0, 1, -1]) {
    const p0 = [a[0] + px * s, 0.6, a[2] + pz * s];
    const p1 = [b[0] + px * s, 0.6, b[2] + pz * s];
    if (segWorld(p0, p1, boxes, walkFilter) < 1) return false;
  }
  return true;
}
