import assert from "node:assert/strict";
import test from "node:test";
import { applyThreat, createTable } from "../src/index.js";
import { advance, damage, entry, healing, leave, validTable, MAX } from "./helpers.js";

const OPTIONS = "options must be an object";
const TABLE = "table must be an object";
const DAMAGE = "damageMultiplier must be an integer greater than or equal to 0";
const HEALING = "healingMultiplier must be an integer greater than or equal to 0";
const DECAY = "decay must be an integer greater than or equal to 0";
const SWITCH = "switchPercent must be an integer greater than or equal to 0";
const TIME = "time must be an integer greater than or equal to 0";
const TARGET = "target must be an entry id or null";
const ENTRIES = "entries must be an array";
const ENTRY = "entry must be an object";
const ENTRY_ID = "entry id must be a non-empty string";
const UNIQUE = "entry ids must be unique";
const THREAT = "threat must be an integer greater than or equal to 1";
const ADDED_AT = "addedAt must be an integer greater than or equal to 0";
const ADDED_AT_ORDER = "addedAt must be less than or equal to time";
const ACTIONS = "actions must be an array";
const ACTION = "action must be an object";
const TYPE = "action type must be advance, damage, healing, or leave";
const ELAPSED = "elapsed must be an integer greater than or equal to 0";
const ACTION_ID = "action id must be a non-empty string";
const AMOUNT = "amount must be an integer greater than or equal to 0";
const GAIN = "threat gain must be a safe integer";
const SUM = "threat must be a safe integer";
const DECAY_AMOUNT = "decay amount must be a safe integer";
const ADVANCED = "advanced time must be a safe integer";

function rejects(fn, name, message) {
  assert.throws(fn, { name, message });
}

test("createTable rejects a bad options object before it reads fields", () => {
  rejects(() => createTable(), "TypeError", OPTIONS);
  for (const options of [undefined, null, [], "table", 1, true, false, () => {}]) {
    rejects(() => createTable(options), "TypeError", OPTIONS);
  }
});

test("createTable reads damageMultiplier, healingMultiplier, decay, then switchPercent", () => {
  rejects(
    () =>
      createTable({
        damageMultiplier: -1,
        healingMultiplier: -1,
        decay: -1,
        switchPercent: -1
      }),
    "RangeError",
    DAMAGE
  );
  rejects(
    () => createTable({ healingMultiplier: -1, decay: -1, switchPercent: -1 }),
    "RangeError",
    HEALING
  );
  rejects(() => createTable({ decay: -1, switchPercent: -1 }), "RangeError", DECAY);
  rejects(() => createTable({ switchPercent: -1 }), "RangeError", SWITCH);
  rejects(() => createTable({ switchPercent: MAX - 99 }), "RangeError", SWITCH);
  assert.equal(createTable({ switchPercent: MAX - 100 }).switchPercent, MAX - 100);
});

test("createTable multipliers, decay, and switch percent are own safe integers", () => {
  for (const damageMultiplier of [
    null,
    true,
    "1",
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAX + 1
  ]) {
    rejects(() => createTable({ damageMultiplier }), "RangeError", DAMAGE);
  }
  for (const healingMultiplier of [null, "0", -1, 0.5, Number.NaN]) {
    rejects(() => createTable({ healingMultiplier }), "RangeError", HEALING);
  }
  for (const decay of [null, -1, 1.5, "0", Number.NaN, MAX + 1]) {
    rejects(() => createTable({ decay }), "RangeError", DECAY);
  }
  for (const switchPercent of [null, -1, 1.5, "0", Number.NaN, MAX - 99, MAX + 1]) {
    rejects(() => createTable({ switchPercent }), "RangeError", SWITCH);
  }
  const table = createTable({
    damageMultiplier: 0,
    healingMultiplier: 0,
    decay: MAX,
    switchPercent: 0
  });
  assert.equal(table.damageMultiplier, 0);
  assert.equal(table.healingMultiplier, 0);
  assert.equal(table.decay, MAX);
});

test("applyThreat rejects a bad table before it reads actions", () => {
  rejects(() => applyThreat(), "TypeError", TABLE);
  let reads = 0;
  const actions = {};
  Object.defineProperty(actions, "length", {
    get() {
      reads += 1;
      return 0;
    }
  });
  for (const table of [undefined, null, [], "table", 1, true, false, () => {}]) {
    rejects(() => applyThreat(table, actions), "TypeError", TABLE);
  }
  assert.equal(reads, 0);
});

