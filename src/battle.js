const LINE_DAMAGE = [0, 6, 15, 28, 48];
const T_SPIN_DAMAGE = [0, 24, 44, 68];

export const ATTENTION_BUDGET = Object.freeze({
  boardPlacement: 0.55,
  threatResponse: 0.25,
  offensePlanning: 0.15,
  spectacle: 0.05,
});

export function damageForResolution(resolution) {
  if (!resolution || resolution.linesCleared <= 0) return 0;
  const table = resolution.tSpin ? T_SPIN_DAMAGE : LINE_DAMAGE;
  const base = table[resolution.linesCleared] || 0;
  const comboBonus = Math.min(Math.max(0, resolution.combo) * 4, 20);
  const subtotal = base + comboBonus;
  return Math.round(resolution.backToBackBonus ? subtotal * 1.25 : subtotal);
}

export class BattleDirector {
  constructor({ enemyHp = 90, initialFocus = 3, focusMax = 6, wardCost = 3 } = {}) {
    this.initialEnemyHp = enemyHp;
    this.initialFocus = initialFocus;
    this.focusMax = focusMax;
    this.wardCost = wardCost;
    this.reset();
  }

  reset() {
    this.enemyHp = this.initialEnemyHp;
    this.focus = this.initialFocus;
    this.wardArmed = false;
    this.piecesElapsed = 0;
    this.lastResolutionId = 0;
    this.intentSequence = 0;
    this.intents = [];
    this.phase = "active";
    this.lastOutcome = null;
  }

  queueIntent({ type, inPieces = 3, payload = {} }) {
    if (!type) throw new TypeError("An enemy intent requires a type");
    if (!Number.isInteger(inPieces) || inPieces < 1) {
      throw new RangeError("Enemy intent countdown must be a positive whole number");
    }
    this.intentSequence += 1;
    const intent = {
      id: this.intentSequence,
      type,
      remainingPieces: inPieces,
      payload: { ...payload },
    };
    this.intents.push(intent);
    return { ...intent, payload: { ...intent.payload } };
  }

  consumeResolution(resolution) {
    if (!resolution || resolution.id <= this.lastResolutionId) return null;
    if (this.phase !== "active") return null;

    this.lastResolutionId = resolution.id;
    this.piecesElapsed += 1;
    const damage = damageForResolution(resolution);
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    const focusGain = Math.max(0, resolution.linesCleared) + (resolution.difficult ? 1 : 0);
    this.focus = Math.min(this.focusMax, this.focus + focusGain);

    const commands = [];
    if (this.enemyHp === 0) {
      this.phase = "victory";
      this.intents = [];
    } else {
      this.intents = this.intents.filter((intent) => {
        intent.remainingPieces -= 1;
        if (intent.remainingPieces > 0) return true;
        commands.push(this.commandForIntent(intent));
        return false;
      });
    }

    this.lastOutcome = {
      resolutionId: resolution.id,
      damage,
      enemyHp: this.enemyHp,
      focusGain,
      commands,
      phase: this.phase,
      resolutionBeatMs: damage > 0 ? 420 : 180,
    };
    return this.lastOutcome;
  }

  commandForIntent(intent) {
    if (intent.type === "pressure-line") {
      return {
        type: "add-pressure-line",
        rows: intent.payload.rows || 1,
        gapColumn: intent.payload.gapColumn,
        sourceIntentId: intent.id,
      };
    }
    if (intent.type === "block-rain") {
      return {
        type: "add-block-rain",
        columns: [...(intent.payload.columns || [])],
        blocksPerColumn: intent.payload.blocksPerColumn || 1,
        sourceIntentId: intent.id,
      };
    }
    if (intent.type === "blindness") {
      return {
        type: "apply-blindness",
        durationPieces: intent.payload.durationPieces || 3,
        rows: intent.payload.rows || 4,
        startRow: intent.payload.startRow,
        sourceIntentId: intent.id,
      };
    }
    if (intent.type === "meteor-rush") {
      return {
        type: "apply-meteor-rush",
        pieces: intent.payload.pieces || 3,
        interval: intent.payload.interval || 150,
        sourceIntentId: intent.id,
      };
    }
    if (intent.type === "narrow-vision") {
      return {
        type: "apply-narrow-vision",
        durationPieces: intent.payload.durationPieces || 3,
        hiddenRows: intent.payload.hiddenRows || 6,
        sourceIntentId: intent.id,
      };
    }
    if (intent.type === "earthquake") {
      return {
        type: "apply-earthquake",
        affectedRows: intent.payload.affectedRows || 10,
        intensity: intent.payload.intensity ?? 0.3,
        assistChance: intent.payload.assistChance ?? 0,
        sourceIntentId: intent.id,
      };
    }
    return {
      type: "unhandled-intent",
      intentType: intent.type,
      payload: { ...intent.payload },
      sourceIntentId: intent.id,
    };
  }

  armWard() {
    if (this.phase !== "active" || this.wardArmed || this.focus < this.wardCost) return false;
    this.focus -= this.wardCost;
    this.wardArmed = true;
    return true;
  }

  interceptCommand(command) {
    if (!command || !this.wardArmed) return { blocked: false, command };
    if (![
      "add-pressure-line",
      "add-block-rain",
      "apply-blindness",
      "apply-meteor-rush",
      "apply-narrow-vision",
      "apply-earthquake",
    ].includes(command.type)) {
      return { blocked: false, command };
    }
    this.wardArmed = false;
    return { blocked: true, command: null, blockedCommand: command };
  }

  snapshot() {
    return {
      enemyHp: this.enemyHp,
      focus: this.focus,
      focusMax: this.focusMax,
      wardCost: this.wardCost,
      wardArmed: this.wardArmed,
      piecesElapsed: this.piecesElapsed,
      phase: this.phase,
      intents: this.intents.map((intent) => ({ ...intent, payload: { ...intent.payload } })),
    };
  }
}
