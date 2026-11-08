// LOW NOON - browser client
import * as THREE from 'three';
import { boxes, SITES, siteAt, PALMS, MAP_BOUNDS } from '../shared/map.js';
import { moveBody, canStand, losClear, STAND_H, CROUCH_H } from '../shared/physics.js';
import { WEAPONS, GEAR, MAX_HP, BUY_RADIUS } from '../shared/weapons.js';
import { createGame } from '../shared/core.js';

// =====================================================================
// settings
// =====================================================================
const settings = { name: '', team: 'auto', res: 300, sens: 1, vol: 0.7 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('lownoon') || '{}')); } catch { /* ignore */ }
const saveSettings = () => { try { localStorage.setItem('lownoon', JSON.stringify(settings)); } catch { /* ignore */ } };
const $ = (id) => document.getElementById(id);

// =====================================================================
// renderer + PS2 pipeline
// =====================================================================
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.autoClear = false;

const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const snapU = { value: new THREE.Vector2(160, 120) };

function psx(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = snapU;
    shader.vertexShader = 'uniform vec2 uSnap;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      if (gl_Position.w > 0.0) {
        vec2 ndc = gl_Position.xy / gl_Position.w;
        ndc = floor(ndc * uSnap + 0.5) / uSnap;
        gl_Position.xy = ndc * gl_Position.w;
      }`);
  };
  mat.customProgramCacheKey = () => 'psx';
  return mat;
}

const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: rt.texture }, uHurt: { value: 0 }, uFlash: { value: 0 }, uDead: { value: 0 } },
  depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uHurt; uniform float uFlash; uniform float uDead;
    varying vec2 vUv;
    float bayer4(vec2 p) {
      vec2 q = mod(floor(p), 4.0);
      float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
      return m[int(q.x) + int(q.y) * 4] / 16.0;
    }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * 0.7;
      c = mix(c, vec3(0.75, 0.05, 0.02), uHurt * 0.5 * smoothstep(0.15, 0.7, length(d) * 1.4));
      float g = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, vec3(g) * vec3(1.0, 0.9, 0.85), uDead * 0.75);
      c = mix(c, vec3(1.0), clamp(uFlash, 0.0, 1.0));
      float levels = 28.0;
      c = floor(c * levels + bayer4(gl_FragCoord.xy)) / levels;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

const scene = new THREE.Scene();
const FOG_COLOR = 0xe9c99a;
scene.fog = new THREE.Fog(FOG_COLOR, 30, 150);
const BASE_FOV = 78;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 500);
camera.rotation.order = 'YXZ';

const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(68, 1, 0.01, 10);

function resize() {
  const aspect = innerWidth / innerHeight;
  const h = Number(settings.res) || 300;
  const w = Math.round(h * aspect);
  renderer.setSize(w, h, false);
  rt.setSize(w, h);
  camera.aspect = aspect; camera.updateProjectionMatrix();
  vmCam.aspect = aspect; vmCam.updateProjectionMatrix();
  snapU.value.set(w * 0.3, h * 0.3);
}
addEventListener('resize', resize);
resize();

// =====================================================================
// procedural textures
// =====================================================================
let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function makeTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noise(g, s, amt) {
  const img = g.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n * 0.8;
  }
  g.putImageData(img, 0, 0);
}
const texSand = makeTex(64, (g, s) => {
  g.fillStyle = '#d4ad72'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) { g.fillStyle = rnd() < 0.5 ? '#c49a60' : '#e2c088'; g.fillRect(rnd() * s | 0, rnd() * s | 0, 2, 1); }
  for (let i = 0; i < 12; i++) { g.fillStyle = '#9c7a4c'; g.fillRect(rnd() * s | 0, rnd() * s | 0, 1, 1); }
  noise(g, s, 18);
});
const texWall = makeTex(64, (g, s) => {
  g.fillStyle = '#9a7748'; g.fillRect(0, 0, s, s);
  const bh = 8, bw = 16;
  for (let y = 0; y < s; y += bh) {
    const off = (y / bh) % 2 ? bw / 2 : 0;
    for (let x = -bw; x < s; x += bw) {
      const v = 175 + rnd() * 30 | 0;
      g.fillStyle = `rgb(${v + 20},${v - 12},${v - 60})`;
      g.fillRect(x + off + 1, y + 1, bw - 1, bh - 1);
    }
  }
  noise(g, s, 16);
});
const texHouse = makeTex(128, (g, s) => {
  g.fillStyle = '#e0c597'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(150,110,60,${0.08 + rnd() * 0.12})`; g.fillRect(rnd() * s | 0, rnd() * s | 0, 4 + rnd() * 18 | 0, 2 + rnd() * 10 | 0); }
  g.fillStyle = 'rgba(120,85,45,0.25)'; g.fillRect(0, s - 10, s, 10);
  const wx = 44, wy = 44, ww = 40, wh = 46;
  g.fillStyle = '#6b4a2a'; g.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
  g.fillStyle = '#1d1a1e'; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = '#2f5d66'; g.fillRect(wx + 2, wy + 2, ww / 2 - 3, wh - 4); g.fillRect(wx + ww / 2 + 1, wy + 2, ww / 2 - 3, wh - 4);
  g.fillStyle = '#8a5d32'; for (let y = wy + 4; y < wy + wh; y += 6) { g.fillRect(wx + 2, y, ww / 2 - 3, 2); }
  g.fillStyle = '#b48a5a'; g.fillRect(wx - 6, wy + wh + 4, ww + 12, 4);
  g.fillStyle = '#c4a473'; g.fillRect(0, 0, s, 6);
  noise(g, s, 14);
});
const texCrate = makeTex(64, (g, s) => {
  g.fillStyle = '#8c5e2e'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 8) { g.fillStyle = y % 16 ? '#946535' : '#83552a'; g.fillRect(0, y, s, 7); g.fillStyle = '#5a3a1a'; g.fillRect(0, y + 7, s, 1); }
  g.fillStyle = '#5e3c1a'; g.fillRect(0, 0, s, 6); g.fillRect(0, s - 6, s, 6); g.fillRect(0, 0, 6, s); g.fillRect(s - 6, 0, 6, s);
  g.strokeStyle = '#5e3c1a'; g.lineWidth = 6; g.beginPath(); g.moveTo(4, 4); g.lineTo(s - 4, s - 4); g.stroke();
  g.fillStyle = '#2a2a2a'; [[3, 3], [s - 5, 3], [3, s - 5], [s - 5, s - 5]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
  noise(g, s, 14);
});
const texTile = makeTex(64, (g, s) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = (x + y) % 2 ? '#b0603c' : '#c97a4a'; g.fillRect(x * 16, y * 16, 16, 16);
    g.fillStyle = '#7a3e22'; g.fillRect(x * 16, y * 16, 16, 1); g.fillRect(x * 16, y * 16, 1, 16);
  }
  noise(g, s, 14);
});
const texDark = makeTex(64, (g, s) => {
  g.fillStyle = '#6a5640'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 16) for (let x = 0; x < s; x += 16) { const v = 90 + rnd() * 25 | 0; g.fillStyle = `rgb(${v + 10},${v - 5},${v - 25})`; g.fillRect(x + 1, y + 1, 14, 14); }
  noise(g, s, 18);
});
const texTrim = makeTex(64, (g, s) => {
  g.fillStyle = '#6b4626'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 4) { g.fillStyle = `rgb(${95 + rnd() * 20 | 0},${62 + rnd() * 12 | 0},${32})`; g.fillRect(0, y, s, 3); }
  noise(g, s, 12);
});

// =====================================================================
// map
// =====================================================================
const MATS = {
  wall: { tex: texWall, m: 2 }, house: { tex: texHouse, m: 4 }, crate: { tex: texCrate, m: 0 },
  tile: { tex: texTile, m: 2 }, dark: { tex: texDark, m: 2 }, trim: { tex: texTrim, m: 1.5 },
};
const materials = {};
for (const k in MATS) materials[k] = psx(new THREE.MeshLambertMaterial({ map: MATS[k].tex }));

function scaleBoxUV(geo, w, h, d, m) {
  if (!m) return;
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / m, uv.getY(i) * dims[f][1] / m);
  }
}

const mapMeshes = [];
for (const b of boxes) {
  const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
  const geo = new THREE.BoxGeometry(w, h, d);
  scaleBoxUV(geo, w, h, d, MATS[b.mat].m);
  const mesh = new THREE.Mesh(geo, materials[b.mat]);
  mesh.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  scene.add(mesh);
  mapMeshes.push(mesh);
}
{
  const gw = 200, gd = 220;
  const geo = new THREE.PlaneGeometry(gw, gd);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * gw / 4, uv.getY(i) * gd / 4);
  const ground = new THREE.Mesh(geo, psx(new THREE.MeshLambertMaterial({ map: texSand })));
  ground.rotation.x = -Math.PI / 2;
  ground.matrixAutoUpdate = false; ground.updateMatrix();
  scene.add(ground);
  mapMeshes.push(ground);
}

for (const k in SITES) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(180,30,20,0.85)'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 27, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(190,35,20,0.9)'; g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k, 32, 35);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(SITES[k].label[0], 0.03, SITES[k].label[1]);
  scene.add(m);
}

{
  const geo = new THREE.SphereGeometry(400, 16, 10);
  const cols = [];
  const top = new THREE.Color(0x4d86c9), mid = new THREE.Color(0xa9c3d8), hor = new THREE.Color(FOG_COLOR);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 400;
    const c = y > 0.25 ? mid.clone().lerp(top, Math.min(1, (y - 0.25) / 0.6)) : hor.clone().lerp(mid, Math.max(0, y / 0.25));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);
  const sunTex = makeTex(32, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.35, 'rgba(255,230,160,0.9)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
  sun.position.set(160, 220, 120); sun.scale.set(70, 70, 1);
  scene.add(sun);
}

scene.add(new THREE.HemisphereLight(0xcfe0ff, 0xa07e50, 1.5));
const sunLight = new THREE.DirectionalLight(0xfff0d0, 2.6);
sunLight.position.set(0.55, 1, 0.35);
scene.add(sunLight);
const flashLight = new THREE.PointLight(0xffc070, 0, 14, 2);
scene.add(flashLight);

{
  const trunkMat = psx(new THREE.MeshLambertMaterial({ color: 0x7a5a36 }));
  const leafMat = psx(new THREE.MeshLambertMaterial({ color: 0x4f7a2e, side: THREE.DoubleSide }));
  for (const [x, z] of PALMS) {
    const g = new THREE.Group();
    const hgt = 9 + rnd() * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, hgt, 5), trunkMat);
    trunk.position.y = hgt / 2; g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 4.5), leafMat);
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.sin(a) * 1.8, hgt - 0.4, Math.cos(a) * 1.8);
      leaf.rotation.set(0.45, a, 0, 'YXZ');
      g.add(leaf);
    }
    g.position.set(x, 0, z); g.rotation.z = (rnd() - 0.5) * 0.25;
    scene.add(g);
  }
  const clothCols = [0xb8402a, 0x2e7a7a, 0xd8a03a, 0x6a3a8a];
  const awn = [[-6, -30, 1], [-6, -18, 1], [6, -24, -1], [-28, -30, -1], [-28, -2, -1], [28, -36, 1], [-16, 26, -1], [16, 26, 1]];
  awn.forEach(([x, z, dir], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 3), psx(new THREE.MeshLambertMaterial({ color: clothCols[i % 4] })));
    m.position.set(x - dir * 0.8, 3.1, z);
    m.rotation.z = dir * 0.35;
    scene.add(m);
  });
}

