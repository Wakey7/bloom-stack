import { SevenBag } from "./randomizer.js";
import { cellsFor, getKickTests } from "./pieces.js";

export const BOARD_WIDTH = 10;
export const VISIBLE_HEIGHT = 18;
export const HIDDEN_ROWS = 2;
export const BOARD_HEIGHT = VISIBLE_HEIGHT + HIDDEN_ROWS;

const LINE_POINTS = [0, 100, 300, 500, 800];
const T_SPIN_POINTS = [400, 800, 1200, 1600];
const PERFECT_CLEAR_POINTS = [0, 800, 1200, 1800, 2000];

export function createEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

export class FallingBlockGame {
  constructor({ random = Math.random, gravityMode = "classic" } = {}) {
    this.random = random;
    this.gravityMode = gravityMode;
    this.reset();
  }

  reset() {
    this.board = createEmptyBoard();
    this.randomizer = new SevenBag(this.random);
    this.queue = [];
    this.active = null;
    this.held = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = -1;
    this.backToBack = false;
    this.status = "ready";
    this.dropAccumulator = 0;
    this.lockAccumulator = 0;
    this.lockResets = 0;
    this.holdFocusDuration = 650;
    this.holdFocusRemaining = 0;
    this.lastAction = null;
    this.effectId = 0;
    this.lastEffect = null;
    this.resolutionId = 0;
    this.lastResolution = null;
    this.piecesLocked = 0;
    this.threatColumns = [];
    this.intentPreview = null;
    this.effects = {};
    this.lastEvent = { label: "READY", detail: "Press start" };
    this.fillQueue();
  }

  start() {
    if (this.status === "gameover" || this.status === "victory") this.reset();
    if (this.status === "ready") {
      this.status = "playing";
      this.lastEvent = { label: "RUN ACTIVE", detail: "Build from the bottom" };
      this.spawn();
    }
  }

  togglePause() {
    if (this.status === "playing") this.status = "paused";
    else if (this.status === "paused") this.status = "playing";
  }

  fillQueue() {
    while (this.queue.length < 6) this.queue.push(this.randomizer.next());
  }

  spawn(forcedType = null) {
    this.fillQueue();
    const type = forcedType || this.queue.shift();
    this.fillQueue();
    // Two hidden rows keep rotations safe while y=1 leaves the lower cells
    // visible immediately, instead of making a new piece appear to vanish.
    this.active = { type, rotation: 0, x: 3, y: 1 };
    this.dropAccumulator = 0;
    this.lockAccumulator = 0;
    this.lockResets = 0;
    this.holdFocusRemaining = 0;
    this.lastAction = "spawn";

    if (!this.isValid(this.active)) {
      this.status = "gameover";
      this.lastEvent = { label: "STACK OVER", detail: "Try a cleaner build" };
      return false;
    }
    return true;
  }

  isValid(piece) {
    return cellsFor(piece).every(([x, y]) => (
      x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT && !this.board[y][x]
    ));
  }

  isGrounded() {
    if (!this.active) return false;
    return !this.isValid({ ...this.active, y: this.active.y + 1 });
  }

  move(horizontal) {
    if (this.status !== "playing" || !this.active) return false;
    const wasGrounded = this.isGrounded();
    const candidate = { ...this.active, x: this.active.x + horizontal };
    if (!this.isValid(candidate)) return false;
    this.active = candidate;
    this.lastAction = "move";
    this.maybeResetLock(wasGrounded);
    return true;
  }

  rotate(direction) {
    if (this.status !== "playing" || !this.active) return false;
    const wasGrounded = this.isGrounded();
    const from = this.active.rotation;
    const to = (from + direction + 4) % 4;

    for (const [offsetX, offsetY] of getKickTests(this.active.type, from, to)) {
      const candidate = {
        ...this.active,
        rotation: to,
        x: this.active.x + offsetX,
        y: this.active.y + offsetY,
      };
      if (this.isValid(candidate)) {
        this.active = candidate;
        this.lastAction = "rotate";
        this.maybeResetLock(wasGrounded);
        return true;
      }
    }
    return false;
  }

  maybeResetLock(wasGrounded) {
    if ((wasGrounded || this.isGrounded()) && this.lockResets < 15) {
      this.lockAccumulator = 0;
      this.lockResets += 1;
    }
  }

  softDrop() {
    if (this.status !== "playing" || !this.active) return false;
    const candidate = { ...this.active, y: this.active.y + 1 };
    if (!this.isValid(candidate)) return false;
    this.active = candidate;
    this.score += 1;
    this.dropAccumulator = 0;
    this.lockAccumulator = 0;
    this.lastAction = "drop";
    return true;
  }

