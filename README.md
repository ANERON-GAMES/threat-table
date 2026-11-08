# @aneron/threat-table

Per-target threat tables for one enemy.

## Purpose

`@aneron/threat-table` keeps the threat table for one enemy. Each row is a contender that enemy might attack. Damage and healing add threat, scaled by integer multipliers. Elapsed time subtracts a fixed amount of threat from every row. A row that falls to zero is removed. A contender who dies, drops combat, or vanishes can leave immediately. The table names one current target. A different contender takes that seat only by clearing a configurable percentage margin over the current threat, or by inheriting an empty seat. Ties break by earlier arrival, then by id.

The caller passes every amount and every elapsed interval. The same numbers produce the same table. Time is the `elapsed` field on an `advance` action and the `time` field stored on the table. The module reads no clock, starts no timer, draws no random number, and opens no network connection. It has no runtime dependencies.

The caller chooses the threat unit. A point can mean one damage, or half a point of healing, provided every value is a safe integer in that unit. The module does not convert units.

## Install

The package is an ES module. It needs Node.js 20 or newer. It has no runtime dependencies. The package name is `@aneron/threat-table`. It is not published to the npm registry.

Clone this repository and run the tests:

```bash
git clone https://github.com/ANERON-GAMES/threat-table.git
cd threat-table
npm install
npm test
```

`npm test` runs `node --test`. `npm run lint` runs ESLint. `npm run format:check` runs Prettier.

Install it as a dependency from the git repository:

```bash
npm install github:ANERON-GAMES/threat-table
```

```js
import { applyThreat, createTable } from "@aneron/threat-table";
```

Code in this repository imports the same entry point with `./src/index.js`.

## Usage

`createTable` stores the rules. `applyThreat` applies a list of actions and returns the next table. The rules below use a damage multiplier of `2`, a healing multiplier of `1`, decay of `5` per time unit, and a switch margin of `10` percent.

```js
import { applyThreat, createTable } from "@aneron/threat-table";

const table = createTable({
  damageMultiplier: 2,
  healingMultiplier: 1,
  decay: 5,
  switchPercent: 10
});
```

`table.target` is `null`. `table.time` is `0`. `table.entries.length` is `0`.

The warrior hits for `40`. Threat gain is `40 * 2`, so the warrior row is `80` and the warrior is the target. The rogue hits for `30` and gains `60`. A switch at `10` percent requires `threat * 100 > currentThreat * (100 + switchPercent)`. `6000` is not greater than `8800`, so the target stays the warrior. The cleric's heal of `50` uses the healing multiplier of `1` and adds a cleric row of `50`. That row does not clear the margin either.

```js
const openedFight = applyThreat(table, [
  { type: "damage", id: "warrior", amount: 40 },
  { type: "damage", id: "rogue", amount: 30 },
  { type: "healing", id: "cleric", amount: 50 }
]);
```

`openedFight.target` is `"warrior"`. `openedFight.time` is `0`. `openedFight.entries[0].id` is `"warrior"`. `openedFight.entries[0].threat` is `80`. `openedFight.entries[1].id` is `"rogue"`. `openedFight.entries[1].threat` is `60`. `openedFight.entries[2].id` is `"cleric"`. `openedFight.entries[2].threat` is `50`.

Four time units pass. Decay of `5` removes `20` from each row. The warrior has `60`, the rogue has `40`, and the cleric has `30`. The rogue's `4000` is not greater than the warrior's `60 * 110`, so the target is unchanged.

```js
const decayed = applyThreat(openedFight, [{ type: "advance", elapsed: 4 }]);
```

`decayed.time` is `4`. `decayed.target` is `"warrior"`. `decayed.entries[0].threat` is `60`. `decayed.entries[1].threat` is `40`. `decayed.entries[2].threat` is `30`.

The rogue hits for another `20` and gains `40`, reaching `80`. `8000` is greater than `6600`, so the rogue takes the target. The warrior then leaves. The cleric remains at `30`.

```js
const fought = applyThreat(decayed, [
  { type: "damage", id: "rogue", amount: 20 },
  { type: "leave", id: "warrior" }
]);
```

