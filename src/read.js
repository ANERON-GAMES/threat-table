import { isObject, normalizeZero } from "./shape.js";

const OPTIONS_MESSAGE = "options must be an object";
const TABLE_MESSAGE = "table must be an object";
const DAMAGE_MULTIPLIER_MESSAGE = "damageMultiplier must be an integer greater than or equal to 0";
const HEALING_MULTIPLIER_MESSAGE =
  "healingMultiplier must be an integer greater than or equal to 0";
const DECAY_MESSAGE = "decay must be an integer greater than or equal to 0";
const SWITCH_MESSAGE = "switchPercent must be an integer greater than or equal to 0";
const TIME_MESSAGE = "time must be an integer greater than or equal to 0";
const TARGET_MESSAGE = "target must be an entry id or null";
const ENTRIES_MESSAGE = "entries must be an array";
const ENTRY_MESSAGE = "entry must be an object";
const ENTRY_ID_MESSAGE = "entry id must be a non-empty string";
const ENTRY_UNIQUE_MESSAGE = "entry ids must be unique";
const THREAT_MESSAGE = "threat must be an integer greater than or equal to 1";
const ADDED_AT_MESSAGE = "addedAt must be an integer greater than or equal to 0";
const ADDED_AT_ORDER_MESSAGE = "addedAt must be less than or equal to time";
const ACTIONS_MESSAGE = "actions must be an array";
const ACTION_MESSAGE = "action must be an object";
const TYPE_MESSAGE = "action type must be advance, damage, healing, or leave";
const ELAPSED_MESSAGE = "elapsed must be an integer greater than or equal to 0";
const ACTION_ID_MESSAGE = "action id must be a non-empty string";
const AMOUNT_MESSAGE = "amount must be an integer greater than or equal to 0";

const MAX_SWITCH = Number.MAX_SAFE_INTEGER - 100;

export function readCreate(options) {
  if (!isObject(options)) {
    throw new TypeError(OPTIONS_MESSAGE);
  }
  const damageMultiplier = readOptionalWhole(
    options,
    "damageMultiplier",
    1,
    DAMAGE_MULTIPLIER_MESSAGE
  );
  const healingMultiplier = readOptionalWhole(
    options,
    "healingMultiplier",
    1,
    HEALING_MULTIPLIER_MESSAGE
  );
  const decay = readOptionalWhole(options, "decay", 0, DECAY_MESSAGE);
  const switchPercent = readOptionalSwitch(options);
  return { damageMultiplier, healingMultiplier, decay, switchPercent };
}

export function readApply(table, actions) {
  if (!isObject(table)) {
    throw new TypeError(TABLE_MESSAGE);
  }
  const time = readRequiredWhole(table, "time", TIME_MESSAGE);
  const damageMultiplier = readRequiredWhole(table, "damageMultiplier", DAMAGE_MULTIPLIER_MESSAGE);
  const healingMultiplier = readRequiredWhole(
    table,
    "healingMultiplier",
    HEALING_MULTIPLIER_MESSAGE
  );
  const decay = readRequiredWhole(table, "decay", DECAY_MESSAGE);
  const switchPercent = readRequiredSwitch(table);
  const target = readTarget(table);
  const entries = readEntries(table, time);
  if (target !== null && !entries.some((entry) => entry.id === target)) {
    throw new TypeError(TARGET_MESSAGE);
  }
  const list = readActions(actions);
  return {
    time,
    damageMultiplier,
    healingMultiplier,
    decay,
    switchPercent,
    target,
    entries,
    actions: list
  };
}

function readOptionalWhole(source, key, fallback, message) {
  if (!Object.hasOwn(source, key) || source[key] === undefined) {
    return fallback;
  }
  return readWhole(source[key], message);
}

function readRequiredWhole(source, key, message) {
  if (!Object.hasOwn(source, key)) {
    throw new RangeError(message);
  }
  return readWhole(source[key], message);
}

function readWhole(value, message) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(message);
  }
  return normalizeZero(value);
}

function readOptionalSwitch(source) {
  if (!Object.hasOwn(source, "switchPercent") || source.switchPercent === undefined) {
    return 0;
  }
  return readSwitch(source.switchPercent);
}

function readRequiredSwitch(source) {
  if (!Object.hasOwn(source, "switchPercent")) {
    throw new RangeError(SWITCH_MESSAGE);
  }
  return readSwitch(source.switchPercent);
}

function readSwitch(value) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_SWITCH
  ) {
    throw new RangeError(SWITCH_MESSAGE);
  }
  return normalizeZero(value);
}

function readTarget(source) {
  if (!Object.hasOwn(source, "target")) {
    throw new TypeError(TARGET_MESSAGE);
  }
  const value = source.target;
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(TARGET_MESSAGE);
  }
  return value;
}

function readEntries(source, time) {
  if (!Object.hasOwn(source, "entries") || !Array.isArray(source.entries)) {
    throw new TypeError(ENTRIES_MESSAGE);
  }
  const seen = new Set();
  const entries = [];
  for (const entry of source.entries) {
    entries.push(readEntry(entry, time, seen));
  }
  return entries;
}

function readEntry(entry, time, seen) {
  if (!isObject(entry)) {
    throw new TypeError(ENTRY_MESSAGE);
  }
  if (!Object.hasOwn(entry, "id") || typeof entry.id !== "string" || entry.id.length === 0) {
    throw new TypeError(ENTRY_ID_MESSAGE);
  }
  if (seen.has(entry.id)) {
    throw new TypeError(ENTRY_UNIQUE_MESSAGE);
  }
  seen.add(entry.id);
  const threat = readThreat(entry);
  const addedAt = readAddedAt(entry, time);
  return { id: entry.id, threat, addedAt };
}

function readThreat(entry) {
  if (!Object.hasOwn(entry, "threat")) {
    throw new RangeError(THREAT_MESSAGE);
  }
  const value = entry.threat;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(THREAT_MESSAGE);
  }
  return value;
}

function readAddedAt(entry, time) {
  if (!Object.hasOwn(entry, "addedAt")) {
    throw new RangeError(ADDED_AT_MESSAGE);
  }
  const value = readWhole(entry.addedAt, ADDED_AT_MESSAGE);
  if (value > time) {
    throw new RangeError(ADDED_AT_ORDER_MESSAGE);
  }
  return value;
}

function readActions(actions) {
  if (!Array.isArray(actions)) {
    throw new TypeError(ACTIONS_MESSAGE);
  }
  const list = [];
  for (const action of actions) {
    list.push(readAction(action));
  }
  return list;
}

function readAction(action) {
  if (!isObject(action)) {
    throw new TypeError(ACTION_MESSAGE);
  }
  if (!Object.hasOwn(action, "type") || !isActionType(action.type)) {
    throw new TypeError(TYPE_MESSAGE);
  }
  if (action.type === "advance") {
    return { type: "advance", elapsed: readRequiredWhole(action, "elapsed", ELAPSED_MESSAGE) };
  }
  const id = readActionId(action);
  if (action.type === "leave") {
    return { type: "leave", id };
  }
  return {
    type: action.type,
    id,
    amount: readRequiredWhole(action, "amount", AMOUNT_MESSAGE)
  };
}

function isActionType(value) {
  return value === "advance" || value === "damage" || value === "healing" || value === "leave";
}

function readActionId(action) {
  if (!Object.hasOwn(action, "id") || typeof action.id !== "string" || action.id.length === 0) {
    throw new TypeError(ACTION_ID_MESSAGE);
  }
  return action.id;
}