  hardDrop() {
    if (this.status !== "playing" || !this.active) return 0;
    let distance = 0;
    while (this.isValid({ ...this.active, y: this.active.y + distance + 1 })) distance += 1;
    this.active.y += distance;
    this.score += distance * 2;
    this.lastAction = "drop";
    this.lockPiece();
    return distance;
  }

  hold() {
    if (this.status !== "playing" || !this.active || !this.canHold) return false;
    const outgoing = this.active.type;
    const incoming = this.held;
    this.held = outgoing;
    this.canHold = false;
    if (incoming) this.spawn(incoming);
    else this.spawn();
    this.canHold = false;
    this.holdFocusRemaining = this.holdFocusDuration;
    this.lastEvent = { label: "RESERVE FOCUS", detail: "650 ms planning buffer" };
    return true;
  }

  update(deltaMilliseconds) {
    if (this.status !== "playing" || !this.active) return;
    const delta = Math.min(deltaMilliseconds, 100);

    if (this.holdFocusRemaining > 0) {
      this.holdFocusRemaining = Math.max(0, this.holdFocusRemaining - delta);
      return;
    }

    if (this.isGrounded()) {
      this.lockAccumulator += delta;
      if (this.lockAccumulator >= 500) this.lockPiece();
      return;
    }

    this.lockAccumulator = 0;
    this.dropAccumulator += delta;
    const interval = this.gravityInterval;
    while (this.dropAccumulator >= interval && this.active) {
      this.dropAccumulator -= interval;
      const candidate = { ...this.active, y: this.active.y + 1 };
      if (!this.isValid(candidate)) break;
      this.active = candidate;
      this.lastAction = "gravity";
    }
  }

  get gravityInterval() {
    if (this.effects.meteorRush) return this.effects.meteorRush.interval;
    if (this.gravityMode === "battle") {
      return Math.max(650, 900 * Math.pow(0.95, this.level - 1));
    }
    return Math.max(70, 900 * Math.pow(0.82, this.level - 1));
  }

  ghostY() {
    if (!this.active) return 0;
    let y = this.active.y;
    while (this.isValid({ ...this.active, y: y + 1 })) y += 1;
    return y;
  }

  addPressureLines(count = 1, gapColumn = 4) {
    if (this.status !== "playing" || !this.active) return false;
    const rows = Math.max(1, Math.min(4, Math.floor(count)));
    const gap = Math.max(0, Math.min(BOARD_WIDTH - 1, Math.floor(gapColumn)));
    let overflow = false;

    for (let index = 0; index < rows; index += 1) {
      const removed = this.board.shift();
      if (removed.some(Boolean)) overflow = true;
      const pressureRow = Array(BOARD_WIDTH).fill("G");
      pressureRow[gap] = null;
      this.board.push(pressureRow);
    }

    if (overflow || !this.isValid(this.active)) {
      this.status = "gameover";
      this.lastEvent = { label: "OVERWHELMED", detail: "The Warden broke the formation" };
      return false;
    }

    this.lastEvent = { label: "PRESSURE LINE", detail: `Gap opened in column ${gap + 1}` };
    return true;
  }

  setThreatColumns(columns = []) {
    this.threatColumns = [...new Set(columns)]
      .map((column) => Math.floor(column))
      .filter((column) => column >= 0 && column < BOARD_WIDTH);
  }

  setIntentPreview(intent = null) {
    this.intentPreview = intent ? {
      type: intent.type,
      remainingPieces: intent.remainingPieces,
      payload: { ...(intent.payload || {}) },
    } : null;
  }

  clearThreat(message = null) {
    this.threatColumns = [];
    if (message) this.lastEvent = { label: "WARD TRIGGERED", detail: message };
  }

  addBlockRain(columns = [], blocksPerColumn = 1) {
    if (this.status !== "playing" || !this.active) return false;
    const targets = [...new Set(columns)]
      .map((column) => Math.floor(column))
      .filter((column) => column >= 0 && column < BOARD_WIDTH);
    const amount = Math.max(1, Math.min(3, Math.floor(blocksPerColumn)));
    if (targets.length === 0) return false;

    let overflow = false;
    for (const column of targets) {
      for (let block = 0; block < amount; block += 1) {
        const highestOccupied = this.board.findIndex((row) => row[column] !== null);
        const targetY = highestOccupied === -1 ? BOARD_HEIGHT - 1 : highestOccupied - 1;
        if (targetY < HIDDEN_ROWS) {
          overflow = true;
          break;
        }
        this.board[targetY][column] = "G";
      }
    }

    this.threatColumns = [];
    if (overflow || !this.isValid(this.active)) {
      this.status = "gameover";
      this.lastEvent = { label: "STONE RAIN", detail: "The marked columns overflowed" };
      return false;
    }

    this.lastEvent = {
      label: "STONE RAIN",
      detail: `Columns ${targets.map((column) => column + 1).join(" / ")} were struck`,
    };
    return true;
  }

