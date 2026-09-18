import test from "node:test";
import assert from "node:assert/strict";
import { BOARD_HEIGHT, BOARD_WIDTH, FallingBlockGame } from "../src/game.js";
import { cellsFor } from "../src/pieces.js";

function startedGame() {
  const game = new FallingBlockGame({ random: () => 0.42 });
  game.start();
  return game;
}

test("starts with a valid active piece and a populated preview queue", () => {
  const game = startedGame();
  assert.equal(game.status, "playing");
  assert.equal(game.queue.length, 6);
  assert.equal(game.isValid(game.active), true);
  assert.equal(cellsFor(game.active).some(([, y]) => y >= 2), true);
});

test("movement never crosses the playfield boundary", () => {
  const game = startedGame();
  while (game.move(-1)) {}
  assert.equal(game.move(-1), false);
  assert.equal(cellsFor(game.active).every(([x]) => x >= 0), true);
});

test("hold is limited to once per falling piece", () => {
  const game = startedGame();
  const firstType = game.active.type;
  assert.equal(game.hold(), true);
  assert.equal(game.held, firstType);
  assert.equal(game.holdFocusRemaining, 650);
  assert.equal(game.hold(), false);
  game.hardDrop();
  assert.equal(game.canHold, true);
});

test("hold focus pauses gravity but still allows placement input", () => {
  const game = startedGame();
  game.hold();
  const initialY = game.active.y;
  const initialX = game.active.x;

  for (let step = 0; step < 7; step += 1) game.update(100);
  assert.equal(game.active.y, initialY);
  assert.equal(game.move(-1), true);
  assert.equal(game.active.x, initialX - 1);

  for (let step = 0; step < 9; step += 1) game.update(100);
  assert.equal(game.active.y, initialY + 1);
});

test("hard drop locks exactly four cells and awards drop points", () => {
  const game = startedGame();
  const distance = game.hardDrop();
  const occupied = game.board.flat().filter(Boolean);
  assert.ok(distance > 0);
  assert.equal(occupied.length, 4);
  assert.ok(game.score >= distance * 2);
});

test("completed rows clear and update line count", () => {
  const game = startedGame();
  game.board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill("J");
  game.board[BOARD_HEIGHT - 1][4] = null;
  game.board[BOARD_HEIGHT - 1][5] = null;
  game.active = { type: "O", rotation: 0, x: 3, y: BOARD_HEIGHT - 2 };
  game.lockPiece();
  assert.equal(game.lines, 1);
  assert.ok(game.score >= 100);
  assert.equal(game.lastEffect.type, "line-clear");
  assert.equal(game.lastEffect.rows.length, 1);
  assert.equal(game.lastResolution.linesCleared, 1);
  assert.equal(game.lastResolution.piecesLocked, 1);
});

test("level increases after every ten cleared lines", () => {
  const game = startedGame();
  game.lines = 9;
  game.board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill("L");
  game.board[BOARD_HEIGHT - 1][4] = null;
  game.board[BOARD_HEIGHT - 1][5] = null;
  game.active = { type: "O", rotation: 0, x: 3, y: BOARD_HEIGHT - 2 };
  game.lockPiece();
  assert.equal(game.lines, 10);
  assert.equal(game.level, 2);
});

test("pause freezes timed updates", () => {
  const game = startedGame();
  const initialY = game.active.y;
  game.togglePause();
  game.update(10_000);
  assert.equal(game.active.y, initialY);
});

test("grounded pieces respect the lock delay", () => {
  const game = startedGame();
  game.active = { type: "O", rotation: 0, x: 3, y: BOARD_HEIGHT - 2 };
  for (let step = 0; step < 4; step += 1) game.update(100);
  game.update(99);
  assert.equal(game.board.flat().filter(Boolean).length, 0);
  game.update(1);
  assert.equal(game.board.flat().filter(Boolean).length, 4);
});

test("four rotations return a piece to its original occupied cells", () => {
  const game = startedGame();
  game.active = { type: "T", rotation: 0, x: 3, y: 5 };
  const original = cellsFor(game.active);
  for (let turn = 0; turn < 4; turn += 1) assert.equal(game.rotate(1), true);
  assert.deepEqual(cellsFor(game.active), original);
});

