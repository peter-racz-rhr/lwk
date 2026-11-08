// "Kasbah" - original desert-town map for LOW NOON.
// Shared by server (bots, collision) and client (rendering, collision).
// Coordinates in meters. X = west(-)/east(+), Z = north(-)/south(+). Y = up.

export const boxes = [];

function B(x1, z1, x2, z2, y1, y2, mat = 'wall') {
  boxes.push({
    min: [Math.min(x1, x2), y1, Math.min(z1, z2)],
    max: [Math.max(x1, x2), y2, Math.max(z1, z2)],
    mat,
  });
}
function crate(cx, cz, s = 1.1, y = 0) {
  B(cx - s / 2, cz - s / 2, cx + s / 2, cz + s / 2, y, y + s, 'crate');
}

// ---- boundary
B(-41, -53, -40, 53, 0, 8, 'wall');
B(40, -53, 41, 53, 0, 8, 'wall');
B(-40, -53, 40, -52, 0, 8, 'wall');
B(-40, 52, 40, 53, 0, 8, 'wall');

// ---- attacker spawn (north)
B(-40, -52, -30, -43, 0, 7, 'house');
B(30, -52, 40, -43, 0, 7, 'house');
crate(-12, -48); crate(12, -48); crate(12, -48, 1.1, 1.1);

// ---- central building blocks (separate the three lanes)
B(-28, -38, -6, 8, 0, 7, 'house');
B(6, -38, 28, 8, 0, 7, 'house');

// ---- LONG (west lane x -40..-28)
B(-40, -18.5, -36, -17.5, 0, 7, 'wall');
B(-32, -18.5, -28, -17.5, 0, 7, 'wall');
B(-36, -18.5, -32, -17.5, 3.2, 7, 'trim');
crate(-38, -30); crate(-38, -30, 1.1, 1.1);
crate(-38.2, -6);
crate(-30, 0, 2.2);

// ---- MID (x -6..6)
B(-6, -10.5, -1.8, -9.5, 0, 7, 'wall');
B(1.8, -10.5, 6, -9.5, 0, 7, 'wall');
B(-1.8, -10.5, 1.8, -9.5, 3.4, 7, 'trim');
crate(4, -26);
crate(-4.2, 3); crate(-4.2, 3, 1.1, 1.1);

// ---- TUNNELS (east lane x 28..40)
B(28, -30, 40, 2, 3.6, 4.4, 'dark');
B(33, -14, 35, -10, 0, 3.6, 'dark');
crate(38.6, -24);
B(31, 4, 40, 5, 0, 4.4, 'dark');  // tunnel exit corner (breaks the long sightline into B)

// ---- courtyard / connectors
B(-16, 12, -15, 20, 0, 7, 'wall');
B(15, 12, 16, 20, 0, 7, 'wall');
B(-16, 20, -6, 34, 0, 7, 'house');
B(6, 20, 16, 34, 0, 7, 'house');
B(-6, 33, 6, 34, 3.6, 7, 'trim'); // arch over mid-bottom

// ---- A SITE (x -40..-16, z 8..34)
B(-38, 22, -29, 32, 0, 1.2, 'tile');      // raised platform
B(-36, 20.8, -31, 22, 0, 0.8, 'tile');    // steps
B(-36, 19.6, -31, 20.8, 0, 0.4, 'tile');
crate(-24, 18); crate(-22.9, 18);
crate(-23.5, 27, 2.2);
crate(-33, 29, 1.1, 1.2);
crate(-19, 31);

// ---- B SITE (x 16..40, z 8..34)
crate(22, 15, 2.2);
crate(34, 17); crate(35.1, 17);
crate(30, 28); crate(30, 28, 1.1, 1.1);
B(18, 24, 24, 25, 0, 1.1, 'wall');

// ---- defender spawn (south)
B(-40, 44, -30, 52, 0, 7, 'house');
B(30, 44, 40, 52, 0, 7, 'house');
crate(-24, 37); crate(24, 37);

export const MAP_BOUNDS = { x1: -40, x2: 40, z1: -52, z2: 52 };

export const SITES = {
  A: { x1: -40, x2: -16, z1: 14, z2: 34, label: [-21, 23] },
  B: { x1: 16, x2: 40, z1: 14, z2: 34, label: [28, 22] },
};

export function siteAt(p) {
  for (const k in SITES) {
    const s = SITES[k];
    if (p[0] > s.x1 && p[0] < s.x2 && p[2] > s.z1 && p[2] < s.z2) return k;
  }
  return null;
}

// yaw: 0 faces -Z (north), PI faces +Z (south)
export const SPAWNS = {
  atk: { yaw: Math.PI, pts: [[-6, -47], [0, -47], [6, -47], [-3, -44], [3, -44], [-9, -44], [9, -44], [0, -50]] },
  def: { yaw: 0, pts: [[-6, 46], [0, 46], [6, 46], [-3, 49], [3, 49], [-9, 49], [9, 49], [0, 42]] },
};

// Bot navigation nodes (x, z). Edges are computed automatically from line of sight.
export const NODES = [
  [0, -46], [-18, -44], [18, -44],
  [-34, -40], [-34, -28], [-34, -18], [-34, -8], [-34, 4],
  [0, -36], [0, -22], [0, -10], [0, -2], [0, 6],
  [34, -40], [34, -24], [31, -12], [37.5, -12], [34, -2], [30, 1], [29.5, 8],
  [-10, 10], [10, 10], [0, 14], [-19, 10], [19, 10],
  [-30, 12], [-21, 14], [-20, 24], [-26, 33], [-34, 16],
  [28, 12], [26, 20], [36, 24], [24, 30], [34, 32],
  [0, 26], [0, 38], [0, 46], [-14, 40], [14, 40], [-28, 40], [28, 40],
];

export const PLANT_SPOTS = { A: [-21, 0, 18], B: [26, 0, 20] };

export const HOLDS = [
  { site: 'A', p: [-26, 0, 33], look: [-34, 0, 8] },
  { site: 'B', p: [34, 0, 32], look: [34, 0, 8] },
  { site: 'M', p: [0, 0, 26], look: [0, 0, 10] },
];

// decorative palms outside the walls (client only)
export const PALMS = [[-46, -30], [46, -10], [-47, 20], [47, 40], [-20, -58], [15, 58], [48, -45], [-48, 48], [-5, 59], [30, -59]];