  applyBlindness(durationPieces = 3, rows = 6, startRow = VISIBLE_HEIGHT - rows) {
    if (this.status !== "playing") return false;
    const bandRows = Math.max(2, Math.min(VISIBLE_HEIGHT - 3, Math.floor(rows)));
    const bandStart = Math.max(0, Math.min(VISIBLE_HEIGHT - bandRows, Math.floor(startRow)));
    this.effects.blindness = {
      remainingPieces: Math.max(1, Math.floor(durationPieces)),
      rows: bandRows,
      startRow: bandStart,
    };
    this.lastEvent = {
      label: "BLINDNESS",
      detail: `Rows ${bandStart + 1}–${bandStart + bandRows} obscured`,
    };
    return true;
  }

  applyMeteorRush(pieces = 3, interval = 150) {
    if (this.status !== "playing") return false;
    this.effects.meteorRush = {
      remainingPieces: Math.max(1, Math.floor(pieces)),
      interval: Math.max(110, Math.min(300, Math.floor(interval))),
    };
    this.lastEvent = { label: "METEOR RUSH", detail: `${this.effects.meteorRush.remainingPieces} rapid pieces` };
    return true;
  }

  applyNarrowVision(durationPieces = 3, hiddenRows = 6) {
    if (this.status !== "playing") return false;
    this.effects.narrowVision = {
      remainingPieces: Math.max(1, Math.floor(durationPieces)),
      hiddenRows: Math.max(1, Math.min(VISIBLE_HEIGHT - 6, Math.floor(hiddenRows))),
    };
    this.lastEvent = { label: "NARROW VISION", detail: "Upper field and Ghost obscured" };
    return true;
  }

  applyEarthquake(affectedRows = 8, intensity = 0.3, assistChance = 0) {
    if (this.status !== "playing" || !this.active) return false;
    const rows = Math.max(4, Math.min(VISIBLE_HEIGHT, Math.floor(affectedRows)));
    const startY = BOARD_HEIGHT - rows;
    const strength = Math.max(0, Math.min(0.65, Number(intensity) || 0));
    const occupied = [];
    for (let y = startY; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        if (this.board[y][x]) occupied.push([x, y]);
      }
    }

    for (let index = occupied.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      [occupied[index], occupied[swapIndex]] = [occupied[swapIndex], occupied[index]];
    }

