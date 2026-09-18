import { BOARD_WIDTH, HIDDEN_ROWS, VISIBLE_HEIGHT } from "./game.js";
import { cellsFor, PIECES, PIECE_COLORS } from "./pieces.js";

function setupCanvas(canvas, cssWidth, cssHeight) {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.round(cssWidth * ratio);
  const height = Math.round(cssHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function drawBlock(context, x, y, size, color, alpha = 1, ghost = false) {
  const gap = Math.max(1.5, size * 0.065);
  const radius = size * 0.08;
  context.save();
  context.globalAlpha = alpha;
  context.shadowColor = ghost ? "transparent" : "rgba(39, 28, 20, .34)";
  context.shadowBlur = ghost ? 0 : size * 0.16;
  context.shadowOffsetY = ghost ? 0 : size * 0.08;
  context.strokeStyle = color;
  context.lineWidth = ghost ? Math.max(1.5, size * 0.055) : 1;

  context.beginPath();
  context.roundRect(x + gap, y + gap, size - gap * 2, size - gap * 2, radius);
  if (ghost) {
    context.setLineDash([size * 0.18, size * 0.12]);
    context.stroke();
  } else {
    const gradient = context.createLinearGradient(x, y, x, y + size);
    gradient.addColorStop(0, `${color}f2`);
    gradient.addColorStop(1, color);
    context.fillStyle = gradient;
    context.fill();
    context.globalAlpha = alpha * 0.62;
    context.strokeStyle = "rgba(255,239,204,.48)";
    context.stroke();
    context.globalAlpha = alpha * 0.4;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.roundRect(
      x + gap * 2.1,
      y + gap * 1.9,
      size - gap * 4.2,
      Math.max(1.5, size * 0.085),
      size * 0.05,
    );
    context.fill();
  }
  context.restore();
}

export class GameRenderer {
  constructor(boardCanvas, holdCanvas, nextCanvas) {
    this.boardCanvas = boardCanvas;
    this.holdCanvas = holdCanvas;
    this.nextCanvas = nextCanvas;
    this.particles = [];
    this.waves = [];
    this.lastEffectId = 0;
    this.lastFrameTime = performance.now();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  render(game) {
    const bounds = this.boardCanvas.getBoundingClientRect();
    const width = Math.max(220, bounds.width);
    const cell = width / BOARD_WIDTH;
    const height = cell * VISIBLE_HEIGHT;
    const context = setupCanvas(this.boardCanvas, width, height);
    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "rgba(224, 207, 172, 0.98)");
    background.addColorStop(0.55, "rgba(208, 188, 151, 0.98)");
    background.addColorStop(1, "rgba(188, 166, 128, 0.99)");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(54, 40, 30, 0.13)";
    context.lineWidth = 1;
    for (let x = 1; x < BOARD_WIDTH; x += 1) {
      context.beginPath();
      context.moveTo(x * cell, 0);
      context.lineTo(x * cell, height);
      context.stroke();
    }
    for (let y = 1; y < VISIBLE_HEIGHT; y += 1) {
      context.beginPath();
      context.moveTo(0, y * cell);
      context.lineTo(width, y * cell);
      context.stroke();
    }

    this.drawIntentPreview(context, cell, game.intentPreview);

    if (game.threatColumns?.length) {
      context.save();
      for (const column of game.threatColumns) {
        const left = column * cell;
        const warning = context.createLinearGradient(0, 0, 0, height);
        warning.addColorStop(0, "rgba(151, 51, 38, .32)");
        warning.addColorStop(0.32, "rgba(151, 51, 38, .08)");
        warning.addColorStop(1, "rgba(151, 51, 38, .16)");
        context.fillStyle = warning;
        context.fillRect(left + 1, 0, cell - 2, height);
        context.fillStyle = "rgba(111, 36, 29, .82)";
        context.beginPath();
        context.moveTo(left + cell * 0.2, cell * 0.16);
        context.lineTo(left + cell * 0.8, cell * 0.16);
        context.lineTo(left + cell * 0.5, cell * 0.62);
        context.closePath();
        context.fill();
      }
      context.restore();
    }

    game.board.slice(HIDDEN_ROWS).forEach((row, visibleY) => {
      row.forEach((type, x) => {
        if (type) drawBlock(context, x * cell, visibleY * cell, cell, PIECE_COLORS[type]);
      });
    });

    if (game.active) {
      if (!game.effects.narrowVision) {
        const ghost = { ...game.active, y: game.ghostY() };
        for (const [x, y] of cellsFor(ghost)) {
          if (y >= HIDDEN_ROWS) drawBlock(context, x * cell, (y - HIDDEN_ROWS) * cell, cell, PIECE_COLORS[ghost.type], 0.5, true);
        }
      }
      for (const [x, y] of cellsFor(game.active)) {
        if (y >= HIDDEN_ROWS) drawBlock(context, x * cell, (y - HIDDEN_ROWS) * cell, cell, PIECE_COLORS[game.active.type]);
      }
    }

    this.drawStatusEffects(context, cell, game.effects);
    this.captureEffect(game.lastEffect);
    this.drawEffects(context, cell);
    this.renderMini(this.holdCanvas, game.held ? [game.held] : [], 1);
    this.renderMini(this.nextCanvas, game.queue.slice(0, 4), 4);
  }

  drawIntentPreview(context, cell, intent) {
    if (!intent) return;
    const width = cell * BOARD_WIDTH;
    const payload = intent.payload || {};
    context.save();
    context.lineWidth = Math.max(1.5, cell * 0.055);
    context.setLineDash([cell * 0.24, cell * 0.16]);

    if (intent.type === "blindness") {
      const rows = Math.max(1, payload.rows || 6);
      const startRow = Math.max(0, Math.min(VISIBLE_HEIGHT - rows, payload.startRow ?? VISIBLE_HEIGHT - rows));
      context.fillStyle = "rgba(77,39,78,.13)";
      context.strokeStyle = "rgba(130,69,127,.7)";
      context.fillRect(0, startRow * cell, width, rows * cell);
      context.strokeRect(1, startRow * cell + 1, width - 2, rows * cell - 2);
    }

    if (intent.type === "pressure-line") {
      const rows = Math.max(1, payload.rows || 1);
      context.fillStyle = "rgba(141,65,43,.15)";
      context.strokeStyle = "rgba(151,69,42,.66)";
      context.fillRect(0, (VISIBLE_HEIGHT - rows) * cell, width, rows * cell);
      context.strokeRect(1, (VISIBLE_HEIGHT - rows) * cell + 1, width - 2, rows * cell - 2);
    }

    if (intent.type === "narrow-vision") {
      const rows = Math.max(1, payload.hiddenRows || 6);
      context.fillStyle = "rgba(58,48,39,.15)";
      context.strokeStyle = "rgba(122,92,54,.68)";
      context.fillRect(0, 0, width, rows * cell);
      context.strokeRect(1, 1, width - 2, rows * cell - 2);
    }

    if (intent.type === "earthquake") {
      const rows = Math.max(1, payload.affectedRows || 8);
      const top = (VISIBLE_HEIGHT - rows) * cell;
      context.fillStyle = "rgba(151,91,42,.11)";
      context.strokeStyle = "rgba(135,73,36,.62)";
      context.fillRect(0, top, width, rows * cell);
      context.strokeRect(1, top + 1, width - 2, rows * cell - 2);
      context.beginPath();
      context.moveTo(0, top + cell * .45);
      for (let x = 0; x <= BOARD_WIDTH; x += 1) {
        context.lineTo(x * cell, top + cell * (.45 + (x % 2 ? .18 : -.12)));
      }
      context.stroke();
    }

    if (intent.type === "meteor-rush") {
      context.strokeStyle = "rgba(169,66,35,.68)";
      context.setLineDash([]);
      for (let x = 1; x < BOARD_WIDTH; x += 3) {
        context.beginPath();
        context.moveTo(x * cell, cell * .18);
        context.lineTo((x - .55) * cell, cell * 1.05);
        context.stroke();
      }
    }
    context.restore();
  }

  drawStatusEffects(context, cell, effects) {
    context.save();
    if (effects.blindness) {
      const height = effects.blindness.rows * cell;
      const top = effects.blindness.startRow * cell;
      const veil = context.createLinearGradient(0, top, 0, top + height);
      veil.addColorStop(0, "rgba(24,18,21,.72)");
      veil.addColorStop(0.28, "rgba(14,11,15,.94)");
      veil.addColorStop(1, "rgba(5,4,7,.985)");
      context.fillStyle = veil;
      context.fillRect(0, top, cell * BOARD_WIDTH, height);
      context.strokeStyle = "rgba(190,135,180,.32)";
      context.setLineDash([cell * .2, cell * .16]);
      context.strokeRect(1, top + 1, cell * BOARD_WIDTH - 2, height - 2);
    }
    if (effects.narrowVision) {
      const height = effects.narrowVision.hiddenRows * cell;
      const mask = context.createLinearGradient(0, 0, 0, height);
      mask.addColorStop(0, "rgba(7,6,8,.99)");
      mask.addColorStop(.76, "rgba(12,10,12,.95)");
      mask.addColorStop(1, "rgba(12,10,12,.7)");
      context.fillStyle = mask;
      context.fillRect(0, 0, cell * BOARD_WIDTH, height);
      context.fillStyle = "rgba(225,179,102,.62)";
      context.beginPath();
      context.moveTo(cell * 4.7, height - cell * .22);
      context.lineTo(cell * 5.3, height - cell * .22);
      context.lineTo(cell * 5, height - cell * .62);
      context.closePath();
      context.fill();
    }
    context.restore();
  }

  captureEffect(effect) {
    if (!effect) {
      this.lastEffectId = 0;
      return;
    }
    if (effect.id === this.lastEffectId) return;
    this.lastEffectId = effect.id;
    if (effect.type !== "line-clear") return;

    const piecesPerCell = this.reducedMotion ? 2 : 8;
    effect.rows.forEach(({ y, cells }, rowIndex) => {
      const visibleY = y - HIDDEN_ROWS;
      this.waves.push({ y: visibleY + 0.5, life: 1, delay: rowIndex * 0.045 });
      cells.forEach((type, x) => {
        const color = PIECE_COLORS[type];
        for (let index = 0; index < piecesPerCell; index += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.9 + Math.random() * 3.1;
          this.particles.push({
            x: x + 0.5 + (Math.random() - 0.5) * 0.45,
            y: visibleY + 0.5 + (Math.random() - 0.5) * 0.38,
            vx: Math.cos(angle) * speed + (x - 4.5) * 0.08,
            vy: Math.sin(angle) * speed - 1.25,
            size: 0.06 + Math.random() * 0.16,
            life: 0.7 + Math.random() * 0.45,
            maxLife: 1.15,
            color,
            rotation: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 8,
            shard: index % 3 === 0,
          });
        }
      });
    });
  }

  drawEffects(context, cell) {
    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, 0.04);
    this.lastFrameTime = now;

    context.save();
    context.globalCompositeOperation = "screen";
    this.particles = this.particles.filter((particle) => {
      particle.life -= delta;
      if (particle.life <= 0) return false;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 3.1 * delta;
      particle.vx *= 0.986;
      particle.rotation += particle.spin * delta;
      const fade = Math.min(1, particle.life * 2.4);
      const px = particle.x * cell;
      const py = particle.y * cell;
      const size = particle.size * cell;
      context.save();
      context.translate(px, py);
      context.rotate(particle.rotation);
      context.globalAlpha = fade * 0.82;
      context.fillStyle = particle.color;
      context.shadowColor = particle.color;
      context.shadowBlur = size * 2.8;
      if (particle.shard) {
        context.beginPath();
        context.moveTo(-size, size * 0.3);
        context.lineTo(size * 1.25, 0);
        context.lineTo(-size * 0.25, -size * 0.75);
        context.closePath();
        context.fill();
      } else {
        context.beginPath();
        context.arc(0, 0, size, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
      return true;
    });

    this.waves = this.waves.filter((wave) => {
      wave.delay -= delta;
      if (wave.delay > 0) return true;
      wave.life -= delta * 1.8;
      if (wave.life <= 0) return false;
      const progress = 1 - wave.life;
      const gradient = context.createLinearGradient(0, 0, cell * BOARD_WIDTH, 0);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, `rgba(255,255,255,${wave.life * 0.72})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.shadowColor = "rgba(255, 238, 190, .9)";
      context.shadowBlur = cell * 0.6;
      context.fillRect(0, (wave.y - progress * 0.55) * cell, cell * BOARD_WIDTH, cell * (0.12 + progress * 0.7));
      return true;
    });
    context.restore();
  }

  renderMini(canvas, types, slots) {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(80, bounds.width);
    const height = Math.max(64 * slots, bounds.height);
    const context = setupCanvas(canvas, width, height);
    context.clearRect(0, 0, width, height);
    const slotHeight = height / slots;

    types.forEach((type, slot) => {
      const cells = PIECES[type][0];
      const minX = Math.min(...cells.map(([x]) => x));
      const maxX = Math.max(...cells.map(([x]) => x));
      const minY = Math.min(...cells.map(([, y]) => y));
      const maxY = Math.max(...cells.map(([, y]) => y));
      const size = Math.min(22, width / 5, slotHeight / 4);
      const pieceWidth = (maxX - minX + 1) * size;
      const pieceHeight = (maxY - minY + 1) * size;
      const offsetX = (width - pieceWidth) / 2 - minX * size;
      const offsetY = slot * slotHeight + (slotHeight - pieceHeight) / 2 - minY * size;
      cells.forEach(([x, y]) => drawBlock(context, offsetX + x * size, offsetY + y * size, size, PIECE_COLORS[type]));
    });
  }
}