`fought.target` is `"rogue"`. `fought.time` is `4`. `fought.entries.length` is `2`. `fought.entries[0].id` is `"rogue"`. `fought.entries[0].threat` is `80`. `fought.entries[0].addedAt` is `0`. `fought.entries[1].id` is `"cleric"`. `fought.entries[1].threat` is `30`. `fought.damageMultiplier` is `2`. `fought.healingMultiplier` is `1`. `fought.decay` is `5`. `fought.switchPercent` is `10`.

The same six actions in one list match that table. Applying each action in its own call matches it too.

```js
const actions = [
  { type: "damage", id: "warrior", amount: 40 },
  { type: "damage", id: "rogue", amount: 30 },
  { type: "healing", id: "cleric", amount: 50 },
  { type: "advance", elapsed: 4 },
  { type: "damage", id: "rogue", amount: 20 },
  { type: "leave", id: "warrior" }
];

const oneShot = applyThreat(table, actions);
```

`oneShot.target` is `"rogue"`. `oneShot.time` is `4`. `oneShot.entries[0].threat` is `80`. `oneShot.entries[1].threat` is `30`.

A margin of `10` percent on a current threat of `100` requires the challenger to land strictly above `110`. Threat of `110` stays with the warrior, even though the rogue is first in the sorted list. One more point switches.

```js
const held = applyThreat(createTable({ switchPercent: 10 }), [
  { type: "damage", id: "warrior", amount: 100 },
  { type: "damage", id: "rogue", amount: 110 }
]);
const pulled = applyThreat(held, [{ type: "damage", id: "rogue", amount: 1 }]);
```

`held.target` is `"warrior"`. `held.entries[0].id` is `"rogue"`. `held.entries[0].threat` is `110`. `held.entries[1].id` is `"warrior"`. `held.entries[1].threat` is `100`. `pulled.target` is `"rogue"`. `pulled.entries[0].threat` is `111`.

Equal threat does not switch. The default margin is `0`, which still requires a strictly greater threat. Aria matches zed and stays second. The sorted list puts aria first because the id `aria` is before `zed`, and the target stays zed.

```js
const sticky = applyThreat(createTable({}), [
  { type: "damage", id: "zed", amount: 10 },
  { type: "damage", id: "aria", amount: 10 }
]);
```

`sticky.target` is `"zed"`. `sticky.entries[0].id` is `"aria"`. `sticky.entries[0].threat` is `10`. `sticky.entries[1].id` is `"zed"`.

When the current target leaves, the open seat uses the sort order. Bryn, corin, and aria are tied at `100`. Corin and aria do not take the seat while bryn is present. After bryn leaves, aria wins the id comparison.

```js
const settled = applyThreat(createTable({}), [
  { type: "damage", id: "bryn", amount: 100 },
  { type: "damage", id: "corin", amount: 100 },
  { type: "damage", id: "aria", amount: 100 },
  { type: "leave", id: "bryn" }
]);
```

`settled.target` is `"aria"`. `settled.entries[0].id` is `"aria"`. `settled.entries[0].threat` is `100`. `settled.entries[1].id` is `"corin"`.

Arrival time beats id when the seat is open. The margin of `100` percent keeps zed and aria from pulling the mage. Zed joined at time `0`. Aria joined after an advance of `2`. Removing the mage leaves zed in the seat.

```js
const vacated = applyThreat(createTable({ switchPercent: 100 }), [
  { type: "damage", id: "mage", amount: 50 },
  { type: "damage", id: "zed", amount: 10 },
  { type: "advance", elapsed: 2 },
  { type: "damage", id: "aria", amount: 10 },
  { type: "leave", id: "mage" }
]);
```

`vacated.target` is `"zed"`. `vacated.time` is `2`. `vacated.entries[0].id` is `"zed"`. `vacated.entries[0].threat` is `10`. `vacated.entries[0].addedAt` is `0`. `vacated.entries[1].id` is `"aria"`. `vacated.entries[1].addedAt` is `2`.

