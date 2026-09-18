export const ENCOUNTERS = Object.freeze([
  {
    id: "cairn-pass",
    order: 1,
    name: "石冢守卫",
    status: "playable",
    bossHp: 90,
    signatureSkill: "block-rain",
    teachingGoal: "读取棋盘内的列预告，并决定是否消耗护符。",
    pattern: [
      { type: "block-rain", inPieces: 4, payload: { columns: [1, 4, 7], blocksPerColumn: 1 } },
      { type: "pressure-line", inPieces: 5, payload: { rows: 1, gapColumn: 4 } },
      { type: "block-rain", inPieces: 4, payload: { columns: [2, 5, 8], blocksPerColumn: 2 } },
      { type: "pressure-line", inPieces: 4, payload: { rows: 2, gapColumn: 7 } },
    ],
  },
  {
    id: "veil-grotto",
    order: 2,
    name: "帷幕蛾",
    status: "prototype",
    bossHp: 105,
    signatureSkill: "blindness",
    teachingGoal: "读取黑暗区间预警，并记忆即将被遮挡的堆叠轮廓。",
    pattern: [
      { type: "blindness", inPieces: 5, payload: { durationPieces: 3, baseRows: 6, maxRows: 9, growthEvery: 2, randomBand: true, minStartRow: 4 } },
      { type: "blindness", inPieces: 4, payload: { durationPieces: 4, baseRows: 6, maxRows: 9, growthEvery: 2, randomBand: true, minStartRow: 3 } },
    ],
  },
  {
    id: "comet-causeway",
    order: 3,
    name: "彗星猎犬",
    status: "prototype",
    bossHp: 115,
    signatureSkill: "meteor-rush",
    teachingGoal: "为连续三个高速方块预留简单、可靠的落点。",
    pattern: [
      { type: "meteor-rush", inPieces: 5, payload: { pieces: 2, interval: 220 } },
      { type: "meteor-rush", inPieces: 4, payload: { pieces: 3, interval: 175 } },
      { type: "meteor-rush", inPieces: 5, payload: { pieces: 4, interval: 145 } },
    ],
  },
  {
    id: "narrow-observatory",
    order: 4,
    name: "窄视观测者",
    status: "prototype",
    bossHp: 125,
    signatureSkill: "narrow-vision",
    teachingGoal: "利用 Next 队列规划，而不是依赖生成区和 Ghost。",
    pattern: [
      { type: "narrow-vision", inPieces: 5, payload: { durationPieces: 2, hiddenRows: 5 } },
      { type: "narrow-vision", inPieces: 4, payload: { durationPieces: 3, hiddenRows: 6 } },
      { type: "narrow-vision", inPieces: 5, payload: { durationPieces: 4, hiddenRows: 7 } },
    ],
  },
  {
    id: "fault-sanctum",
    order: 5,
    name: "断层巨像",
    status: "prototype",
    bossHp: 140,
    signatureSkill: "earthquake",
    teachingGoal: "为可预告的地形重排保留冗余空间与恢复路线。",
    pattern: [
      { type: "earthquake", inPieces: 6, payload: { affectedRows: 6, intensity: 0.16, assistChance: 0.7 } },
      { type: "earthquake", inPieces: 5, payload: { affectedRows: 8, intensity: 0.28, assistChance: 0.5 } },
      { type: "earthquake", inPieces: 5, payload: { affectedRows: 9, intensity: 0.4, assistChance: 0.3 } },
    ],
  },
]);

export function getEncounter(id) {
  const encounter = ENCOUNTERS.find((candidate) => candidate.id === id);
  if (!encounter) throw new RangeError(`Unknown encounter: ${id}`);
  return encounter;
}
