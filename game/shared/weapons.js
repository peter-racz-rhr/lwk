export const WEAPONS = [
  { id: 0, name: 'RIFLE', dmg: 30, headMul: 4, rate: 0.1, mag: 30, reserve: 90, reload: 2.4, auto: true,
    spread: 0.003, moveSpread: 0.07, airSpread: 0.14, bloom: 0.0028, recoil: 0.016, range: 300, speed: 0.95 },
  { id: 1, name: 'PISTOL', dmg: 27, headMul: 3.7, rate: 0.16, mag: 12, reserve: 48, reload: 1.8, auto: false,
    spread: 0.006, moveSpread: 0.035, airSpread: 0.09, bloom: 0.004, recoil: 0.03, range: 200, speed: 1.0 },
  { id: 2, name: 'KNIFE', dmg: 55, headMul: 1.3, rate: 0.45, mag: 0, reserve: 0, reload: 0, auto: true,
    spread: 0, moveSpread: 0, airSpread: 0, bloom: 0, recoil: 0, range: 2.2, speed: 1.08 },
];

export const MAX_HP = 100;
export const ROUND_TIME = 100;
export const BOMB_TIME = 40;
export const FREEZE_TIME = 3.5;
export const PLANT_TIME = 3;
export const DEFUSE_TIME = 5;
export const ROUNDS_TO_WIN = 7;
export const HALF_ROUNDS = 6;