Decay removes `decay * elapsed` from every row and drops a row at zero. A warrior at `10` and a rogue at `4`, with decay `3` and an advance of `2`, lose `6`. The rogue is gone. The warrior remains at `4`. Another advance of `2` removes the warrior as well.

```js
const faded = applyThreat(createTable({ decay: 3 }), [
  { type: "damage", id: "warrior", amount: 10 },
  { type: "damage", id: "rogue", amount: 4 },
  { type: "advance", elapsed: 2 }
]);
const gone = applyThreat(faded, [{ type: "advance", elapsed: 2 }]);
```

`faded.target` is `"warrior"`. `faded.time` is `2`. `faded.entries.length` is `1`. `faded.entries[0].id` is `"warrior"`. `faded.entries[0].threat` is `4`. `gone.target` is `null`. `gone.time` is `4`. `gone.entries.length` is `0`.

The same subtraction can cross a percentage margin, because the margin is a percentage of the current threat and that threat got smaller. At `10` percent, rogue `110` against warrior `100` does not switch. After decay of `10`, the rows are `100` and `90`. `10000` is greater than `9900`, so the rogue takes the target.

```js
const slid = applyThreat(createTable({ decay: 10, switchPercent: 10 }), [
  { type: "damage", id: "warrior", amount: 100 },
  { type: "damage", id: "rogue", amount: 110 },
  { type: "advance", elapsed: 1 }
]);
```

`slid.target` is `"rogue"`. `slid.time` is `1`. `slid.entries[0].id` is `"rogue"`. `slid.entries[0].threat` is `100`. `slid.entries[1].id` is `"warrior"`. `slid.entries[1].threat` is `90`.

Each action resolves the target before the next action. The same amounts in a different order can finish on the same totals and a different path. From warrior `100` and rogue `50` at a `10` percent margin, a rogue gain of `1000` switches. A later warrior gain of `5000` switches back, because `5100` clears `10` percent over `1050`. If the warrior gain happens first, the rogue's `1050` does not clear `10` percent over `5100`, and the rogue is target at no point in that list.

```js
const base = applyThreat(createTable({ switchPercent: 10 }), [
  { type: "damage", id: "warrior", amount: 100 },
  { type: "damage", id: "rogue", amount: 50 }
]);
const surged = applyThreat(base, [{ type: "damage", id: "rogue", amount: 1000 }]);
const traded = applyThreat(surged, [{ type: "damage", id: "warrior", amount: 5000 }]);
const kept = applyThreat(base, [
  { type: "damage", id: "warrior", amount: 5000 },
  { type: "damage", id: "rogue", amount: 1000 }
]);
```

`surged.target` is `"rogue"`. `surged.entries[0].threat` is `1050`. `traded.target` is `"warrior"`. `traded.entries[0].id` is `"warrior"`. `traded.entries[0].threat` is `5100`. `traded.entries[1].threat` is `1050`. `kept.target` is `"warrior"`. `kept.entries[0].threat` is `5100`. `kept.entries[1].id` is `"rogue"`. `kept.entries[1].threat` is `1050`.

A table does not have to come from `createTable`. Any object with the state fields is accepted. An empty action list does not change threat or time. It still orders the rows and resolves the target. Here the rogue already leads by more than `10` percent, so the resolved target is the rogue. A `null` target with two equal rows picks the earlier `addedAt`.

```js
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
```

`neat.target` is `"rogue"`. `neat.entries[0].id` is `"rogue"`. `neat.entries[0].threat` is `200`. `messy.target` is still `"warrior"`. `messy.entries[0].id` is still `"warrior"`. `messy.entries[0].threat` is still `100`. `open.target` is `"aria"`. `open.entries[0].id` is `"aria"`. `open.entries[0].addedAt` is `1`. `open.entries[1].id` is `"zed"`. `open.time` is `3`.

The calls above do not write into the objects they were given. `actions[0].amount` is still `40`. `table.target` is still `null`. `table.entries.length` is still `0`. A later edit of `actions[0].amount` is visible only to a later call. `oneShot.entries[0].threat` stays `80`.

## API