test("applyThreat reads time, multipliers, decay, switch percent, target, entries, then actions", () => {
  rejects(() => applyThreat({}, []), "RangeError", TIME);
  rejects(
    () =>
      applyThreat(
        {
          damageMultiplier: -1,
          healingMultiplier: -1,
          decay: -1,
          switchPercent: -1,
          target: 1,
          entries: null
        },
        null
      ),
    "RangeError",
    TIME
  );
  rejects(
    () =>
      applyThreat(validTable({ time: -1, damageMultiplier: -1, target: 1, entries: null }), null),
    "RangeError",
    TIME
  );
  rejects(
    () => applyThreat(validTable({ damageMultiplier: -1, healingMultiplier: -1, target: 1 }), []),
    "RangeError",
    DAMAGE
  );
  rejects(
    () => applyThreat(validTable({ healingMultiplier: -1, decay: -1, target: "" }), []),
    "RangeError",
    HEALING
  );
  rejects(
    () => applyThreat(validTable({ decay: -1, switchPercent: -1, target: 1 }), []),
    "RangeError",
    DECAY
  );
  rejects(
    () => applyThreat(validTable({ switchPercent: MAX - 99, target: 1, entries: null }), []),
    "RangeError",
    SWITCH
  );
  rejects(
    () => applyThreat(validTable({ target: 1, entries: [{ id: "" }] }), []),
    "TypeError",
    TARGET
  );
  rejects(() => applyThreat(validTable({ target: "", entries: null }), []), "TypeError", TARGET);
  rejects(
    () => applyThreat(validTable({ entries: null }), [{ type: "nope" }]),
    "TypeError",
    ENTRIES
  );
  rejects(
    () =>
      applyThreat(
        validTable({
          target: "missing",
          entries: [{ id: "", threat: 1, addedAt: 0 }]
        }),
        [{ type: "nope" }]
      ),
    "TypeError",
    ENTRY_ID
  );
  rejects(
    () => applyThreat(validTable({ target: "missing", entries: [] }), [{ type: "nope" }]),
    "TypeError",
    TARGET
  );
  rejects(() => applyThreat(validTable(), null), "TypeError", ACTIONS);
  rejects(
    () => applyThreat(validTable(), { type: "damage", id: "a", amount: 1 }),
    "TypeError",
    ACTIONS
  );
});

test("table numbers are own safe integers and the target must name an entry", () => {
  const badNumbers = [
    undefined,
    null,
    true,
    "0",
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAX + 1
  ];
  for (const time of badNumbers) {
    rejects(() => applyThreat(validTable({ time }), []), "RangeError", TIME);
  }
  for (const damageMultiplier of badNumbers) {
    rejects(() => applyThreat(validTable({ damageMultiplier }), []), "RangeError", DAMAGE);
  }
  for (const healingMultiplier of [null, -1, 0.5, "1"]) {
    rejects(() => applyThreat(validTable({ healingMultiplier }), []), "RangeError", HEALING);
  }
  for (const decay of [null, -1, 1.5, Number.NaN]) {
    rejects(() => applyThreat(validTable({ decay }), []), "RangeError", DECAY);
  }
  for (const switchPercent of [undefined, null, -1, 0.5, MAX - 99, MAX + 1]) {
    rejects(() => applyThreat(validTable({ switchPercent }), []), "RangeError", SWITCH);
  }
  const inherited = Object.create({
    time: 0,
    damageMultiplier: 1,
    healingMultiplier: 1,
    decay: 0,
    switchPercent: 0,
    target: null,
    entries: []
  });
  rejects(() => applyThreat(inherited, []), "RangeError", TIME);
  assert.equal(
    Object.is(applyThreat(validTable({ time: -0, decay: -0, switchPercent: -0 }), []).time, 0),
    true
  );
  assert.equal(
    applyThreat(validTable({ time: MAX, damageMultiplier: 0, switchPercent: MAX - 100 }), []).time,
    MAX
  );
  for (const target of [undefined, 1, true, "", "missing"]) {
    rejects(() => applyThreat(validTable({ target }), []), "TypeError", TARGET);
  }
  const named = applyThreat(
    validTable({ target: "warrior", entries: [entry("warrior", 1.0, -0)] }),
    []
  );
  assert.equal(named.target, "warrior");
  assert.equal(named.entries[0].threat, 1);
  assert.equal(Object.is(named.entries[0].addedAt, 0), true);
  const bare = Object.create(null);
  bare.time = 0;
  bare.damageMultiplier = 1;
  bare.healingMultiplier = 1;
  bare.decay = 0;
  bare.switchPercent = 0;
  bare.target = null;
  bare.entries = [];
  assert.equal(applyThreat(bare, []).target, null);
});

