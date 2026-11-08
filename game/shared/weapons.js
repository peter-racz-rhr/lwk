// Weapon + economy data shared by server and client.
// slot: knife | sec (pistol) | pri (primary) | nade
// side: optional restriction ('atk' or 'def')
const DEFAULTS = {
  price: 0, dmg: 0, headMul: 1, pen: 0.5, rate: 0.8, mag: 0, reserve: 0, reload: 0, auto: false,
  spread: 0, moveSpread: 0, airSpread: 0, bloom: 0, recoil: 0, range: 0, speed: 1, reward: 300, len: 0,
};

export const WEAPONS = [
  { id: 0, name: 'KNIFE', slot: 'knife', dmg: 55, headMul: 1.3, pen: 0.85, rate: 0.45, auto: true, range: 2.2, speed: 1.08, reward: 1500 },
  { id: 1, name: 'P9 PISTOL', slot: 'sec', price: 200, dmg: 26, headMul: 4, pen: 0.5, rate: 0.15, mag: 12, reserve: 48, reload: 2.0,
    spread: 0.006, moveSpread: 0.035, airSpread: 0.09, bloom: 0.004, recoil: 0.03, range: 200, speed: 1, reward: 300, len: 0.3,
    desc: 'Default sidearm' },
  { id: 2, name: 'HAND CANNON', slot: 'sec', price: 700, dmg: 52, headMul: 3.5, pen: 0.9, rate: 0.32, mag: 7, reserve: 35, reload: 2.2,
    spread: 0.005, moveSpread: 0.06, airSpread: 0.12, bloom: 0.02, recoil: 0.07, range: 200, speed: 0.98, reward: 300, len: 0.36,
    desc: 'One-tap headshots' },
  { id: 3, name: 'WASP SMG', slot: 'pri', price: 1250, dmg: 24, headMul: 4, pen: 0.6, rate: 0.075, mag: 30, reserve: 120, reload: 2.1, auto: true,
    spread: 0.007, moveSpread: 0.025, airSpread: 0.08, bloom: 0.003, recoil: 0.012, range: 120, speed: 1.0, reward: 600, len: 0.5,
    desc: 'Fast, $600 kill bonus' },
  { id: 4, name: 'THUNDER-12', slot: 'pri', price: 1100, dmg: 17, headMul: 2, pen: 0.5, rate: 0.85, mag: 7, reserve: 28, reload: 2.8,
    pellets: 9, pelletSpread: 0.055, spread: 0.01, moveSpread: 0.02, airSpread: 0.05, recoil: 0.06, range: 28, speed: 0.94, reward: 900, len: 0.75,
    desc: 'Shotgun, close range' },
  { id: 5, name: 'RAIDER AR', slot: 'pri', side: 'atk', price: 2700, dmg: 35, headMul: 4, pen: 0.78, rate: 0.1, mag: 30, reserve: 90, reload: 2.4, auto: true,
    spread: 0.003, moveSpread: 0.075, airSpread: 0.15, bloom: 0.003, recoil: 0.018, range: 300, speed: 0.9, reward: 300, len: 0.75,
    desc: 'Attacker rifle, headshot kills' },
  { id: 6, name: 'GUARDIAN AR', slot: 'pri', side: 'def', price: 3100, dmg: 31, headMul: 4, pen: 0.7, rate: 0.09, mag: 30, reserve: 90, reload: 2.9, auto: true,
    spread: 0.0025, moveSpread: 0.065, airSpread: 0.15, bloom: 0.0025, recoil: 0.014, range: 300, speed: 0.92, reward: 300, len: 0.75,
    desc: 'Defender rifle, accurate' },
  { id: 7, name: 'LONGBOW', slot: 'pri', price: 4750, dmg: 115, headMul: 3, pen: 0.97, rate: 1.45, mag: 5, reserve: 30, reload: 3.6,
    scope: true, spread: 0.0006, unscoped: 0.1, moveSpread: 0.12, airSpread: 0.3, recoil: 0.06, range: 400, speed: 0.84, reward: 100, len: 0.95,
    desc: 'Sniper, right-click scope' },
  { id: 8, name: 'HE GRENADE', slot: 'nade', nade: 'he', price: 300, max: 1, reward: 300, desc: 'Explodes, up to 100 dmg' },
  { id: 9, name: 'FLASHBANG', slot: 'nade', nade: 'fl', price: 200, max: 2, desc: 'Blinds anyone looking' },
  { id: 10, name: 'SMOKE', slot: 'nade', nade: 'sm', price: 300, max: 1, desc: 'Blocks vision 16s' },
].map((w) => ({ ...DEFAULTS, ...w }));

export const NADE_IDS = { he: 8, fl: 9, sm: 10 };

export const GEAR = {
  vest: { name: 'KEVLAR VEST', price: 650, desc: 'Armor for the body' },
  vesthelm: { name: 'VEST + HELMET', price: 1000, desc: 'Body + head armor' },
  kit: { name: 'DEFUSE KIT', price: 400, side: 'def', desc: 'Defuse in 2.5s' },
};

export const MAX_HP = 100;
export const START_MONEY = 800;
export const MAX_MONEY = 16000;
export const ROUND_TIME = 115;
export const BUY_TIME = 20;        // seconds into the live round you can still buy
export const BUY_RADIUS = 16;
export const BOMB_TIME = 40;
export const FREEZE_TIME = 8;
export const PLANT_TIME = 3;
export const DEFUSE_TIME = 5;
export const KIT_DEFUSE_TIME = 2.5;
export const ROUNDS_TO_WIN = 7;
export const HALF_ROUNDS = 6;
export const WIN_ELIM = 3250;
export const WIN_OBJ = 3500;
export const LOSS_BASE = 1400;
export const LOSS_STEP = 500;
export const PLANT_BONUS = 800;