    const moveBudget = strength > 0 ? Math.max(1, Math.round(occupied.length * strength)) : 0;
    let moved = 0;
    const directions = [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, 1], [-1, -1], [1, -1]];
    for (const [sourceX, sourceY] of occupied.slice(0, moveBudget)) {
      const type = this.board[sourceY][sourceX];
      if (!type) continue;
      const offset = Math.floor(this.random() * directions.length);
      for (let attempt = 0; attempt < directions.length; attempt += 1) {
        const [deltaX, deltaY] = directions[(offset + attempt) % directions.length];
        const targetX = sourceX + deltaX;
        const targetY = sourceY + deltaY;
        if (targetX < 0 || targetX >= BOARD_WIDTH || targetY < startY || targetY >= BOARD_HEIGHT) continue;
        if (this.board[targetY][targetX]) continue;
        this.board[targetY][targetX] = type;
        this.board[sourceY][sourceX] = null;
        moved += 1;
        break;
      }
    }

    // A quake settles downward after the lateral jolt. It cannot lift the stack
    // into the middle of the field, so early casts may even improve a rough build.
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const column = [];
      for (let y = BOARD_HEIGHT - 1; y >= startY; y -= 1) {
        if (this.board[y][x]) column.push(this.board[y][x]);
        this.board[y][x] = null;
      }
      column.forEach((type, index) => {
        this.board[BOARD_HEIGHT - 1 - index][x] = type;
      });
    }

    let assisted = false;
    if (this.random() < Math.max(0, Math.min(1, Number(assistChance) || 0))) {
      for (let targetY = BOARD_HEIGHT - 1; targetY >= startY; targetY -= 1) {
        const gaps = this.board[targetY]
          .map((cell, x) => (cell ? -1 : x))
          .filter((x) => x >= 0);
        if (gaps.length < 1 || gaps.length > 2) continue;
        const donors = [];
        for (let y = startY; y < targetY; y += 1) {
          for (let x = 0; x < BOARD_WIDTH; x += 1) {
            if (this.board[y][x]) donors.push([x, y]);
          }
        }
        if (donors.length < gaps.length) continue;
        gaps.forEach((gapX, index) => {
          const [donorX, donorY] = donors[index];
          this.board[targetY][gapX] = this.board[donorY][donorX];
          this.board[donorY][donorX] = null;
        });
        assisted = true;
        break;
      }
    }

    const clearResult = this.clearLines();
    this.effectId += 1;
    if (clearResult.count > 0) {
      this.lines += clearResult.count;
      this.level = Math.floor(this.lines / 10) + 1;
      this.score += (LINE_POINTS[clearResult.count] || LINE_POINTS[4]) * this.level;
      this.lastEffect = { id: this.effectId, type: "line-clear", rows: clearResult.rows };
      this.lastEvent = { label: "EARTHQUAKE AID", detail: `震动帮助清除了 ${clearResult.count} 行` };
    } else {
      this.lastEffect = { id: this.effectId, type: "earthquake", rows: [], strength };
      this.lastEvent = {
        label: "EARTHQUAKE",
        detail: `${rows} 行范围 · ${moved} 格位移${assisted ? " · 地形被推向完整行" : ""}`,
      };
    }
    return true;
  }

  advanceEffects() {
    for (const [name, effect] of Object.entries(this.effects)) {
      effect.remainingPieces -= 1;
      if (effect.remainingPieces <= 0) delete this.effects[name];
    }
  }

  completeEncounter() {
    if (this.status !== "playing") return false;
    this.status = "victory";
    this.threatColumns = [];
    this.lastEvent = { label: "WARDEN DEFEATED", detail: `${this.piecesLocked} pieces used` };
    return true;
  }

  lockPiece() {
    if (!this.active) return;
    const lockedPiece = { ...this.active };
    const scoreBeforeClear = this.score;
    const tSpin = this.detectTSpin(lockedPiece);
    for (const [x, y] of cellsFor(lockedPiece)) this.board[y][x] = lockedPiece.type;

    const clearResult = this.clearLines();
    const cleared = clearResult.count;
    if (cleared > 0) {
      this.effectId += 1;
      this.lastEffect = {
        id: this.effectId,
        type: "line-clear",
        rows: clearResult.rows,
      };
    }
    const difficult = cleared === 4 || (tSpin && cleared > 0);
    const backToBackBonus = difficult && this.backToBack;
    let base = tSpin ? T_SPIN_POINTS[cleared] : LINE_POINTS[cleared];
    if (backToBackBonus) base *= 1.5;
    if (cleared > 0) {
      this.combo += 1;
      base += Math.max(0, this.combo) * 50;
    } else {
      this.combo = -1;
    }

    if (this.board.every((row) => row.every((cell) => cell === null)) && cleared > 0) {
      base += PERFECT_CLEAR_POINTS[cleared];
    }

    this.score += Math.round(base * this.level);
    this.lines += cleared;
    this.level = Math.floor(this.lines / 10) + 1;
    if (difficult) this.backToBack = true;
    else if (cleared > 0) this.backToBack = false;

    this.piecesLocked += 1;
    this.resolutionId += 1;
    this.lastResolution = {
      id: this.resolutionId,
      piece: lockedPiece.type,
      piecesLocked: this.piecesLocked,
      linesCleared: cleared,
      tSpin,
      difficult,
      combo: this.combo,
      backToBack: this.backToBack,
      backToBackBonus,
      scoreAwarded: this.score - scoreBeforeClear,
    };

    this.lastEvent = this.describeClear(cleared, tSpin);
    this.advanceEffects();
    this.active = null;
    this.canHold = true;
    this.spawn();
  }

  detectTSpin(piece) {
    if (piece.type !== "T" || this.lastAction !== "rotate") return false;
    const centerX = piece.x + 1;
    const centerY = piece.y + 1;
    const corners = [
      [centerX - 1, centerY - 1], [centerX + 1, centerY - 1],
      [centerX - 1, centerY + 1], [centerX + 1, centerY + 1],
    ];
    const occupied = corners.filter(([x, y]) => (
      x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT || this.board[y][x]
    )).length;
    return occupied >= 3;
  }

  clearLines() {
    const rows = [];
    this.board.forEach((row, y) => {
      if (row.every((cell) => cell !== null)) rows.push({ y, cells: [...row] });
    });
    const remaining = this.board.filter((row) => row.some((cell) => cell === null));
    const cleared = BOARD_HEIGHT - remaining.length;
    this.board = [
      ...Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(null)),
      ...remaining,
    ];
    return { count: cleared, rows };
  }

  describeClear(lines, tSpin) {
    if (tSpin) {
      const names = ["T-SPIN", "T-SPIN SINGLE", "T-SPIN DOUBLE", "T-SPIN TRIPLE"];
      return { label: names[lines], detail: this.backToBack ? "Back-to-back active" : "Precision clear" };
    }
    if (lines === 4) return { label: "QUAD CLEAR", detail: this.backToBack ? "Back-to-back active" : "Four lines" };
    if (lines > 0) {
      const names = ["", "SINGLE", "DOUBLE", "TRIPLE"];
      return { label: names[lines], detail: this.combo > 0 ? `${this.combo + 1} clear combo` : "Stack stabilized" };
    }
    return { label: "LOCKED", detail: "Keep building" };
  }
}