test("entries are objects with unique ids, positive threat, and addedAt at or before time", () => {
  rejects(() => applyThreat(validTable({ entries: {} }), []), "TypeError", ENTRIES);
  rejects(() => applyThreat(validTable({ entries: [null] }), []), "TypeError", ENTRY);
  rejects(() => applyThreat(validTable({ entries: [[]] }), []), "TypeError", ENTRY);
  const hole = [];
  hole[1] = entry("a", 1, 0);
  rejects(() => applyThreat(validTable({ entries: hole }), []), "TypeError", ENTRY);
  rejects(() => applyThreat(validTable({ entries: [{}] }), []), "TypeError", ENTRY_ID);
  rejects(
    () => applyThreat(validTable({ entries: [{ id: "", threat: 1, addedAt: 0 }] }), []),
    "TypeError",
    ENTRY_ID
  );
  rejects(
    () => applyThreat(validTable({ entries: [{ id: 1, threat: 1, addedAt: 0 }] }), []),
    "TypeError",
    ENTRY_ID
  );
  rejects(
    () =>
      applyThreat(
        validTable({
          entries: [entry("a", 1, 0), { id: "a", threat: -1, addedAt: -1 }]
        }),
        []
      ),
    "TypeError",
    UNIQUE
  );
  rejects(
    () =>
      applyThreat(
        validTable({
          entries: [entry("__proto__", 1, 0), entry("__proto__", 2, 0)]
        }),
        []
      ),
    "TypeError",
    UNIQUE
  );
  rejects(
    () =>
      applyThreat(
        validTable({
          entries: [
            { id: "a", threat: 0, addedAt: 0 },
            { id: "a", threat: 1, addedAt: 0 }
          ]
        }),
        []
      ),
    "RangeError",
    THREAT
  );
  rejects(
    () => applyThreat(validTable({ entries: [{ id: "a", addedAt: -1 }] }), []),
    "RangeError",
    THREAT
  );
  for (const threat of [undefined, null, 0, -1, 1.5, "1", Number.NaN, MAX + 1]) {
    rejects(
      () => applyThreat(validTable({ entries: [{ id: "a", threat, addedAt: 0 }] }), []),
      "RangeError",
      THREAT
    );
  }
  rejects(
    () => applyThreat(validTable({ entries: [{ id: "a", threat: 1.5, addedAt: -1 }] }), []),
    "RangeError",
    THREAT
  );
  rejects(
    () => applyThreat(validTable({ entries: [{ id: "a", threat: 1 }] }), []),
    "RangeError",
    ADDED_AT
  );
  for (const addedAt of [null, -1, 0.5, "0", Number.NaN, MAX + 1]) {
    rejects(
      () => applyThreat(validTable({ entries: [{ id: "a", threat: 1, addedAt }] }), []),
      "RangeError",
      ADDED_AT
    );
  }
  rejects(
    () => applyThreat(validTable({ time: 4, entries: [entry("a", 1, 5)] }), []),
    "RangeError",
    ADDED_AT_ORDER
  );
  rejects(
    () =>
      applyThreat(
        validTable({
          time: 0,
          entries: [{ id: "a", threat: 0, addedAt: 5 }]
        }),
        []
      ),
    "RangeError",
    THREAT
  );
  const edge = applyThreat(validTable({ time: 4, target: "a", entries: [entry("a", MAX, 4)] }), []);
  assert.equal(edge.entries[0].threat, MAX);
  assert.equal(edge.entries[0].addedAt, 4);
  let reads = 0;
  const row = entry("a", 2, 0);
  Object.defineProperty(row, "note", {
    get() {
      reads += 1;
      return 1;
    }
  });
  applyThreat(validTable({ target: "a", entries: [row] }), []);
  assert.equal(reads, 0);
});