test("pressure lines rise from the bottom with a telegraphed gap", () => {
  const game = startedGame();
  assert.equal(game.addPressureLines(1, 4), true);
  assert.deepEqual(game.board[BOARD_HEIGHT - 1], ["G", "G", "G", "G", null, "G", "G", "G", "G", "G"]);
  assert.equal(game.lastEvent.label, "PRESSURE LINE");
});

test("block rain lands on top of the marked columns", () => {
  const game = startedGame();
  game.board[BOARD_HEIGHT - 1][2] = "T";
  game.setThreatColumns([2, 5, 8]);

  assert.equal(game.addBlockRain([2, 5, 8]), true);
  assert.equal(game.board[BOARD_HEIGHT - 2][2], "G");
  assert.equal(game.board[BOARD_HEIGHT - 1][5], "G");
  assert.equal(game.board[BOARD_HEIGHT - 1][8], "G");
  assert.deepEqual(game.threatColumns, []);
  assert.equal(game.lastEvent.label, "STONE RAIN");
});

test("battle gravity increases slowly and remains bounded", () => {
  const game = new FallingBlockGame({ random: () => 0.42, gravityMode: "battle" });
  game.level = 1;
  assert.equal(game.gravityInterval, 900);
  game.level = 10;
  assert.ok(game.gravityInterval >= 650);
  assert.ok(game.gravityInterval > 500);
});

test("temporary visibility effects expire by locked pieces", () => {
  const game = startedGame();
  assert.equal(game.applyBlindness(2, 6, 5), true);
  assert.equal(game.applyNarrowVision(2, 6), true);
  assert.equal(game.effects.blindness.rows, 6);
  assert.equal(game.effects.blindness.startRow, 5);
  assert.equal(game.effects.narrowVision.hiddenRows, 6);

  game.hardDrop();
  assert.equal(game.effects.blindness.remainingPieces, 1);
  game.hardDrop();
  assert.equal(game.effects.blindness, undefined);
  assert.equal(game.effects.narrowVision, undefined);
});

test("meteor rush temporarily overrides battle gravity", () => {
  const game = new FallingBlockGame({ random: () => 0.42, gravityMode: "battle" });
  game.start();
  game.applyMeteorRush(3);
  assert.equal(game.gravityInterval, 150);
  game.hardDrop();
  game.hardDrop();
  game.hardDrop();
  assert.equal(game.effects.meteorRush, undefined);
  assert.equal(game.gravityInterval, 900);
});

test("meteor rush accepts a telegraphed per-stage speed", () => {
  const game = new FallingBlockGame({ random: () => 0.42, gravityMode: "battle" });
  game.start();
  game.applyMeteorRush(2, 220);
  assert.equal(game.gravityInterval, 220);
});

test("earthquake preserves cells and confines redistribution to lower rows", () => {
  const game = startedGame();
  const startY = BOARD_HEIGHT - 10;
  game.board[startY - 1][0] = "I";
  for (let index = 0; index < 18; index += 1) {
    game.board[startY + Math.floor(index / BOARD_WIDTH)][index % BOARD_WIDTH] = "T";
  }
  const beforeCount = game.board.flat().filter(Boolean).length;

  assert.equal(game.applyEarthquake(10), true);
  assert.equal(game.board.flat().filter(Boolean).length, beforeCount);
  assert.equal(game.board[startY - 1][0], "I");
  assert.equal(game.board.slice(startY).some((row) => row.every(Boolean)), false);
  assert.equal(game.lastEvent.label, "EARTHQUAKE");
});

test("a gentle earthquake can settle a near-complete row for the player", () => {
  const game = startedGame();
  const bottom = BOARD_HEIGHT - 1;
  for (let x = 0; x < 8; x += 1) game.board[bottom][x] = "T";
  game.board[bottom - 1][0] = "L";
  game.board[bottom - 1][1] = "L";

  assert.equal(game.applyEarthquake(6, 0, 1), true);
  assert.equal(game.lines, 1);
  assert.equal(game.lastEvent.label, "EARTHQUAKE AID");
  assert.equal(game.board.flat().filter(Boolean).length, 0);
});
