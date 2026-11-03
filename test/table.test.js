import assert from "node:assert/strict";
import test from "node:test";
import { applyThreat, createTable } from "../src/index.js";
import { advance, damage, entry, healing, leave, validTable } from "./helpers.js";

const fightConfig = {
  damageMultiplier: 2,
  healingMultiplier: 1,
  decay: 5,
  switchPercent: 10
};

const fightActions = [
  damage("warrior", 40),
  damage("rogue", 30),
  healing("cleric", 50),
  advance(4),
  damage("rogue", 20),
  leave("warrior")
];

function keys(value) {
  return Object.keys(value);
}

test("createTable starts an empty table at time zero", () => {
  const table = createTable({});
  assert.deepEqual(keys(table), [
    "time",
    "damageMultiplier",
    "healingMultiplier",
    "decay",
    "switchPercent",
    "target",
    "entries"
  ]);
  assert.equal(table.time, 0);
  assert.equal(table.damageMultiplier, 1);
  assert.equal(table.healingMultiplier, 1);
  assert.equal(table.decay, 0);
  assert.equal(table.switchPercent, 0);
  assert.equal(table.target, null);
  assert.deepEqual(table.entries, []);
  assert.equal(Object.isFrozen(table), true);
  assert.equal(Object.isFrozen(table.entries), true);
  assert.equal(Object.getPrototypeOf(table), Object.prototype);
  assert.equal(Array.isArray(table.entries), true);
});

test("omitted and undefined options use defaults, and negative zero is stored as zero", () => {
  const table = createTable({
    damageMultiplier: undefined,
    healingMultiplier: -0,
    decay: -0,
    switchPercent: -0
  });
  assert.equal(table.damageMultiplier, 1);
  assert.equal(Object.is(table.healingMultiplier, 0), true);
  assert.equal(Object.is(table.decay, 0), true);
  assert.equal(Object.is(table.switchPercent, 0), true);
  assert.equal(createTable({ damageMultiplier: 1.0, healingMultiplier: 2.0, decay: 0.0 }).decay, 0);
  const inherited = Object.create({ damageMultiplier: 4, decay: 9, switchPercent: 3 });
  const plain = createTable(inherited);
  assert.equal(plain.damageMultiplier, 1);
  assert.equal(plain.decay, 0);
  assert.equal(plain.switchPercent, 0);
  const bare = Object.create(null);
  bare.damageMultiplier = 3;
  assert.equal(createTable(bare).damageMultiplier, 3);
  let reads = 0;
  const options = { decay: 2 };
  Object.defineProperty(options, "note", {
    get() {
      reads += 1;
      return 1;
    }
  });
  const hidden = createTable(options);
  assert.equal(reads, 0);
  assert.equal(hidden.decay, 2);
  assert.equal(Object.hasOwn(hidden, "note"), false);
});

test("the documented fight applies multipliers, decay, healing, and leave", () => {
  const table = createTable(fightConfig);
  assert.equal(table.target, null);
  assert.equal(table.time, 0);
  assert.equal(table.entries.length, 0);

  const openedFight = applyThreat(table, fightActions.slice(0, 3));
  assert.equal(openedFight.target, "warrior");
  assert.equal(openedFight.time, 0);
  assert.equal(openedFight.entries[0].id, "warrior");
  assert.equal(openedFight.entries[0].threat, 80);
  assert.equal(openedFight.entries[0].addedAt, 0);
  assert.equal(openedFight.entries[1].id, "rogue");
  assert.equal(openedFight.entries[1].threat, 60);
  assert.equal(openedFight.entries[2].id, "cleric");
  assert.equal(openedFight.entries[2].threat, 50);

  const decayed = applyThreat(openedFight, [fightActions[3]]);
  assert.equal(decayed.time, 4);
  assert.equal(decayed.target, "warrior");
  assert.equal(decayed.entries[0].threat, 60);
  assert.equal(decayed.entries[1].threat, 40);
  assert.equal(decayed.entries[2].threat, 30);

  const fought = applyThreat(decayed, fightActions.slice(4));
  assert.equal(fought.target, "rogue");
  assert.equal(fought.time, 4);
  assert.equal(fought.entries.length, 2);
  assert.equal(fought.entries[0].id, "rogue");
  assert.equal(fought.entries[0].threat, 80);
  assert.equal(fought.entries[0].addedAt, 0);
  assert.equal(fought.entries[1].id, "cleric");
  assert.equal(fought.entries[1].threat, 30);
  assert.equal(fought.entries[1].addedAt, 0);
  assert.equal(fought.damageMultiplier, 2);
  assert.equal(fought.healingMultiplier, 1);
  assert.equal(fought.decay, 5);
  assert.equal(fought.switchPercent, 10);

  const oneShot = applyThreat(table, fightActions);
  assert.deepEqual(oneShot, fought);
  assert.notEqual(oneShot, fought);
  assert.notEqual(oneShot.entries, fought.entries);
  assert.notEqual(oneShot.entries[0], fought.entries[0]);

  let stepped = table;
  for (const action of fightActions) {
    stepped = applyThreat(stepped, [action]);
  }
  assert.deepEqual(stepped, fought);

  const actions = fightActions.map((action) => ({ ...action }));
  const replay = applyThreat(table, actions);
  assert.equal(actions[0].amount, 40);
  assert.equal(table.target, null);
  assert.equal(table.entries.length, 0);
  actions[0].amount = 1;
  assert.equal(replay.entries[0].threat, 80);
  assert.equal(replay.target, "rogue");
});