test("actions are validated in order before any threat is changed", () => {
  rejects(() => applyThreat(validTable(), undefined), "TypeError", ACTIONS);
  rejects(() => applyThreat(validTable(), [null]), "TypeError", ACTION);
  rejects(() => applyThreat(validTable(), [[]]), "TypeError", ACTION);
  const actions = [damage("a", 1)];
  actions[2] = advance(1);
  rejects(() => applyThreat(validTable(), actions), "TypeError", ACTION);
  rejects(() => applyThreat(validTable(), [{ elapsed: -1 }]), "TypeError", TYPE);
  rejects(
    () => applyThreat(validTable(), [{ type: "Damage", id: "a", amount: 1 }]),
    "TypeError",
    TYPE
  );
  rejects(
    () => applyThreat(validTable(), [{ type: "heal", id: "a", amount: 1 }]),
    "TypeError",
    TYPE
  );
  rejects(() => applyThreat(validTable(), [{ type: "", elapsed: 1 }]), "TypeError", TYPE);
  const inherited = Object.create({ type: "damage" });
  inherited.id = "a";
  inherited.amount = 1;
  rejects(() => applyThreat(validTable(), [inherited]), "TypeError", TYPE);
  rejects(
    () => applyThreat(validTable(), [advance(-1), { type: "damage", id: "", amount: -1 }]),
    "RangeError",
    ELAPSED
  );
  rejects(
    () => applyThreat(validTable(), [{ type: "damage", amount: -1 }, advance(-1)]),
    "TypeError",
    ACTION_ID
  );
  rejects(() => applyThreat(validTable(), [damage("a", -1), advance(-1)]), "RangeError", AMOUNT);
  rejects(() => applyThreat(validTable(), [{ type: "healing", id: "a" }]), "RangeError", AMOUNT);
  rejects(() => applyThreat(validTable(), [{ type: "advance" }]), "RangeError", ELAPSED);
  rejects(() => applyThreat(validTable(), [leave("")]), "TypeError", ACTION_ID);
  for (const elapsed of [null, -1, 1.5, "0", Number.NaN, Number.POSITIVE_INFINITY, MAX + 1]) {
    rejects(() => applyThreat(validTable(), [{ type: "advance", elapsed }]), "RangeError", ELAPSED);
  }
  for (const amount of [undefined, null, -1, 0.5, "1", Number.NaN, MAX + 1]) {
    rejects(
      () => applyThreat(validTable(), [{ type: "healing", id: "a", amount }]),
      "RangeError",
      AMOUNT
    );
  }
  for (const id of [undefined, null, "", 1, true]) {
    rejects(() => applyThreat(validTable(), [{ type: "leave", id }]), "TypeError", ACTION_ID);
    rejects(
      () => applyThreat(validTable(), [{ type: "damage", id, amount: 1 }]),
      "TypeError",
      ACTION_ID
    );
  }
  let amountReads = 0;
  const skipped = { type: "leave", id: "a" };
  Object.defineProperty(skipped, "amount", {
    get() {
      amountReads += 1;
      return -1;
    }
  });
  const left = applyThreat(createTable({}), [damage("a", 2), skipped]);
  assert.equal(amountReads, 0);
  assert.equal(left.target, null);
  assert.equal(left.entries.length, 0);

  const crowded = validTable({
    time: MAX,
    decay: MAX,
    target: "warrior",
    entries: [entry("warrior", 5, 0)]
  });
  rejects(
    () => applyThreat(crowded, [{ type: "advance", elapsed: 2 }, { type: "nope" }]),
    "TypeError",
    TYPE
  );
  assert.equal(crowded.entries[0].threat, 5);
  assert.equal(crowded.time, MAX);
  rejects(() => applyThreat(crowded, [advance(2)]), "RangeError", DECAY_AMOUNT);
  assert.equal(crowded.entries[0].threat, 5);

  const late = validTable({ time: MAX, decay: 0 });
  rejects(() => applyThreat(late, [advance(1)]), "RangeError", ADVANCED);
  assert.equal(late.time, MAX);

  rejects(
    () => applyThreat(validTable({ damageMultiplier: MAX }), [damage("a", 2)]),
    "RangeError",
    GAIN
  );
  rejects(
    () => applyThreat(validTable({ healingMultiplier: MAX }), [healing("a", 2)]),
    "RangeError",
    GAIN
  );
  const full = validTable({
    target: "warrior",
    entries: [entry("warrior", MAX, 0)]
  });
  rejects(() => applyThreat(full, [damage("warrior", 1)]), "RangeError", SUM);
  rejects(() => applyThreat(full, [healing("warrior", 1)]), "RangeError", SUM);
  assert.equal(full.entries[0].threat, MAX);
  assert.equal(full.entries.length, 1);

  const zeroDecay = applyThreat(validTable({ time: 1, decay: MAX }), [advance(0)]);
  assert.equal(zeroDecay.time, 1);
  const room = applyThreat(validTable({ time: MAX - 1, decay: 0 }), [advance(1)]);
  assert.equal(room.time, MAX);
  const capped = applyThreat(
    validTable({ target: "warrior", entries: [entry("warrior", MAX - 1, 0)] }),
    [damage("warrior", 1)]
  );
  assert.equal(capped.entries[0].threat, MAX);
});