// =====================================================================
// characters
// =====================================================================
const TEAM_COL = {
  red: { shirt: 0xc0452a, pants: 0x5a4632, hat: 0x2a2320, skin: 0xb07a50, accent: 0xe8b04a },
  blue: { shirt: 0x2d5aa8, pants: 0x2b3442, hat: 0x3c4a34, skin: 0xd0a07a, accent: 0x9ab0c8 },
};
const charMatCache = {};
const cmat = (col) => (charMatCache[col] ||= psx(new THREE.MeshLambertMaterial({ color: col })));

function makeChar(team, ownerId) {
  const c = TEAM_COL[team];
  const g = new THREE.Group();
  const part = (w, h, d, col, x, y, z, parent, tag = 'body') => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cmat(col));
    m.position.set(x, y, z); m.userData.part = tag; m.userData.owner = ownerId;
    parent.add(m); return m;
  };
  const body = new THREE.Group(); g.add(body);
  const legL = new THREE.Group(); legL.position.set(-0.13, 0.85, 0); body.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.13, 0.85, 0); body.add(legR);
  for (const leg of [legL, legR]) {
    part(0.2, 0.8, 0.22, c.pants, 0, -0.4, 0, leg);
    part(0.22, 0.12, 0.3, 0x2a2016, 0, -0.79, -0.03, leg);
  }
  const torso = new THREE.Group(); torso.position.y = 0.85; body.add(torso);
  part(0.5, 0.62, 0.3, c.shirt, 0, 0.32, 0, torso);
  part(0.52, 0.12, 0.32, c.accent, 0, 0.05, 0, torso);
  const vest = part(0.54, 0.38, 0.34, 0x3a3f36, 0, 0.42, 0, torso);
  const pack = part(0.34, 0.4, 0.16, 0x3a4a2a, 0, 0.35, 0.24, torso, 'gun');
  const head = new THREE.Group(); head.position.y = 0.8; torso.add(head);
  part(0.28, 0.3, 0.28, c.skin, 0, 0, 0, head, 'head');
  if (team === 'red') {
    part(0.3, 0.16, 0.3, c.hat, 0, 0.1, 0, head, 'head');
    part(0.3, 0.08, 0.3, c.hat, 0, -0.1, 0, head, 'head');
  } else {
    part(0.24, 0.05, 0.05, 0x111111, 0, 0.02, -0.15, head, 'head');
  }
  const helmet = part(0.34, 0.14, 0.34, team === 'red' ? 0x4a4030 : c.hat, 0, 0.17, 0, head, 'head');
  const aim = new THREE.Group(); aim.position.set(0, 0.52, 0); torso.add(aim);
  const armR = part(0.12, 0.12, 0.5, c.shirt, 0.22, -0.05, -0.2, aim);
  armR.rotation.y = 0.15;
  const armL = part(0.12, 0.12, 0.5, c.shirt, -0.12, -0.05, -0.32, aim);
  armL.rotation.y = -0.5;
  const gun = part(0.07, 0.1, 0.65, 0x1e1e1e, 0.12, -0.02, -0.55, aim, 'gun');
  const tip = new THREE.Object3D(); tip.position.set(0.12, -0.02, -0.9); aim.add(tip);

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.userData.part = 'gun';
  g.add(shadow);
  g.userData = { body, legL, legR, torso, aim, gun, tip, head, shadow, vest, pack, helmet };
  return g;
}
function setCharWeapon(model, w) {
  const W = WEAPONS[w] || WEAPONS[1];
  const ud = model.userData;
  const len = W.slot === 'nade' ? 0.12 : W.len;
  ud.gun.visible = len > 0;
  if (len > 0) {
    ud.gun.scale.z = len / 0.65;
    ud.gun.position.z = -0.25 - len / 2;
    ud.tip.position.z = -0.27 - len;
  }
}

function nameSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 24;
  const g = c.getContext('2d');
  g.font = '12px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#000'; g.fillText(text, 65, 13); g.fillStyle = color; g.fillText(text, 64, 12);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false, transparent: true }));
  s.scale.set(1.6, 0.3, 1); s.position.y = 2.2; s.renderOrder = 5;
  return s;
}

// =====================================================================
// viewmodels
// =====================================================================
vmScene.add(new THREE.HemisphereLight(0xffffff, 0x806040, 1.6));
const vmSun = new THREE.DirectionalLight(0xfff0d0, 2.2); vmSun.position.set(0.4, 1, 0.6); vmScene.add(vmSun);
const vmMatCache = {};
const vmMat = (col) => (vmMatCache[col] ||= psx(new THREE.MeshLambertMaterial({ color: col })));
const vm = new THREE.Group(); vmScene.add(vm);
const vmBox = (parent, w, h, d, col, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), vmMat(col));
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
};
const flashTex = makeTex(32, (g, s) => {
  g.translate(s / 2, s / 2);
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4);
    g.fillStyle = i % 2 ? 'rgba(255,240,170,1)' : 'rgba(255,170,60,0.9)';
    g.beginPath(); g.moveTo(0, -2); g.lineTo(i % 2 ? 15 : 10, 0); g.lineTo(0, 2); g.fill();
  }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill();
});
const SKIN = 0xc08a5c, GLOVE = 0x2a2420, METAL = 0x26282a, WOOD = 0x7a4a24, SLEEVE = 0x4a4a3a, BLACK = 0x18191a, OLIVE = 0x4d5a3a, SILVER = 0x9a9ea2;

function finishVM(g, base, tipZ, tipY, flashSize) {
  let flash = null;
  if (flashSize) {
    flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    flash.position.set(0, tipY, tipZ); flash.scale.set(flashSize, flashSize, 1); flash.visible = false;
    g.add(flash);
  }
  g.userData = { base: new THREE.Vector3(...base), flash };
  g.visible = false;
  vm.add(g);
  return g;
}
function pistolVM(col, len, gripCol, scale) {
  const g = new THREE.Group();
  vmBox(g, 0.036 * scale, 0.042 * scale, len, col, 0, 0, -len / 2 + 0.04);
  vmBox(g, 0.032 * scale, 0.095 * scale, 0.045, gripCol, 0, -0.06 * scale, 0.01, -0.22);
  vmBox(g, 0.05, 0.06, 0.07, GLOVE, 0.005, -0.065 * scale, 0.02);
  vmBox(g, 0.055, 0.055, 0.26, SLEEVE, 0.02, -0.1, 0.17, 0.3);
  return finishVM(g, [0.15, -0.15, -0.46], -len + 0.02, 0.005, 0.11 * scale);
}
const VM = [];
// knife
{
  const g = new THREE.Group();
  vmBox(g, 0.03, 0.035, 0.11, 0x1a1a1a, 0, 0, 0);
  vmBox(g, 0.05, 0.012, 0.02, METAL, 0, 0, -0.06);
  vmBox(g, 0.006, 0.035, 0.18, 0xc8ccd0, 0, 0.004, -0.15);
  vmBox(g, 0.055, 0.065, 0.08, GLOVE, 0.005, -0.01, 0.02);
  vmBox(g, 0.07, 0.07, 0.34, SLEEVE, 0.03, -0.04, 0.2, 0.15);
  VM[0] = finishVM(g, [0.16, -0.16, -0.26], 0, 0, 0);
}
VM[1] = pistolVM(METAL, 0.18, BLACK, 1);
VM[2] = pistolVM(SILVER, 0.24, 0x3a2a1a, 1.25);
// SMG
{
  const g = new THREE.Group();
  vmBox(g, 0.05, 0.07, 0.26, METAL, 0, 0, -0.08);
  vmBox(g, 0.02, 0.02, 0.1, METAL, 0, 0.01, -0.26);
  vmBox(g, 0.035, 0.17, 0.045, BLACK, 0, -0.11, -0.07);
  vmBox(g, 0.035, 0.08, 0.04, BLACK, 0, -0.07, 0.03, -0.3);
  vmBox(g, 0.012, 0.05, 0.18, METAL, 0, -0.01, 0.13);
  vmBox(g, 0.06, 0.06, 0.08, GLOVE, 0, -0.075, 0.04);
  vmBox(g, 0.06, 0.06, 0.08, GLOVE, -0.01, -0.06, -0.17);
  vmBox(g, 0.07, 0.07, 0.26, SLEEVE, 0.03, -0.11, 0.18, 0.35);
  VM[3] = finishVM(g, [0.15, -0.15, -0.38], -0.32, 0.01, 0.12);
}
// shotgun
{
  const g = new THREE.Group();
  vmBox(g, 0.03, 0.03, 0.55, METAL, 0, 0.012, -0.32);
  vmBox(g, 0.026, 0.026, 0.42, BLACK, 0, -0.022, -0.27);
  vmBox(g, 0.052, 0.048, 0.14, WOOD, 0, -0.022, -0.32);
  vmBox(g, 0.05, 0.07, 0.18, BLACK, 0, 0, -0.02);
  vmBox(g, 0.045, 0.08, 0.2, WOOD, 0, -0.03, 0.15);
  vmBox(g, 0.06, 0.06, 0.08, GLOVE, 0, -0.075, 0.05);
  vmBox(g, 0.065, 0.06, 0.09, GLOVE, -0.01, -0.05, -0.32);
  vmBox(g, 0.07, 0.07, 0.26, SLEEVE, 0.03, -0.11, 0.2, 0.35);
  VM[4] = finishVM(g, [0.17, -0.17, -0.48], -0.6, 0.012, 0.2);
}
// raider rifle (wood)
{
  const g = new THREE.Group();
  vmBox(g, 0.05, 0.075, 0.34, METAL, 0, 0, -0.12);
  vmBox(g, 0.022, 0.022, 0.26, METAL, 0, 0.012, -0.4);
  vmBox(g, 0.058, 0.055, 0.17, WOOD, 0, -0.008, -0.3);
  vmBox(g, 0.04, 0.13, 0.065, 0x3a3020, 0, -0.09, -0.15, 0.35);
  vmBox(g, 0.045, 0.07, 0.16, WOOD, 0, -0.022, 0.09);
  vmBox(g, 0.035, 0.085, 0.04, WOOD, 0, -0.07, 0.0, -0.3);
  vmBox(g, 0.012, 0.03, 0.012, METAL, 0, 0.05, -0.5);
  vmBox(g, 0.06, 0.06, 0.08, GLOVE, 0.0, -0.075, 0.01);
  vmBox(g, 0.065, 0.06, 0.09, GLOVE, -0.01, -0.045, -0.3);
  vmBox(g, 0.07, 0.07, 0.26, SLEEVE, 0.03, -0.11, 0.16, 0.35);
  VM[5] = finishVM(g, [0.17, -0.17, -0.5], -0.56, 0.012, 0.16);
}
// guardian rifle (black)
{
  const g = new THREE.Group();
  vmBox(g, 0.05, 0.08, 0.34, BLACK, 0, 0, -0.12);
  vmBox(g, 0.022, 0.022, 0.24, METAL, 0, 0.012, -0.42);
  vmBox(g, 0.062, 0.062, 0.2, 0x2a2c2e, 0, 0, -0.3);
  vmBox(g, 0.04, 0.12, 0.05, BLACK, 0, -0.09, -0.12);
  vmBox(g, 0.02, 0.03, 0.14, BLACK, 0, 0.055, -0.08);
  vmBox(g, 0.045, 0.075, 0.2, BLACK, 0, -0.015, 0.12);
  vmBox(g, 0.035, 0.085, 0.04, BLACK, 0, -0.07, 0.01, -0.3);
  vmBox(g, 0.06, 0.06, 0.08, GLOVE, 0.0, -0.075, 0.02);
  vmBox(g, 0.068, 0.06, 0.09, GLOVE, -0.01, -0.04, -0.3);
  vmBox(g, 0.07, 0.07, 0.26, SLEEVE, 0.03, -0.11, 0.18, 0.35);
  VM[6] = finishVM(g, [0.17, -0.17, -0.5], -0.56, 0.012, 0.15);
}
// longbow sniper
{
  const g = new THREE.Group();
  vmBox(g, 0.055, 0.075, 0.4, OLIVE, 0, 0, -0.1);
  vmBox(g, 0.022, 0.022, 0.5, METAL, 0, 0.012, -0.5);
  vmBox(g, 0.042, 0.045, 0.24, BLACK, 0, 0.07, -0.1);
  vmBox(g, 0.05, 0.052, 0.03, BLACK, 0, 0.07, -0.23);
  vmBox(g, 0.05, 0.052, 0.03, BLACK, 0, 0.07, 0.03);
  vmBox(g, 0.012, 0.012, 0.05, METAL, 0.04, 0.02, 0.02, 0, 0.8);
  vmBox(g, 0.05, 0.09, 0.24, OLIVE, 0, -0.025, 0.2);
  vmBox(g, 0.035, 0.085, 0.04, OLIVE, 0, -0.07, 0.06, -0.3);
  vmBox(g, 0.06, 0.06, 0.08, GLOVE, 0.0, -0.075, 0.07);
  vmBox(g, 0.065, 0.06, 0.09, GLOVE, -0.01, -0.045, -0.3);
  vmBox(g, 0.07, 0.07, 0.26, SLEEVE, 0.03, -0.11, 0.24, 0.35);
  VM[7] = finishVM(g, [0.17, -0.17, -0.52], -0.76, 0.012, 0.18);
}
function nadeVM(col, h, stripe) {
  const g = new THREE.Group();
  vmBox(g, 0.06, h, 0.06, col, 0, 0, 0);
  vmBox(g, 0.03, 0.025, 0.03, SILVER, 0, h / 2 + 0.012, 0);
  vmBox(g, 0.01, 0.06, 0.02, SILVER, 0.03, h / 2 - 0.02, 0);
  if (stripe) vmBox(g, 0.062, 0.012, 0.062, stripe, 0, 0, 0);
  vmBox(g, 0.07, 0.07, 0.08, GLOVE, 0.01, -0.045, 0.02);
  vmBox(g, 0.07, 0.07, 0.3, SLEEVE, 0.03, -0.08, 0.2, 0.25);
  return finishVM(g, [0.14, -0.14, -0.3], 0, 0, 0);
}
VM[8] = nadeVM(0x3f5a2a, 0.075, null);
VM[9] = nadeVM(0x9aa0a6, 0.09, 0x2a2a2a);
VM[10] = nadeVM(0x5a6a7a, 0.1, 0xd0c040);

