import { readApply, readCreate } from "./read.js";

const GAIN_MESSAGE = "threat gain must be a safe integer";
const SUM_MESSAGE = "threat must be a safe integer";
const DECAY_AMOUNT_MESSAGE = "decay amount must be a safe integer";
const ADVANCED_TIME_MESSAGE = "advanced time must be a safe integer";

export function createTable(options) {
  const config = readCreate(options);
  return freezeTable({
    time: 0,
    damageMultiplier: config.damageMultiplier,
    healingMultiplier: config.healingMultiplier,
    decay: config.decay,
    switchPercent: config.switchPercent,
    target: null,
    entries: []
  });
}

export function applyThreat(table, actions) {
  const input = readApply(table, actions);
  const entries = [];
  for (const entry of input.entries) {
    entries.push(copyEntry(entry));
  }
  let time = input.time;
  let target = input.target;
  if (input.actions.length === 0) {
    target = chooseTarget(entries, target, input.switchPercent);
  }
  for (const action of input.actions) {
    if (action.type === "advance") {
      const loss = mulSafe(input.decay, action.elapsed, DECAY_AMOUNT_MESSAGE);
      time = addSafe(time, action.elapsed, ADVANCED_TIME_MESSAGE);
      decayEntries(entries, loss);
    } else if (action.type === "leave") {
      removeId(entries, action.id);
    } else {
      const multiplier =
        action.type === "damage" ? input.damageMultiplier : input.healingMultiplier;
      const gain = mulSafe(action.amount, multiplier, GAIN_MESSAGE);
      addGain(entries, action.id, gain, time);
    }
    target = chooseTarget(entries, target, input.switchPercent);
  }
  entries.sort(compareEntry);
  return freezeTable({
    time,
    damageMultiplier: input.damageMultiplier,
    healingMultiplier: input.healingMultiplier,
    decay: input.decay,
    switchPercent: input.switchPercent,
    target,
    entries
  });
}

function copyEntry(entry) {
  return { id: entry.id, threat: entry.threat, addedAt: entry.addedAt };
}

function decayEntries(entries, loss) {
  if (loss === 0) {
    return;
  }
  let write = 0;
  for (let read = 0; read < entries.length; read += 1) {
    const entry = entries[read];
    if (entry.threat <= loss) {
      continue;
    }
    entries[write] = {
      id: entry.id,
      threat: entry.threat - loss,
      addedAt: entry.addedAt
    };
    write += 1;
  }
  entries.length = write;
}

function removeId(entries, id) {
  let write = 0;
  for (let read = 0; read < entries.length; read += 1) {
    const entry = entries[read];
    if (entry.id === id) {
      continue;
    }
    entries[write] = entry;
    write += 1;
  }
  entries.length = write;
}

function addGain(entries, id, gain, time) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.id !== id) {
      continue;
    }
    if (gain === 0) {
      return;
    }
    entries[index] = {
      id,
      threat: addSafe(entry.threat, gain, SUM_MESSAGE),
      addedAt: entry.addedAt
    };
    return;
  }
  if (gain === 0) {
    return;
  }
  entries.push({ id, threat: gain, addedAt: time });
}

function chooseTarget(entries, currentId, switchPercent) {
  if (entries.length === 0) {
    return null;
  }
  const best = bestEntry(entries);
  const current = findEntry(entries, currentId);
  if (current === null) {
    return best.id;
  }
  if (best.id === current.id) {
    return current.id;
  }
  if (exceedsThreshold(best.threat, current.threat, switchPercent)) {
    return best.id;
  }
  return current.id;
}

function bestEntry(entries) {
  let best = entries[0];
  for (let index = 1; index < entries.length; index += 1) {
    if (compareEntry(entries[index], best) < 0) {
      best = entries[index];
    }
  }
  return best;
}

function findEntry(entries, id) {
  if (id === null) {
    return null;
  }
  for (const entry of entries) {
    if (entry.id === id) {
      return entry;
    }
  }
  return null;
}

function exceedsThreshold(threat, currentThreat, switchPercent) {
  return BigInt(threat) * 100n > BigInt(currentThreat) * BigInt(100 + switchPercent);
}

function compareEntry(left, right) {
  if (left.threat !== right.threat) {
    return left.threat > right.threat ? -1 : 1;
  }
  if (left.addedAt !== right.addedAt) {
    return left.addedAt < right.addedAt ? -1 : 1;
  }
  if (left.id < right.id) {
    return -1;
  }
  if (left.id > right.id) {
    return 1;
  }
  return 0;
}

function mulSafe(left, right, message) {
  if (left === 0 || right === 0) {
    return 0;
  }
  if (left > Math.floor(Number.MAX_SAFE_INTEGER / right)) {
    throw new RangeError(message);
  }
  return left * right;
}

function addSafe(left, right, message) {
  if (right > Number.MAX_SAFE_INTEGER - left) {
    throw new RangeError(message);
  }
  return left + right;
}

function freezeTable(result) {
  const entries = [];
  for (const entry of result.entries) {
    entries.push(
      Object.freeze({
        id: entry.id,
        threat: entry.threat,
        addedAt: entry.addedAt
      })
    );
  }
  result.entries = Object.freeze(entries);
  return Object.freeze(result);
}