test("a boundary of ten percent keeps the current target until threat is strictly over it", () => {
  const held = applyThreat(createTable({ switchPercent: 10 }), [
    damage("warrior", 100),
    damage("rogue", 110)
  ]);
  assert.equal(held.target, "warrior");
  assert.equal(held.entries[0].id, "rogue");
  assert.equal(held.entries[0].threat, 110);
  assert.equal(held.entries[1].id, "warrior");
  assert.equal(held.entries[1].threat, 100);
  const stayed = applyThreat(held, []);
  assert.deepEqual(stayed, held);
  assert.notEqual(stayed.entries[0], held.entries[0]);
  const pulled = applyThreat(held, [damage("rogue", 1)]);
  assert.equal(pulled.target, "rogue");
  assert.equal(pulled.entries[0].threat, 111);
  assert.equal(pulled.entries[1].id, "warrior");
  assert.equal(pulled.entries[1].threat, 100);
});

test("equal threat does not unseat the current target, and an open seat uses id order", () => {
  const sticky = applyThreat(createTable({}), [damage("zed", 10), damage("aria", 10)]);
  assert.equal(sticky.target, "zed");
  assert.equal(sticky.entries[0].id, "aria");
  assert.equal(sticky.entries[0].threat, 10);
  assert.equal(sticky.entries[1].id, "zed");
  assert.equal(sticky.entries[1].threat, 10);

  const settled = applyThreat(createTable({}), [
    damage("bryn", 100),
    damage("corin", 100),
    damage("aria", 100),
    leave("bryn")
  ]);
  assert.equal(settled.target, "aria");
  assert.equal(settled.entries[0].id, "aria");
  assert.equal(settled.entries[0].threat, 100);
  assert.equal(settled.entries[1].id, "corin");
  assert.equal(settled.entries[1].threat, 100);
  assert.equal(settled.time, 0);
});

test("an open seat prefers the earlier row, then the earlier id", () => {
  const vacated = applyThreat(createTable({ switchPercent: 100 }), [
    damage("mage", 50),
    damage("zed", 10),
    advance(2),
    damage("aria", 10),
    leave("mage")
  ]);
  assert.equal(vacated.target, "zed");
  assert.equal(vacated.time, 2);
  assert.equal(vacated.entries[0].id, "zed");
  assert.equal(vacated.entries[0].addedAt, 0);
  assert.equal(vacated.entries[0].threat, 10);
  assert.equal(vacated.entries[1].id, "aria");
  assert.equal(vacated.entries[1].addedAt, 2);
  assert.equal(vacated.entries[1].threat, 10);
});

test("decay drops rows that hit zero and can clear the table", () => {
  const faded = applyThreat(createTable({ decay: 3 }), [
    damage("warrior", 10),
    damage("rogue", 4),
    advance(2)
  ]);
  assert.equal(faded.target, "warrior");
  assert.equal(faded.time, 2);
  assert.equal(faded.entries.length, 1);
  assert.equal(faded.entries[0].id, "warrior");
  assert.equal(faded.entries[0].threat, 4);
  const exact = applyThreat(createTable({ decay: 3 }), [damage("warrior", 6), advance(2)]);
  assert.equal(exact.target, null);
  assert.deepEqual(exact.entries, []);
  assert.equal(exact.time, 2);
  const gone = applyThreat(faded, [advance(2)]);
  assert.equal(gone.target, null);
  assert.equal(gone.time, 4);
  assert.equal(gone.entries.length, 0);
  assert.equal(gone.decay, 3);
});

