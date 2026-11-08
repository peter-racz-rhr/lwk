// Grenade projectile physics (server simulates, client only renders).
export const NADE_GRAVITY = 15;
export const NADE_R = 0.07;

function inside(p, b, m) {
  return p[0] > b.min[0] - m && p[0] < b.max[0] + m &&
         p[1] > b.min[1] - m && p[1] < b.max[1] + m &&
         p[2] > b.min[2] - m && p[2] < b.max[2] + m;
}

// n: { p:[x,y,z], v:[x,y,z] }
export function stepNade(n, dt, boxes) {
  const steps = 4, sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    n.v[1] -= NADE_GRAVITY * sdt;
    const np = [n.p[0] + n.v[0] * sdt, n.p[1] + n.v[1] * sdt, n.p[2] + n.v[2] * sdt];
    if (np[1] < NADE_R) {
      np[1] = NADE_R;
      if (n.v[1] < 0) n.v[1] = -n.v[1] * 0.35;
      n.v[0] *= 0.75; n.v[2] *= 0.75;
      if (Math.abs(n.v[1]) < 0.6) n.v[1] = 0;
    }
    for (const b of boxes) {
      if (!inside(np, b, NADE_R)) continue;
      for (let i = 0; i < 3; i++) {
        const was = n.p[i] > b.min[i] - NADE_R && n.p[i] < b.max[i] + NADE_R;
        if (!was) {
          n.v[i] = -n.v[i] * 0.45;
          for (let j = 0; j < 3; j++) if (j !== i) n.v[j] *= 0.8;
          np[i] = n.p[i];
          if (i === 1 && n.v[1] > 0 && n.v[1] < 0.6) n.v[1] = 0;
        }
      }
      if (inside(np, b, NADE_R)) { np[0] = n.p[0]; np[1] = n.p[1]; np[2] = n.p[2]; }
    }
    n.p = np;
  }
}