// =====================================================================
// effects
// =====================================================================
const effects = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, fog: false });
function tracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, tracerMat.clone());
  scene.add(line);
  effects.push({ obj: line, life: 0.07, max: 0.07, kind: 'fade' });
}
const puffTex = makeTex(16, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
});
const smokeTex = makeTex(32, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
});
function puff(p, color, size = 0.35, life = 0.35, rise = 0) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color, transparent: true, depthWrite: false }));
  s.position.copy(p); s.scale.setScalar(size);
  scene.add(s);
  effects.push({ obj: s, life, max: life, kind: 'puff', size, rise });
}
const decals = [];
const decalGeo = new THREE.PlaneGeometry(0.12, 0.12);
const decalMat = new THREE.MeshBasicMaterial({ color: 0x1a120a, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
function decal(p, n) {
  const m = new THREE.Mesh(decalGeo, decalMat);
  m.position.copy(p).addScaledVector(n, 0.01);
  m.lookAt(p.clone().add(n));
  scene.add(m); decals.push(m);
  if (decals.length > 120) scene.remove(decals.shift());
}
const smokes = [];
function spawnSmoke(p, dur) {
  const group = new THREE.Group();
  const parts = [];
  for (let i = 0; i < 30; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: new THREE.Color().setHSL(0.1, 0.05, 0.62 + Math.random() * 0.12), transparent: true, depthWrite: false, opacity: 0 }));
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 3.3;
    s.userData.target = new THREE.Vector3(Math.cos(a) * r, 0.4 + Math.random() * 2.8, Math.sin(a) * r);
    s.userData.size = 2.6 + Math.random() * 1.8;
    s.position.set(0, 0.3, 0);
    group.add(s); parts.push(s);
  }
  group.position.set(p[0], p[1], p[2]);
  scene.add(group);
  smokes.push({ group, parts, t: 0, dur });
}
function updateSmokes(dt) {
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    s.t += dt;
    const grow = Math.min(1, s.t / 1.2);
    const fade = Math.min(1, (s.dur - s.t) / 2.5);
    for (const p of s.parts) {
      p.position.lerp(p.userData.target, Math.min(1, dt * 2.5));
      p.scale.setScalar(p.userData.size * (0.3 + 0.7 * grow));
      p.material.opacity = 0.92 * Math.max(0, Math.min(grow, fade));
      p.material.rotation += dt * 0.05;
    }
    if (s.t > s.dur) { scene.remove(s.group); s.parts.forEach((p) => p.material.dispose()); smokes.splice(i, 1); }
  }
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    const k = Math.max(0, e.life / e.max);
    if (e.kind === 'fade') e.obj.material.opacity = k * 0.9;
    if (e.kind === 'puff') { e.obj.material.opacity = k; e.obj.scale.setScalar(e.size * (1 + (1 - k) * 2)); e.obj.position.y += (e.rise || 0) * dt; }
    if (e.life <= 0) {
      scene.remove(e.obj);
      e.obj.geometry?.dispose?.();
      e.obj.material.dispose();
      effects.splice(i, 1);
    }
  }
}

// bomb model (dropped / planted)
const bombObj = new THREE.Group();
vmBox(bombObj, 0.4, 0.14, 0.28, 0x3a4a2a, 0, 0.07, 0);
vmBox(bombObj, 0.18, 0.06, 0.12, 0x111111, 0.05, 0.16, 0);
const bombLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2010 }));
bombLight.position.set(-0.12, 0.17, 0.05); bombObj.add(bombLight);
bombObj.visible = false;
scene.add(bombObj);

// grenades in flight
const NADE_COL = { he: 0x3f5a2a, fl: 0xc0c4c8, sm: 0x5a6a7a };
const nadeMeshes = new Map();
const nadeGeo = new THREE.BoxGeometry(0.12, 0.16, 0.12);

// =====================================================================
// audio (all synthesized)
// =====================================================================
let AC = null, master = null, noiseBuf = null;
function initAudio() {
  if (AC) { AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = settings.vol; master.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function spatial(pos) {
  if (!pos) return { gain: 1, pan: 0, dist: 0 };
  const dx = pos.x - camera.position.x, dz = pos.z - camera.position.z;
  const dist = Math.hypot(dx, dz);
  const yaw = camera.rotation.y;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const pan = dist > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) : 0;
  return { gain: 1 / (1 + dist * 0.07), pan: pan * 0.8, dist };
}
function outNode(pos, vol) {
  const sp = spatial(pos);
  const g = AC.createGain(); g.gain.value = vol * sp.gain;
  const p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  if (p) { p.pan.value = sp.pan; g.connect(p); p.connect(master); } else g.connect(master);
  return { g, sp };
}
function noiseHit(pos, { vol = 1, dur = 0.2, freq = 3000, q = 0.7, type = 'lowpass', sweep = 0 }) {
  if (!AC) return;
  const t = AC.currentTime;
  const { g, sp } = outNode(pos, vol);
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q;
  const fq = freq * (sp.dist > 25 ? 0.45 : 1);
  f.frequency.setValueAtTime(fq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, fq * sweep), t + dur);
  const env = AC.createGain();
  env.gain.setValueAtTime(1, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(env); env.connect(g);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function tone(pos, { vol = 0.3, freq = 440, to = 0, dur = 0.1, type = 'sine', delay = 0 }) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const { g } = outNode(pos, vol);
  const o = AC.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = AC.createGain();
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1, t + 0.005); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(env); env.connect(g);
  o.start(t); o.stop(t + dur + 0.05);
}
const SHOT_SND = {
  1: { vol: 0.75, dur: 0.15, freq: 3800, body: 220 }, 2: { vol: 1.0, dur: 0.25, freq: 2200, body: 120 },
  3: { vol: 0.7, dur: 0.12, freq: 4200, body: 240 }, 4: { vol: 1.2, dur: 0.35, freq: 1500, body: 80 },
  5: { vol: 1.0, dur: 0.22, freq: 2400, body: 140 }, 6: { vol: 0.9, dur: 0.2, freq: 3000, body: 170 },
  7: { vol: 1.4, dur: 0.5, freq: 1700, body: 70 },
};
const SFX = {
  shot(w, pos) {
    if (w === 0) { noiseHit(pos, { vol: 0.35, dur: 0.12, freq: 2500, type: 'bandpass', q: 1.5, sweep: 0.4 }); return; }
    const s = SHOT_SND[w] || SHOT_SND[5];
    noiseHit(pos, { vol: s.vol, dur: s.dur, freq: s.freq, sweep: 0.25 });
    tone(pos, { vol: s.vol * 0.7, freq: s.body, to: 40, dur: 0.12, type: 'triangle' });
  },
  step(pos, vol = 0.25) { noiseHit(pos, { vol, dur: 0.06, freq: 700 + Math.random() * 300, type: 'bandpass', q: 2 }); },
  hit(head) { tone(null, head ? { vol: 0.35, freq: 2400, dur: 0.18, type: 'triangle' } : { vol: 0.25, freq: 1300, dur: 0.05, type: 'square' }); },
  hurt() { noiseHit(null, { vol: 0.5, dur: 0.15, freq: 500 }); tone(null, { vol: 0.3, freq: 180, to: 90, dur: 0.15, type: 'sawtooth' }); },
  click() { tone(null, { vol: 0.25, freq: 1800, dur: 0.03, type: 'square' }); },
  buy() { tone(null, { vol: 0.25, freq: 1400, dur: 0.05, type: 'square' }); tone(null, { vol: 0.25, freq: 2100, dur: 0.06, type: 'square', delay: 0.06 }); },
  deny() { tone(null, { vol: 0.25, freq: 200, dur: 0.15, type: 'square' }); },
  reload() { tone(null, { vol: 0.2, freq: 900, dur: 0.04, type: 'square' }); tone(null, { vol: 0.2, freq: 600, dur: 0.05, type: 'square', delay: 0.5 }); tone(null, { vol: 0.25, freq: 1100, dur: 0.04, type: 'square', delay: 1.2 }); },
  beep(pos) { tone(pos, { vol: 0.5, freq: 1900, dur: 0.09, type: 'square' }); },
  boom(pos) { noiseHit(pos, { vol: 2.2, dur: 2.2, freq: 1800, sweep: 0.03 }); tone(pos, { vol: 1.4, freq: 70, to: 25, dur: 1.6 }); },
  he(pos) { noiseHit(pos, { vol: 1.8, dur: 0.9, freq: 2200, sweep: 0.05 }); tone(pos, { vol: 1.0, freq: 90, to: 30, dur: 0.6 }); },
  flash(pos) { noiseHit(pos, { vol: 1.4, dur: 0.25, freq: 5000, sweep: 0.3 }); },
  ring() { tone(null, { vol: 0.12, freq: 3500, dur: 2.5, type: 'sine' }); },
  smoke(pos) { noiseHit(pos, { vol: 0.6, dur: 2.0, freq: 5000, type: 'highpass', q: 0.5 }); },
  throwIt(pos) { noiseHit(pos, { vol: 0.3, dur: 0.15, freq: 1200, type: 'bandpass', q: 1 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(null, { vol: 0.25, freq: f, dur: 0.22, type: 'square', delay: i * 0.12 })); },
  lose() { [392, 330, 262].forEach((f, i) => tone(null, { vol: 0.25, freq: f, dur: 0.3, type: 'square', delay: i * 0.18 })); },
  kill() { tone(null, { vol: 0.3, freq: 880, dur: 0.08, type: 'square' }); tone(null, { vol: 0.3, freq: 1320, dur: 0.12, type: 'square', delay: 0.07 }); },
  plant() { [1200, 1200, 1600].forEach((f, i) => tone(null, { vol: 0.35, freq: f, dur: 0.1, type: 'square', delay: i * 0.15 })); },
};

// =====================================================================
// game state
// =====================================================================
let G = { ph: 'idle', tm: 0, sc: { red: 0, blue: 0 }, sw: false, rd: 0, c4: null, act: null, bt: 0, nd: [] };
let myId = null;
const sideOf = (team) => ((team === 'red') !== G.sw ? 'atk' : 'def');
const SPAWN_CENTER = { atk: [0, -46], def: [0, 46] };

const me = {
  pos: [0, 0, -46], vel: [0, 0, 0], onGround: true, h: STAND_H, yaw: Math.PI, pitch: 0, crouch: false, eye: 1.62,
  alive: false, team: null, hp: 100, w: 1, lastW: 0,
  inv: { pri: null, sec: 1, he: 0, fl: 0, sm: 0, ar: 0, hm: 0, kit: 0, m: 800 },
  ammo: WEAPONS.map((w) => w.mag), reserve: WEAPONS.map((w) => w.reserve),
  nextFire: 0, reloading: false, reloadEnd: 0, switchEnd: 0, zoom: 0, rezoomAt: 0, rezoomTo: 0,
  punch: 0, punchYaw: 0, shots: 0, lastShot: 0, stepT: 0, bob: 0, kick: 0, swing: 0, spawned: false, blind: 0, shake: 0,
};
const remotes = new Map();
let lastSnap = null;

const NADE_KEY = { 8: 'he', 9: 'fl', 10: 'sm' };
function owns(w) {
  const W = WEAPONS[w];
  if (!W) return false;
  if (w === 0) return true;
  if (W.slot === 'nade') return me.inv[W.nade] > 0;
  return me.inv.pri === w || me.inv.sec === w;
}
const bestGun = () => (me.inv.pri != null ? me.inv.pri : me.inv.sec);
function ownedList() {
  const l = [];
  if (me.inv.pri != null) l.push(me.inv.pri);
  l.push(me.inv.sec, 0);
  for (const id of [8, 9, 10]) if (owns(id)) l.push(id);
  return l;
}
function refillAll() { me.ammo = WEAPONS.map((w) => w.mag); me.reserve = WEAPONS.map((w) => w.reserve); }
function switchWeapon(w, force) {
  if (!owns(w)) return;
  if (!force && w === me.w) return;
  if (w !== me.w) me.lastW = me.w;
  me.w = w; me.reloading = false; me.zoom = 0; me.rezoomAt = 0;
  me.switchEnd = performance.now() / 1000 + (WEAPONS[w].slot === 'pri' ? 0.5 : 0.35);
  VM.forEach((m, i) => (m.visible = i === w));
}

// =====================================================================
// input
// =====================================================================
const keys = {};
let mouseDown = false, firedThisPress = false, locked = false, inGame = false, chatOpen = false, buyOpen = false;
let showBoard = false, specIdx = 0;

const chatIn = document.createElement('input');
chatIn.type = 'text'; chatIn.maxLength = 80; chatIn.className = 'hidden';
Object.assign(chatIn.style, { position: 'fixed', left: '12px', bottom: '50px', width: '320px', font: '10px "Press Start 2P", monospace', padding: '6px', background: 'rgba(0,0,0,.7)', color: '#fff', border: '2px solid #ffcf6e', zIndex: 30 });
document.body.appendChild(chatIn);
chatIn.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') { const t = chatIn.value.trim(); if (t) net({ t: 'chat', text: t }); closeChat(); }
  if (e.key === 'Escape') closeChat();
});
function openChat() { chatOpen = true; chatIn.classList.remove('hidden'); chatIn.value = ''; setTimeout(() => chatIn.focus(), 0); for (const k in keys) keys[k] = false; }
function closeChat() { chatOpen = false; chatIn.classList.add('hidden'); chatIn.blur(); canvas.requestPointerLock(); }

