import test from "node:test";
import assert from "node:assert/strict";
import { ATTENTION_BUDGET, BattleDirector, damageForResolution } from "../src/battle.js";

function resolution(overrides = {}) {
  return {
    id: 1,
    linesCleared: 1,
    tSpin: false,
    difficult: false,
    combo: 0,
    backToBack: false,
    backToBackBonus: false,
    ...overrides,
  };
}

test("attention budget keeps board placement as the primary task", () => {
  const total = Object.values(ATTENTION_BUDGET).reduce((sum, value) => sum + value, 0);
  assert.equal(total, 1);
  assert.ok(ATTENTION_BUDGET.boardPlacement > ATTENTION_BUDGET.threatResponse);
  assert.ok(ATTENTION_BUDGET.spectacle <= 0.05);
});

test("damage rewards multi-line clears, T-spins, combos, and back-to-back play", () => {
  assert.equal(damageForResolution(resolution()), 6);
  assert.equal(damageForResolution(resolution({ linesCleared: 2 })), 15);
  assert.equal(damageForResolution(resolution({ linesCleared: 2, tSpin: true, difficult: true })), 44);
  assert.equal(damageForResolution(resolution({ linesCleared: 2, tSpin: true, difficult: true, backToBack: true, backToBackBonus: true })), 55);
  assert.equal(damageForResolution(resolution({ linesCleared: 1, combo: 3 })), 18);
  assert.equal(damageForResolution(resolution({ linesCleared: 0, combo: 9 })), 0);
});

test("battle director consumes each resolution only once", () => {
  const battle = new BattleDirector({ enemyHp: 100 });
  const event = resolution({ linesCleared: 2 });

  assert.equal(battle.consumeResolution(event).damage, 15);
  assert.equal(battle.enemyHp, 85);
  assert.equal(battle.consumeResolution(event), null);
  assert.equal(battle.enemyHp, 85);
});

test("enemy intents resolve by locked-piece countdown rather than real-time speed", () => {
  const battle = new BattleDirector();
  battle.queueIntent({ type: "pressure-line", inPieces: 3, payload: { rows: 1, gapColumn: 4 } });

  assert.deepEqual(battle.consumeResolution(resolution({ id: 1 })).commands, []);
  assert.equal(battle.snapshot().intents[0].remainingPieces, 2);
  assert.deepEqual(battle.consumeResolution(resolution({ id: 2 })).commands, []);
  const outcome = battle.consumeResolution(resolution({ id: 3 }));

  assert.deepEqual(outcome.commands, [{
    type: "add-pressure-line",
    rows: 1,
    gapColumn: 4,
    sourceIntentId: 1,
  }]);
  assert.equal(battle.snapshot().intents.length, 0);
});

test("block rain intent exposes its telegraphed columns", () => {
  const battle = new BattleDirector();
  battle.queueIntent({ type: "block-rain", inPieces: 1, payload: { columns: [1, 4, 7] } });

  assert.deepEqual(battle.consumeResolution(resolution()).commands, [{
    type: "add-block-rain",
    columns: [1, 4, 7],
    blocksPerColumn: 1,
    sourceIntentId: 1,
  }]);
});

test("encounter status intents become explicit board commands", () => {
  const cases = [
    ["blindness", { durationPieces: 3, rows: 4 }, "apply-blindness"],
    ["meteor-rush", { pieces: 3 }, "apply-meteor-rush"],
    ["narrow-vision", { durationPieces: 3, hiddenRows: 6 }, "apply-narrow-vision"],
    ["earthquake", { affectedRows: 10 }, "apply-earthquake"],
  ];
  cases.forEach(([type, payload, commandType], index) => {
    const battle = new BattleDirector();
    battle.queueIntent({ type, inPieces: 1, payload });
    const outcome = battle.consumeResolution(resolution({ id: index + 1 }));
    assert.equal(outcome.commands[0].type, commandType);
  });
});

test("clears charge a ward that blocks one board attack", () => {
  const battle = new BattleDirector({ initialFocus: 0 });
  const outcome = battle.consumeResolution(resolution({ linesCleared: 2 }));
  assert.equal(outcome.focusGain, 2);
  assert.equal(battle.armWard(), false);

  battle.consumeResolution(resolution({ id: 2, linesCleared: 1 }));
  assert.equal(battle.armWard(), true);
  assert.equal(battle.snapshot().focus, 0);
  assert.equal(battle.snapshot().wardArmed, true);

  const defense = battle.interceptCommand({ type: "add-block-rain", columns: [2, 5] });
  assert.equal(defense.blocked, true);
  assert.equal(defense.command, null);
  assert.equal(battle.snapshot().wardArmed, false);
});

test("damage resolution exposes a short non-interactive presentation beat", () => {
  const battle = new BattleDirector();
  assert.equal(battle.consumeResolution(resolution({ id: 1, linesCleared: 0 })).resolutionBeatMs, 180);
  assert.equal(battle.consumeResolution(resolution({ id: 2, linesCleared: 4 })).resolutionBeatMs, 420);
});

test("a finishing clear cancels an enemy intent expiring on the same piece", () => {
  const battle = new BattleDirector({ enemyHp: 6 });
  battle.queueIntent({ type: "pressure-line", inPieces: 1, payload: { rows: 2, gapColumn: 3 } });

  const outcome = battle.consumeResolution(resolution({ linesCleared: 1 }));

  assert.equal(outcome.phase, "victory");
  assert.equal(outcome.enemyHp, 0);
  assert.deepEqual(outcome.commands, []);
  assert.deepEqual(battle.snapshot().intents, []);
});