`createTable` and `applyThreat` are functions. There is no constructor and no shared state. Each call reads its arguments and returns a new table. The same input produces a deep-equal result and a new object tree.

`createTable` returns a frozen table. `applyThreat` returns a frozen table. A call freezes only the objects it creates. Inputs stay mutable for the caller.

Own fields are read. Unknown fields are ignored. An omitted optional field, or a field whose value is `undefined`, uses the default. A frozen object and an object with a null prototype are accepted. Inherited fields are ignored. A getter on an unknown field is left unread.

Integer means `Number.isSafeInteger`. `1.0` is accepted. `1.5`, `Infinity`, `NaN`, and `Number.MAX_SAFE_INTEGER + 1` are rejected. `-0` is stored as `0`.

Ids are primitive strings. They are not trimmed and are not case-folded. `"warrior"` and `"Warrior"` are different ids. A string of one space is a valid id. `"__proto__"` and `"constructor"` are valid ids. `"Aria"` sorts before `"aria"` because the code unit `A` is before `a`.

### `createTable(options)`

```js
createTable(options);
```

`options` must be an object and must not be an array. Otherwise the function throws `TypeError` with the message `options must be an object`.

Checks run in this order. The first failure wins. A throw returns no table.

1. `options` is an object.
2. `damageMultiplier`, when present and not `undefined`, is an integer greater than or equal to `0`.
3. `healingMultiplier`, when present and not `undefined`, is an integer greater than or equal to `0`.
4. `decay`, when present and not `undefined`, is an integer greater than or equal to `0`.
5. `switchPercent`, when present and not `undefined`, is an integer from `0` through `Number.MAX_SAFE_INTEGER - 100`.

| Field               | Default | Accepted values                                                            |
| ------------------- | ------- | -------------------------------------------------------------------------- |
| `damageMultiplier`  | `1`     | A safe integer greater than or equal to `0`. `-0` is stored as `0`.        |
| `healingMultiplier` | `1`     | A safe integer greater than or equal to `0`. `-0` is stored as `0`.        |
| `decay`             | `0`     | A safe integer greater than or equal to `0`. Threat removed per time unit. |
| `switchPercent`     | `0`     | A safe integer from `0` through `Number.MAX_SAFE_INTEGER - 100`.           |

The upper bound on `switchPercent` keeps `100 + switchPercent` inside the safe integer range. `0` means a challenger must exceed the current threat by any positive amount. `10` means ten percent. `100` means the challenger must pass double the current threat.

The returned table has `time` `0`, `target` `null`, and an empty `entries` array. The four rules are copied onto the table.

### `applyThreat(table, actions)`

```js
applyThreat(table, actions);
```

`table` is a threat table. `actions` is an array of actions applied in order. The result is the next table.

Checks run in this order. The first failure wins. A throw returns no table, and the input objects are left as they were.

1. `table` is an object.
2. `time` is an integer greater than or equal to `0`.
3. `damageMultiplier` is an integer greater than or equal to `0`.
4. `healingMultiplier` is an integer greater than or equal to `0`.
5. `decay` is an integer greater than or equal to `0`.
6. `switchPercent` is an integer from `0` through `Number.MAX_SAFE_INTEGER - 100`.
7. `target` is `null` or a non-empty string.
8. `entries` is an array. Each entry is read in order: object, non-empty string `id`, unique `id`, integer `threat` greater than or equal to `1`, integer `addedAt` greater than or equal to `0`, then `addedAt` less than or equal to `time`.
9. When `target` is a string, that id is one of the entry ids.
10. `actions` is an array. Each action is read in order, as below.
11. The actions are applied. Arithmetic that leaves the safe integer range throws.

State fields are required. An omitted field, an inherited field, and a present `undefined` all fail the check for that field. There are no defaults on `applyThreat`. `createTable` is the call that fills defaults.

`actions` must be an array. A single action object is rejected. An empty array is valid. It does not change `time` or any threat value. It orders `entries` and resolves `target`.

Applying a list is the same as applying each action in its own call, passing the previous result. Both orders of work use the target produced by the previous action.

### `actions`

