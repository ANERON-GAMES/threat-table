import assert from "node:assert/strict";
import test from "node:test";
import { applyThreat, createTable } from "../src/index.js";
import { advance, damage, entry, validTable, MAX } from "./helpers.js";

test("the first positive gain becomes the target at any switch percent", () => {
  const table = applyThreat(createTable({ switchPercent: 5000 }), [damage("mage", 1)]);
  assert.equal(table.target, "mage");
  assert.equal(table.entries[0].threat, 1);
});

test("one hundred percent requires more than double the current threat", () => {
  const held = applyThreat(createTable({ switchPercent: 100 }), [
    damage("warrior", 10),
    damage("rogue", 20)
  ]);
  assert.equal(held.target, "warrior");
  const pulled = applyThreat(held, [damage("rogue", 1)]);
  assert.equal(pulled.target, "rogue");
  assert.equal(pulled.entries[0].threat, 21);
});

test("a threat of two pulls a threat of one at ten percent, and one does not", () => {
  const held = applyThreat(createTable({ switchPercent: 10 }), [
    damage("warrior", 1),
    damage("rogue", 1)
  ]);
  assert.equal(held.target, "warrior");
  const pulled = applyThreat(held, [damage("rogue", 1)]);
  assert.equal(pulled.target, "rogue");
  assert.equal(pulled.entries[0].threat, 2);
});

test("several rows can cross one decay, and the best row takes the seat", () => {
  const table = applyThreat(createTable({ decay: 50, switchPercent: 20 }), [
    damage("warrior", 200),
    damage("zed", 240),
    damage("aria", 240),
    advance(1)
  ]);
  assert.equal(table.target, "aria");
  assert.equal(table.time, 1);
  assert.deepEqual(
    table.entries.map((item) => [item.id, item.threat, item.addedAt]),
    [
      ["aria", 190, 0],
      ["zed", 190, 0],
      ["warrior", 150, 0]
    ]
  );
});

test("challenger rank is threat, then earlier addedAt, then id", () => {
  const byThreat = applyThreat(
    validTable({
      time: 5,
      switchPercent: 10,
      target: "warrior",
      entries: [entry("warrior", 100, 0), entry("mage", 140, 0), entry("rogue", 150, 5)]
    }),
    []
  );
  assert.equal(byThreat.target, "rogue");
  assert.deepEqual(
    byThreat.entries.map((item) => item.id),
    ["rogue", "mage", "warrior"]
  );

  const byTime = applyThreat(
    validTable({
      time: 4,
      switchPercent: 10,
      target: "warrior",
      entries: [entry("warrior", 100, 0), entry("aria", 150, 4), entry("zed", 150, 1)]
    }),
    []
  );
  assert.equal(byTime.target, "zed");

  const byId = applyThreat(
    validTable({
      time: 1,
      switchPercent: 10,
      target: "warrior",
      entries: [entry("warrior", 100, 0), entry("zed", 150, 1), entry("aria", 150, 1)]
    }),
    []
  );
  assert.equal(byId.target, "aria");

  const vacant = applyThreat(
    validTable({
      time: 4,
      target: null,
      entries: [entry("aria", 10, 4), entry("zed", 10, 1)]
    }),
    []
  );
  assert.equal(vacant.target, "zed");
  assert.equal(vacant.entries[0].id, "zed");
});

test("a tied product does not switch, including when number multiplication cannot see the next point", () => {
  const current = 9007199254740957;
  assert.equal(BigInt(current + 1) * 100n > BigInt(current) * 100n, true);
  assert.equal((current + 1) * 100 > current * 100, false);
  const held = applyThreat(createTable({}), [damage("warrior", current), damage("rogue", current)]);
  assert.equal(held.target, "warrior");
  assert.equal(held.entries[0].threat, current);
  const pulled = applyThreat(held, [damage("rogue", 1)]);
  assert.equal(pulled.target, "rogue");
  assert.equal(pulled.entries[0].id, "rogue");
  assert.equal(pulled.entries[0].threat, current + 1);
  assert.equal(pulled.entries[1].threat, current);
});

test("the largest switch percent still uses an exact margin", () => {
  const switchPercent = MAX - 100;
  const below = 90071992547409;
  const above = 90071992547410;
  assert.equal(BigInt(below) * 100n > BigInt(MAX), false);
  assert.equal(BigInt(above) * 100n > BigInt(MAX), true);
  const table = createTable({ switchPercent });
  assert.equal(table.switchPercent, switchPercent);
  const quiet = applyThreat(table, [damage("warrior", 1), damage("rogue", below)]);
  assert.equal(quiet.target, "warrior");
  assert.equal(quiet.entries[0].id, "rogue");
  assert.equal(quiet.entries[0].threat, below);
  const loud = applyThreat(table, [damage("warrior", 1), damage("rogue", above)]);
  assert.equal(loud.target, "rogue");
  assert.equal(loud.entries[0].threat, above);
});