test("equal decay can cross a percentage margin", () => {
  const slid = applyThreat(createTable({ decay: 10, switchPercent: 10 }), [
    damage("warrior", 100),
    damage("rogue", 110),
    advance(1)
  ]);
  assert.equal(slid.target, "rogue");
  assert.equal(slid.time, 1);
  assert.equal(slid.entries[0].id, "rogue");
  assert.equal(slid.entries[0].threat, 100);
  assert.equal(slid.entries[1].id, "warrior");
  assert.equal(slid.entries[1].threat, 90);
});

test("action order chooses the incumbent for the next comparison", () => {
  const base = applyThreat(createTable({ switchPercent: 10 }), [
    damage("warrior", 100),
    damage("rogue", 50)
  ]);
  assert.equal(base.target, "warrior");
  const surged = applyThreat(base, [damage("rogue", 1000)]);
  assert.equal(surged.target, "rogue");
  assert.equal(surged.entries[0].id, "rogue");
  assert.equal(surged.entries[0].threat, 1050);
  const traded = applyThreat(surged, [damage("warrior", 5000)]);
  assert.equal(traded.target, "warrior");
  assert.equal(traded.entries[0].id, "warrior");
  assert.equal(traded.entries[0].threat, 5100);
  assert.equal(traded.entries[1].id, "rogue");
  assert.equal(traded.entries[1].threat, 1050);
  const kept = applyThreat(base, [damage("warrior", 5000), damage("rogue", 1000)]);
  assert.equal(kept.target, "warrior");
  assert.equal(kept.entries[0].threat, 5100);
  assert.equal(kept.entries[1].id, "rogue");
  assert.equal(kept.entries[1].threat, 1050);
  let current = base;
  const seen = [];
  for (const action of [damage("warrior", 5000), damage("rogue", 1000)]) {
    current = applyThreat(current, [action]);
    seen.push(current.target);
  }
  assert.deepEqual(seen, ["warrior", "warrior"]);
});

test("a hand-built table is normalized without changing the input", () => {
  const messy = {
    time: 0,
    damageMultiplier: 1,
    healingMultiplier: 1,
    decay: 0,
    switchPercent: 10,
    target: "warrior",
    entries: [
      { id: "warrior", threat: 100, addedAt: 0 },
      { id: "rogue", threat: 200, addedAt: 0 }
    ]
  };
  const neat = applyThreat(messy, []);
  assert.equal(neat.target, "rogue");
  assert.equal(neat.entries[0].id, "rogue");
  assert.equal(neat.entries[0].threat, 200);
  assert.equal(neat.entries[1].id, "warrior");
  assert.equal(messy.target, "warrior");
  assert.equal(messy.entries[0].id, "warrior");
  assert.equal(messy.entries[0].threat, 100);
  assert.equal(messy.entries.length, 2);

  const open = applyThreat(
    {
      time: 3,
      damageMultiplier: 1,
      healingMultiplier: 1,
      decay: 0,
      switchPercent: 10,
      target: null,
      entries: [
        { id: "zed", threat: 8, addedAt: 3 },
        { id: "aria", threat: 8, addedAt: 1 }
      ]
    },
    []
  );
  assert.equal(open.target, "aria");
  assert.equal(open.entries[0].id, "aria");
  assert.equal(open.entries[0].addedAt, 1);
  assert.equal(open.entries[0].threat, 8);
  assert.equal(open.entries[1].id, "zed");
  assert.equal(open.time, 3);
});

