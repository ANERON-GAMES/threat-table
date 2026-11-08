export function damage(id, amount) {
  return { type: "damage", id, amount };
}

export function healing(id, amount) {
  return { type: "healing", id, amount };
}

export function advance(elapsed) {
  return { type: "advance", elapsed };
}

export function leave(id) {
  return { type: "leave", id };
}

export function entry(id, threat, addedAt) {
  return { id, threat, addedAt };
}

export function validTable(overrides = {}) {
  return {
    time: 0,
    damageMultiplier: 1,
    healingMultiplier: 1,
    decay: 0,
    switchPercent: 0,
    target: null,
    entries: [],
    ...overrides
  };
}

export const MAX = Number.MAX_SAFE_INTEGER;
