# Boss Encounter Game System

## Field and pieces

- Field: 10 columns × 18 visible rows, plus 2 hidden spawn rows. The shorter combat field improves whole-screen readability and increases spatial pressure without relying on speed.
- Pieces: I, J, L, O, S, T, and Z tetrominoes.
- Randomizer: shuffled seven-bag; every consecutive bag contains each type once.
- Preview: four visible upcoming pieces, with a buffered queue behind them.
- Reserve/Hold: one swap per active piece; re-enabled only after lock. A successful swap grants a 650 ms focus buffer during which gravity pauses but movement, rotation, and drop input remain available.

## Placement

- Battle gravity starts at 900 ms per cell and is multiplied by 0.95 for each level, with a 650 ms floor. It remains secondary to monster skills.
- Soft drop awards 1 point per descended cell.
- Hard drop awards 2 points per descended cell and locks immediately.
- Ground contact starts a 500 ms lock delay.
- A successful grounded move or rotation resets lock delay, capped at 15 resets per piece.
- Rotation uses SRS state definitions and the five wall-kick tests for I and JLSTZ pieces.

The reserve focus buffer deliberately separates the “should I exchange this piece?” decision from the first placement decision for the incoming piece. It is not a general pause: the player must commit the reserve action, it is available only once per piece, and manual input remains active.

## Encounter objective and damage

The encounter lab currently exposes five selectable bosses. Each encounter ends when its configured HP reaches zero. Score still exists as an internal diagnostic value, but it is not the objective and is not presented as the main progression measure.

| Clear | Boss damage |
| --- | ---: |
| Single | 6 |
| Double | 15 |
| Triple | 28 |
| Four-line clear | 48 |
| T-spin single | 24 |
| T-spin double | 44 |
| T-spin triple | 68 |

Combo adds 4 damage per step up to 20. A back-to-back difficult clear multiplies final damage by 1.25.

## Monster skills

- **Stone Rain:** three marked columns are tinted on the board. When its locked-piece countdown reaches zero, one garbage block lands on top of each marked column.
- **Pressure Line:** raises one or two garbage rows from the bottom with a telegraphed gap.
- **Blindness:** previews and then masks a random contiguous band in the middle/lower field. It begins at six rows and grows to at most nine rows across repeated casts while preserving the underlying collision and clear rules.
- **Meteor Rush:** escalates from two pieces at 220 ms per cell to four pieces at 145 ms per cell while retaining normal lock delay and Ghost visibility.
- **Narrow Vision:** masks the upper third of the field and disables Ghost for three locked pieces while leaving the Next queue visible.
- **Earthquake:** begins with a gentle six-row, 16% displacement and grows to a nine-row, 40% displacement. Cells settle downward instead of being lifted, and early casts can complete and clear a nearly finished row.
- Intents count down by locked pieces, never by real time. A warning strip and translucent in-field target preview remain visible throughout the countdown. After the first tutorial encounter, each boss uses only its own signature pressure family.

## Player resource and skill

Focus starts at 3/6. Clears restore Focus equal to the number of lines, with one additional point for a difficult clear. Ward costs 3 Focus, can be armed with `V`, and negates the next incoming monster board effect of any type. It has no separate player-health model.

## Legacy scoring hooks

Level is `floor(total lines / 10) + 1`. Clear points are multiplied by the current level.

| Event | Base points |
| --- | ---: |
| Single | 100 |
| Double | 300 |
| Triple | 500 |
| Four-line clear | 800 |
| T-spin without line clear | 400 |
| T-spin single | 800 |
| T-spin double | 1,200 |
| T-spin triple | 1,600 |

Consecutive difficult clears (four-line clears or line-clearing T-spins) receive a 1.5× back-to-back multiplier. Consecutive line-clearing placements add `50 × combo index × level`. Perfect clears add a line-count-dependent bonus. The current T-spin detector recognizes the three-corner rule; mini/full refinement remains Phase 2 work.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Left / Right | arrow buttons |
| Soft drop | Down | down button |
| Rotate clockwise | Up or X | clockwise button |
| Rotate counter-clockwise | Z | counter-clockwise button |
| Hold | C | hold button |
| Hard drop | Space | hard-drop button |
| Pause | P or Escape | header pause button |
| Ward | V | Ward button |

## Game states

`ready → playing ↔ paused → victory/gameover → ready`

Victory means the boss HP reached zero. Game over means the stack or a monster board effect crossed the spawn boundary. No account, analytics, server, or network connection is used.

Each locked piece also produces a structured resolution event containing piece type, total locked-piece count, cleared lines, T-spin status, difficult-clear status, combo, back-to-back state, whether this clear actually earned the back-to-back bonus, and awarded clear score. Expansion systems can consume this event without changing board rules.

## Feedback system

- Each completed row emits a warm sweep followed by colored shards and light motes derived from the cleared cells.
- Particles rise briefly, disperse, and fall away to evoke a gentle dissolution rather than an explosion.
- A damaging clear now turns the actual cleared row into colored fragments, gathers them at the board edge, and sends them directly toward the boss before the hit reaction and damage number. Multi-line clears increase projectile density and impact weight; the character does not perform the attack.
- Reduced-motion mode lowers the particle count and disables the board pulse animation.
- Movement, rotation, hold, drop, clear, and game-over sounds are generated at runtime with Web Audio oscillators, envelopes, filters, and procedural noise. No sampled audio is downloaded or distributed.