function cycleNade() {
  const list = [8, 9, 10].filter(owns);
  if (!list.length) return;
  const i = list.indexOf(me.w);
  switchWeapon(list[(i + 1) % list.length]);
}

addEventListener('keydown', (e) => {
  if (!inGame || chatOpen) return;
  if (e.code === 'Tab') { e.preventDefault(); showBoard = true; return; }
  if (buyOpen) {
    if (e.code === 'KeyB' || e.code === 'Escape') closeBuy();
    return;
  }
  if (!locked) return;
  if (e.code === 'Space') e.preventDefault();
  keys[e.code] = true;
  if (!me.alive) return;
  if (e.code === 'Digit1' && me.inv.pri != null) switchWeapon(me.inv.pri);
  if (e.code === 'Digit2') switchWeapon(me.inv.sec);
  if (e.code === 'Digit3') switchWeapon(0);
  if (e.code === 'Digit4') cycleNade();
  if (e.code === 'KeyQ') switchWeapon(owns(me.lastW) ? me.lastW : bestGun());
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyB') openBuy();
  if (e.code === 'KeyG') net({ t: 'dropbomb' });
  if (e.code === 'KeyT' || e.code === 'KeyY') { e.preventDefault(); openChat(); }
  if (e.code === 'KeyE' && !e.repeat) net({ t: 'use', on: true });
});
addEventListener('keyup', (e) => {
  if (e.code === 'Tab') { showBoard = false; return; }
  keys[e.code] = false;
  if (e.code === 'KeyE') net({ t: 'use', on: false });
});
addEventListener('contextmenu', (e) => { if (inGame) e.preventDefault(); });
addEventListener('mousedown', (e) => {
  if (!inGame || chatOpen || !locked) return;
  if (e.button === 0) { mouseDown = true; firedThisPress = false; if (!me.alive) specIdx++; }
  if (e.button === 2 && me.alive) {
    const W = WEAPONS[me.w];
    if (W.scope && !me.reloading) { me.zoom = (me.zoom + 1) % 3; SFX.click(); }
    else if (W.slot === 'nade') throwNade(false);
  }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
addEventListener('wheel', (e) => {
  if (!locked || !me.alive) return;
  const l = ownedList();
  const i = l.indexOf(me.w);
  switchWeapon(l[(i + (e.deltaY > 0 ? 1 : l.length - 1)) % l.length]);
});
const vmSway = { x: 0, y: 0 };
addEventListener('mousemove', (e) => {
  if (!locked) return;
  const s = 0.0022 * settings.sens * (camera.fov / BASE_FOV);
  me.yaw -= e.movementX * s;
  me.pitch = Math.max(-1.55, Math.min(1.55, me.pitch - e.movementY * s));
  vmSway.x += e.movementX * 0.00004; vmSway.y += e.movementY * 0.00004;
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked) { mouseDown = false; for (const k in keys) keys[k] = false; net({ t: 'use', on: false }); }
  $('pause').classList.toggle('hidden', locked || !inGame || chatOpen || buyOpen);
});
$('pause').addEventListener('click', () => canvas.requestPointerLock());
canvas.addEventListener('click', () => { if (inGame && !locked && !chatOpen && !buyOpen) canvas.requestPointerLock(); });

// =====================================================================
// buy menu
// =====================================================================
const BUY_CATS = [
  { name: 'PISTOLS', items: [1, 2] },
  { name: 'SMG / HEAVY', items: [3, 4] },
  { name: 'RIFLES', items: [5, 6, 7] },
  { name: 'GEAR', items: ['vest', 'vesthelm', 'kit'] },
  { name: 'GRENADES', items: [8, 9, 10] },
];
function itemInfo(item) {
  if (typeof item === 'number') { const W = WEAPONS[item]; return { name: W.name, price: W.price, side: W.side, desc: W.desc }; }
  const g = GEAR[item];
  const price = item === 'vesthelm' && me.inv.ar >= 100 ? 350 : g.price;
  return { name: g.name, price, side: g.side, desc: g.desc };
}
function itemState(item) {
  const info = itemInfo(item);
  const side = me.team ? sideOf(me.team) : null;
  if (info.side && info.side !== side) return 'side';
  if (typeof item === 'number') {
    const W = WEAPONS[item];
    if ((W.slot === 'pri' && me.inv.pri === item) || (W.slot === 'sec' && me.inv.sec === item)) return 'owned';
    if (W.slot === 'nade' && me.inv[W.nade] >= W.max) return 'owned';
  } else if (item === 'vest' && me.inv.ar >= 100) return 'owned';
  else if (item === 'vesthelm' && me.inv.ar >= 100 && me.inv.hm) return 'owned';
  else if (item === 'kit' && me.inv.kit) return 'owned';
  if (me.inv.m < info.price) return 'poor';
  return 'ok';
}
function renderBuy() {
  const grid = $('bmGrid');
  grid.innerHTML = '';
  for (const cat of BUY_CATS) {
    const col = document.createElement('div');
    col.className = 'bm-col';
    col.innerHTML = `<div class="bm-cat">${cat.name}</div>`;
    for (const item of cat.items) {
      const info = itemInfo(item);
      const st = itemState(item);
      const b = document.createElement('button');
      b.className = 'bm-item ' + st;
      b.innerHTML = `<span class="bm-name">${info.name}</span><span class="bm-price">$${info.price}</span><span class="bm-desc">${st === 'side' ? (info.side === 'atk' ? 'ATTACKERS ONLY' : 'DEFENDERS ONLY') : st === 'owned' ? 'OWNED' : info.desc || ''}</span>`;
      b.addEventListener('click', () => { net({ t: 'buy', item }); });
      col.appendChild(b);
    }
    grid.appendChild(col);
  }
}
function canBuyHere() {
  if (!me.alive || !me.team || G.bt <= 0) return false;
  const c = SPAWN_CENTER[sideOf(me.team)];
  return Math.hypot(me.pos[0] - c[0], me.pos[2] - c[1]) < BUY_RADIUS;
}
function openBuy() {
  if (!canBuyHere()) { flashHint('CAN\'T BUY HERE / BUY TIME OVER'); SFX.deny(); return; }
  buyOpen = true;
  for (const k in keys) keys[k] = false;
  mouseDown = false;
  renderBuy();
  $('buymenu').classList.remove('hidden');
  document.exitPointerLock();
}
function closeBuy() {
  buyOpen = false;
  $('buymenu').classList.add('hidden');
  canvas.requestPointerLock();
}
let hintMsg = '', hintT = 0;
function flashHint(t) { hintMsg = t; hintT = 2; }

// =====================================================================
// networking
// =====================================================================
let conn = null, localGame = null, peer = null, roomCode = null;
function net(m) { if (conn) conn.send(JSON.stringify(m)); }
function handleRaw(s) { let m; try { m = JSON.parse(s); } catch { return; } onMsg(m); }
function onDisconnect(why) {
  if (inGame) centerMsg('DISCONNECTED', why || 'refresh the page to rejoin', 999);
  $('status').textContent = why || 'Disconnected.';
}

// 1) dedicated Node server (WebSocket)
function connectServer() {
  return new Promise((res, rej) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const sock = new WebSocket(`${proto}://${location.host}`);
    let open = false;
    sock.onopen = () => { open = true; res({ send: (s) => { if (sock.readyState === 1) sock.send(s); } }); };
    sock.onerror = () => { if (!open) rej(new Error('Cannot reach the server.')); };
    sock.onclose = () => { if (open) onDisconnect(); };
    sock.onmessage = (ev) => handleRaw(ev.data);
  });
}

