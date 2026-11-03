import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { applyThreat, createTable } from "../src/index.js";
import * as api from "../src/index.js";

const root = new URL("..", import.meta.url);

test("public exports stay limited to the documented surface", () => {
  assert.deepEqual(Object.keys(api).sort(), ["applyThreat", "createTable"]);
  assert.equal(typeof api.createTable, "function");
  assert.equal(typeof api.applyThreat, "function");
  assert.equal(createTable, api.createTable);
  assert.equal(applyThreat, api.applyThreat);
});

test("package metadata names the module and the author", () => {
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(pkg.name, "@aneron/threat-table");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.author, "Vadim Gubin");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.sideEffects, false);
  assert.equal(pkg.engines.node, ">=20");
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.main, "./src/index.js");
  assert.equal(pkg.exports, "./src/index.js");
  assert.equal(pkg.repository.type, "git");
  assert.equal(pkg.repository.url, "git+https://github.com/ANERON-GAMES/threat-table.git");
  assert.deepEqual(pkg.files, ["src", "LICENSE", "README.md"]);
  assert.equal(pkg.scripts.test, "node --test test/*.test.js");
  assert.equal(pkg.scripts.lint, "eslint .");
  assert.equal(pkg.scripts.format, "prettier --write .");
  assert.equal(pkg.scripts["format:check"], "prettier --check .");
  const license = readFileSync(new URL("LICENSE", root), "utf8");
  assert.equal(license.includes("Copyright (c) 2026 Vadim Gubin"), true);
  assert.equal(license.includes("anerongames"), false);
  const readme = readFileSync(new URL("README.md", root), "utf8");
  for (const heading of [
    "## Purpose",
    "## Install",
    "## Usage",
    "## API",
    "## Design notes",
    "## License"
  ]) {
    assert.equal(readme.includes(heading), true, heading);
  }
  for (const phrase of [
    "`table.target` is `null`",
    "`table.time` is `0`",
    "`table.entries.length` is `0`",
    '`openedFight.target` is `"warrior"`',
    "`openedFight.entries[0].threat` is `80`",
    "`openedFight.entries[1].threat` is `60`",
    "`openedFight.entries[2].threat` is `50`",
    "`decayed.time` is `4`",
    "`decayed.entries[0].threat` is `60`",
    "`decayed.entries[1].threat` is `40`",
    "`decayed.entries[2].threat` is `30`",
    '`fought.target` is `"rogue"`',
    "`fought.time` is `4`",
    "`fought.entries.length` is `2`",
    '`fought.entries[0].id` is `"rogue"`',
    "`fought.entries[0].threat` is `80`",
    "`fought.entries[0].addedAt` is `0`",
    '`fought.entries[1].id` is `"cleric"`',
    "`fought.entries[1].threat` is `30`",
    "`fought.damageMultiplier` is `2`",
    "`fought.healingMultiplier` is `1`",
    "`fought.decay` is `5`",
    "`fought.switchPercent` is `10`",
    '`oneShot.target` is `"rogue"`',
    "`oneShot.entries[1].threat` is `30`",
    '`held.target` is `"warrior"`',
    '`held.entries[0].id` is `"rogue"`',
    "`held.entries[0].threat` is `110`",
    "`held.entries[1].threat` is `100`",
    '`pulled.target` is `"rogue"`',
    "`pulled.entries[0].threat` is `111`",
    '`sticky.target` is `"zed"`',
    '`sticky.entries[0].id` is `"aria"`',
    '`sticky.entries[1].id` is `"zed"`',
    '`settled.target` is `"aria"`',
    '`settled.entries[0].id` is `"aria"`',
    '`settled.entries[1].id` is `"corin"`',
    '`vacated.target` is `"zed"`',
    "`vacated.time` is `2`",
    "`vacated.entries[0].addedAt` is `0`",
    '`vacated.entries[1].id` is `"aria"`',
    "`vacated.entries[1].addedAt` is `2`",
    '`faded.target` is `"warrior"`',
    "`faded.time` is `2`",
    "`faded.entries.length` is `1`",
    "`faded.entries[0].threat` is `4`",
    "`gone.target` is `null`",
    "`gone.time` is `4`",
    "`gone.entries.length` is `0`",
    '`slid.target` is `"rogue"`',
    "`slid.entries[0].threat` is `100`",
    '`slid.entries[1].id` is `"warrior"`',
    "`slid.entries[1].threat` is `90`",
    '`surged.target` is `"rogue"`',
    "`surged.entries[0].threat` is `1050`",
    '`traded.target` is `"warrior"`',
    "`traded.entries[0].threat` is `5100`",
    '`kept.target` is `"warrior"`',
    "`kept.entries[1].threat` is `1050`",
    '`neat.target` is `"rogue"`',
    "`neat.entries[0].threat` is `200`",
    '`messy.target` is still `"warrior"`',
    '`messy.entries[0].id` is still `"warrior"`',
    '`open.target` is `"aria"`',
    "`open.entries[0].addedAt` is `1`",
    "`open.time` is `3`",
    "`actions[0].amount` is still `40`",
    "`table.target` is still `null`",
    "`table.entries.length` is still `0`",
    "`threat * 100 > currentThreat * (100 + switchPercent)`"
  ]) {
    assert.equal(readme.includes(phrase), true, phrase);
  }
});

test("source files do not contain comments, clocks, timers, or network calls", () => {
  const files = readdirSync(new URL("src/", root)).sort();
  assert.deepEqual(files, ["index.js", "read.js", "shape.js", "table.js"]);
  for (const name of files) {
    const source = readFileSync(new URL("src/" + name, root), "utf8");
    const specifiers = source.match(/from "[^"]+"/g) ?? [];
    assert.equal(specifiers.length > 0 || !source.includes("import "), true, name);
    for (const specifier of specifiers) {
      assert.match(specifier, /^from "\.\/[a-z]+\.js"$/);
    }
    assert.equal(source.includes("node:"), false, name);
    assert.equal(source.includes("require("), false, name);
    assert.equal(source.includes("/*"), false, name);
    assert.equal(source.includes("//"), false, name);
    for (const token of [
      "Date",
      "setTimeout",
      "setInterval",
      "Math.random",
      "process",
      "fetch(",
      "globalThis",
      "queueMicrotask",
      "setImmediate",
      "performance"
    ]) {
      assert.equal(source.includes(token), false, name + " " + token);
    }
  }
});

test("ci runs lint, format, and tests on node 20 and 22", () => {
  const ci = readFileSync(new URL(".github/workflows/ci.yml", root), "utf8");
  assert.equal(ci.includes("node-version: [20, 22]"), true);
  assert.equal(ci.includes("npm ci"), true);
  assert.equal(ci.includes("npm test"), true);
  assert.equal(ci.includes("npm run lint"), true);
  assert.equal(ci.includes("npm run format:check"), true);
});

test("the lockfile resolves only from the npm registry", () => {
  const lockPath = new URL("package-lock.json", root);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.lockfileVersion >= 2, true);
  const text = readFileSync(lockPath, "utf8");
  assert.equal(text.includes("git+"), false);
  assert.equal(text.includes("github:"), false);
  let resolved = 0;
  const walk = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    if (value !== null && typeof value === "object") {
      if (typeof value.resolved === "string") {
        resolved += 1;
        assert.equal(
          value.resolved.startsWith("https://registry.npmjs.org/"),
          true,
          value.resolved
        );
      }
      for (const key of Object.keys(value)) {
        walk(value[key]);
      }
    }
  };
  walk(lock);
  assert.equal(resolved > 0, true);
});
