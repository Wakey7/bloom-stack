import { SoundBoard } from "./audio.js";
import { applyBattleCommand } from "./battle-effects.js";
import { BattleDirector } from "./battle.js";
import { getEncounter } from "./encounters.js";
import { FallingBlockGame, HIDDEN_ROWS, VISIBLE_HEIGHT } from "./game.js";
import { PIECE_COLORS } from "./pieces.js";
import { GameRenderer } from "./renderer.js";

const game = new FallingBlockGame({ gravityMode: "battle" });
const sound = new SoundBoard();
let currentEncounter = getEncounter("cairn-pass");
let battle = new BattleDirector({ enemyHp: currentEncounter.bossHp });
let nextIntentIndex = 0;
let intentUseCounts = {};

function materializeIntent(plan) {
  const payload = { ...(plan.payload || {}) };
  const useIndex = intentUseCounts[plan.type] || 0;
  intentUseCounts[plan.type] = useIndex + 1;
  if (plan.type === "blindness") {
    const growthEvery = Math.max(1, payload.growthEvery || 1);
    payload.rows = Math.min(payload.maxRows || 9, (payload.baseRows || 6) + Math.floor(useIndex / growthEvery));
    if (payload.randomBand) {
      const minimum = Math.max(0, Math.min(VISIBLE_HEIGHT - payload.rows, payload.minStartRow || 0));
      const maximum = VISIBLE_HEIGHT - payload.rows;
      payload.startRow = minimum + Math.floor(game.random() * (maximum - minimum + 1));
    }
  }
  return { ...plan, payload };
}

function queueNextIntent() {
  const plan = currentEncounter.pattern[nextIntentIndex % currentEncounter.pattern.length];
  nextIntentIndex += 1;
  const intent = battle.queueIntent(materializeIntent(plan));
  game.setThreatColumns(intent.type === "block-rain" ? intent.payload.columns : []);
  game.setIntentPreview(intent);
  return intent;
}

queueNextIntent();
const renderer = new GameRenderer(
  document.querySelector("#board"),
  document.querySelector("#hold-canvas"),
  document.querySelector("#next-canvas"),
);