// 2) game runs inside this browser tab (bots / host)
function connectLocal() {
  localGame = createGame();
  const h = localGame.attach({ send: (s) => queueMicrotask(() => handleRaw(s)) });
  return { send: (s) => queueMicrotask(() => h.message(s)) };
}

// 3) peer-to-peer (WebRTC via PeerJS) for host / join
const PEER_PREFIX = 'lownoon-ps2-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
function getPeerLib() {
  if (window.__PEER) return Promise.resolve(window.__PEER);
  if (window.peerjs) return Promise.resolve(window.peerjs.Peer);
  return new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'peerjs/peerjs.min.js';
    sc.onload = () => res(window.peerjs.Peer);
    sc.onerror = () => rej(new Error('Could not load the online library.'));
    document.head.appendChild(sc);
  });
}
// optional custom broker: LOW-NOON.html?peerhost=192.168.1.5&peerport=9000
const PEER_OPTS = (() => {
  const q = new URLSearchParams(location.search);
  const host = q.get('peerhost');
  if (!host) return { debug: 0 };
  return { debug: 0, host, port: Number(q.get('peerport')) || 9000, path: q.get('peerpath') || '/', secure: q.get('peersecure') === '1' };
})();
const dataToString = (d) => (typeof d === 'string' ? d : d instanceof ArrayBuffer ? new TextDecoder().decode(d) : String(d));

async function startHost() {
  const Peer = await getPeerLib();
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('Online service did not answer. Check the internet, or play with bots.')), 15000);
    const tryOpen = (attempt) => {
      const code = randomCode();
      const p = new Peer(PEER_PREFIX + code, PEER_OPTS);
      let opened = false;
      p.on('open', () => {
        opened = true; clearTimeout(timer);
        peer = p; roomCode = code;
        res(connectLocal());
      });
      p.on('error', (err) => {
        if (err.type === 'unavailable-id' && attempt < 5) { p.destroy(); tryOpen(attempt + 1); return; }
        if (!opened) { clearTimeout(timer); rej(new Error('Hosting failed (' + err.type + '). Check the internet, or play with bots.')); }
        else chatLine('Network: ' + err.type);
      });
      p.on('connection', (dc) => {
        dc.on('open', () => {
          if (!localGame) { dc.close(); return; }
          const h = localGame.attach({ send: (s) => { if (dc.open) dc.send(s); } });
          dc.on('data', (d) => h.message(dataToString(d)));
          dc.on('close', () => h.close());
          dc.on('error', () => h.close());
        });
      });
      p.on('disconnected', () => { try { p.reconnect(); } catch { /* ignore */ } });
    };
    tryOpen(0);
  });
}

async function startJoin(code) {
  const Peer = await getPeerLib();
  return new Promise((res, rej) => {
    const p = new Peer(PEER_OPTS);
    const timer = setTimeout(() => { p.destroy(); rej(new Error('Could not reach the host. Same code? Is the host still in the game?')); }, 15000);
    p.on('error', (err) => {
      clearTimeout(timer);
      rej(new Error(err.type === 'peer-unavailable' ? `No game found with code ${code}.` : 'Online error (' + err.type + ').'));
    });
    p.on('open', () => {
      const dc = p.connect(PEER_PREFIX + code, { serialization: 'raw', reliable: true });
      dc.on('open', () => { clearTimeout(timer); peer = p; res({ send: (s) => { if (dc.open) dc.send(s); } }); });
      dc.on('data', (d) => handleRaw(dataToString(d)));
      dc.on('close', () => onDisconnect('The host left the game.'));
    });
  });
}

function onMsg(m) {
  switch (m.t) {
    case 'welcome': myId = m.id; me.team = m.team; me.spawned = true; break;
    case 'snap': onSnap(m); break;
    case 'spawn':
      me.pos = m.p.slice(); me.vel = [0, 0, 0]; me.yaw = m.yaw; me.pitch = 0; me.alive = true; me.hp = MAX_HP;
      me.crouch = false; me.h = STAND_H; me.spawned = true; me.blind = 0;
      me.reloading = false; me.punch = 0; me.punchYaw = 0; me.shots = 0;
      refillAll();
      switchWeapon(bestGun(), true);
      break;
    case 'round': {
      const side = me.team ? sideOf(me.team) : null;
      const sub = side === 'atk' ? 'YOU ATTACK — press B to buy, plant the bomb at A or B' : side === 'def' ? 'YOU DEFEND — press B to buy, protect A and B' : '';
      centerMsg(m.half ? 'HALFTIME — SIDES SWITCHED' : `ROUND ${m.rd}`, sub, 4);
      smokes.forEach((s) => { s.t = s.dur; });
      break;
    }
    case 'go': centerMsg('GO GO GO', '', 1.2); if (buyOpen && !canBuyHere()) closeBuy(); break;
    case 'fire': onRemoteFire(m); break;
    case 'hurt': hurtFlash = 1; SFX.hurt(); me.punch += 0.03; break;
    case 'kill': onKill(m); break;
    case 'cash': cashPop(`+$${m.v}`); break;
    case 'bought': SFX.buy(); setTimeout(() => { if (buyOpen) renderBuy(); }, 80); break;
    case 'buyfail': SFX.deny(); flashHint(m.why.toUpperCase()); break;
    case 'roundend': {
      const won = me.team === m.team;
      const reason = { elim: 'enemies eliminated', time: 'time ran out', bomb: 'the bomb exploded', defuse: 'bomb defused' }[m.reason] || '';
      centerMsg(m.side === 'atk' ? 'ATTACKERS WIN' : 'DEFENDERS WIN', `${reason} · ${won ? '+$' + m.win : '+$' + m.loss + ' loss bonus'}`, 4.5, m.team);
      (won ? SFX.win : SFX.lose)();
      break;
    }
    case 'matchend': setTimeout(() => centerMsg(`${m.team.toUpperCase()} TEAM WINS THE MATCH!`, 'new match starting...', 8, m.team), 1500); break;
    case 'sound':
      if (m.s === 'plant') { SFX.plant(); centerMsg(`BOMB PLANTED AT ${m.site}`, '', 2.5); }
      if (m.s === 'defuse') SFX.plant();
      if (m.s === 'boom') {
        const p = new THREE.Vector3(m.p[0], m.p[1] + 1, m.p[2]);
        SFX.boom(p);
        for (let i = 0; i < 16; i++) puff(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6)), i % 2 ? 0xffa040 : 0x553322, 4 + Math.random() * 4, 1.5, 2);
        screenFlash = 1; me.shake = 1;
      }
      break;
    case 'bomb':
      if (me.team && sideOf(me.team) === 'atk') {
        const n = playerName(m.by).n;
        chatLine(m.ev === 'pick' ? `${n} picked up the bomb` : `${n} dropped the bomb`, me.team);
      }
      break;
    case 'nade': onNade(m); break;
    case 'throw': { const r = remotes.get(m.i); if (r) SFX.throwIt(r.model.position); break; }
    case 'chat': chatLine(m.text, m.team); break;
  }
}

function onNade(m) {
  const p = new THREE.Vector3(m.p[0], m.p[1], m.p[2]);
  if (m.k === 'he') {
    SFX.he(p);
    for (let i = 0; i < 10; i++) puff(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 2, (Math.random() - 0.5) * 2.5)), i % 3 ? 0x4a3a2a : 0xffa040, 1.5 + Math.random() * 1.5, 0.9, 1);
    flashLight.position.copy(p); flashLight.intensity = 30; flashT = 0.12;
    const d = p.distanceTo(camera.position);
    if (d < 14) me.shake = Math.max(me.shake, 1 - d / 14);
  } else if (m.k === 'fl') {
    SFX.flash(p);
    puff(p, 0xffffff, 3, 0.25);
    flashLight.position.copy(p); flashLight.intensity = 40; flashT = 0.1;
    if (me.alive) {
      const eye = [camera.position.x, camera.position.y, camera.position.z];
      const d = p.distanceTo(camera.position);
      if (d < 30 && losClear(eye, [p.x, p.y + 0.05, p.z], boxes)) {
        const fwd = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
        const dot = fwd.dot(p.clone().sub(camera.position).normalize());
        const k = (dot > 0.5 ? 1 : dot > 0 ? 0.6 : 0.2) * (1 - d / 32);
        const t = 4.5 * k;
        if (t > 0.3) { me.blind = Math.max(me.blind, t); if (t > 1.5) SFX.ring(); }
      }
    }
  } else if (m.k === 'sm') {
    SFX.smoke(p);
    spawnSmoke(m.p, m.dur || 16);
  }
}

function onSnap(m) {
  lastSnap = m; G = m.g;
  const seen = new Set();
  for (const p of m.ps) {
    seen.add(p.i);
    if (p.i === myId) {
      if (me.alive && !p.a) onDeath();
      me.alive = !!p.a; me.hp = p.hp; me.team = p.tm;
      const old = me.inv;
      me.inv = { pri: p.pri, sec: p.sec, he: p.he, fl: p.fl, sm: p.sm, ar: p.ar, hm: p.hm, kit: p.kit, m: p.m };
      if (p.pri != null && p.pri !== old.pri) { me.ammo[p.pri] = WEAPONS[p.pri].mag; me.reserve[p.pri] = WEAPONS[p.pri].reserve; if (me.alive) switchWeapon(p.pri); }
      if (p.sec !== old.sec) { me.ammo[p.sec] = WEAPONS[p.sec].mag; me.reserve[p.sec] = WEAPONS[p.sec].reserve; if (me.alive && p.pri == null) switchWeapon(p.sec); }
      if (me.alive && !owns(me.w)) switchWeapon(owns(me.lastW) ? me.lastW : bestGun(), true);
      if (buyOpen && old.m !== p.m) renderBuy();
      continue;
    }
    let r = remotes.get(p.i);
    if (!r || r.data.tm !== p.tm) {
      if (r) scene.remove(r.model);
      const model = makeChar(p.tm, p.i);
      scene.add(model);
      r = { model, data: p, cur: { x: p.x, y: p.y, z: p.z, yw: p.yw, pt: p.pt }, speed: 0, stepT: 0, deadT: 0, tag: null, lastFire: -9, lastPos: [p.x, p.z], w: -1 };
      remotes.set(p.i, r);
    }
    if (r.data.a && !p.a) r.deadT = 0.0001;
    if (!r.data.a && p.a) { r.deadT = 0; r.cur = { x: p.x, y: p.y, z: p.z, yw: p.yw, pt: p.pt }; }
    if (r.w !== p.w) { r.w = p.w; setCharWeapon(r.model, p.w); }
    r.model.userData.vest.visible = p.ar > 0;
    r.model.userData.helmet.visible = !!p.hm || p.tm === 'blue';
    r.model.userData.pack.visible = !!(G.c4 && G.c4.st === 'carried' && G.c4.c === p.i);
    r.data = p;
  }
  for (const [id, r] of remotes) if (!seen.has(id)) { scene.remove(r.model); remotes.delete(id); }
  for (const [, r] of remotes) {
    const mate = me.team && r.data.tm === me.team;
    if (mate && !r.tag) { r.tag = nameSprite(r.data.n, r.data.tm === 'red' ? '#ffb08a' : '#a8c8ff'); r.model.add(r.tag); }
    if (!mate && r.tag) { r.model.remove(r.tag); r.tag = null; }
  }
  // grenades in flight
  const live = new Set();
  for (const [id, k, x, y, z] of G.nd || []) {
    live.add(id);
    let n = nadeMeshes.get(id);
    if (!n) {
      const mesh = new THREE.Mesh(nadeGeo, cmat(NADE_COL[k]));
      mesh.position.set(x, y, z);
      scene.add(mesh);
      n = { mesh, tgt: new THREE.Vector3(x, y, z) };
      nadeMeshes.set(id, n);
    }
    n.tgt.set(x, y, z);
  }
  for (const [id, n] of nadeMeshes) if (!live.has(id)) { scene.remove(n.mesh); nadeMeshes.delete(id); }
  if (buyOpen && G.bt <= 0) closeBuy();
}

