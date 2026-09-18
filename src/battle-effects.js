export function applyBattleCommand(game, command) {
  if (!game || !command) return false;
  if (command.type === "add-pressure-line") return game.addPressureLines(command.rows, command.gapColumn);
  if (command.type === "add-block-rain") return game.addBlockRain(command.columns, command.blocksPerColumn);
  if (command.type === "apply-blindness") return game.applyBlindness(command.durationPieces, command.rows, command.startRow);
  if (command.type === "apply-meteor-rush") return game.applyMeteorRush(command.pieces, command.interval);
  if (command.type === "apply-narrow-vision") return game.applyNarrowVision(command.durationPieces, command.hiddenRows);
  if (command.type === "apply-earthquake") return game.applyEarthquake(command.affectedRows, command.intensity, command.assistChance);
  return false;
}