const elements = {
  battleDamage: document.querySelector("#battle-damage"),
  piecesUsed: document.querySelector("#pieces-used"),
  lines: document.querySelector("#lines"),
  eventLabel: document.querySelector("#event-label"),
  eventDetail: document.querySelector("#event-detail"),
  overlay: document.querySelector("#overlay"),
  overlayEyebrow: document.querySelector("#overlay-eyebrow"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayText: document.querySelector("#overlay-text"),
  startButton: document.querySelector("#start-button"),
  pauseButton: document.querySelector("#pause-button"),
  soundButton: document.querySelector("#sound-button"),
  boardFrame: document.querySelector(".board-frame"),
  holdCard: document.querySelector(".hold-card"),
  holdStatus: document.querySelector("#hold-status"),
  battleStage: document.querySelector("#battle-stage"),
  enemyHealth: document.querySelector("#enemy-health"),
  enemyHealthText: document.querySelector("#enemy-health-text"),
  intentName: document.querySelector("#intent-name"),
  intentCountdown: document.querySelector("#intent-countdown"),
  damagePop: document.querySelector("#damage-pop"),
  focusValue: document.querySelector("#focus-value"),
  wardButton: document.querySelector("#ward-button"),
  wardDetail: document.querySelector("#ward-detail"),
  wardState: document.querySelector("#ward-state"),
  encounterSelect: document.querySelector("#encounter-select"),
  enemyName: document.querySelector("#enemy-name"),
  enemyActor: document.querySelector(".enemy-actor"),
  rowAttackLayer: document.querySelector("#row-attack-layer"),
  effectBadges: document.querySelector("#effect-badges"),
  intentWarning: document.querySelector("#intent-warning"),
  boardIntentName: document.querySelector("#board-intent-name"),
  boardIntentCountdown: document.querySelector("#board-intent-countdown"),
};

let previousScore = 0;
let previousLines = 0;
let previousStatus = game.status;
let previousCanHold = game.canHold;
let previousHoldFocus = false;
let previousResolutionId = 0;
let battleBeatRemaining = 0;
let lastTime = performance.now();

function resetBattle() {
  battle.reset();
  nextIntentIndex = 0;
  intentUseCounts = {};
  queueNextIntent();
  previousResolutionId = 0;
  battleBeatRemaining = 0;
  updateBattleInterface();
}

function loadEncounter(id) {
  currentEncounter = getEncounter(id);
  battle = new BattleDirector({ enemyHp: currentEncounter.bossHp });
  game.reset();
  nextIntentIndex = 0;
  intentUseCounts = {};
  previousResolutionId = 0;
  previousScore = 0;
  previousLines = 0;
  previousStatus = game.status;
  battleBeatRemaining = 0;
  queueNextIntent();
  elements.encounterSelect.value = currentEncounter.id;
  elements.rowAttackLayer.replaceChildren();
  updateBattleInterface();
  updateInterface();
}

function updateBattleInterface() {
  const state = battle.snapshot();
  const enemyPercent = Math.max(0, state.enemyHp / battle.initialEnemyHp * 100);
  elements.enemyHealth.style.width = `${enemyPercent}%`;
  elements.enemyHealthText.textContent = `${state.enemyHp} / ${battle.initialEnemyHp}`;
  elements.enemyName.textContent = currentEncounter.name;
  elements.battleDamage.textContent = String(battle.initialEnemyHp - state.enemyHp);
  elements.piecesUsed.textContent = String(state.piecesElapsed);
  elements.focusValue.textContent = `${state.focus} / ${state.focusMax}`;
  elements.wardState.textContent = state.wardArmed ? "护符已展开" : `专注 ${state.focus}/${state.focusMax}`;
  elements.wardButton.disabled = game.status !== "playing" || state.phase !== "active" || state.wardArmed || state.focus < state.wardCost;
  elements.wardButton.classList.toggle("is-armed", state.wardArmed);
  elements.wardDetail.textContent = state.wardArmed
    ? "将抵消下一次怪物技能"
    : state.focus < state.wardCost
      ? `还需 ${state.wardCost - state.focus} 专注`
      : `消耗 ${state.wardCost} 专注，抵消下一次技能`;
  const intent = state.intents[0];
  game.setIntentPreview(intent || null);
  const intentNames = {
    "block-rain": "落石雨",
    "pressure-line": "压迫线",
    blindness: "目盲",
    "meteor-rush": "三轮流星雨",
    "narrow-vision": "缩小视野",
    earthquake: "地震",
  };
  const intentName = intentNames[intent?.type] || "观察中";
  const intentTarget = intent?.type === "block-rain"
    ? ` · ${intent.payload.columns.map((column) => column + 1).join(" / ")} 列`
    : intent?.type === "pressure-line"
      ? ` · 缺口 ${intent.payload.gapColumn + 1} 列`
      : intent?.type === "blindness"
        ? ` · 第 ${intent.payload.startRow + 1}–${intent.payload.startRow + intent.payload.rows} 行`
        : intent?.type === "meteor-rush"
          ? ` · 接下来 ${intent.payload.pieces} 块`
          : intent?.type === "narrow-vision"
            ? ` · 持续 ${intent.payload.durationPieces} 块`
            : intent?.type === "earthquake"
              ? ` · 下部 ${intent.payload.affectedRows} 行`
              : "";
  elements.intentName.textContent = state.phase === "victory" ? "怪物溃散" : intentName;
  elements.intentCountdown.textContent = state.phase === "victory" ? "遭遇结束" : intent ? `${intent.remainingPieces} 个方块后${intentTarget}` : "暂无攻击";
  elements.boardIntentName.textContent = state.phase === "victory" ? "威胁解除" : intentName;
  elements.boardIntentCountdown.textContent = intent ? `${intent.remainingPieces} 块后` : "安全";
  elements.intentWarning.classList.toggle("is-imminent", Boolean(intent && intent.remainingPieces <= 2));
  elements.intentWarning.classList.toggle("is-safe", !intent);
  elements.intentWarning.setAttribute(
    "aria-label",
    intent ? `技能预警：${intentName}，${intent.remainingPieces} 个方块后触发${intentTarget}` : "当前没有怪物技能威胁",
  );
  elements.battleStage.classList.toggle("is-victory", state.phase === "victory");
  elements.battleStage.classList.toggle("ward-active", state.wardArmed);
}

function emitRowAttack(effect, power) {
  if (!effect || effect.type !== "line-clear") return;
  const layoutRect = elements.rowAttackLayer.getBoundingClientRect();
  const boardRect = renderer.boardCanvas.getBoundingClientRect();
  const targetRect = elements.enemyActor.getBoundingClientRect();
  const cellSize = boardRect.height / VISIBLE_HEIGHT;

  effect.rows.forEach((row, rowIndex) => {
    const visibleY = row.y - HIDDEN_ROWS;
    if (visibleY < 0) return;
    const attack = document.createElement("div");
    attack.className = "row-attack";
    const left = boardRect.left - layoutRect.left;
    const top = boardRect.top - layoutRect.top + visibleY * cellSize;
    const targetX = targetRect.left - layoutRect.left + targetRect.width * .72;
    const targetY = targetRect.top - layoutRect.top + targetRect.height * .42;
    const travelX = targetX - (left + boardRect.width);
    const travelY = targetY - (top + cellSize / 2);
    attack.style.left = `${left}px`;
    attack.style.top = `${top}px`;
    attack.style.setProperty("--line-width", `${boardRect.width}px`);
    attack.style.setProperty("--cell-size", `${cellSize}px`);
    attack.style.setProperty("--travel-x", `${travelX}px`);
    attack.style.setProperty("--travel-y", `${travelY}px`);
    attack.style.setProperty("--travel-x-mid", `${travelX * .62}px`);
    attack.style.setProperty("--travel-y-mid", `${travelY * .62}px`);
    attack.style.setProperty("--beam-power", String(Math.min(1.8, .7 + power * .2)));
    attack.style.animationDelay = `${rowIndex * 45}ms`;

    row.cells.forEach((type, index) => {
      const fragment = document.createElement("span");
      fragment.style.setProperty("--cell-left", `${index * 10}%`);
      fragment.style.setProperty("--gather-x", `${(9 - index) * cellSize}px`);
      fragment.style.setProperty("--cell-color", PIECE_COLORS[type] || "#f2c76d");
      fragment.style.animationDelay = `${rowIndex * 45}ms`;
      attack.append(fragment);
    });
    elements.rowAttackLayer.append(attack);
    setTimeout(() => attack.remove(), 760 + rowIndex * 45);
  });
}

function resolveBattleEvent() {
  const resolution = game.lastResolution;
  if (!resolution || resolution.id <= previousResolutionId) return;
  previousResolutionId = resolution.id;
  const outcome = battle.consumeResolution(resolution);
  if (!outcome) return;

  elements.battleStage.classList.remove("player-strike", "enemy-strike", "ward-block");
  void elements.battleStage.offsetWidth;
  if (outcome.damage > 0) {
    elements.damagePop.textContent = `-${outcome.damage}`;
    elements.battleStage.style.setProperty("--beam-power", String(Math.min(2.2, 0.8 + resolution.linesCleared * 0.35)));
    elements.battleStage.classList.add("player-strike");
    emitRowAttack(game.lastEffect, resolution.linesCleared);
    elements.boardFrame.classList.remove("energy-release");
    void elements.boardFrame.offsetWidth;
    elements.boardFrame.classList.add("energy-release");
    sound.attack(resolution.linesCleared);
    battleBeatRemaining = Math.max(battleBeatRemaining, outcome.resolutionBeatMs);
  }

  for (const command of outcome.commands) {
    const defense = battle.interceptCommand(command);
    if (defense.blocked) {
      game.clearThreat("护符抵消了怪物技能");
      elements.battleStage.classList.add("ward-block");
      sound.tone(720, 0.14, 0.035, "sine");
      battleBeatRemaining = Math.max(battleBeatRemaining, 320);
      continue;
    }
    applyBattleCommand(game, command);
    if (command.type === "apply-earthquake") {
      elements.boardFrame.classList.remove("earthquake-hit");
      void elements.boardFrame.offsetWidth;
      elements.boardFrame.classList.add("earthquake-hit");
    }
    elements.battleStage.classList.add("enemy-strike");
    battleBeatRemaining = Math.max(battleBeatRemaining, 420);
  }

  if (outcome.phase === "victory") {
    game.completeEncounter();
    game.clearThreat();
  } else if (outcome.commands.length > 0 && game.status === "playing") {
    queueNextIntent();
  }
  updateBattleInterface();
  updateInterface();
}

function updateInterface() {
  elements.lines.textContent = String(game.lines).padStart(2, "0");
  elements.eventLabel.textContent = game.lastEvent.label;
  elements.eventDetail.textContent = game.lastEvent.detail;
  elements.pauseButton.textContent = game.status === "paused" ? "继续" : "暂停";
  const holdFocus = game.holdFocusRemaining > 0;
  elements.holdStatus.textContent = game.status !== "playing" ? "C" : holdFocus ? "FOCUS" : game.canHold ? "READY" : "USED";
  elements.holdCard.classList.toggle("is-focus", holdFocus);
  elements.holdCard.classList.toggle("is-used", game.status === "playing" && !game.canHold && !holdFocus);
  elements.boardFrame.classList.toggle("is-blind", Boolean(game.effects.blindness));
  elements.boardFrame.classList.toggle("is-rush", Boolean(game.effects.meteorRush));
  elements.boardFrame.classList.toggle("is-narrow", Boolean(game.effects.narrowVision));
  const effectLabels = [];
  if (game.effects.blindness) {
    const { startRow, rows, remainingPieces } = game.effects.blindness;
    effectLabels.push(`目盲 ${startRow + 1}–${startRow + rows}行 · ${remainingPieces}`);
  }
  if (game.effects.meteorRush) effectLabels.push(`流星雨 ${game.effects.meteorRush.remainingPieces}`);
  if (game.effects.narrowVision) effectLabels.push(`窄视 ${game.effects.narrowVision.remainingPieces}`);
  elements.effectBadges.replaceChildren(...effectLabels.map((label) => {
    const badge = document.createElement("span");
    badge.textContent = label;
    return badge;
  }));

  const overlayContent = {
    ready: [`STAGE ${String(currentEncounter.order).padStart(2, "0")}`, currentEncounter.name, currentEncounter.teachingGoal],
    paused: ["CAMPFIRE PAUSE", "暂歇", "整理路线，再继续前行。"],
    gameover: ["THE ROAD CLOSES", "遭遇失败", "堆叠越过了警戒线。"],
    victory: ["ENCOUNTER CLEARED", `${currentEncounter.name}已击败`, `使用 ${game.piecesLocked} 个方块完成遭遇`],
  }[game.status];

  elements.overlay.hidden = !overlayContent;
  if (overlayContent) {
    [elements.overlayEyebrow.textContent, elements.overlayTitle.textContent, elements.overlayText.textContent] = overlayContent;
    elements.startButton.textContent = game.status === "paused" ? "继续游戏" : ["gameover", "victory"].includes(game.status) ? "再次挑战" : "开始游戏";
  }
}

function beginOrResume() {
  if (game.status === "paused") game.togglePause();
  else {
    if (["gameover", "victory"].includes(game.status)) {
      game.reset();
      resetBattle();
    }
    game.start();
  }
  sound.tone(520, 0.08, 0.025, "triangle");
  updateBattleInterface();
  updateInterface();
}

function perform(action) {
  if (action === "start") return beginOrResume();
  if (action === "pause") {
    if (game.status === "playing" || game.status === "paused") game.togglePause();
    updateBattleInterface();
    updateInterface();
    return;
  }
  if (game.status !== "playing") return;
  if (action === "ward") {
    if (battle.armWard()) {
      game.lastEvent = { label: "WARD ARMED", detail: "下一次怪物技能将被抵消" };
      sound.tone(620, 0.12, 0.03, "sine");
    }
    updateBattleInterface();
    updateInterface();
    return;
  }
  if (battleBeatRemaining > 0) return;

  let changed = false;
  if (action === "left") changed = game.move(-1);
  if (action === "right") changed = game.move(1);
  if (action === "down") changed = game.softDrop();
  if (action === "rotate-left") changed = game.rotate(-1);
  if (action === "rotate-right") changed = game.rotate(1);
  if (action === "drop") {
    game.hardDrop();
    sound.drop();
    changed = true;
  }
  if (action === "hold") {
    changed = game.hold();
    if (changed) sound.hold();
  }
  if (changed && ["left", "right", "down"].includes(action)) sound.move();
  if (changed && action.startsWith("rotate")) sound.rotate();
  updateInterface();
}

const keyActions = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowUp: "rotate-right",
  KeyX: "rotate-right",
  KeyZ: "rotate-left",
  KeyC: "hold",
  KeyV: "ward",
  Space: "drop",
  KeyP: "pause",
  Escape: "pause",
  Enter: "start",
};