Each action must be an object and must not be an array. Otherwise `TypeError`: `action must be an object`.

`type` must be an own property whose value is `advance`, `damage`, `healing`, or `leave`. Otherwise `TypeError`: `action type must be advance, damage, healing, or leave`.

An `advance` action then requires `elapsed`, an own safe integer greater than or equal to `0`. Otherwise `RangeError`: `elapsed must be an integer greater than or equal to 0`.

A `damage`, `healing`, or `leave` action then requires `id`, an own string of length at least `1`. Otherwise `TypeError`: `action id must be a non-empty string`.

A `damage` or `healing` action then requires `amount`, an own safe integer greater than or equal to `0`. Otherwise `RangeError`: `amount must be an integer greater than or equal to 0`. A `leave` action does not read `amount`.

Unknown action fields are ignored.

| Type      | Own fields     | Effect                                       |
| --------- | -------------- | -------------------------------------------- |
| `advance` | `elapsed`      | Move time forward and decay every row.       |
| `damage`  | `id`, `amount` | Add `amount * damageMultiplier` to that id.  |
| `healing` | `id`, `amount` | Add `amount * healingMultiplier` to that id. |
| `leave`   | `id`           | Remove that id when a row exists.            |

`advance` adds `elapsed` to `time`. It subtracts `decay * elapsed` from every row, then drops a row whose threat is less than or equal to zero. `elapsed` of `0` moves nothing and removes nothing. Rows are decayed by the same amount, so the gap between two survivors stays the same. The required switch margin is a percentage of the current target, so a smaller current threat can make an existing gap large enough to switch.

The decay product is checked before the next time. `decay * elapsed` must be a safe integer. Otherwise `RangeError`: `decay amount must be a safe integer`. `time + elapsed` must be a safe integer. Otherwise `RangeError`: `advanced time must be a safe integer`. A product of `0` is safe. A table whose `time` is already `Number.MAX_SAFE_INTEGER` accepts `elapsed` of `0` and rejects `elapsed` of `1` when decay does not itself overflow.

`damage` and `healing` share one pool per id. The first positive gain creates a row. `addedAt` is the table `time` at that moment. A later gain on the same id keeps `addedAt` and adds to `threat`. A gain of `0` does not create a row. On an existing row it leaves `threat` and `addedAt` unchanged. A multiplier of `0` produces a gain of `0` for every amount.

The gain product is checked first. `amount * multiplier` must be a safe integer. Otherwise `RangeError`: `threat gain must be a safe integer`. The sum with the current threat must be a safe integer. Otherwise `RangeError`: `threat must be a safe integer`.

`leave` removes the row for that id. A missing id removes nothing. Threat on a removed row is discarded. A later gain for the same id creates a new row at the current `time`.

After every action, including each action in a list, the target is resolved from the rows that remain. An empty list resolves it once.

### Target choice

Let the current row be the entry whose id is `target`. The comparison is exact:

`threat * 100 > currentThreat * (100 + switchPercent)`

A challenger switches only when that comparison is true for the best other row. Equality does not switch. The best row is decided by threat descending, then `addedAt` ascending, then id in UTF-16 code unit order, the same order as `<` on strings. When the best row is the current target, the target stays. When the best other row does not clear the margin, the target stays, even if that row is first in `entries`.

When `target` is `null`, or the current id is no longer in `entries`, there is no incumbent. The best remaining row becomes the target. An empty `entries` array leaves `target` as `null`. The percentage margin is not applied to an empty seat.

`entries` on the result is ordered by that same ranking, threat descending, then `addedAt` ascending, then id. `entries[0]` is the highest row. It can differ from `target` while a sticky target is behind by less than the margin.

### Table fields

Every returned table is a frozen object:

| Field               | Meaning                                                   |
| ------------------- | --------------------------------------------------------- |
| `time`              | The sum of `elapsed` so far. `createTable` starts at `0`. |
| `damageMultiplier`  | The multiplier used for `damage` actions.                 |
| `healingMultiplier` | The multiplier used for `healing` actions.                |
| `decay`             | The threat removed from each row per unit of `elapsed`.   |
| `switchPercent`     | The percentage margin a challenger must clear.            |
| `target`            | The current target id, or `null` when `entries` is empty. |
| `entries`           | One frozen row per contender. The array is frozen.        |