function playerName(id) {
  if (id === myId) return { n: settings.name || 'You', tm: me.team };
  const r = remotes.get(id);
  return r ? { n: r.data.n, tm: r.data.tm } : { n: '?', tm: 'red' };
}
function onKill(m) {
  const v = playerName(m.victim);
  const k = m.killer ? playerName(m.killer) : null;
  const wn = m.w === -1 ? 'BOMB' : WEAPONS[m.w]?.name || '';
  const div = document.createElement('div');
  if (m.killer === myId || m.victim === myId) div.className = 'me';
  div.innerHTML = (k ? `<span class="t${k.tm}">${esc(k.n)}</span> ` : '') + `[${wn}${m.head ? ' ◎' : ''}] <span class="t${v.tm}">${esc(v.n)}</span>`;
  $('killfeed').prepend(div);
  setTimeout(() => div.remove(), 6000);
  while ($('killfeed').children.length > 5) $('killfeed').lastChild.remove();
  if (m.killer === myId && m.victim !== myId) SFX.kill();
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function chatLine(text, team) {
  const d = document.createElement('div');
  d.innerHTML = team ? `<span class="t${team}">${esc(text)}</span>` : esc(text);
  $('chat').append(d);
  setTimeout(() => d.remove(), 8000);
  while ($('chat').children.length > 6) $('chat').firstChild.remove();
}
function cashPop(text) {
  const d = document.createElement('div');
  d.className = 'cashpop shadow'; d.textContent = text;
  $('hud').appendChild(d);
  setTimeout(() => d.remove(), 1500);
}

function onDeath() {
  me.alive = false; mouseDown = false; specIdx = 0; me.zoom = 0;
  if (buyOpen) closeBuy();
  net({ t: 'use', on: false });
}

const _v = new THREE.Vector3();
function onRemoteFire(m) {
  const r = remotes.get(m.i);
  if (!r) return;
  r.lastFire = performance.now() / 1000;
  r.model.userData.tip.getWorldPosition(_v);
  const from = _v.clone();
  SFX.shot(m.w, from);
  if (m.w === 0) return;
  flashLight.position.copy(from); flashLight.intensity = 6; flashT = 0.05;
  puff(from, 0xffd080, 0.35, 0.06);
  if (m.e) {
    const end = new THREE.Vector3(m.e[0], m.e[1], m.e[2]);
    tracer(from, end);
    if (m.hit) puff(end, 0xa01010, 0.4, 0.3);
    else puff(end, 0xc8a878, 0.3, 0.4);
  }
}

// =====================================================================
// weapons (local)
// =====================================================================
const raycaster = new THREE.Raycaster();
function aliveEnemyModels() {
  const list = [];
  for (const [, r] of remotes) if (r.data.a && r.data.tm !== me.team) list.push(r.model);
  return list;
}
function castShot(dir, range) {
  raycaster.set(camera.position, dir);
  raycaster.far = range;
  const hits = raycaster.intersectObjects([...mapMeshes, ...aliveEnemyModels()], true);
  for (const h of hits) {
    if (h.object.userData.part === 'gun') continue;
    if (h.object.type === 'Sprite') continue;
    return h;
  }
  return null;
}
function startReload() {
  const W = WEAPONS[me.w];
  if (!me.alive || !W.mag || me.reloading || me.ammo[me.w] >= W.mag || me.reserve[me.w] <= 0) return;
  me.reloading = true; me.reloadEnd = performance.now() / 1000 + W.reload; me.zoom = 0;
  SFX.reload();
}
const hspeed = () => Math.hypot(me.vel[0], me.vel[2]);
function currentSpread(W) {
  let s = W.scope && !me.zoom ? W.unscoped : W.spread;
  s += Math.min(1, hspeed() / 5.6) * W.moveSpread + (me.onGround ? 0 : W.airSpread) + Math.min(me.shots, 10) * W.bloom;
  if (me.crouch) s *= 0.6;
  return s;
}

function throwNade(strong) {
  const W = WEAPONS[me.w];
  const now = performance.now() / 1000;
  if (W.slot !== 'nade' || now < me.nextFire || now < me.switchEnd || !owns(me.w)) return;
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  const sp = strong ? 17 : 8;
  const v = [dir.x * sp + me.vel[0] * 0.5, dir.y * sp + (strong ? 2.5 : 3.5), dir.z * sp + me.vel[2] * 0.5];
  net({ t: 'throw', w: me.w, v });
  SFX.throwIt(null);
  me.swing = 1; me.nextFire = now + 0.8;
  me.inv[W.nade]--;
  setTimeout(() => { if (!owns(me.w)) switchWeapon(owns(me.lastW) && WEAPONS[me.lastW].slot !== 'nade' ? me.lastW : bestGun(), true); }, 300);
}

function fire(now) {
  const W = WEAPONS[me.w];
  me.nextFire = now + W.rate;
  if (W.slot === 'nade') { throwNade(true); return; }
  if (W.id === 0) {
    me.swing = 1;
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const h = castShot(dir, W.range);
    SFX.shot(0, null);
    const hits = [];
    if (h && h.object.userData.owner) { const hit = { id: h.object.userData.owner, head: h.object.userData.part === 'head' }; hits.push(hit); puff(h.point, 0xa01010, 0.4); SFX.hit(hit.head); showHitmark(hit.head); }
    else if (h) puff(h.point, 0xc8a878, 0.2);
    net({ t: 'fire', w: 0, e: null, hits });
    return;
  }
  me.ammo[me.w]--;
  let spread = currentSpread(W);
  if (me.shots === 0 && hspeed() < 1.5 && me.onGround && !W.pellets) spread = Math.min(spread, (W.scope && !me.zoom ? W.unscoped : W.spread) * 0.5);
  const fwd = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
  const up = new THREE.Vector3(0, 1, 0).applyEuler(camera.rotation);
  const muzzle = camera.position.clone().addScaledVector(right, 0.18).addScaledVector(up, -0.15).addScaledVector(fwd, 0.5);
  const pellets = W.pellets || 1;
  const hits = [];
  let lastEnd = null;
  for (let i = 0; i < pellets; i++) {
    const sp = W.pellets ? W.pelletSpread + spread : spread;
    const r = sp * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
    const dir = fwd.clone().addScaledVector(right, Math.cos(th) * r).addScaledVector(up, Math.sin(th) * r).normalize();
    const h = castShot(dir, W.range * (W.pellets ? 2 : 1));
    const end = h ? h.point.clone() : camera.position.clone().addScaledVector(dir, 120);
    lastEnd = end;
    if (h && h.object.userData.owner) {
      const hit = { id: h.object.userData.owner, head: h.object.userData.part === 'head' };
      hits.push(hit);
      puff(end, 0xa01010, hit.head ? 0.6 : 0.4, 0.3);
    } else if (h) {
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      decal(h.point, n);
      if (i < 4) puff(h.point.clone().addScaledVector(n, 0.05), 0xc8a878, 0.3, 0.4);
    }
    if (Math.random() < (W.pellets ? 0.3 : 0.6) || W.scope) tracer(muzzle, end);
  }
  if (hits.length) { const head = hits.some((h) => h.head); SFX.hit(head); showHitmark(head); }
  net({ t: 'fire', w: W.id, e: [lastEnd.x, lastEnd.y, lastEnd.z], hits });
  SFX.shot(W.id, null);
  const fl = VM[me.w].userData.flash;
  if (fl) { fl.visible = true; fl.material.rotation = Math.random() * 6; flashVisT = 0.04; }
  flashLight.position.copy(camera.position); flashLight.intensity = 5; flashT = 0.05;
  me.punch = Math.min(0.22, me.punch + W.recoil * (0.9 + Math.random() * 0.3));
  me.punchYaw += (Math.random() - 0.5) * W.recoil * (me.shots > 6 ? 1.6 : 0.5);
  me.shots++; me.lastShot = now; me.kick = 1;
  if (W.scope && me.zoom) { me.rezoomTo = me.zoom; me.zoom = 0; me.rezoomAt = now + W.rate * 0.95; }
}

let hitmarkT = 0;
function showHitmark(head) { hitmarkT = 0.15; $('hitmark').className = head ? 'head' : ''; }
let hurtFlash = 0, screenFlash = 0, flashT = 0, flashVisT = 0;

// =====================================================================
// per-frame update
// =====================================================================
let sendT = 0, beepT = 0;
function updateLocal(dt, now) {
  const W = WEAPONS[me.w];
  const acting = G.act && G.act.i === myId;
  const canMove = me.alive && G.ph !== 'freeze' && !chatOpen && !acting && !buyOpen;
  let fw = 0, st = 0;
  if (canMove && locked) {
    if (keys.KeyW) fw += 1; if (keys.KeyS) fw -= 1;
    if (keys.KeyD) st += 1; if (keys.KeyA) st -= 1;
  }
  const wantCrouch = !!keys.KeyC && me.alive;
  if (wantCrouch) me.crouch = true;
  else if (me.crouch && canStand(me.pos, boxes)) me.crouch = false;
  me.h = me.crouch ? CROUCH_H : STAND_H;
  const walking = !!(keys.ShiftLeft || keys.ShiftRight);
  const speed = (me.crouch ? 2.3 : walking ? 2.8 : 5.6) * W.speed * (me.zoom ? 0.6 : 1);
  const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  let wx = -sy * fw + cy * st, wz = -cy * fw - sy * st;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx = (wx / wl) * speed; wz = (wz / wl) * speed; }
  const k = Math.min(1, (me.onGround ? 12 : 1.5) * dt);
  me.vel[0] += (wx - me.vel[0]) * k;
  me.vel[2] += (wz - me.vel[2]) * k;
  if (canMove && locked && keys.Space && me.onGround) { me.vel[1] = 6.6; me.onGround = false; }
  if (me.alive) moveBody(me, dt, boxes);
  me.eye += ((me.crouch ? 1.12 : 1.62) - me.eye) * Math.min(1, dt * 12);

  const hs = hspeed();
  if (me.alive && me.onGround && hs > 3.5 && !walking && !me.crouch) {
    me.stepT += dt * hs;
    if (me.stepT > 2.3) { me.stepT = 0; SFX.step(null, 0.12); }
  }
  me.bob += dt * hs * 1.6;

  if (me.reloading && now >= me.reloadEnd) {
    const take = Math.min(W.mag - me.ammo[me.w], me.reserve[me.w]);
    me.ammo[me.w] += take; me.reserve[me.w] -= take; me.reloading = false;
  }
  if (me.rezoomAt && now >= me.rezoomAt) { if (WEAPONS[me.w].scope && !me.reloading) me.zoom = me.rezoomTo; me.rezoomAt = 0; }

  if (me.alive && locked && mouseDown && G.ph !== 'freeze' && !acting && now >= me.nextFire && now >= me.switchEnd && !me.reloading) {
    if (W.slot === 'nade') { if (!firedThisPress) { throwNade(true); firedThisPress = true; } }
    else if (me.w === 0 || me.ammo[me.w] > 0) {
      if (W.auto || !firedThisPress) { fire(now); firedThisPress = true; }
    } else if (!firedThisPress) {
      SFX.click(); firedThisPress = true; me.nextFire = now + 0.25;
      startReload();
    }
  }
  if (W.mag && me.ammo[me.w] === 0 && !me.reloading && me.reserve[me.w] > 0 && now - me.lastShot > 0.3) startReload();

  if (now - me.lastShot > W.rate * 1.6) {
    const rec = Math.min(1, dt * 7);
    me.punch -= me.punch * rec; me.punchYaw -= me.punchYaw * rec;
    if (now - me.lastShot > 0.35) me.shots = 0;
  }
  me.blind = Math.max(0, me.blind - dt);
  me.shake = Math.max(0, me.shake - dt * 2);

  sendT -= dt;
  if (sendT <= 0 && me.alive) {
    sendT = 0.05;
    net({ t: 'st', p: me.pos.map((v) => Math.round(v * 100) / 100), yaw: +me.yaw.toFixed(3), pitch: +(me.pitch + me.punch).toFixed(3),
      cr: me.crouch, mv: hs > 3.5 && !walking && !me.crouch && me.onGround, w: me.w, zm: me.zoom ? 1 : 0, g: me.onGround ? 1 : 0 });
  }
}