const repeatable = new Set(["left", "right", "down"]);
document.addEventListener("keydown", (event) => {
  const action = keyActions[event.code];
  if (!action || (event.repeat && !repeatable.has(action))) return;
  event.preventDefault();
  perform(action);
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    perform(button.dataset.action);
  });
});

elements.startButton.addEventListener("click", beginOrResume);
elements.pauseButton.addEventListener("click", () => perform("pause"));
elements.encounterSelect.addEventListener("change", () => {
  loadEncounter(elements.encounterSelect.value);
  sound.tone(480, 0.09, 0.022, "triangle");
});
elements.soundButton.addEventListener("click", () => {
  const enabled = sound.toggle();
  elements.soundButton.textContent = enabled ? "声音：开" : "声音：关";
  elements.soundButton.setAttribute("aria-pressed", String(!enabled));
});

function frame(now) {
  const frameDelta = now - lastTime;
  if (battleBeatRemaining > 0) battleBeatRemaining = Math.max(0, battleBeatRemaining - frameDelta);
  else game.update(frameDelta);
  lastTime = now;
  resolveBattleEvent();

  if (game.score !== previousScore || game.lines !== previousLines) {
    if (game.lines > previousLines) {
      sound.clear(game.lines - previousLines);
      elements.boardFrame.classList.remove("clear-pulse");
      void elements.boardFrame.offsetWidth;
      elements.boardFrame.classList.add("clear-pulse");
    }
    previousScore = game.score;
    previousLines = game.lines;
    updateInterface();
  }

  if (game.status !== previousStatus) {
    if (game.status === "gameover") sound.gameOver();
    if (game.status === "victory") sound.clear(4);
    previousStatus = game.status;
  }
  const holdFocus = game.holdFocusRemaining > 0;
  if (game.canHold !== previousCanHold || holdFocus !== previousHoldFocus) {
    previousCanHold = game.canHold;
    previousHoldFocus = holdFocus;
    updateInterface();
  }
  if (["gameover", "victory"].includes(game.status) && elements.overlay.hidden) updateInterface();
  renderer.render(game);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => renderer.render(game));
updateInterface();
updateBattleInterface();
requestAnimationFrame(frame);
