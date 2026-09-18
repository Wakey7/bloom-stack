import { BattleDirector } from "../src/battle.js";

const battle = new BattleDirector({ enemyHp: 90 });
battle.queueIntent({ type: "block-rain", inPieces: 4, payload: { columns: [1, 4, 7] } });

const sampleRun = [
  { linesCleared: 0 },
  { linesCleared: 1 },
  { linesCleared: 2, combo: 1 },
  { linesCleared: 0 },
  { linesCleared: 4, difficult: true },
  { linesCleared: 2, tSpin: true, difficult: true, backToBack: true, backToBackBonus: true },
];

const timeline = sampleRun.map((sample, index) => {
  const outcome = battle.consumeResolution({
    id: index + 1,
    linesCleared: 0,
    tSpin: false,
    difficult: false,
    combo: -1,
    backToBack: false,
    backToBackBonus: false,
    ...sample,
  });
  return {
    piece: index + 1,
    cleared: sample.linesCleared,
    damage: outcome.damage,
    enemyHp: outcome.enemyHp,
    focus: battle.snapshot().focus,
    enemyCommand: outcome.commands[0]?.type || "—",
    presentationMs: outcome.resolutionBeatMs,
  };
});

console.table(timeline);
console.log("Final battle state:", battle.snapshot());