Each entry is a frozen object:

| Field     | Meaning                                                         |
| --------- | --------------------------------------------------------------- |
| `id`      | The contender id.                                               |
| `threat`  | The current threat. A stored row is at least `1`.               |
| `addedAt` | The `time` when this row was created. It is from `0` to `time`. |

`threat` on a stored row is a safe integer greater than or equal to `1`. A row that would be `0` or less is omitted. `addedAt` is a safe integer, and `0 <= addedAt <= time`.

The result does not share object or array references with the input or with another call. Input entry order does not affect the result. Reversing `entries` produces the same table when the ids, threat values, `addedAt` values, target, and rules match.

### Errors

| When the check fails                                                           | Error        | Message                                                           |
| ------------------------------------------------------------------------------ | ------------ | ----------------------------------------------------------------- |
| `options` is missing, an array, or not an object                               | `TypeError`  | `options must be an object`                                       |
| `table` is missing, an array, or not an object                                 | `TypeError`  | `table must be an object`                                         |
| `damageMultiplier` is missing or not an integer greater than or equal to `0`   | `RangeError` | `damageMultiplier must be an integer greater than or equal to 0`  |
| `healingMultiplier` is missing or not an integer greater than or equal to `0`  | `RangeError` | `healingMultiplier must be an integer greater than or equal to 0` |
| `decay` is missing or not an integer greater than or equal to `0`              | `RangeError` | `decay must be an integer greater than or equal to 0`             |
| `switchPercent` is missing, negative, or above `Number.MAX_SAFE_INTEGER - 100` | `RangeError` | `switchPercent must be an integer greater than or equal to 0`     |
| `time` is missing or not an integer greater than or equal to `0`               | `RangeError` | `time must be an integer greater than or equal to 0`              |
| `target` is missing, not a non-empty string, and not `null`, or names no entry | `TypeError`  | `target must be an entry id or null`                              |
| `entries` is missing or not an array                                           | `TypeError`  | `entries must be an array`                                        |
| An entry is an array or not an object                                          | `TypeError`  | `entry must be an object`                                         |
| An entry id is not a non-empty string                                          | `TypeError`  | `entry id must be a non-empty string`                             |
| An entry id is repeated                                                        | `TypeError`  | `entry ids must be unique`                                        |
| `threat` is missing or not an integer greater than or equal to `1`             | `RangeError` | `threat must be an integer greater than or equal to 1`            |
| `addedAt` is missing or not an integer greater than or equal to `0`            | `RangeError` | `addedAt must be an integer greater than or equal to 0`           |
| `addedAt` is greater than `time`                                               | `RangeError` | `addedAt must be less than or equal to time`                      |
| `actions` is missing or not an array                                           | `TypeError`  | `actions must be an array`                                        |
| An action is an array or not an object                                         | `TypeError`  | `action must be an object`                                        |
| An action type is not `advance`, `damage`, `healing`, or `leave`               | `TypeError`  | `action type must be advance, damage, healing, or leave`          |
| `elapsed` is missing or not an integer greater than or equal to `0`            | `RangeError` | `elapsed must be an integer greater than or equal to 0`           |
| An action id is not a non-empty string                                         | `TypeError`  | `action id must be a non-empty string`                            |
| `amount` is missing or not an integer greater than or equal to `0`             | `RangeError` | `amount must be an integer greater than or equal to 0`            |
| `amount * multiplier` exceeds the safe integer range                           | `RangeError` | `threat gain must be a safe integer`                              |
| Adding the gain to the current threat exceeds the safe integer range           | `RangeError` | `threat must be a safe integer`                                   |
| `decay * elapsed` exceeds the safe integer range                               | `RangeError` | `decay amount must be a safe integer`                             |
| `time + elapsed` exceeds the safe integer range                                | `RangeError` | `advanced time must be a safe integer`                            |