function updateRemotes(dt, now) {
  const k = 1 - Math.exp(-dt * 14);
  for (const [, r] of remotes) {
    const d = r.data, c = r.cur, ud = r.model.userData;
    c.x += (d.x - c.x) * k; c.y += (d.y - c.y) * k; c.z += (d.z - c.z) * k;
    let dy = d.yw - c.yw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    c.yw += dy * k; c.pt += (d.pt - c.pt) * k;
    r.model.position.set(c.x, c.y, c.z);
    r.model.rotation.y = c.yw;
    const moved = Math.hypot(c.x - r.lastPos[0], c.z - r.lastPos[1]);
    r.lastPos = [c.x, c.z];
    r.speed += ((dt > 0 ? moved / dt : 0) - r.speed) * Math.min(1, dt * 10);
    ud.aim.rotation.x = c.pt;
    if (d.a) {
      r.model.visible = true;
      ud.body.rotation.x = 0; ud.body.position.y = 0;
      const sw = Math.sin(now * 11) * Math.min(1, r.speed / 5) * 0.7;
      ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
      ud.body.scale.y = d.cr ? 0.72 : 1;
      if (d.mv && r.speed > 2.5) {
        r.stepT += dt * r.speed;
        if (r.stepT > 2.4) { r.stepT = 0; SFX.step(r.model.position, 0.55); }
      }
      if (r.tag) r.tag.visible = true;
    } else if (r.deadT > 0) {
      r.deadT += dt;
      const t = Math.min(1, r.deadT / 0.35);
      ud.body.rotation.x = -t * Math.PI / 2;
      ud.body.position.y = 0.15 * t;
      ud.legL.rotation.x = ud.legR.rotation.x = 0;
      ud.body.scale.y = 1;
      ud.pack.visible = false;
      r.model.visible = true;
      if (r.tag) r.tag.visible = false;
    } else {
      r.model.visible = false;
    }
  }
  const nk = 1 - Math.exp(-dt * 18);
  for (const [, n] of nadeMeshes) { n.mesh.position.lerp(n.tgt, nk); n.mesh.rotation.x += dt * 8; n.mesh.rotation.z += dt * 5; }
}

function spectateTarget() {
  const mates = [...remotes.values()].filter((r) => r.data.a && r.data.tm === me.team);
  const pool = mates.length ? mates : [...remotes.values()].filter((r) => r.data.a);
  if (!pool.length) return null;
  return pool[specIdx % pool.length];
}

function updateCamera(dt, now) {
  const fov = me.alive ? [BASE_FOV, 32, 12][me.zoom] : BASE_FOV;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (me.alive || !me.spawned) {
    if (!me.spawned) {
      const t = now * 0.08;
      camera.position.set(Math.sin(t) * 45, 28, Math.cos(t) * 45);
      camera.lookAt(0, 0, 0);
      return null;
    }
    const bobY = Math.sin(me.bob) * 0.03 * Math.min(1, hspeed() / 5.6) * (me.onGround ? 1 : 0);
    const sh = me.shake * 0.05;
    camera.position.set(me.pos[0] + (Math.random() - 0.5) * sh, me.pos[1] + me.eye + bobY + (Math.random() - 0.5) * sh, me.pos[2]);
    camera.rotation.set(me.pitch + me.punch, me.yaw + me.punchYaw, 0);
    return null;
  }
  const r = spectateTarget();
  if (r) {
    const c = r.cur;
    const back = 2.8;
    const target = new THREE.Vector3(c.x, c.y + 1.6, c.z);
    const dir = new THREE.Vector3(-Math.sin(c.yw), 0, -Math.cos(c.yw));
    let want = target.clone().addScaledVector(dir, -back).add(new THREE.Vector3(0, 0.6, 0));
    raycaster.set(target, want.clone().sub(target).normalize()); raycaster.far = back + 0.6;
    const hit = raycaster.intersectObjects(mapMeshes, false)[0];
    if (hit) want = target.clone().addScaledVector(want.clone().sub(target).normalize(), Math.max(0.3, hit.distance - 0.3));
    camera.position.lerp(want, Math.min(1, dt * 10));
    camera.lookAt(target.clone().addScaledVector(dir, 4));
    return r;
  }
  camera.position.set(0, 40, 30);
  camera.lookAt(0, 0, 5);
  return null;
}

function updateViewmodel(dt, now) {
  const show = me.alive && me.spawned && !me.zoom;
  vm.visible = show;
  if (!show) return;
  const m = VM[me.w];
  const base = m.userData.base;
  const hs = Math.min(1, hspeed() / 5.6) * (me.onGround ? 1 : 0.3);
  vmSway.x *= Math.pow(0.001, dt); vmSway.y *= Math.pow(0.001, dt);
  me.kick = Math.max(0, me.kick - dt * 10);
  me.swing = Math.max(0, me.swing - dt * 3);
  let x = base.x + Math.sin(me.bob * 0.5) * 0.012 * hs - vmSway.x;
  let y = base.y + Math.abs(Math.cos(me.bob * 0.5)) * 0.01 * hs + vmSway.y - (me.crouch ? 0.01 : 0);
  let z = base.z + me.kick * (me.w === 4 || me.w === 7 ? 0.08 : 0.04);
  let rx = me.kick * (me.w === 2 || me.w === 4 ? 0.2 : 0.08), ry = WEAPONS[me.w].slot === 'pri' ? 0.05 : 0, rz = 0;
  const sw = Math.max(0, me.switchEnd - now) / 0.5;
  y -= sw * 0.2; rx -= sw * 0.6;
  if (me.reloading) {
    const W = WEAPONS[me.w];
    const t = 1 - (me.reloadEnd - now) / W.reload;
    const dip = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
    y -= dip * 0.08; rx -= dip * 0.5; rz += dip * 0.4;
  }
  if (me.swing > 0) {
    const s = Math.sin(me.swing * Math.PI);
    if (me.w === 0) { x -= s * 0.12; z -= s * 0.12; ry += s * 1.0; rz += s * 0.5; }
    else { z -= s * 0.25; y += s * 0.08; rx += s * 0.8; }
  }
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  flashVisT -= dt;
  if (flashVisT <= 0) VM.forEach((v) => { if (v.userData.flash) v.userData.flash.visible = false; });
}

// =====================================================================
// HUD
// =====================================================================
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).innerHTML = v; } }
function setStyle(id, prop, v) { const key = id + prop; if (hudCache[key] !== v) { hudCache[key] = v; $(id).style[prop] = v; } }
function toggle(id, show) { const key = id + '_v'; if (hudCache[key] !== show) { hudCache[key] = show; $(id).classList.toggle('hidden', !show); } }