test("gains, zeros, rejoins, and absent leaves follow the row rules", () => {
  const scaled = applyThreat(createTable({ damageMultiplier: 5, healingMultiplier: 2 }), [
    damage("cleric", 4),
    healing("cleric", 4),
    healing("rogue", 3)
  ]);
  assert.equal(scaled.target, "cleric");
  assert.equal(scaled.entries[0].id, "cleric");
  assert.equal(scaled.entries[0].threat, 28);
  assert.equal(scaled.entries[1].id, "rogue");
  assert.equal(scaled.entries[1].threat, 6);

  const silent = applyThreat(createTable({ damageMultiplier: 0, healingMultiplier: 0 }), [
    damage("warrior", 40),
    healing("cleric", 50)
  ]);
  assert.equal(silent.target, null);
  assert.deepEqual(silent.entries, []);

  const row = applyThreat(createTable({}), [damage("warrior", 5)]);
  const same = applyThreat(row, [damage("warrior", 0), healing("warrior", 0), healing("rogue", 0)]);
  assert.equal(same.entries.length, 1);
  assert.equal(same.entries[0].threat, 5);
  assert.equal(same.entries[0].addedAt, 0);
  assert.equal(same.target, "warrior");

  const rejoined = applyThreat(createTable({}), [
    damage("warrior", 50),
    advance(4),
    leave("warrior"),
    damage("warrior", 10)
  ]);
  assert.equal(rejoined.time, 4);
  assert.equal(rejoined.target, "warrior");
  assert.equal(rejoined.entries.length, 1);
  assert.equal(rejoined.entries[0].threat, 10);
  assert.equal(rejoined.entries[0].addedAt, 4);

  const parked = applyThreat(createTable({ decay: 9 }), [damage("warrior", 4)]);
  const still = applyThreat(parked, [advance(0), leave("rogue")]);
  assert.equal(still.time, 0);
  assert.equal(still.entries[0].threat, 4);
  assert.equal(still.target, "warrior");
  assert.deepEqual(still, applyThreat(parked, [advance(-0)]));

  const joined = applyThreat(createTable({}), [advance(5), damage("aria", 1)]);
  assert.equal(joined.time, 5);
  assert.equal(joined.entries[0].addedAt, 5);
  assert.equal(joined.entries[0].threat, 1);
  assert.equal(joined.target, "aria");
});

test("ids keep their characters, including prototype names, case, and spaces", () => {
  const table = applyThreat(createTable({}), [
    damage("__proto__", 2),
    damage("constructor", 2),
    damage(" ", 1)
  ]);
  assert.equal(table.target, "__proto__");
  assert.deepEqual(
    table.entries.map((item) => [item.id, item.threat]),
    [
      ["__proto__", 2],
      ["constructor", 2],
      [" ", 1]
    ]
  );
  assert.equal(Object.prototype.threat, undefined);
  const letters = applyThreat(createTable({}), [damage("aria", 5), damage("Aria", 5)]);
  assert.equal(letters.target, "aria");
  assert.deepEqual(
    letters.entries.map((item) => item.id),
    ["Aria", "aria"]
  );
});

test("results are frozen, sorted, and independent of input order and identity", () => {
  const fought = applyThreat(createTable(fightConfig), fightActions);
  assert.equal(Object.isFrozen(fought), true);
  assert.equal(Object.isFrozen(fought.entries), true);
  assert.equal(Object.isFrozen(fought.entries[0]), true);
  assert.throws(() => {
    fought.time = 1;
  }, TypeError);
  assert.throws(() => {
    fought.entries.push(entry("x", 1, 0));
  }, TypeError);
  assert.throws(() => {
    fought.entries[0].threat = 1;
  }, TypeError);

  const again = applyThreat(createTable(fightConfig), fightActions);
  assert.deepEqual(again, fought);
  assert.notEqual(again, fought);

  const row = { id: "warrior", threat: 5, addedAt: 0, note: "keep" };
  const source = validTable({ target: "warrior", entries: [row] });
  const copied = applyThreat(source, []);
  row.threat = 9;
  source.entries.push(entry("rogue", 9, 0));
  assert.equal(copied.entries[0].threat, 5);
  assert.equal(copied.entries.length, 1);
  assert.equal(Object.hasOwn(copied.entries[0], "note"), false);
  assert.notEqual(copied.entries[0], row);
  assert.deepEqual(keys(copied.entries[0]), ["id", "threat", "addedAt"]);

  const first = applyThreat(
    validTable({
      time: 1,
      target: "warrior",
      switchPercent: 10,
      entries: [entry("rogue", 105, 1), entry("warrior", 100, 0), entry("mage", 40, 0)]
    }),
    []
  );
  const second = applyThreat(
    validTable({
      time: 1,
      target: "warrior",
      switchPercent: 10,
      entries: [entry("mage", 40, 0), entry("warrior", 100, 0), entry("rogue", 105, 1)]
    }),
    []
  );
  assert.deepEqual(first, second);
  assert.equal(first.target, "warrior");
  assert.deepEqual(
    first.entries.map((item) => item.id),
    ["rogue", "warrior", "mage"]
  );
});

test("the current target can fall to zero while a lower row remains", () => {
  const table = applyThreat(createTable({ decay: 6, switchPercent: 100 }), [
    damage("warrior", 6),
    damage("aria", 8),
    damage("zed", 7),
    advance(1)
  ]);
  assert.equal(table.time, 1);
  assert.equal(table.target, "aria");
  assert.deepEqual(
    table.entries.map((item) => [item.id, item.threat]),
    [
      ["aria", 2],
      ["zed", 1]
    ]
  );
});
