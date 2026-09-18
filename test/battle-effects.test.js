import test from "node:test";
import assert from "node:assert/strict";
import { applyBattleCommand } from "../src/battle-effects.js";
import { BattleDirector } from "../src/battle.js";
import { ENCOUNTERS } from "../src/encounters.js";
import { FallingBlockGame } from "../src/game.js";

function resolution(id) {
  return {
    id,
    linesCleared: 0,
    tSpin: false,
    difficult: false,
    combo: -1,
    backToBack: false,
    backToBackBonus: false,
  };
}

test("every stage signature intent reaches the board engine", () => {
  ENCOUNTERS.forEach((encounter, index) => {
    const game = new FallingBlockGame({ random: () => 0.42, gravityMode: "battle" });
    game.start();
    const battle = new BattleDirector({ enemyHp: encounter.bossHp });
    const signature = encounter.pattern.find((intent) => intent.type === encounter.signatureSkill);
    battle.queueIntent({ ...signature, inPieces: 1 });
    const [command] = battle.consumeResolution(resolution(index + 1)).commands;

    assert.equal(applyBattleCommand(game, command), true, encounter.id);
    if (encounter.signatureSkill === "blindness") assert.ok(game.effects.blindness);
    if (encounter.signatureSkill === "meteor-rush") assert.ok(game.effects.meteorRush);
    if (encounter.signatureSkill === "narrow-vision") assert.ok(game.effects.narrowVision);
    if (encounter.signatureSkill === "earthquake") assert.equal(game.lastEvent.label, "EARTHQUAKE");
  });
});