let centerT = 0;
function centerMsg(title, sub = '', dur = 3, team) {
  const col = team === 'red' ? '#ff9a6a' : team === 'blue' ? '#8ab8ff' : '#fff';
  $('center').innerHTML = `<span style="color:${col}">${esc(title)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}`;
  centerT = dur;
}
const fmt = (t) => { t = Math.ceil(t); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const iCarry = () => G.c4 && G.c4.st === 'carried' && G.c4.c === myId;

function updateHud(dt, specR) {
  const W = WEAPONS[me.w];
  const redSide = sideOf('red') === 'atk' ? 'ATK' : 'DEF';
  const blueSide = redSide === 'ATK' ? 'DEF' : 'ATK';
  setText('scRed', `${G.sc.red}<small>RED · ${redSide}</small>`);
  setText('scBlue', `${G.sc.blue}<small>BLUE · ${blueSide}</small>`);
  const phaseLbl = { freeze: 'BUY TIME', live: `ROUND ${G.rd}`, planted: 'BOMB PLANTED', end: 'ROUND OVER', idle: 'WAITING' }[G.ph] || '';
  setText('timer', `${G.ph === 'end' || G.ph === 'idle' ? '--:--' : fmt(G.tm)}<small>${phaseLbl}</small>`);
  $('timer').classList.toggle('bomb', G.ph === 'planted');

  if (me.team) {
    const side = sideOf(me.team);
    setText('sidebadge', (side === 'atk' ? 'ATTACKER' : 'DEFENDER') + (iCarry() ? ' · <span class="bombtag">BOMB</span>' : '') + (me.inv.kit ? ' · KIT' : ''));
    setStyle('sidebadge', 'background', me.team === 'red' ? 'rgba(170,60,30,.85)' : 'rgba(40,80,160,.85)');
  }
  const hp = me.alive ? me.hp : 0;
  setText('hpnum', String(hp));
  setStyle('hpfill', 'width', hp + '%');
  setStyle('hpfill', 'background', hp > 50 ? '#9be36a' : hp > 25 ? '#ffcf6e' : '#ff4a3a');
  setText('armor', me.inv.ar > 0 ? `${me.inv.hm ? '⛑' : '◈'} ${me.inv.ar}` : '');
  setText('money', `$${me.inv.m}`);
  setText('wname', me.reloading ? 'RELOADING...' : W.name);
  const isGun = W.mag > 0;
  setText('mag', W.slot === 'nade' ? String(me.inv[W.nade]) : isGun ? String(me.ammo[me.w]) : '∞');
  setText('res', isGun ? String(me.reserve[me.w]) : '-');
  setText('nades', [['he', 'HE'], ['fl', 'FL'], ['sm', 'SM']].filter(([k]) => me.inv[k] > 0).map(([k, n]) => `${n}${me.inv[k] > 1 ? '×' + me.inv[k] : ''}`).join(' '));
  toggle('health', me.alive);
  toggle('ammo', me.alive);
  toggle('money', !!me.team);

  const spread = currentSpread(W);
  const gap = Math.round(4 + Math.min(spread, 0.12) * 500);
  setStyle('chL', 'left', `${-gap - 8}px`); setStyle('chR', 'left', `${gap}px`);
  setStyle('chU', 'top', `${-gap - 8}px`); setStyle('chD', 'top', `${gap}px`);
  toggle('crosshair', me.alive && !me.zoom && !W.scope);
  toggle('scope', me.alive && me.zoom > 0);
  hitmarkT -= dt;
  setStyle('hitmark', 'opacity', hitmarkT > 0 ? '1' : '0');

  centerT -= dt;
  setStyle('center', 'opacity', centerT > 0 ? String(Math.min(1, centerT * 2)) : '0');

  let hint = '';
  if (me.alive && me.team) {
    const side = sideOf(me.team);
    if (canBuyHere() && !buyOpen) hint = `PRESS [B] TO BUY · ${Math.ceil(G.bt)}s`;
    if (side === 'atk' && G.ph === 'live' && iCarry() && siteAt(me.pos)) hint = 'HOLD [E] TO PLANT THE BOMB';
    if (side === 'def' && G.ph === 'planted' && G.c4 && G.c4.p && Math.hypot(me.pos[0] - G.c4.p[0], me.pos[1] - G.c4.p[1], me.pos[2] - G.c4.p[2]) < 2.4) hint = me.inv.kit ? 'HOLD [E] TO DEFUSE (KIT)' : 'HOLD [E] TO DEFUSE';
  }
  const act = G.act;
  if (act && act.i === myId) hint = act.k === 'plant' ? 'PLANTING... stay still' : 'DEFUSING... stay still';
  hintT -= dt;
  if (hintT > 0) hint = hintMsg;
  setText('hint', hint);
  toggle('progress', !!act && (act.i === myId || (!me.alive && specR && specR.data.i === act.i)));
  if (act) setStyle('progfill', 'width', `${Math.round(act.p * 100)}%`);
  if (buyOpen) setText('bmMoney', `$${me.inv.m} · ${Math.ceil(G.bt)}s`);

  const specOn = !me.alive && me.spawned;
  toggle('spec', specOn);
  if (specOn) setText('spec', specR ? `SPECTATING ${esc(specR.data.n)} · ${specR.data.hp} HP<small>click to switch player</small>` : 'YOU ARE DEAD<small>wait for next round</small>');

  toggle('scoreboard', showBoard);
  if (showBoard && lastSnap) renderBoard();
}

function renderBoard() {
  const rows = (team) => lastSnap.ps.filter((p) => p.tm === team).sort((a, b) => b.k - a.k).map((p) =>
    `<tr class="${p.a ? '' : 'dead'} ${p.i === myId ? 'me' : ''}"><td>${esc(p.n)}${p.a ? '' : ' ✝'}${G.c4 && G.c4.st === 'carried' && G.c4.c === p.i && team === me.team ? ' [B]' : ''}</td><td class="n">${team === me.team ? '$' + p.m : ''}</td><td class="n">${p.k}</td><td class="n">${p.d}</td></tr>`).join('');
  const html = ['red', 'blue'].map((t) =>
    `<h3 class="t${t}">${t.toUpperCase()} — ${G.sc[t]} · ${sideOf(t) === 'atk' ? 'ATTACK' : 'DEFEND'}</h3><table><tr><td></td><td class="n">$</td><td class="n">K</td><td class="n">D</td></tr>${rows(t)}</table>`).join('');
  setText('scoreboard', html);
}

// radar
const radar = $('radar'), rctx = radar.getContext('2d');
const RW = radar.width, RH = radar.height;
const rsx = RW / (MAP_BOUNDS.x2 - MAP_BOUNDS.x1 + 2), rsz = RH / (MAP_BOUNDS.z2 - MAP_BOUNDS.z1 + 2);
const toR = (x, z) => [(x - MAP_BOUNDS.x1 + 1) * rsx, (z - MAP_BOUNDS.z1 + 1) * rsz];
const radarBase = document.createElement('canvas'); radarBase.width = RW; radarBase.height = RH;
{
  const g = radarBase.getContext('2d');
  g.fillStyle = 'rgba(210,175,120,0.55)'; g.fillRect(0, 0, RW, RH);
  for (const k in SITES) { const s = SITES[k]; const [x1, z1] = toR(s.x1, s.z1), [x2, z2] = toR(s.x2, s.z2); g.fillStyle = 'rgba(200,60,40,0.25)'; g.fillRect(x1, z1, x2 - x1, z2 - z1); }
  for (const b of boxes) {
    if (b.max[1] < 0.5 || b.min[1] > 2) continue;
    const [x1, z1] = toR(b.min[0], b.min[2]), [x2, z2] = toR(b.max[0], b.max[2]);
    g.fillStyle = b.mat === 'crate' ? 'rgba(90,55,25,0.9)' : b.max[1] < 2 ? 'rgba(120,80,50,0.8)' : 'rgba(40,28,18,0.92)';
    g.fillRect(x1, z1, Math.max(1, x2 - x1), Math.max(1, z2 - z1));
  }
  g.fillStyle = '#ffdf8a'; g.font = '12px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k in SITES) { const [x, z] = toR(SITES[k].label[0], SITES[k].label[1]); g.fillText(k, x, z); }
}
function drawRadar(now) {
  rctx.clearRect(0, 0, RW, RH);
  rctx.drawImage(radarBase, 0, 0);
  for (const [, r] of remotes) {
    if (!r.data.a) continue;
    const mate = r.data.tm === me.team;
    if (!mate && now - r.lastFire > 1.2) continue;
    const [x, z] = toR(r.cur.x, r.cur.z);
    rctx.fillStyle = mate ? (r.data.tm === 'red' ? '#ff9a6a' : '#8ab8ff') : '#ff2a2a';
    rctx.fillRect(x - 2, z - 2, 4, 4);
    if (mate && G.c4 && G.c4.st === 'carried' && G.c4.c === r.data.i) { rctx.strokeStyle = '#ffdf3a'; rctx.strokeRect(x - 3.5, z - 3.5, 7, 7); }
  }
  const c4 = G.c4;
  const atk = me.team && sideOf(me.team) === 'atk';
  if (c4 && c4.p && (c4.st === 'planted' || (c4.st === 'dropped' && atk))) {
    const [x, z] = toR(c4.p[0], c4.p[2]);
    if (c4.st === 'dropped' || Math.floor(now * 4) % 2) { rctx.fillStyle = c4.st === 'dropped' ? '#ffdf3a' : '#ff2010'; rctx.fillRect(x - 3, z - 3, 6, 6); }
  }
  for (const s of smokes) { const [x, z] = toR(s.group.position.x, s.group.position.z); rctx.fillStyle = 'rgba(200,200,200,0.7)'; rctx.beginPath(); rctx.arc(x, z, 4.5, 0, Math.PI * 2); rctx.fill(); }
  if (me.alive) {
    const [x, z] = toR(me.pos[0], me.pos[2]);
    rctx.save(); rctx.translate(x, z); rctx.rotate(-me.yaw);
    rctx.fillStyle = '#fff'; rctx.beginPath(); rctx.moveTo(0, -5); rctx.lineTo(3.5, 4); rctx.lineTo(-3.5, 4); rctx.closePath(); rctx.fill();
    rctx.restore();
  }
}

// =====================================================================
// main loop
// =====================================================================
let lastT = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const tNow = performance.now();
  const dt = Math.min(0.05, (tNow - lastT) / 1000);
  lastT = tNow;
  const now = tNow / 1000;

  if (inGame) updateLocal(dt, now);
  updateRemotes(dt, now);
  const specR = updateCamera(dt, now);
  updateViewmodel(dt, now);
  updateEffects(dt);
  updateSmokes(dt);

  const c4 = G.c4;
  bombObj.visible = !!(c4 && c4.p && (c4.st === 'planted' || c4.st === 'dropped'));
  if (bombObj.visible) {
    bombObj.position.set(c4.p[0], c4.p[1], c4.p[2]);
    if (c4.st === 'planted') {
      const interval = Math.max(0.12, (G.tm / 40) * 1.0);
      beepT -= dt;
      if (beepT <= 0 && G.ph === 'planted') { beepT = interval; SFX.beep(bombObj.position); bombLight.visible = true; }
      if (beepT < interval - 0.08) bombLight.visible = false;
    } else bombLight.visible = false;
  }

  flashT -= dt; if (flashT <= 0) flashLight.intensity = 0;
  hurtFlash = Math.max(0, hurtFlash - dt * 2.5);
  screenFlash = Math.max(0, screenFlash - dt * 1.5);
  postMat.uniforms.uHurt.value = hurtFlash;
  postMat.uniforms.uFlash.value = Math.max(screenFlash * 0.8, Math.min(1, me.blind / 1.3));
  postMat.uniforms.uDead.value = me.spawned && !me.alive ? 1 : 0;

  if (inGame) { updateHud(dt, specR); drawRadar(now); }

  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  if (vm.visible) renderer.render(vmScene, vmCam);
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(postScene, postCam);
}
requestAnimationFrame(frame);

// =====================================================================
// menu
// =====================================================================
$('nameIn').value = settings.name || '';
$('teamIn').value = settings.team || 'auto';
$('resIn').value = String(settings.res || 300);
$('sensIn').value = settings.sens; $('sensVal').textContent = Number(settings.sens).toFixed(1);
$('volIn').value = settings.vol;
$('sensIn').addEventListener('input', () => { settings.sens = Number($('sensIn').value); $('sensVal').textContent = settings.sens.toFixed(1); saveSettings(); });
$('volIn').addEventListener('input', () => { settings.vol = Number($('volIn').value); if (master) master.gain.value = settings.vol; saveSettings(); });
$('resIn').addEventListener('change', () => { settings.res = Number($('resIn').value); resize(); saveSettings(); });
$('bmClose').addEventListener('click', closeBuy);

const STANDALONE = !!window.__STANDALONE || location.protocol === 'file:';
if (!STANDALONE) $('serverBtn').classList.remove('hidden');
$('codeIn').addEventListener('input', () => { $('codeIn').value = $('codeIn').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
$('codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });

let starting = false;
async function play(mode) {
  if (starting) return;
  const code = $('codeIn').value.trim().toUpperCase();
  if (mode === 'join' && code.length !== 4) { $('status').textContent = 'Type the 4-letter code from the host.'; $('codeIn').focus(); return; }
  starting = true;
  settings.name = $('nameIn').value.trim().slice(0, 16) || 'Player' + Math.floor(Math.random() * 100);
  settings.team = $('teamIn').value;
  saveSettings();
  initAudio();
  $('status').textContent = mode === 'bots' ? 'Starting...' : 'Connecting...';
  canvas.requestPointerLock();
  try {
    if (mode === 'bots') conn = connectLocal();
    else if (mode === 'host') conn = await startHost();
    else if (mode === 'join') conn = await startJoin(code);
    else conn = await connectServer();
  } catch (e) {
    $('status').textContent = e.message;
    starting = false;
    if (document.pointerLockElement) document.exitPointerLock();
    return;
  }
  net({ t: 'join', name: settings.name, team: settings.team });
  inGame = true;
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('status').textContent = '';
  if (roomCode) {
    $('room').textContent = `ROOM CODE: ${roomCode}`;
    $('room').classList.remove('hidden');
    $('pauseRoom').textContent = `Room code for friends: ${roomCode}`;
    chatLine(`Your room code is ${roomCode} - friends open the game, type it and press JOIN`);
  }
  if (!locked) $('pause').classList.remove('hidden');
}
$('botsBtn').addEventListener('click', () => play('bots'));
$('hostBtn').addEventListener('click', () => play('host'));
$('joinBtn').addEventListener('click', () => play('join'));
$('serverBtn').addEventListener('click', () => play('server'));
$('nameIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') play(STANDALONE ? 'bots' : 'server'); });

// debug hook for automated tests
window.__lownoon = {
  me, remotes, camera, get G() { return G; },
  fire: () => fire(performance.now() / 1000), setLocked: (v) => { locked = v; },
  buy: (item) => net({ t: 'buy', item }), throwNade, switchWeapon, openBuy, get localGame() { return localGame; },
};