`options` applies to `createTable`. On that call, `damageMultiplier`, `healingMultiplier`, `decay`, and `switchPercent` may be omitted. The missing-field wording in the table applies to `applyThreat`, where those fields are required along with `time`, `target`, and `entries`. A present invalid value uses the same message on both calls.

The duplicate-id check happens before that entry's `threat` is validated. A repeated id with a bad threat reports the duplicate. A bad id is reported before the threat. The first entry is finished before the second entry is read. Every entry is validated before any action is read, and every action is validated before any gain, decay, or removal is applied.

## Design notes

One table belongs to one enemy. The ids are the contenders for that enemy's attention, often players. Damage threat and healing threat land in the same integer, so a person who both hits and heals has one row. The heal amount is the share that belongs on this table. A heal that should touch several enemies is applied by the caller to each enemy's table, with the amount chosen for that enemy.

The multipliers are integers so every product is exact. A damage multiplier of `2` doubles the amount into threat. A healing multiplier of `0` records heals without threat. A multiplier of `1` stores the amount as given. Fractional threat is a smaller unit in the caller's hands: pass `1` to mean whatever fraction the game uses, and keep the module on safe integers. Floats would make the switch boundary depend on rounding.

Decay is a flat subtraction per elapsed unit, `decay * elapsed`, applied to every row together. A row that reaches zero is dropped. Leaving it at zero would make it tie with absence and it could not win a strict exceed check. `leave` is the explicit removal for a contender who is gone while threat remains, such as a death, a drop from combat, or a vanish. An unknown leave is a no-op so a caller can report a departure the table already forgot.

The current target is sticky so the enemy does not swap on every point of threat. The rule is the cross-multiply above, not a rounded ratio. A challenger whose scaled threat equals the current target's scaled threat does not take the seat. That includes products larger than `Number.MAX_SAFE_INTEGER`, where a floating-point multiply can round the next point away. `switchPercent` of `0` is already sticky: equal threat stays, and the next point switches. A positive percent lets a row lead `entries` without being the target. The sorted list is the threat meter. `target` is who the enemy is on.

Tie-breaking is only for an open choice. Higher threat wins, then the smaller `addedAt`, then the smaller id in UTF-16 code unit order. That order is the string order JavaScript already uses, so the caller does not pre-sort. An equal row does not unseat the current id. When the current id is gone, the same order fills the seat, and the percentage margin is not consulted. Two contenders who both clear the margin are ranked by that order. The winner is the best row whenever that best row is allowed to take the seat.

The target is resolved after each action. A list is a sequence of tables, and the incumbent for a hit is the target the previous hit left behind. The rogue who surges and then loses the seat to a larger warrior hit is a different fight from the warrior who surges first and never gives the seat up. The totals can match. The target path is part of the input order. Splitting the list into one call per action produces the same final table as one call with the whole list.

Flat decay changes the margin even though it preserves gaps. Subtracting `10` from `110` and `100` leaves `100` and `90`. The absolute lead is still `10`, and `10` percent of `90` is smaller than `10` percent of `100`, so the challenger crosses. Decay can also delete the current row and hand the seat to someone who was behind. The module applies the decay the caller asks for and then resolves the target. It does not clamp decay, and it does not spread one advance into hidden steps.

`time` starts at `0` and increases only by `elapsed`. Damage, healing, and leave do not move it. `addedAt` is that clock at the moment the row is created, which is what makes an earlier contender win a tie after the current target is gone. Two gains with no advance between them share `addedAt`, and the id breaks the tie. Leaving and gaining again starts a new row. The old threat does not come back.

Safe integers keep the boundary exact. A sum or product that would leave the safe range throws, so a caller never receives a rounded threat or a rounded time. The previous table is unchanged because the function does not write into it. `-0` is stored as `0` so later comparisons do not observe a sign bit.

The result is a pure reduction of the numbers the caller passed. Inputs stay mutable. Two calls do not share result objects, so freezing one result cannot change the next call. A later edit of an amount is visible only to a later call. The earlier frozen table keeps the target it selected.

## License

MIT. Copyright (c) 2026 Vadim Gubin.
